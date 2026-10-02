// Standalone game lobby. The host game page still owns webcam, voice and gameplay.
import { listParticipants } from './src/participant-store.js';
import { createGamePlatform } from './src/game-platform.js';
import { randomFollowPatternGame } from './src/games/random-follow-pattern.js';
import { reactionChallengeGame } from './src/games/reaction-challenge.js';
import {
 LOBBY_TICKET_KEY,validateLobbySelection,makeLobbyTicket,roundRosterPreview
} from './src/game-lobby.js';

const $=selector=>document.querySelector(selector);
const ui={
  game:$('#lobbyGame'),count:$('#lobbyPlayerCount'),interval:$('#lobbyInterval'),
  rounds:$('#lobbyRounds'),players:$('#lobbyPlayers'),preview:$('#lobbyPreview'),
  status:$('#lobbyStatus'),start:$('#lobbyStart'),settings:$('#patternLobbySettings'),
  gameSummary:$('#lobbyGameSummary')
};
const games=createGamePlatform();
games.register(randomFollowPatternGame);
games.register(reactionChallengeGame);
let roster=[];
let picks=[];

function playerOption(person) {
  const option=document.createElement('option');
  option.value=person.id;
  option.textContent=person.name || person.nickname || 'Enrolled participant';
  return option;
}
function renderPlayers() {
  const count=Number(ui.count.value);
  const old=picks.slice();
  picks=Array.from({length:count},(_,i)=>old[i]||'');
  ui.players.replaceChildren();
  for(let i=0;i<count;i++){
    const label=document.createElement('label');
    label.textContent='Player '+(i+1);
    const select=document.createElement('select');
    select.dataset.position=String(i);
    select.setAttribute('aria-label','Enrolled participant for player '+(i+1));
    const empty=document.createElement('option');
    empty.value='';empty.textContent='Choose an enrolled participant…';
    select.append(empty);
    for (const person of roster) select.append(playerOption(person));
    select.value=roster.some(p=>p.id===picks[i])?picks[i]:'';
    label.append(select);
    ui.players.append(label);
  }
}
function choices() {
  return {
    gameId:ui.game.value,
    playerIds:picks.slice(0,Number(ui.count.value)),
    intervalSeconds:Number(ui.interval.value),
    rounds:Number(ui.rounds.value)
  };
}
function renderPreview() {
  const pattern=['random-follow-pattern','reaction-challenge'].includes(ui.game.value);
  ui.settings.hidden=!pattern;
  ui.status.textContent='';
  ui.preview.replaceChildren();
  ui.start.textContent=pattern?'Go to game setup':'Open classic game';
  if(!pattern){
    ui.gameSummary.textContent=ui.game.value==='solo'?
      'Original classic solo game with one green controller.':
      'Original classic two-player game with individual green and blue markers.';
    const p=document.createElement('p');p.textContent='Select enrolled participants and game settings on the classic game screen.';
    ui.preview.append(p);
    return;
  }
  ui.gameSummary.textContent=ui.game.value==='reaction-challenge' ?
    'React to highlighted zones as quickly as possible. Move outside, then enter the target to score a timed hit.':
    'Follow random zone targets on one shared four-section board. Each interval is one timed round.';
  try {
    const valid=validateLobbySelection(roster,choices());
    const info=document.createElement('p');
    info.textContent=valid.players.length+' players · '+valid.rounds+' rounds · '+
      valid.intervalSeconds+' seconds per turn · '+Math.round(valid.totalSeconds/60*10)/10+
      ' minutes total (not including setup)';
    ui.preview.append(info);
    const rule=document.createElement('p');
    rule.textContent=valid.controllerMode==='shared-green'?
      'Pass the same green marker at each round change. Marker possession is manually assigned, not biometrically verified.':
      'Green and blue use separate assigned markers. Only the current player can score.';
    ui.preview.append(rule);
    const list=document.createElement('ol');
    for(const round of roundRosterPreview(valid)){
      const li=document.createElement('li');
      li.textContent='Round '+round.round+': '+round.name+' · '+round.intervalSeconds+
        ' seconds · '+round.color+' marker';
      list.append(li);
    }
    ui.preview.append(list);
  } catch(error) {
    const line=document.createElement('p');
    line.textContent=roster.length===0?
      'No enrolled participants are available. Enroll players before starting.':
      error.message;
    ui.preview.append(line);
  }
}
ui.game.addEventListener('change',renderPreview);
ui.count.addEventListener('change',()=>{renderPlayers();renderPreview();});
ui.interval.addEventListener('change',renderPreview);
ui.rounds.addEventListener('change',renderPreview);
ui.players.addEventListener('change',event=>{
  if(event.target.tagName!=='SELECT')return;
  picks[Number(event.target.dataset.position)]=event.target.value;
  renderPreview();
});
ui.start.addEventListener('click',()=>{
  if(ui.game.value==='solo'||ui.game.value==='multiplayer'){
    const mode=ui.game.value;
    window.location.assign('./vertical-motion.html?mode='+encodeURIComponent(mode));
    return;
  }
  try {
    const valid=validateLobbySelection(roster,choices());
    // Store IDs only in one-time same-tab handoff, never URL parameters.
    window.sessionStorage.setItem(LOBBY_TICKET_KEY,makeLobbyTicket(valid));
    window.location.assign('./vertical-motion.html');
  } catch(error){
    ui.status.textContent=error.message;
  }
});
try {
  roster=await listParticipants();
  roster=roster.filter(person=>person && typeof person.id==='string' && person.id);
  ui.status.textContent=roster.length?roster.length+' enrolled participants available.':
    'Enroll participants to set up a timed game.';
} catch {
  ui.status.textContent='Local participant storage is unavailable. Check browser storage permissions.';
}
renderPlayers();
renderPreview();
