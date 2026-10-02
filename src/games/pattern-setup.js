// Bind game participants to existing enrolled profiles; never accept arbitrary UI names as identity.
export function resolvePatternPlayers(roster, {count,greenId,blueId} = {}) {
  if (!Array.isArray(roster) || ![1,2].includes(count)) {
    throw new RangeError('Select one or two enrolled players.');
  }
  const seen = new Set(), ids = count===1?[greenId]:[greenId,blueId];
  return Object.freeze(ids.map((id,index)=>{
    if (typeof id!=='string' || !id || seen.has(id)) throw new Error('Assign distinct enrolled participants.');
    const profile=roster.find(p=>p && p.id===id);
    if (!profile) throw new Error('Enroll and select every chosen participant before starting.');
    seen.add(id);
    return Object.freeze({
      participantId:id,color:index===0?'green':'blue',
      name:String(profile.name || profile.nickname || ('Player '+(index+1))).trim().slice(0,80)
    });
  }));
}
