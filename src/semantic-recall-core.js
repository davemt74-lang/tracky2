// V0.14E bounded, ephemeral semantic recall.
// The index is rebuilt from canonical recall rows and is never persisted.
import {searchRecall,recallRowAllowed,explainRecallResult,MAX_RECALL_RESULTS} from './session-recall-core.js';

export const SEMANTIC_RECALL_SCHEMA=1;
export const MAX_SEMANTIC_INDEX_ITEMS=320;
export const SEMANTIC_VECTOR_DIM=128;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clean=v=>String(v??'').replace(/\s+/g,' ').trim().toLowerCase();
const STOP=new Set(['a','an','and','are','as','at','be','been','but','by','for','from','had','has','have','he','her','hers','him','his','i','in','is','it','its','me','my','of','on','or','our','ours','she','that','the','their','them','they','this','to','was','we','were','with','you','your']);
const CONCEPTS=Object.freeze([
 ['purchase',['buy','bought','purchase','purchased','order','ordered','shop','shopping','product']],
 ['preference',['prefer','prefers','preferred','like','likes','liked','favorite','favourite','dislike','avoid']],
 ['conversation',['talk','talked','speak','spoke','speech','conversation','discuss','discussed','chat']],
 ['schedule',['schedule','scheduled','calendar','appointment','meeting','meet','deadline','due']],
 ['decision',['decision','decide','decided','choose','chose','approve','approved','reject','rejected']],
 ['task',['task','todo','action','assignment','job','work']],
 ['recall',['remember','remembered','recall','memory','memorize','note']],
 ['location',['room','area','zone','desk','kitchen','office','location','place']],
 ['recording',['record','recorded','recording','audio','microphone','voice']],
 ['search',['search','searched','find','found','lookup','looked','query']],
 ['music',['music','song','songs','album','artist','track']],
 ['project',['project','projects','initiative','pilot','release','launch']]
]);
const CONCEPT_BY_WORD=(()=>{
 const map=new Map();
 for(const [concept,words] of CONCEPTS)for(const word of words)map.set(word,concept);
 return map;
})();
const stem=value=>{
 let word=clean(value).replace(/[^\p{L}\p{N}-]/gu,'');
 if(word.length>5&&word.endsWith('ing'))word=word.slice(0,-3);
 else if(word.length>4&&word.endsWith('ed'))word=word.slice(0,-2);
 else if(word.length>4&&word.endsWith('es'))word=word.slice(0,-2);
 else if(word.length>3&&word.endsWith('s'))word=word.slice(0,-1);
 return word;
};
function terms(value=''){
 const raw=clean(value).split(/[^\p{L}\p{N}-]+/u).filter(Boolean).slice(0,80);
 const out=[];
 for(const token of raw){
  if(STOP.has(token))continue;
  const base=stem(token);if(!base)continue;
  out.push('w:'+base);
  const concept=CONCEPT_BY_WORD.get(token)||CONCEPT_BY_WORD.get(base);
  if(concept)out.push('c:'+concept);
  if(base.length>=5){
   for(let i=0;i<=Math.min(base.length-3,5);i++)out.push('g:'+base.slice(i,i+3));
  }
 }
 return out.slice(0,180);
}
function hash(value){
 let h=2166136261;
 for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
 return h>>>0;
}
function vector(value=''){
 const arr=new Float32Array(SEMANTIC_VECTOR_DIM);
 for(const term of terms(value)){
  const h=hash(term),index=h%SEMANTIC_VECTOR_DIM,sign=(h&0x80000000)?-1:1;
  arr[index]+=term.startsWith('c:')?sign*2.4:term.startsWith('w:')?sign*1.5:sign*.35;
 }
 let norm=0;for(const x of arr)norm+=x*x;
 norm=Math.sqrt(norm);if(norm)for(let i=0;i<arr.length;i++)arr[i]/=norm;
 return arr;
}
function cosine(a,b){
 if(!a||!b||a.length!==b.length)return 0;
 let score=0;for(let i=0;i<a.length;i++)score+=a[i]*b[i];
 return Math.max(-1,Math.min(1,score));
}
function rowText(row){
 return [row.title,row.text,row.sourceType,row.subtype,row.status,...(row.provenance||[])].filter(Boolean).join(' ');
}
function staleCount(row){return (row.references||[]).filter(ref=>ref.state==='stale').length;}
function lexicalCoverage(row,query){
 const q=[...new Set(clean(query).split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(stem).filter(Boolean))];
 if(!q.length)return 0;
 const hay=clean(rowText(row));let matched=0;
 for(const token of q)if(hay.includes(token))matched++;
 return matched/q.length;
}
export class SemanticRecallIndex{
 constructor({maxItems=MAX_SEMANTIC_INDEX_ITEMS}={}){
  this.maxItems=Math.max(1,Math.min(MAX_SEMANTIC_INDEX_ITEMS,Number(maxItems)||MAX_SEMANTIC_INDEX_ITEMS));
  this.rows=[];this.builtAt=0;this.generation=0;
 }
 rebuild(rows=[],now=Date.now()){
  this.rows=(Array.isArray(rows)?rows:[]).slice(0,this.maxItems).map(row=>Object.freeze({
   id:row.id,sourceId:row.sourceId,sourceType:row.sourceType,vector:vector(rowText(row)),row
  }));
  this.builtAt=finite(now)?now:Date.now();this.generation++;
  return this.snapshot();
 }
 clear(){this.rows=[];this.builtAt=0;this.generation++;return this.snapshot();}
 snapshot(){return Object.freeze({schema:SEMANTIC_RECALL_SCHEMA,itemCount:this.rows.length,builtAt:this.builtAt,generation:this.generation,maxItems:this.maxItems,persistent:false});}
 search(query='',options={}){
  const q=clean(query);
  if(!q)return searchRecall(this.rows.map(entry=>entry.row),'',options);
  const queryVector=vector(q),limit=Math.max(1,Math.min(MAX_RECALL_RESULTS,Number(options.limit)||50));
  const semanticWeight=Math.max(0,Math.min(1,Number(options.semanticWeight)||.72));
  const candidates=[];
  for(const entry of this.rows){
   const row=entry.row;if(!recallRowAllowed(row,options))continue;
   const semantic=Math.max(0,cosine(queryVector,entry.vector));
   const lexical=lexicalCoverage(row,q);
   const stalePenalty=staleCount(row)>.0?.035:0;
   const score=semantic*semanticWeight+lexical*(1-semanticWeight)-stalePenalty;
   if(score<.08&&lexical===0)continue;
   candidates.push(Object.freeze({...row,
    matchTerms:Object.freeze([]),score:Number(score.toFixed(6)),
    retrieval:Object.freeze({mode:'local-semantic',semanticScore:Number(semantic.toFixed(6)),
     lexicalCoverage:Number(lexical.toFixed(6)),indexGeneration:this.generation})
   }));
  }
  return Object.freeze(candidates.sort((a,b)=>b.score-a.score||b.at-a.at||a.id.localeCompare(b.id)).slice(0,limit));
 }
}

