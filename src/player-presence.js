// Read-only, non-authoritative participant/marker evidence for manually assigned players.
// This module never chooses or reassigns a player's color and never grants scoring permission.
const FRESH_MS = 1500;
const OCCLUSION_MS = 6000;
export function playerPresenceEvidence(participantId, tracks, marker, now, voiceReady = false) {
  if (typeof participantId !== 'string' || !participantId) return Object.freeze({
    presence:'not-assigned', marker:'unverified', voiceReady:false
  });
  const candidates = (Array.isArray(tracks) ? tracks : []).filter(t =>
    t && t.participantId === participantId && t.status !== 'reacquiring');
  const recent = t => Math.max(Number(t.lastBodySeenAt ?? -Infinity),
    Number(t.lastFaceSeenAt ?? -Infinity), Number(t.lastSeenAt ?? -Infinity));
  candidates.sort((a,b)=>recent(b)-recent(a));
  const own = candidates[0] || null;
  const faceFresh = own && own.status !== 'occluded' && Number.isFinite(own.lastFaceSeenAt) &&
    now - own.lastFaceSeenAt >= 0 && now - own.lastFaceSeenAt <= FRESH_MS;
  const bodyFresh = own && own.status !== 'occluded' && Number.isFinite(own.lastBodySeenAt) &&
    now - own.lastBodySeenAt >= 0 && now - own.lastBodySeenAt <= FRESH_MS;
  const remembered = own && Number.isFinite(recent(own)) &&
    now - recent(own) >= 0 && now - recent(own) <= OCCLUSION_MS;
  const presence = faceFresh ? 'face-observed' :
    bodyFresh ? 'body-tracked' : remembered ? 'temporarily-occluded' : 'not-visible';

  const near = (t) => {
    if (!marker || !Number.isFinite(marker.x) || !Number.isFinite(marker.y) ||
        !t || !t.box || t.status === 'occluded' ||
        !Number.isFinite(t.lastBodySeenAt) ||
        now - t.lastBodySeenAt < 0 || now - t.lastBodySeenAt > FRESH_MS) return false;
    const box=t.box;
    if (![box.x,box.y,box.width,box.height].every(Number.isFinite)) return false;
    const dx=Math.max(box.x-marker.x,0,marker.x-(box.x+box.width));
    const dy=Math.max(box.y-marker.y,0,marker.y-(box.y+box.height));
    return Math.hypot(dx,dy) <= .06;
  };
  const nearOthers = (Array.isArray(tracks) ? tracks : [])
    .filter(t=>t?.participantId && t.participantId !== participantId && near(t));
  const markerRelation = near(own) && !nearOthers.length ? 'near-assigned-body' :
    near(own) && nearOthers.length ? 'ambiguous-proximity' : 'unverified';
  return Object.freeze({ presence, marker:markerRelation, voiceReady:Boolean(voiceReady) });
}
