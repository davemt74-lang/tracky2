// One chronological chat view, joining canonical local transcript turns with agent replies.
// Attribution follows the verified voice turn; spatial proximity never establishes a speaker.
export function conversationTimeline(turns=[],history=[],participants=[]){
 const people=new Map(participants.map(p=>[p.id,p]));
 const rows=turns.filter(t=>String(t.transcript||'').trim()).map((t,i)=>{
  const verified=Boolean(t.participantId)&&t.attribution!=='unknown';
  const person=verified?people.get(t.participantId):null;
  const time=Date.parse(t.createdAt||'');
  return {id:t.id||'turn-'+i,role:'participant',text:t.transcript,
   at:Number.isFinite(time)?time:(Number.isFinite(t.at)?t.at:0),
   name:verified?(person?.nickname||person?.name||t.participantName||'Participant'):'Unknown speaker',
   photo:verified?(person?.primaryPhoto||null):null,
   verified,source:'transcript'};
 });
 const saved=history.filter(h=>['agent','system','participant'].includes(h.role)&&String(h.text||'').trim())
  .filter(h=>h.role!=='participant'||!rows.some(r=>r.text===h.text&&Math.abs(r.at-h.at)<6000))
  .map((h,i)=>{
   const person=h.participantId?people.get(h.participantId):null;
   const verified=h.role==='participant'&&Boolean(h.participantId&&person&&h.verified===true);
   return {id:h.id||'agent-'+i,role:h.role,text:h.text,at:Number.isFinite(h.at)?h.at:0,
    name:h.role==='agent'?'AGENT':h.role==='system'?'System':verified?(person.nickname||person.name):'Unknown speaker',
    photo:verified?person.primaryPhoto||null:null,verified,source:'agent-history'};
  });
 return [...rows,...saved].sort((a,b)=>a.at-b.at).slice(-120);
}
