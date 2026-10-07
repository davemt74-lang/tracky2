export function startupReport({secureContext=true, storageAvailable=true, hasParticipantStorage=true}={}) {
  const problems=[];
  if (!secureContext) problems.push('Camera features need localhost or HTTPS.');
  if (!storageAvailable) problems.push('Browser storage unavailable; participant data may not persist.');
  return Object.freeze({ready:problems.length===0, problems:Object.freeze(problems),
    message:problems.length?problems.join(' '):hasParticipantStorage?
    'AGENT ready · Enrolled participants stay on this device.':
    'AGENT ready · Add participants when you want identity recognition.'});
}
export function shouldAutoEnter({seenThisTab=false, optedOut=false, reducedMotion=false}={}) {
  return !seenThisTab && !optedOut && !reducedMotion;
}
