import test from 'node:test';
import assert from 'node:assert/strict';
import {guestWorkbook,budgetWorkbook} from './planner-export.js';
import {emptyPlan,uid} from './planner-model.js';
import {person} from './model.js';
import {read,write,utils} from './xlsx.mjs';
const roundtrip=wb=>read(write(wb,{type:'array',bookType:'xlsx'}),{type:'array'});
test('extended guest columns remain aligned with category traversal',()=>{
  const p=emptyPlan(),family=person('Family guest'),direct=person('Direct guest');family.phone='0771234567';family.invited=true;direct.phone='0781234567';family.events={e:{rsvp:'Attending',meal:'Vegetarian'}};p.events=[{id:'e',name:'Reception'}];p.tree.children[0].children.push(family);p.tree.children.push(direct);
  const wb=roundtrip(guestWorkbook(p)),all=utils.sheet_to_json(wb.Sheets['All Guests'],{range:3}),invited=utils.sheet_to_json(wb.Sheets['Invited Guests'],{range:3});
  assert.equal(all[0]['Guest name'],'Direct guest');assert.equal(all[0].Phone,'0781234567');assert.equal(all[1].Phone,'0771234567');assert.equal(invited[0]['Reception RSVP'],'Attending');assert.equal(invited[0]['Reception meal'],'Vegetarian');
});
test('budget export records numeric balances and payment statuses',()=>{
  const p=emptyPlan();p.settings.budget=1000;p.expenses=[{id:uid(),name:'Venue',category:'Venue',estimate:700,actual:600,payments:[{id:uid(),name:'Deposit',due:'2026-10-26',amount:100,paid:true},{id:uid(),name:'Balance',due:'2027-01-01',amount:500,paid:false}]}];
  const wb=roundtrip(budgetWorkbook(p));assert.deepEqual(wb.SheetNames,['Summary','Expenses','Payments']);assert.equal(utils.sheet_to_json(wb.Sheets.Expenses)[0].Balance,500);assert.equal(utils.sheet_to_json(wb.Sheets.Payments)[1].Status,'Pending');
});