export function searchRecallV2(rows=[],query='',options={}){
 const semantic=options.semantic!==false,semanticIndex=options.semanticIndex||null;
 if(semantic&&semanticIndex instanceof SemanticRecallIndex){
  try{
   const result=semanticIndex.search(query,options);
   if(result.length||!clean(query))return Object.freeze({mode:'local-semantic',results:result,index:semanticIndex.snapshot()});
  }catch{}
 }
 const results=searchRecall(rows,query,options).map(row=>Object.freeze({...row,
  retrieval:Object.freeze({mode:'lexical-fallback',semanticScore:null,lexicalCoverage:1,indexGeneration:null})
 }));
 return Object.freeze({mode:'lexical-fallback',results:Object.freeze(results),index:null});
}

export function summarizeRecallResults(results=[],{maxSources=4}={}){
 const rows=Array.isArray(results)?results:[],counts=new Map(),stale=new Set();
 for(const row of rows){
  counts.set(row.sourceType,(counts.get(row.sourceType)||0)+1);
  for(const ref of row.references||[])if(ref.state==='stale')stale.add(ref.type+':'+ref.id);
 }
 const sources=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,Math.max(1,Math.min(8,maxSources)));
 const top=rows.slice(0,3).map(row=>({id:row.id,title:row.title,sourceType:row.sourceType,at:row.at}));
 return Object.freeze({
  resultCount:rows.length,staleReferenceCount:stale.size,
  sources:Object.freeze(sources.map(([sourceType,count])=>Object.freeze({sourceType,count}))),
  top:Object.freeze(top.map(Object.freeze)),
  summary:rows.length
   ?rows.length+' ranked result'+(rows.length===1?'':'s')+' across '+sources.length+' source type'+(sources.length===1?'':'s')+
    (stale.size?' · '+stale.size+' stale reference'+(stale.size===1?'':'s')+' preserved':'')
   :'No recall results to summarize.'
 });
}

export function explainRecallResultV2(result){
 const base=explainRecallResult(result),retrieval=result?.retrieval;
 if(!retrieval)return base;
 const reason=retrieval.mode==='local-semantic'
  ?'local semantic match '+Math.round((retrieval.semanticScore||0)*100)+'% · lexical coverage '+Math.round((retrieval.lexicalCoverage||0)*100)+'%'
  :'deterministic lexical fallback';
 return Object.freeze({summary:base.summary+' · retrieval: '+reason,references:base.references});
}
