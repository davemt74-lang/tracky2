import fs from 'node:fs';
import path from 'node:path';

function assetList(source){
 const match=source.match(/const\s+ASSETS\s*=\s*\[([\s\S]*?)\];/);
 if(!match)throw new Error('Service worker ASSETS list not found.');
 return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(row=>row[1]);
}
function importSpecifiers(source=''){
 const specs=new Set();
 const patterns=[
  /\b(?:import|export)\s+(?:[^'"\n]*?\s+from\s*)?['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
 ];
 for(const pattern of patterns)for(const match of source.matchAll(pattern)){
  if(match[1]?.startsWith('./')||match[1]?.startsWith('../'))specs.add(match[1]);
 }
 return [...specs];
}
function normalizeAsset(value){
 const stripped=String(value||'').replace(/^\.\//,'');
 return path.posix.normalize(stripped);
}
function resolveImport(fromAsset,spec){
 const base=path.posix.normalize(path.posix.join(path.posix.dirname(fromAsset),spec));
 return path.posix.extname(base)?base:base+'.js';
}
export function missingPwaImports(swSource,root='.'){
 const assets=assetList(swSource);
 const cached=new Set(assets.map(normalizeAsset));
 const missing=[];
 for(const raw of assets){
  const asset=normalizeAsset(raw);
  if(!asset.endsWith('.js'))continue;
  const file=path.join(root,...asset.split('/'));
  if(!fs.existsSync(file))continue;
  const source=fs.readFileSync(file,'utf8');
  for(const spec of importSpecifiers(source)){
   const target=resolveImport(asset,spec);
   if(!cached.has(target))missing.push({file:asset,spec,target});
  }
 }
 return missing;
}
if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const sw=fs.readFileSync(process.argv[2]||'sw.js','utf8');
 const missing=missingPwaImports(sw,process.argv[3]||'.');
 if(missing.length){
  console.error('PWA cache is missing local JavaScript dependencies:');
  for(const row of missing)console.error('- '+row.file+' -> '+row.spec+' (missing '+row.target+')');
  process.exit(1);
 }
 console.log('PWA local-import cache audit passed.');
}
