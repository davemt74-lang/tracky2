import fs from 'node:fs';
import path from 'node:path';

export function localModuleSpecifiers(source=''){
 const specs=new Set();
 const patterns=[
  /\b(?:import|export)\s+(?:[^'"\n]*?\s+from\s*)?['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
 ];
 for(const pattern of patterns){
  for(const match of source.matchAll(pattern)){
   const spec=match[1];
   if(spec?.startsWith('./')||spec?.startsWith('../'))specs.add(spec);
  }
 }
 return [...specs];
}

function resolveLocalImport(file,spec){
 const base=path.resolve(path.dirname(file),spec);
 const candidates=path.extname(base)?[base]:[base+'.js',path.join(base,'index.js')];
 return candidates.find(candidate=>fs.existsSync(candidate))||candidates[0];
}

export function missingLocalImports(root){
 const missing=[];
 const stack=[path.resolve(root)];
 while(stack.length){
  const current=stack.pop();
  for(const entry of fs.readdirSync(current,{withFileTypes:true})){
   const full=path.join(current,entry.name);
   if(entry.isDirectory()){stack.push(full);continue;}
   if(!entry.isFile()||!entry.name.endsWith('.js'))continue;
   const source=fs.readFileSync(full,'utf8');
   for(const spec of localModuleSpecifiers(source)){
    const target=resolveLocalImport(full,spec);
    if(!fs.existsSync(target)){
     missing.push({
      file:path.relative(root,full).replaceAll('\\','/'),
      spec,
      target:path.relative(root,target).replaceAll('\\','/')
     });
    }
   }
  }
 }
 return missing;
}

if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const root=process.argv[2];
 if(!root||!fs.existsSync(root)){
  console.error('Usage: node scripts/verify-deploy-imports.mjs <deploy-root>');
  process.exit(2);
 }
 const missing=missingLocalImports(root);
 if(missing.length){
  console.error('Deploy package has unresolved local JavaScript imports:');
  for(const item of missing)console.error('- '+item.file+' -> '+item.spec+' (missing '+item.target+')');
  process.exit(1);
 }
 console.log('Deploy local-import audit passed.');
}
