import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('14B server execution accepts only fixed skill and approved object id',()=>{
 const api=read('server/skill-api.php');
 assert.match(api,/\$skill!=='product_search'/);
 assert.match(api,/tracky_require\(\$db,'skills\.execute'\)/);
 assert.match(api,/tracky_permission\(\$db,\$actor,'providers\.use'\)/);
 assert.match(api,/tracky_skill_object\(\$db,\$objectId,\$skill\)/);
 assert.match(api,/https:\/\/api\.openai\.com\/v1\/responses/);
 assert.match(api,/'type'=>'web_search'/);
 assert.doesNotMatch(api,/\$data\[['"](?:query|url|endpoint|prompt|command|shell|tool)['"]\]/);
});

test('14B server revalidates approval and enabled grant at execution time',()=>{
 const api=read('server/skill-api.php'),admin=read('server/admin.php');
 assert.match(api,/o\.status='approved'|\$row\['status'\]!=='approved'/);
 assert.match(api,/\(int\)\$row\['enabled'\]!==1/);
 assert.match(admin,/UPDATE scene_objects SET status=\?,approved_by=\?/);
 assert.match(admin,/UPDATE object_skills SET enabled=0 WHERE object_id=\?/);
 assert.match(admin,/Object approval required/);
 assert.match(admin,/skills\.approve/);
 assert.match(admin,/skills\.execute/);
});

test('14B foreground camera capture stores no image bytes in task persistence',()=>{
 const controller=read('vertical-motion.js'),store=read('src/participant-store.js'),ui=read('src/agent-task-ui.js');
 assert.match(controller,/captureGovernedSceneImage/);
 assert.match(controller,/document\.hidden/);
 assert.match(controller,/URL\.createObjectURL\(blob\)/);
 assert.match(controller,/link\.download=/);
 assert.match(ui,/sideEffect==='read-only'/);
 assert.match(ui,/ownerAction:true/);
 assert.doesNotMatch(store.slice(store.indexOf('export async function saveAgentTask')),
  /Blob|ArrayBuffer|base64|imageData|canvas|primaryPhoto|rawAudio/);
});

test('14B governed skill provenance is bounded and sensitive payloads are excluded',()=>{
 const core=read('src/governed-skill-core.js'),task=read('src/agent-task-core.js');
 assert.match(core,/GOVERNED_SKILL_CONTRACT='14B\.1'/);
 assert.match(core,/authorization:'owner-confirmed-skill-grant'/);
 assert.match(core,/resultCount/);assert.match(core,/mediaBytes/);
 assert.match(task,/executionProvenance/);
 assert.doesNotMatch(core,/rawAudio|embedding|faceTemplate|voiceprint|credential|apiKey/);
});

test('14B product search is server-approved only and local capture is local-only',()=>{
 const core=read('src/governed-skill-core.js');
 assert.match(core,/product_search[\s\S]*targetSources:Object\.freeze\(\['server-approved'\]\)/);
 assert.match(core,/capture_image[\s\S]*targetSources:Object\.freeze\(\['local-owner-defined'\]\)/);
 assert.match(core,/foregroundOwnerAction:true/);
});
