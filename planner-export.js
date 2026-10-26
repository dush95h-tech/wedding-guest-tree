import { buildWorkbook } from './excel-export.js';
import { utils } from './xlsx.mjs';
import { budgetTotals, sum, guestRsvp } from './planner-model.js';
export function guestWorkbook(plan) {
  const wb=buildWorkbook({...plan.tree,name:plan.settings.title}),all=[];
  function collect(n){if(n.type==='person')all.push(n);else n.children?.forEach(collect);}
  plan.tree.children.filter(n=>n.type==='person').forEach(collect);plan.tree.children.filter(n=>n.type==='group').forEach(collect);
  const headers=['Side','Household','Phone','Address','Adult / child','Invitation sent','Notes',...plan.events.flatMap(e=>[e.name+' RSVP',e.name+' meal'])];
  for(const [name,list] of [['All Guests',all],['Invited Guests',all.filter(g=>g.invited)]]){
    const ws=wb.Sheets[name];
    utils.sheet_add_aoa(ws,[headers,...list.map(g=>[g.side||'',g.household||'',g.phone||'',g.address||'',g.age||'Adult',g.sent?'Yes':'No',g.notes||'',...plan.events.flatMap(e=>[guestRsvp(g,e.id),g.events?.[e.id]?.meal||''])])],{origin:'F4'});
    ws['!cols'].push(...headers.map(()=>({wch:28})));
    ws['!autofilter']={ref:utils.encode_range({s:{r:3,c:0},e:{r:Math.max(3,list.length+3),c:4+headers.length}})};
  }
  return wb;
}
export function budgetWorkbook(plan) {
  const wb=utils.book_new();
  function add(name,headers,rows){const ws=utils.aoa_to_sheet([headers,...rows]);ws['!cols']=headers.map(h=>({wch:h.includes('cost')?20:30}));ws['!autofilter']={ref:ws['!ref']};utils.book_append_sheet(wb,ws,name);}
  const b=budgetTotals(plan);add('Summary',['Measure','LKR'],[['Wedding budget',plan.settings.budget],['Estimated',b.estimated],['Actual',b.actual],['Paid',b.paid],['Outstanding',b.remaining],['Budget remaining',b.available]]);
  add('Expenses',['Expense','Category','Vendor','Estimated cost','Actual cost','Paid','Balance'],plan.expenses.map(e=>{const paid=sum(e.payments.filter(p=>p.paid).map(p=>p.amount));return [e.name,e.category,plan.vendors.find(v=>v.id===e.vendorId)?.name||'Not assigned',e.estimate,e.actual,paid,sum([e.actual,-paid])];}));
  add('Payments',['Expense','Installment','Due date','Amount (LKR)','Status'],plan.expenses.flatMap(e=>e.payments.map(p=>[e.name,p.name,p.due,p.amount,p.paid?'Paid':'Pending'])));
  return wb;
}
