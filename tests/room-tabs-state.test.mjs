import test from 'node:test';import assert from 'node:assert/strict';
import {ROOM_TABS,nextRoomTab} from '../src/room-tabs-state.js';
test('clicking activity opens activity and keyboard navigation works both directions',()=>{
 assert.deepEqual(ROOM_TABS,['dialogue','activity']);
 assert.equal(nextRoomTab('dialogue','activity'),'activity');
 assert.equal(nextRoomTab('activity','ArrowRight'),'dialogue');
 assert.equal(nextRoomTab('dialogue','ArrowLeft'),'activity');
 assert.equal(nextRoomTab('activity','Home'),'dialogue');
 assert.equal(nextRoomTab('dialogue','End'),'activity');
});
