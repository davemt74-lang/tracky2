export function startupReport({secureContext=true, storageAvailable=true, hasParticipantStorage=true}={}) {
  const problems=[];
  if (!secureContext) problems.push('Camera features need localhost or HTTPS.');
  if (!storageAvailable) problems.push('Browser storage unavailable; participant data may not persist.');
  return Object.freeze({ready:problems.length===0, problems:Object.freeze(problems),
    message:problems.length?problems.join(' '):hasParticipantStorage?
    'Game room ready · Enrolled players stay on this device.':'Game room ready · Enroll players in the lobby.'});
}
export function shouldAutoEnter({seenThisTab=false, optedOut=false, reducedMotion=false}={}) {
  return !seenThisTab && !optedOut && !reducedMotion;
}
