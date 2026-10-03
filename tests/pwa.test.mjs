import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {STATIC_CACHE,SHELL} from '../src/pwa-assets.js';
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
test('manifest has standalone entry, explicit 192 and 512 PNG icons and scoped start',()=>{
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.start_url,'./index.html');assert.equal(manifest.scope,'./');
 for (const size of [192,512]){
  const icon=manifest.icons.find(x=>x.sizes===size+'x'+size&&x.type==='image/png');
  assert.ok(icon);assert.ok(icon.purpose.includes('maskable'));
 }
});
test('all required offline shell files exist locally and have no external links',()=>{
 assert.match(STATIC_CACHE,/v0\.7\.2/);
 assert.equal(new Set(SHELL).size,SHELL.length);
 for(const path of SHELL){
  assert.ok(path.startsWith('./')&&!path.includes('?')&&!path.includes('http:'));
  if(path!=='./')assert.ok(fs.statSync(path.slice(2)).size>0,path);
 }
});
test('PWA does not force activation, cache cross-origin media or wipe personal storage',()=>{
 const sw=fs.readFileSync('sw.js','utf8');
 assert.ok(sw.includes("event.data?.type==='SKIP_WAITING'"));
 assert.ok(sw.includes('url.origin!==self.location.origin'));
 assert.ok(sw.includes("request.method!=='GET'"));
 assert.ok(!sw.includes('indexedDB.deleteDatabase'));
 assert.ok(!sw.slice(sw.indexOf("self.addEventListener('install'"),sw.indexOf("self.addEventListener('activate'")).includes('skipWaiting')); // no forced update
});
test('generated PNGs have verified signature and dimensions',()=>{
 for(const size of [192,512]){
  const png=fs.readFileSync('assets/icon-'+size+'.png');
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
 }
});
