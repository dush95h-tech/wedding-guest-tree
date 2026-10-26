import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyPlan, budgetTotals, reminders, migrateLegacy, validatePlan, seatingIssue, uid, people } from './planner-model.js';
import { newSheet, person, branch } from './model.js';
test('migration preserves nested people and invite states without mutating the original',()=>{
  const a=newSheet('Family'),b=newSheet('Friends'),p=person('Same name'),q=person('Same name');p.invited=true;a.children[0].children.push(p);b.children[0].children.push(q);
  const legacy={version:1,sheets:[a,b]},source=JSON.stringify(legacy),plan=emptyPlan();
  const result=migrateLegacy(plan,legacy);assert.equal(result.added,2);assert.equal(people(result.plan.tree).length,2);assert.equal(people(result.plan.tree).filter(p=>p.invited).length,1);assert.equal(JSON.stringify(legacy),source);assert.equal(people(plan.tree).length,0);assert.equal(migrateLegacy(result.plan,legacy).added,0);validatePlan(result.plan);
});
test('installments affect paid totals only when marked paid, without floating-point drift',()=>{
  const p=emptyPlan();p.settings.budget=1000;p.expenses=[{id:uid(),estimate:500,actual:400,payments:[{amount:0.1,paid:true},{amount:0.2,paid:true},{amount:100,paid:false}]}];
  assert.deepEqual(budgetTotals(p),{estimated:500,actual:400,paid:0.3,remaining:399.7,available:600});
});
test('reminders exclude completed tasks, paid installments, and future dates',()=>{
  const p=emptyPlan();p.tasks=[{title:'Due',due:'2026-10-26',status:'To do'},{title:'Done',due:'2026-01-01',status:'Done'},{title:'Future',due:'2027-01-01',status:'To do'}];p.expenses=[{name:'Venue',payments:[{name:'Deposit',amount:10,due:'2026-10-25',paid:false},{name:'Paid',amount:10,due:'2026-10-25',paid:true}]}];assert.deepEqual(reminders(p,'2026-10-26').map(x=>x.name),['Venue — Deposit','Due']);
});
test('seating enforces event invitations, capacity, and one table per event',()=>{
  const p=emptyPlan(),g=person('Guest');g.invited=true;g.events={e:{rsvp:'Attending'},other:{rsvp:'Pending'}};p.tree.children[0].children.push(g);
  const t={id:'table',eventId:'e',capacity:1,guests:[]};assert.equal(seatingIssue(p,t,[g.id]),'');assert.match(seatingIssue(p,t,[g.id,g.id]),/capacity/);p.tables=[{id:'other',eventId:'e',guests:[g.id]}];assert.match(seatingIssue(p,t,[g.id]),/already/);p.tables[0].eventId='other';assert.equal(seatingIssue(p,t,[g.id]),'');g.events.e.rsvp='Declined';assert.match(seatingIssue(p,t,[g.id]),/declined/);
});
test('backups reject malformed and negative finance values',()=>{const p=emptyPlan();assert.equal(validatePlan(p),p);p.settings.budget=-1;assert.throws(()=>validatePlan(p));p.settings.budget=0;p.expenses=[{id:'x',estimate:0,actual:0,payments:[{amount:-5,paid:false}]}];assert.throws(()=>validatePlan(p));});
