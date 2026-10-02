import { createRepDetector, recordRepSample, resetRepDetector, nextZone, randomIntInclusive } from '../gameplay-core.js';
import { zoneForY } from '../movement-core.js';
import { GAME_SETTINGS } from '../game-platform.js';

export const FOLLOW_PATTERN_ID = 'random-follow-pattern';
export const FOLLOW_INTERVALS = GAME_SETTINGS.intervals;
export const FOLLOW_ROUND_COUNTS = GAME_SETTINGS.rounds;
export const FOLLOW_ZONE_COUNT = GAME_SETTINGS.boardZones;
export const FOLLOW_REPS = Object.freeze({ min: 3, max: 6 });

export function validatePatternSetup({ players, intervalSeconds, rounds } = {}) {
  if (!Array.isArray(players) || players.length < 1 || players.length > 2 ||
      !FOLLOW_INTERVALS.includes(intervalSeconds) || !FOLLOW_ROUND_COUNTS.includes(rounds)) {
    throw new RangeError('Select 1–2 enrolled players, a supported interval, and 5/10/15/20 rounds.');
  }
  const colors = ['green','blue'];
  const known = new Set();
  const safe = players.map((player, index) => {
    if (!player || typeof player.participantId !== 'string' ||
        !player.participantId.trim() || known.has(player.participantId) ||
        player.color !== colors[index] || typeof player.name !== 'string' || !player.name.trim()) {
      throw new TypeError('Use distinct enrolled participants in green, then blue order.');
    }
    known.add(player.participantId);
    return Object.freeze({
      participantId: player.participantId,
      color: player.color,
      name: player.name.trim().slice(0, 80)
    });
  });
  return Object.freeze({ players: Object.freeze(safe), intervalSeconds, rounds });
}

