// Reaction Challenge uses the same normalized samples, four-zone board and player roster.
// Each target must be entered afresh from OUTSIDE after marker stabilization.
import { nextZone } from '../gameplay-core.js';
import { zoneForY } from '../movement-core.js';
import { validatePatternSetup } from './random-follow-pattern.js';

export const REACTION_GAME_ID='reaction-challenge';
export function createReactionChallenge({players,intervalSeconds=30,rounds=5,random=Math.random}={}){
 const config=validatePatternSetup({players,intervalSeconds,rounds});
 if(rounds<config.players.length)throw new RangeError('Provide at least one round per participant.');
 if(typeof random!=='function')throw new TypeError('Expected random function.');
 const progress=config.players.map(p=>({...p,hits:0,misses:0,roundsPlayed:0,totalMs:0,bestMs:null}));
 let status='ready',index=-1,deadline=null,startAt=null,targetAt=null,zone=null,previous=null;
 let armed=false,tracking=false,lastTime=null,lastZone=null,history=[],roundHits=0,roundMisses=0,roundTime=0,lastEvent='ready';
 function target(at){
   const value=random();
   if(!Number.isFinite(value)||value<0||value>=1)throw new RangeError('Random source must return [0, 1).');
   zone=nextZone(previous,()=>value,4);previous=zone;
   targetAt=at;armed=false;tracking=false;lastZone=null;lastEvent='target-start';
 }
 function startRound(at){
   startAt=at;deadline=at+config.intervalSeconds*1000;roundHits=0;roundMisses=0;roundTime=0;lastTime=null;
   progress[index%progress.length].roundsPlayed++;
   target(at);lastEvent='round-start';
 }
 function finishRound(){
   const p=progress[index%progress.length];
   history.push(Object.freeze({
     round:index+1,participantId:p.participantId,color:p.color,
     hits:roundHits,misses:roundMisses,meanReactionMs:roundHits?Math.round(roundTime/roundHits):null,
     intervalSeconds:config.intervalSeconds
   }));
   armed=false;tracking=false;lastTime=null;
 }
 function valid(t){return Number.isFinite(t)&&t>=0;}
 function snapshot(now=startAt??0){
   const p=status==='running'?progress[index%progress.length]:null;
   return Object.freeze({
     id:REACTION_GAME_ID,status,active:status==='running',
     activeColor:p?.color??null,activeParticipantId:p?.participantId??null,
     activePlayerIndex:p?index%progress.length:null,round:index+1,totalRounds:config.rounds,
     roundsCompleted:history.length,intervalSeconds:config.intervalSeconds,
     remainingMs:status==='running'?Math.max(0,deadline-Math.max(startAt,valid(now)?now:startAt)):0,
     zoneCount:4,activeZone:status==='running'?zone:null,repsRemaining:status==='running'?1:0,
     roundTargets:status==='running'?roundHits:0,armed,lastEvent,trackingPresent:tracking,
     players:Object.freeze(progress.map(x=>Object.freeze({
       participantId:x.participantId,name:x.name,color:x.color,score:x.hits,
       roundsPlayed:x.roundsPlayed,repsCompleted:x.hits,misses:x.misses,
       accuracyPct:x.hits+x.misses?Math.round(100*x.hits/(x.hits+x.misses)):null,
       bestReactionMs:x.bestMs,averageReactionMs:x.hits?Math.round(x.totalMs/x.hits):null
     }))),
     roundHistory:Object.freeze(history.slice())
   });
 }
 function tick(now){
   if(!valid(now))return {type:'invalid-timestamp'};
   if(status!=='running')return {type:'inactive'};
   if(now<startAt)return {type:'stale-timestamp'};
   let advanced=0;
   while(status==='running'&&now>=deadline){
     const at=deadline;finishRound();advanced++;
     if(history.length>=config.rounds){
       status='completed';deadline=null;zone=null;lastEvent='game-complete';break;
     }
     index++;startRound(at);
   }
   return {type:status==='completed'?'game-complete':advanced?'round-advanced':'tracking',
     advanced,activeColor:status==='running'?progress[index%progress.length].color:null};
 }
 return Object.freeze({
   start(now){
     if(status==='running')return {type:'already-active'};
     if(!valid(now))return {type:'invalid-timestamp'};
     progress.forEach(p=>{p.hits=0;p.misses=0;p.roundsPlayed=0;p.totalMs=0;p.bestMs=null;});
     history=[];index=0;previous=null;status='running';startRound(now);
     return {type:'game-start',activeColor:progress[0].color};
   },
   tick,
   sample(color,input){
     if(status!=='running')return {type:'inactive'};
     if(!input||!valid(input.timestamp))return {type:'invalid-input'};
     const advance=tick(input.timestamp);
     if(advance.type==='game-complete'||advance.type==='stale-timestamp')return advance;
     const p=progress[index%progress.length];
     if(color!==p.color)return {type:'not-your-turn'};
     if(!Number.isFinite(input.x)||!Number.isFinite(input.y)||
        input.x<0||input.x>1||input.y<0||input.y>1)return {type:'invalid-input'};
     if(lastTime!==null&&input.timestamp<=lastTime)return {type:'stale-input'};
     lastTime=input.timestamp;tracking=true;
     const atZone=zoneForY(input.y,4);
     if(atZone!==zone){
       if(armed && lastZone!==null && atZone!==lastZone){
         p.misses++;roundMisses++;
       }
       lastZone=atZone;armed=true;lastEvent='armed';return {type:'armed'};
     }
     if(!armed){lastEvent='needs-exit';return {type:'needs-exit'};}
     const reactionMs=Math.max(0,Math.round(input.timestamp-targetAt));
     p.hits++;p.totalMs+=reactionMs;
     p.bestMs=p.bestMs===null?reactionMs:Math.min(reactionMs,p.bestMs);
     roundHits++;roundTime+=reactionMs;
     const hitZone=zone;target(input.timestamp);
     return {type:'hit',zone:hitZone,reactionMs,score:p.hits,nextZone:zone};
   },
   signalLost(color){
     if(status!=='running')return {type:'inactive'};
     if(color!==progress[index%progress.length].color)return {type:'not-your-turn'};
     if(!tracking&&!armed)return {type:'already-lost'};
     tracking=false;armed=false;lastTime=null;lastZone=null;lastEvent='signal-lost';
     return {type:'signal-lost'};
   },
   stop(now){
     if(status!=='running')return {type:'inactive'};
     if(!valid(now))return {type:'invalid-timestamp'};
     tick(now);if(status==='completed')return {type:'game-complete'};
     status='stopped';zone=null;armed=false;tracking=false;lastEvent='stopped';
     return {type:'stopped'};
   },
   snapshot
 });
}
export const reactionChallengeGame=Object.freeze({
 id:REACTION_GAME_ID,title:'Reaction Challenge',
 description:'Move outside and then into the highlighted zone as quickly as possible in timed player rounds.',
 createSession:createReactionChallenge
});
