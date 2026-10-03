// AGENT is a conversation-room experience; it intentionally uses the same
// host camera/identity/audio runtime and has no marker, board or round session.
export const agentGame=Object.freeze({
 id:'agent',title:'AGENT',description:'Live camera room conversation and participant engagement',
 createSession:()=>Object.freeze({mode:'agent',requiresBoard:false,
  camera:'host-shared',roomAudio:'on-when-authorized',identity:'host-shared'})
});