export function createRandomFollowPattern({ players, intervalSeconds=30, rounds=5, random=Math.random } = {}) {
  const config = validatePatternSetup({ players, intervalSeconds, rounds });
  if (typeof random !== 'function') throw new TypeError('Expected random function.');
  const internal = config.players.map(p=>({
    ...p, targetsCompleted:0, repsCompleted:0, roundsPlayed:0, detector:createRepDetector()
  }));
  let status='ready',roundIndex=-1,roundDeadline=null,lastTimestamp=null;
  let activeZone=null,repsRemaining=0,roundTargets=0,previousZone=null,turnStartedAt=null;
  let roundHistory=[],lastEvent='ready',trackingPresent=false;

  function rand() {
    const n=random();
    if (!Number.isFinite(n) || n<0 || n>=1) throw new RangeError('Random source must return [0, 1).');
    return ()=>n;
  }
  function chooseTarget() {
    activeZone=nextZone(previousZone,rand(),FOLLOW_ZONE_COUNT);
    previousZone=activeZone;
    repsRemaining=randomIntInclusive(FOLLOW_REPS.min,FOLLOW_REPS.max,rand());
    resetRepDetector(internal[roundIndex % internal.length].detector);
    trackingPresent=false;
    lastTimestamp=null;
    lastEvent='target-start';
  }
  function startRound(at) {
    turnStartedAt=at;
    roundDeadline=at+config.intervalSeconds*1000;
    roundTargets=0;
    internal[roundIndex % internal.length].roundsPlayed++;
    chooseTarget();
    lastEvent='round-start';
  }
  function finishRound() {
    const p=internal[roundIndex % internal.length];
    resetRepDetector(p.detector);
    roundHistory.push(Object.freeze({
      round:roundIndex+1,color:p.color,targets:roundTargets,
      intervalSeconds:config.intervalSeconds
    }));
    trackingPresent=false;
    lastTimestamp=null;
  }
  function nowValid(now){return Number.isFinite(now)&&now>=0;}
  function snapshot(now=turnStartedAt ?? 0) {
    const remainingMs=status==='running'?
      Math.max(0,roundDeadline-Math.max(turnStartedAt,Number.isFinite(now)?now:turnStartedAt)):0;
    const p=status==='running'?internal[roundIndex%internal.length]:null;
    return Object.freeze({
      id:FOLLOW_PATTERN_ID,status,active:status==='running',
      activeColor:p?.color??null,activeParticipantId:p?.participantId??null,
      round:roundIndex+1,totalRounds:config.rounds,roundsCompleted:roundHistory.length,
      intervalSeconds:config.intervalSeconds,remainingMs,
      zoneCount:FOLLOW_ZONE_COUNT,activeZone:status==='running'?activeZone:null,
      repsRemaining:status==='running'?repsRemaining:0,
      roundTargets:status==='running'?roundTargets:0,
      lastEvent,trackingPresent,
      players:Object.freeze(internal.map(x=>Object.freeze({
        participantId:x.participantId,color:x.color,name:x.name,score:x.targetsCompleted,
        repsCompleted:x.repsCompleted,roundsPlayed:x.roundsPlayed
      }))),
      roundHistory:Object.freeze(roundHistory.slice())
    });
  }
  function tick(now) {
    if(!nowValid(now))return {type:'invalid-timestamp'};
    if(status!=='running')return {type:'inactive'};
    if(now<turnStartedAt)return {type:'stale-timestamp'};
    let advanced=0;
    // Deadlines derive from scheduled timestamps, never from frame arrival;
    // large background-tab gaps consume elapsed rounds instead of adding free time.
    while(status==='running' && now>=roundDeadline){
      const at=roundDeadline;
      finishRound();
      advanced++;
      if(roundHistory.length>=config.rounds){
        status='completed';roundDeadline=null;activeZone=null;
        lastEvent='game-complete';break;
      }
      roundIndex++;
      startRound(at);
    }
    return {type:status==='completed'?'game-complete':advanced?'round-advanced':'tracking',
      advanced,activeColor:status==='running'?internal[roundIndex%internal.length].color:null};
  }
  return Object.freeze({
    start(now) {
      if(status==='running')return {type:'already-active'};
      if(!nowValid(now))return {type:'invalid-timestamp'};
      internal.forEach(p=>{p.targetsCompleted=0;p.repsCompleted=0;p.roundsPlayed=0;resetRepDetector(p.detector);});
      roundHistory=[];roundIndex=0;previousZone=null;status='running';
      startRound(now);
      return {type:'game-start',activeColor:internal[0].color};
    },
    tick,
    sample(color,input) {
      if(status!=='running')return {type:'inactive'};
      if(!input || !nowValid(input.timestamp))return {type:'invalid-input'};
      const advance=tick(input.timestamp);
      if(advance.type==='game-complete')return advance;
      if(advance.type==='stale-timestamp')return advance;
      const p=internal[roundIndex%internal.length];
      if(color!==p.color)return {type:'not-your-turn'};
      if(!Number.isFinite(input.x)||!Number.isFinite(input.y)||
          input.x<0||input.x>1||input.y<0||input.y>1)return {type:'invalid-input'};
      if(lastTimestamp!==null && input.timestamp<=lastTimestamp)return {type:'stale-input'};
      lastTimestamp=input.timestamp;
      trackingPresent=true;
      const zone=zoneForY(input.y,FOLLOW_ZONE_COUNT);
      if(zone!==activeZone){
        resetRepDetector(p.detector);
        lastEvent='outside-zone';
        return {type:'outside-zone',zone};
      }
      if(!recordRepSample(p.detector,input.y)){
        lastEvent='tracking';
        return {type:'tracking',zone};
      }
      repsRemaining--;
      p.repsCompleted++;
      if(repsRemaining>0){
        lastEvent='rep';
        return {type:'rep',zone,repsRemaining};
      }
      p.targetsCompleted++;
      roundTargets++;
      const finishedZone=activeZone;
      chooseTarget();
      return {type:'target-complete',finishedZone,score:p.targetsCompleted,
        nextZone:activeZone,repsRemaining};
    },
    signalLost(color) {
      if(status!=='running')return {type:'inactive'};
      const p=internal[roundIndex%internal.length];
      if(p.color!==color)return {type:'not-your-turn'};
      if(!trackingPresent)return {type:'already-lost'};
      resetRepDetector(p.detector);trackingPresent=false;lastTimestamp=null;
      lastEvent='signal-lost';
      return {type:'signal-lost'};
    },
    stop(now) {
      if(status!=='running')return {type:'inactive'};
      if(!nowValid(now))return {type:'invalid-timestamp'};
      tick(now);
      if(status==='completed')return {type:'game-complete'};
      resetRepDetector(internal[roundIndex%internal.length].detector);
      status='stopped';trackingPresent=false;activeZone=null;lastEvent='stopped';
      return {type:'stopped'};
    },
    snapshot
  });
}

export const randomFollowPatternGame = Object.freeze({
  id:FOLLOW_PATTERN_ID,
  title:'Random Follow Pattern',
  description:'Follow randomly selected four-zone rep targets during timed player rounds.',
  createSession:createRandomFollowPattern
});
