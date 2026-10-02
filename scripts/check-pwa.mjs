import fs from 'node:fs';import path from 'node:path';
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
for(const size of [192,512]){
  const file=path.join('assets','icon-'+size+'.png');
  const png=fs.readFileSync(file);
  if(png.readUInt32BE(16)!==size||png.readUInt32BE(20)!==size)
    throw new Error('Invalid icon '+size);
}
if(!manifest.icons.some(i=>i.purpose.includes('maskable')))throw new Error('No maskable icon');
console.log('PWA manifest/icon verification: PASS');
