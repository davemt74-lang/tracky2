// Ephemeral room-visitor IDs. Observations must mature before a track can be
// presented as a visitor. Track IDs are internal and never become visitor names.
export const VISITOR_MIN_OBSERVATIONS=4;
export const VISITOR_MIN_AGE_MS=1650;
export const VISITOR_GRACE_MS=3600;
export function eligibleVisitor(track,now){
 if(!track||track.participantId||!track.id||!Number.isFinite(now)||
    !Number.isFinite(track.firstSeenAt)||now-track.firstSeenAt<VISITOR_MIN_AGE_MS||
    Number(track.bodyObservations||0)<VISITOR_MIN_OBSERVATIONS||
    now-(track.lastBodySeenAt??track.lastSeenAt??0)>VISITOR_GRACE_MS)return false;
 const face=Boolean(track.face?.box)&&Number(track.quality||0)>=.5;
 // Only persist a new public visitor after a stable usable face AND body track.
 // A moving shadow or poster with repeated body-like boxes isn't a visitor.
 return face && Number(track.bodyScore||0)>=.57;
}
export function createVisitorSession(){
 return {next:1,byTrack:new Map(),records:new Map(),promotion:new Map()};
}
export function visitorForTrack(session,trackId){
 const id=session?.byTrack?.get(trackId);
 return id?session.records.get(id)||null:null;
}
export function reconcileVisitors(session,tracks,now){
 const events=[];
 for(const track of Array.isArray(tracks)?tracks:[]){
  if(!track?.id)continue;
  let visitor=visitorForTrack(session,track.id);
  if(track.participantId){
   if(visitor&&!visitor.participantId){
    visitor={...visitor,participantId:track.participantId,
      participantName:track.participantName||null,matchedAt:now,lastSeenAt:now};
    session.records.set(visitor.id,visitor);
    session.promotion.set(visitor.id,track.participantId);
    events.push({type:'promoted',visitor,track});
   }
   continue;
  }
  if(visitor){
   session.records.set(visitor.id,{...visitor,lastSeenAt:now});
   continue;
  }
  if(!eligibleVisitor(track,now))continue;
  const id='visitor-'+session.next++;
  visitor={id,label:'Visitor '+(session.next-1),firstSeenAt:track.firstSeenAt,
    lastSeenAt:now,trackId:track.id,participantId:null,participantName:null};
  session.byTrack.set(track.id,id);session.records.set(id,visitor);
  events.push({type:'arrived',visitor,track});
 }
 // Suppress departed visitor cards. Retain their session history for future
 // conversion if that same persistent body track is reacquired.
 return events;
}
export function visibleVisitors(session,tracks,now){
 const result=[];const seen=new Set();
 for(const track of Array.isArray(tracks)?tracks:[]){
  const visitor=visitorForTrack(session,track?.id);
  if(!visitor||visitor.participantId||seen.has(visitor.id)||
     now-(track.lastBodySeenAt??track.lastSeenAt??0)>VISITOR_GRACE_MS)continue;
  seen.add(visitor.id);result.push({visitor,track});
 }
 return result;
}
export function visitorDisplayName(session,id){
 const visitor=session.records.get(id);
 return visitor?.participantName ?
   visitor.participantName+' (formerly '+visitor.label+')':
   visitor?.label||null;
}
export function upgradeVisitorTimeline(history,visitorId,participant){
 if(!visitorId||!participant?.id)return history.slice();
 return history.map(event=>event.participantId===visitorId?
  {...event,participantId:participant.id,name:participant.name,
    detail:(event.detail?event.detail+' · ':'')+'originally '+visitorId,
    source:'visitor-observation'}:event);
}
export function associateVisitorTurn(turn,visitor){
 if(!visitor||turn.participantId||turn.visitorId)return turn;
 return {...turn,visitorId:visitor.id,visitorLabel:visitor.label,
   speakerAssociation:'nearby-visitor-unverified'};
}
export function promoteVisitorTurn(turn,visitor,participant){
 if(!visitor||turn.visitorId!==visitor.id||!participant?.id)return turn;
 // Keep unknown-speaker attribution: nearby person is not proof of speaker.
 return {...turn,nearbyParticipantIds:Array.from(new Set([...(turn.nearbyParticipantIds||[]),participant.id])),
   nearbyParticipantNames:Array.from(new Set([...(turn.nearbyParticipantNames||[]),participant.name])),
   visitorMatchId:participant.id,visitorMatchName:participant.name,
   speakerAssociation:'nearby-identified-person-unverified'};
}
