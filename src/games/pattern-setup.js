// Resolve selected roster positions against locally enrolled profiles, never based on a face match.
import { validateLobbySelection } from '../game-lobby.js';

export function resolvePatternPlayers(roster,{count,greenId,blueId,extraIds=[],intervalSeconds=30,rounds=5}={}){
  const ids=[greenId,...(count>=2?[blueId]:[]),...(count>2?extraIds.slice(0,count-2):[])];
  if (!Number.isInteger(count) || ids.length!==count) {
    throw new RangeError('Select the requested number of enrolled participants.');
  }
  return validateLobbySelection(roster,{
    gameId:'random-follow-pattern',playerIds:ids,intervalSeconds,rounds
  }).players;
}
