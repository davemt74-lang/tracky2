// Owner transcript edits never confer voice verification or change speaker identity.
// Canonical record remains in IndexedDB; the AGENT reply-history is NOT a second transcript store.
export const MAX_TRANSCRIPT_LENGTH=800;
export const MAX_TRANSCRIPT_REVISIONS=5;
export function reviseTranscriptRecord(turn,replacement,at=Date.now()){
 if(!turn||typeof turn.id!=='string'||!turn.id.trim()||
  typeof turn.transcript!=='string')throw new TypeError('Missing canonical transcript turn.');
 if(typeof replacement!=='string'||!Number.isFinite(at)||at<0)
  throw new TypeError('Invalid transcript correction.');
 const text=replacement.trim();
 if(!text||text.length>MAX_TRANSCRIPT_LENGTH)
  throw new RangeError('Transcript correction must be 1–800 characters.');
 if(text===turn.transcript.trim())throw new RangeError('Transcript text is unchanged.');
 const revision=Object.freeze({at,previous:turn.transcript});
 const previous=Array.isArray(turn.transcriptRevisions)?
  turn.transcriptRevisions.filter(r=>r&&Number.isFinite(r.at)&&typeof r.previous==='string'):[];
 return Object.freeze({...turn,
  transcript:text,originalTranscript:typeof turn.originalTranscript==='string'?
   turn.originalTranscript:turn.transcript,
  transcriptRevisions:Object.freeze([...previous,revision].slice(-MAX_TRANSCRIPT_REVISIONS)),
  transcriptEditedAt:new Date(at).toISOString(),transcriptEditedBy:'local-owner'
 });
}
