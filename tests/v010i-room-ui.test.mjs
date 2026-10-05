import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 normalizeRoomTimelineFilter,roomEventMatchesFilter,roomUiOverview
} from '../src/room-ui-core.js';

const events=[
 {id:'p',category:'presence',kind:'observation'},
 {id:'a',category:'audio',kind:'observation'},
 {id:'d',category:'decision',kind:'decision'},
 {id:'o',category:'system',kind:'outcome'},
 {id:'c',category:'system',kind:'correction'},
 {id:'m',category:'media',kind:'observation'}
];

test('10I ROOM filters are deterministic and fail safe to all',()=>{
 assert.equal(normalizeRoomTimelineFilter('decision'),'decision');
 assert.equal(normalizeRoomTimelineFilter('garbage'),'all');
 assert.deepEqual(events.filter(e=>roomEventMatchesFilter(e,'presence')).map(e=>e.id),['p']);
 assert.deepEqual(events.filter(e=>roomEventMatchesFilter(e,'audio')).map(e=>e.id),['a']);
 assert.deepEqual(events.filter(e=>roomEventMatchesFilter(e,'activity')).map(e=>e.id),['m']);
 assert.deepEqual(events.filter(e=>roomEventMatchesFilter(e,'decision')).map(e=>e.id),['d','o','c']);
 assert.equal(events.filter(e=>roomEventMatchesFilter(e,'all')).length,events.length);
});

test('10I ROOM overview stays factual and count-based',()=>{
 const view=roomUiOverview({
  events,stableParticipants:2,camera:'online',microphone:'paused'
 });
 assert.deepEqual(view,{
  participants:2,evidence:6,decisions:2,corrections:1,
  camera:'online',microphone:'paused'
 });
 const empty=roomUiOverview({stableParticipants:-2});
 assert.equal(empty.participants,0);
 assert.equal(empty.evidence,0);
});

test('10I ROOM keeps factual overview in Control Center and keyboard-native unified-feed filters',()=>{
 const html=fs.readFileSync('vertical-motion.html','utf8');
 assert.match(html,/id="controlCenterRoomPanel"/);
 assert.match(html,/id="roomUiOverview"/);
 assert.match(html,/id="roomOverviewParticipants"/);
 assert.match(html,/id="roomOverviewSensors"/);
 assert.match(html,/id="roomOverviewEvidence"/);
 assert.match(html,/id="roomOverviewDecisions"/);
 assert.match(html,/role="group" aria-label="Filter unified ROOM feed"/);
 for(const key of ['all','presence','audio','decision','activity','system'])
  assert.match(html,new RegExp('data-room-filter="'+key+'"'));
 assert.match(html,/id="roomTimelineCount" aria-live="polite"/);
 assert.match(html,/roomObservationsTimeline[^>]+aria-live="off"/);
});

test('10I runtime derives UI only from canonical ROOM projection and does not create a second ledger',()=>{
 const code=fs.readFileSync('vertical-motion.js','utf8');
 assert.match(code,/const projection=roomLedger\.project\(\)/);
 assert.match(code,/roomUiOverview\(\{/);
 assert.match(code,/roomEventMatchesFilter\(e,roomTimelineFilter\)/);
 assert.match(code,/normalizeRoomTimelineFilter\(button\.dataset\.roomFilter\)/);
 assert.doesNotMatch(code,/new RoomEventLedger\(\).*new RoomEventLedger\(/s);
});

test('10I responsive presentation preserves existing mobile rails and keyboard tab navigation',()=>{
 const presence=fs.readFileSync('agent-presence.js','utf8');
 const tabs=fs.readFileSync('room-tabs-controller.js','utf8');
 const css=fs.readFileSync('agent-presence.css','utf8');
 assert.match(presence,/agentMobileLeftRail/);
 assert.match(presence,/agentMobileRightRail/);
 assert.match(presence,/event\.key==='Escape'/);
 assert.match(tabs,/ArrowRight/);
 assert.match(tabs,/ArrowLeft/);
 assert.match(tabs,/Home/);
 assert.match(tabs,/End/);
 assert.match(css,/room-timeline-filters button:focus-visible/);
 assert.match(css,/@media\(max-width:520px\)/);
});

test('10I ROOM/Control Center keep privacy and diagnostic boundaries visible',()=>{
 const html=fs.readFileSync('vertical-motion.html','utf8');
 assert.match(html,/overall environment/i);
 assert.match(html,/Person-specific identity, movement, dwell and voice-profile activity stays in Player \/ Participant views/i);
 assert.match(html,/not a measured floor plan/i);
 assert.match(html,/They do not identify a sound source/i);
 assert.match(html,/does not create Agent Memory or infer health, emotion, sleep, protected traits, or intent/i);
});
