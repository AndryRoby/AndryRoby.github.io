import test from 'node:test';
import assert from 'node:assert/strict';
import {zlozSpravu} from './dopyt-opakovanie.js';

test('dopyt obsahuje iba vedome zadaný softvér, frekvenciu a problém',()=>{
 const result=zlozSpravu({software:'  Own export  ',frequency:'weekly',problem:'  Totals need checking  ',xml:'<Invoice>PRIVATE</Invoice>',invoiceNumber:'PRIVATE',email:'PRIVATE'});
 assert.equal(result,'Software: Own export\nFrequency: weekly\nRecurring task / current process:\nTotals need checking');
 assert.ok(!result.includes('PRIVATE'));
});
test('neúplný alebo priveľký dopyt sa nezloží',()=>{
 for(const change of [{software:' '},{problem:'\n'},{frequency:'unexpected'},{software:'x'.repeat(101)},{problem:'x'.repeat(1001)}]){
  assert.equal(zlozSpravu({software:'Example',frequency:'monthly',problem:'Repeated task',...change}),'');
 }
});
test('najdlhší prípustný dopyt sa vojde do limitu existujúcej služby 1500 znakov',()=>{
 const result=zlozSpravu({software:'s'.repeat(100),frequency:'unknown',problem:'p'.repeat(1000)});
 assert.ok(result.length>1100&&result.length<=1500);
});
