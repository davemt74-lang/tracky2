import {clamp} from './participant-core.js';

export const SPEAKER_ASSOCIATION_STATES=Object.freeze([
 'verified-voice+face-body','verified-voice+body','verified-voice-only',
 'ambiguous-voice','unknown-nearby-participant','unknown-nearby-visitor','unknown-speaker'
]);

function currentTrack(track){
 return Boolean(track&&!['occluded','reacquiring'].includes(track.status));
}
function visualRank(track){
 if(!track)return 0;
 if(track.status==='matched')return 4;
 if(track.status==='body-lock')return 3;
 if(track.status==='occluded')return 2;
 return currentTrack(track)?1:0;
}
function bestMatchingTrack(tracks,participantId){
 const matches=(Array.isArray(tracks)?tracks:[])
  .filter(track=>track?.participantId===participantId)
  .sort((a,b)=>visualRank(b)-visualRank(a)||
    Number(b.similarity||0)-Number(a.similarity||0));
 return matches;
}

export function speakerAssociationLabel(state){
 return ({
  'verified-voice+face-body':'VOICE + FACE/BODY',
  'verified-voice+body':'VOICE + BODY',
  'verified-voice-only':'VOICE ONLY',
  'ambiguous-voice':'AMBIGUOUS VOICE',
  'unknown-nearby-participant':'UNKNOWN · PERSON NEARBY',
  'unknown-nearby-visitor':'UNKNOWN · VISITOR NEARBY',
  'unknown-speaker':'UNKNOWN SPEAKER'
 })[state]||'UNKNOWN SPEAKER';
}

export function resolveSpeakerAssociation({voiceMatch={},roomTracks=[]}={}){
 const tracks=Array.isArray(roomTracks)?roomTracks:[];
 const voiceConfidence=clamp(Number(voiceMatch.similarity||0));
 const voiceMargin=Math.max(0,Number(voiceMatch.margin||0));
 const base={
  participantId:null,participantName:null,trackId:null,
  state:'unknown-speaker',attribution:'unknown',
  associationConfidence:0,voiceConfidence,voiceMargin,
  bodyConfirmed:false,faceConfirmed:false,
  visualStatus:null,visualIdentitySource:null,visualSimilarity:0,
  nearbyParticipantId:null,nearbyParticipantName:null,
  nearbyVisitorId:null,nearbyVisitorLabel:null,
  provenance:Object.freeze([])
 };

 if(voiceMatch.matched&&voiceMatch.participant?.id){
  const participant=voiceMatch.participant;
  const matches=bestMatchingTrack(tracks,participant.id);
  const liveMatches=matches.filter(currentTrack);
  const track=liveMatches.length===1?liveMatches[0]:null;
  let state='verified-voice-only',attribution='voice-only';
  let bodyConfirmed=false,faceConfirmed=false;
  const provenance=['voice-profile-match'];

  if(track?.status==='matched'){
   state='verified-voice+face-body';attribution='voice+body';
   bodyConfirmed=true;faceConfirmed=true;
   provenance.push('live-face-identity','live-body-track');
  }else if(track?.status==='body-lock'){
   state='verified-voice+body';attribution='voice+body';
   bodyConfirmed=true;provenance.push('live-body-continuity');
  }else if(matches.some(item=>item.status==='occluded')){
   provenance.push('visual-memory-not-current');
  }
  if(liveMatches.length>1)provenance.push('visual-duplicate-not-used');

  return Object.freeze({...base,
   participantId:participant.id,participantName:participant.name||null,
   trackId:track?.id||null,state,attribution,
   associationConfidence:voiceConfidence,bodyConfirmed,faceConfirmed,
   visualStatus:track?.status||matches[0]?.status||null,
   visualIdentitySource:track?.identitySource||matches[0]?.identitySource||null,
   visualSimilarity:clamp(Number(track?.similarity??matches[0]?.similarity??0)),
   provenance:Object.freeze(provenance)
  });
 }

 if(voiceMatch.ambiguous){
  return Object.freeze({...base,state:'ambiguous-voice',
   provenance:Object.freeze(['voice-profile-ambiguous'])});
 }

 // A shared microphone gives no direction. Nearby context is shown only when
 // exactly one current public person/visitor exists, and it never becomes speaker ID.
 const current=tracks.filter(currentTrack);
 if(current.length===1){
  const only=current[0];
  if(only.participantId){
   return Object.freeze({...base,state:'unknown-nearby-participant',
    nearbyParticipantId:only.participantId,
    nearbyParticipantName:only.participantName||null,
    provenance:Object.freeze(['speaker-unverified','single-visible-participant-context'])});
  }
  if(only.visitorId){
   return Object.freeze({...base,state:'unknown-nearby-visitor',
    nearbyVisitorId:only.visitorId,nearbyVisitorLabel:only.visitorLabel||null,
    provenance:Object.freeze(['speaker-unverified','single-visible-visitor-context'])});
  }
 }
 return Object.freeze({...base,provenance:Object.freeze(['speaker-unverified'])});
}

export function speakerAssociationTurnFields(association){
 const a=association||resolveSpeakerAssociation();
 return Object.freeze({
  associationState:a.state,
  associationConfidence:a.associationConfidence,
  associationProvenance:Array.from(a.provenance||[]),
  bodyConfirmed:Boolean(a.bodyConfirmed),
  faceConfirmed:Boolean(a.faceConfirmed),
  visualStatus:a.visualStatus||null,
  visualIdentitySource:a.visualIdentitySource||null,
  visualSimilarity:Number(a.visualSimilarity||0)
 });
}

export class SpeakerAssociationTracker{
 constructor(){this.last=null;}
 reset(){this.last=null;}
 observe(association,at=Date.now()){
  if(!association)return null;
  const previous=this.last;
  this.last=association;
  if(!previous)return Object.freeze({
   changed:true,type:association.participantId?'speaker-verified':'speaker-unverified',
   fromState:null,toState:association.state,at
  });
  let type=null;
  if(previous.participantId&&association.participantId&&
     previous.participantId!==association.participantId)type='speaker-handoff';
  else if(previous.participantId&&!association.participantId)type='speaker-became-unverified';
  else if(!previous.participantId&&association.participantId)type='speaker-verified';
  else if(previous.participantId===association.participantId&&
     previous.trackId&&association.trackId&&previous.trackId!==association.trackId)
    type='visual-track-handoff';
  else if(previous.state!==association.state)type='evidence-transition';
  if(!type)return null;
  return Object.freeze({changed:true,type,fromState:previous.state,toState:association.state,at});
 }
 snapshot(){return this.last;}
}
