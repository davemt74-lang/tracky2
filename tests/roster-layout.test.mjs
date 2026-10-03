import test from 'node:test';
import assert from 'node:assert/strict';
import { rosterView,nextRosterState } from '../src/roster-layout.js';
test('desktop participant roster collapses without losing content or current participant selection',()=>{
 const expanded=rosterView({wide:true});
 assert.deepEqual(expanded,{state:'expanded',expanded:true,modal:false,backdrop:false});
 const collapsed=nextRosterState(expanded,'close',true);
 assert.equal(collapsed.state,'collapsed');assert.equal(collapsed.expanded,false);
 assert.equal(nextRosterState(collapsed,'open',true).state,'expanded');
});
test('mobile roster slides over camera and is closed by Escape or backdrop',()=>{
 const closed=rosterView({wide:false});
 const open=nextRosterState(closed,'open',false);
 assert.equal(open.modal,true);assert.equal(open.backdrop,true);
 assert.equal(nextRosterState(open,'close',false).modal,false);
 assert.equal(nextRosterState(open,'mobile-close',false).backdrop,false);
});
test('toggle, repeated close and invalid actions are deterministic',()=>{
 const a=rosterView({wide:true,collapsed:true});
 assert.equal(nextRosterState(a,'toggle').expanded,true);
 assert.equal(nextRosterState(a,'close').expanded,false);
 assert.throws(()=>nextRosterState(a,'erase'),RangeError);
});
