import { uid, branch, people, today, money, sum, emptyPlan, budgetTotals, reminders, migrateLegacy, validatePlan, seatingIssue, guestRsvp } from './planner-model.js';
import { find, remove } from './model.js';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEMO = 'together-demo-v2', CONFIG = 'together-connection-v1';
const tabs = [['overview','◈','Overview'],['guests','♧','Guest List'],['budget','◉','Budget & Payments'],['tasks','☑','Tasks'],['events','◇','Events & Timeline'],['vendors','▣','Vendors'],['seating','▦','Seating'],['settings','⚙','Settings']];
let plan, client, session, weddingId, revision, demo = false, busy = false, tab = 'overview', view = 'tree', query = '', selectedEvent = '', config = {}, actionSave, recovery, refreshTimer, toastTimer;
const closed = new Set();
const btn = (action, label, id = '', cls = 'secondary') => `<button type="button" class="${cls}" data-action="${action}" data-id="${esc(id)}">${label}</button>`;
const badge = (text, cls = '') => `<span class="badge ${cls}">${esc(text)}</span>`;
const empty = (title, detail, action = '', label = '') => `<div class="empty"><span>✧</span><h3>${esc(title)}</h3><p>${esc(detail)}</p>${action ? btn(action, label, '', 'primary') : ''}</div>`;
const eventName = id => plan.events.find(x => x.id === id)?.name || 'No event';
const vendorName = id => plan.vendors.find(x => x.id === id)?.name || 'Not assigned';
const guestList = () => people(plan.tree);
const dateLabel = date => date ? new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}) : 'Not set';
function toast(text) { $('toast').textContent = text; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('show'),12000); }
function download(name, data, type = 'application/json') { const u = URL.createObjectURL(new Blob([data],{type})); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u),1000); }
function stats(items) { return `<div class="stats">${items.map(([name,value,sub]) => `<article><span>${esc(name)}</span><strong>${esc(value)}</strong><small>${esc(sub || '')}</small></article>`).join('')}</div>`; }
function table(headers, rows) { return `<div class="table-scroll"><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`; }
function row(cells) { return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`; }
function actions(edit, id, del = '') { return `<div class="row-actions">${btn(edit,'Edit',id,'text')}${del ? btn(del,'Remove',id,'text danger') : ''}</div>`; }
async function commit(change) {
  if (busy) throw Error('A save is already in progress. Please wait.');
  const next = structuredClone(plan); change(next); validatePlan(next); busy = true;
  try {
    if (demo) localStorage.setItem(DEMO,JSON.stringify(next));
    else { const { data,error } = await client.rpc('save_wedding',{p_id:weddingId,p_revision:revision,p_payload:next}); if(error) throw error; revision = data; }
    plan = next; toast(demo ? 'Saved in this browser’s demo workspace' : 'Saved to your shared wedding'); render();
  } catch(e) { recovery = next; toast(`${e.message} Your attempted changes are available in Settings → Recover unsaved changes.`); throw e; }
  finally { busy = false; }
}
function input(f) {
  const [name,label,type='text',value='',options=[],required=false] = f;
  const attrs = `name="${name}" id="field-${name}" ${required?'required':''}`;
  let control;
  if(type === 'select') control = `<select ${attrs}>${options.map(o => {const [v,l] = Array.isArray(o)?o:[o,o]; return `<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(l)}</option>`;}).join('')}</select>`;
  else if(type === 'textarea') control = `<textarea ${attrs} rows="3" maxlength="3000">${esc(value)}</textarea>`;
  else if(type === 'checkbox') control = `<input ${attrs} type="checkbox" ${value?'checked':''}>`;
  else control = `<input ${attrs} type="${type}" value="${esc(value)}" ${type==='number'?'min="0" max="1000000000000" step="0.01"':'maxlength="300"'} ${type==='password'?'minlength="8" autocomplete="new-password"':''}>`;
  return `<label class="field ${type==='checkbox'?'check-field':''}" for="field-${name}"><span>${esc(label)}</span>${control}</label>`;
}
function dialog(title, fields, save, note = '', extra = '') {
  actionSave = save; $('form-content').innerHTML = `<p class="eyebrow">TOGETHER / WEDDING PLANNER</p><h2>${esc(title)}</h2>${note?`<p class="muted">${esc(note)}</p>`:''}<div class="fields">${fields.map(input).join('')}</div>${extra}`;
  $('form-error').textContent = ''; $('submit').disabled = false; $('modal').showModal();
}
function confirmAction(title, note, change) { dialog(title,[],async()=>commit(change),note); }
$('cancel').onclick = () => $('modal').close();
$('form').onsubmit = async e => { e.preventDefault(); $('submit').disabled=true; $('form-error').textContent=''; try { for(const field of e.target.querySelectorAll('[required]')) if(!String(field.value).trim())throw Error('Please fill in all required fields.'); await actionSave(new FormData(e.target)); $('modal').close(); } catch(err) { $('form-error').textContent=err.message; } finally { $('submit').disabled=false; } };
const text = (f,k) => String(f.get(k)||'').trim();
const num = (f,k) => Math.round(Number(f.get(k)||0)*100)/100;
const optsEvents = () => plan.events.map(e => [e.id,e.name]);
function shell(content) {
  const title = tabs.find(t => t[0]===tab)[2], due = reminders(plan).filter(x=>x.tab==='tasks').length;
  $('app').innerHTML = `<aside class="sidebar"><a class="brand" href="./"><span>✧</span><div>Together<small>YOUR WEDDING, THOUGHTFULLY PLANNED</small></div></a><div class="wedding-label"><span class="tiny">OUR CELEBRATION</span><strong>${esc(plan.settings.title)}</strong><small>${esc(dateLabel(plan.settings.date))}</small></div><nav>${tabs.map(([id,icon,name]) => `<button data-action="nav" data-id="${id}" class="${tab===id?'active':''}"><span>${icon}</span>${name}${id==='tasks'&&due?`<i>${due}</i>`:''}</button>`).join('')}</nav><div class="sidebar-foot">${badge(demo?'LOCAL DEMO':'SHARED WORKSPACE',demo?'amber':'green')}<small>${demo?'Demo data stays in this browser.':esc(session?.user.email || '')}</small>${btn('exit',demo?'Exit demo':'Sign out','','text')}<a href="legacy.html">Original guest planner ↗</a></div></aside><main><header><div><p class="eyebrow">A LITTLE CALM FOR YOUR BIG DAY</p><h1>${esc(title)}</h1><p class="muted">${tab==='overview'?'Everything coming together, one beautiful detail at a time.':subtitle(tab)}</p></div><div class="header-actions">${tab!=='settings'?btn('print','Print / PDF'):''}${['guests','budget'].includes(tab)?btn('excel','Export Excel','','primary'):''}</div></header>${demo?'<div class="mode-banner">You’re exploring a local demo. Connect your Supabase project for private accounts and shared online data.</div>':''}<div id="page">${content}</div><footer class="page-footer"><span>One wedding. Two people. All the details.</span><span>${demo?'Saved on this device':'Online workspace · checks for changes every 20 seconds'}</span></footer></main>`;
}
function subtitle(t) { return ({guests:'Your people, connected by family and friendship.',budget:'Make every rupee part of a thoughtful plan.',tasks:'Small steps toward a day you’ll remember.',events:'Give every celebration its own place and time.',vendors:'The people helping bring your day to life.',seating:'A place for everyone, at every event.',settings:'Make this space yours, and keep your plans safe.'})[t]; }
function overview() {
  const g = guestList(), b = budgetTotals(plan), done=plan.tasks.filter(t=>t.status==='Done').length, due=reminders(plan);
  const days = plan.settings.date ? Math.ceil((Date.parse(plan.settings.date+'T00:00:00+05:30')-Date.parse(today()+'T00:00:00+05:30'))/86400000) : null;
  const nearest = [...plan.events].filter(e=>e.date && e.date>=today()).sort((a,b)=>a.date.localeCompare(b.date))[0];
  return `<section class="hero"><div><p class="eyebrow">YOUR NEXT CHAPTER</p><h2>${esc([plan.settings.partner1,plan.settings.partner2].filter(Boolean).join(' & ') || 'Let’s plan something beautiful.')}</h2><p>${days===null?'Start with your date, your people, and what matters to you.':days>=0?`${days} days until your wedding`:'Your wedding date has passed'}</p>${btn('settings-edit','Wedding details','','light')}</div><div class="hero-mark">✧<span>TOGETHER</span></div></section>${stats([['Invited guests',g.filter(x=>x.invited).length,`${g.length} people in your tree`],['Wedding budget',money(plan.settings.budget),`${money(b.available)} unallocated against actual costs`],['Payments made',money(b.paid),`${money(b.remaining)} balance on actual costs`],['Tasks completed',`${done} / ${plan.tasks.length}`,'A little progress, every day']])}<div class="two-col"><section class="panel"><div class="section-head"><h2>Needs your attention</h2>${badge(due.length+' due','amber')}</div>${due.length?due.slice(0,8).map(x=>`<button class="attention" data-action="nav" data-id="${x.tab}"><span>${badge(x.kind)}<strong>${esc(x.name)}</strong></span><small>${x.date<today()?'Overdue':'Due today'} · ${esc(dateLabel(x.date))}</small></button>`).join(''):empty('A little breathing room','No tasks or payments are due today.','task-edit','Add a task')}</section><section class="panel"><div class="section-head"><h2>Coming together</h2>${btn('event-edit','+ Event')}</div>${nearest?`<div class="next-event"><span class="eyebrow">NEXT EVENT</span><h3>${esc(nearest.name)}</h3><p>${esc(dateLabel(nearest.date))} · ${esc(nearest.time||'Time to be set')}</p><p>${esc(nearest.venue||'Venue to be set')}</p></div>`:empty('Your celebrations','Add your ceremony, reception, or other events.')}<div class="quick-links">${btn('nav','♧ Plan your guests','guests')}${btn('nav','◉ Review your budget','budget')}${btn('nav','☑ See your checklist','tasks')}</div></section></div>`;
}
function treeNode(n, root=false, depth=0) {
  const person=n.type==='person', count=people(n), isClosed=closed.has(n.id);
  return `<li><article class="node ${root?'root-node':person?'person-node':'group-node'} ${n.invited?'invited':''}">${person?`<label><input type="checkbox" data-invite="${esc(n.id)}" ${n.invited?'checked':''}><strong>${esc(n.name)}</strong></label><span class="invite-label">${n.invited?'✓ Invited':'Not invited'}</span>`:`<div class="node-title"><button data-action="collapse" data-id="${esc(n.id)}" aria-label="${isClosed?'Expand':'Collapse'} ${esc(n.name)}" aria-expanded="${!isClosed}">${isClosed?'▸':'▾'}</button><strong>${esc(root?plan.settings.title:n.name)}</strong></div><small>${count.filter(x=>x.invited).length} invited · ${count.length} people</small><div class="node-actions">${btn('person-add','+ Person',n.id,'text')}${depth<17?btn('group-add','+ Branch',n.id,'text'):''}</div>`}${!root?`<div class="node-edit">${btn(person?'guest-edit':'group-edit','Edit',n.id,'text')}${btn('node-delete','×',n.id,'text danger')}</div>`:''}</article>${n.children?.length&&!isClosed?`<ul>${n.children.map(c=>treeNode(c,false,depth+1)).join('')}</ul>`:''}</li>`;
}
function guestsPage() {
  const all=guestList(), invited=all.filter(g=>g.invited), filtered=all.filter(g=>(g.name+' '+g.path+' '+(g.household||'')).toLowerCase().includes(query.toLowerCase()));
  const event=plan.events.find(x=>x.id===selectedEvent);
  return `${stats([['In your tree',all.length,'Each card is one person'],['Selected to invite',invited.length,'Includes adults and children'],['Invitations sent',invited.filter(g=>g.sent).length,'Marked manually'],['Confirmed',event?invited.filter(g=>guestRsvp(g,event.id)==='Attending').length:'—',event?.name||'Choose an event in list view']])}<section class="panel flush"><div class="toolbar"><div class="segmented">${btn('guest-view','Mind map','tree',view==='tree'?'active':'')}${btn('guest-view','Guest list','list',view==='list'?'active':'')}</div><div>${btn('legacy-import','Import old sheets')}${btn('person-add','+ Guest',plan.tree.id,'primary')}</div></div>${view==='tree'?`<div class="canvas-hint"><span>Each branch has its own color. Tick a person to invite them.</span>${btn('expand-all','Expand all','','text')}</div><div class="tree-canvas"><ul class="tree-root">${treeNode(plan.tree,true)}</ul></div>`:`<div class="filterbar"><input id="guest-search" placeholder="Search guests, categories, households…" value="${esc(query)}" aria-label="Search guests"><select id="guest-event" aria-label="Event for RSVP"><option value="">All guests / no event filter</option>${plan.events.map(e=>`<option value="${e.id}" ${selectedEvent===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}</select></div>${filtered.length?table(['Guest','Category / family','Invite','RSVP','Meal',''],filtered.map(g=>row([`<strong>${esc(g.name)}</strong><small>${esc(g.household||g.phone||'')}</small>`,esc(g.path),`<label><input type="checkbox" data-invite="${esc(g.id)}" ${g.invited?'checked':''}> ${g.invited?'Invited':'Not invited'}</label>`,event?badge(guestRsvp(g,event.id),guestRsvp(g,event.id)==='Attending'?'green':''): 'Choose an event',esc(event?g.events?.[event.id]?.meal||'—':'—'),actions('guest-edit',g.id)]))):empty('No guests found','Add people to your family branches, or change your search.')}<p class="table-note">RSVP is recorded for each event. Add plus-ones and children as individual guests.</p>`}</section>`;
}
function budgetPage() {
  const b=budgetTotals(plan);
  return `${stats([['Planned budget',money(plan.settings.budget),'Set in Wedding details'],['Estimated costs',money(b.estimated),'Your initial estimates'],['Actual costs',money(b.actual),`${money(b.available)} budget remaining`],['Outstanding',money(b.remaining),`${money(b.paid)} already paid`]])}<section class="panel"><div class="section-head"><div><h2>Every detail, accounted for</h2><p class="muted">Track deposits and installments against each expense.</p></div>${btn('expense-edit','+ Expense','','primary')}</div>${plan.expenses.length?plan.expenses.map(e=>{const paid=sum(e.payments.filter(x=>x.paid).map(x=>x.amount));return `<article class="expense"><div class="expense-top"><div>${badge(e.category)}<h3>${esc(e.name)}</h3><small>${esc(vendorName(e.vendorId))}</small></div><div><span>Estimate <b>${money(e.estimate)}</b></span><span>Actual <b>${money(e.actual)}</b></span><span>Balance <b>${money(sum([e.actual,-paid]))}</b></span></div>${actions('expense-edit',e.id,'expense-delete')}</div>${e.payments.length?table(['Installment','Due','Amount','Status',''],e.payments.map(p=>row([esc(p.name),esc(dateLabel(p.due)),money(p.amount),badge(p.paid?'Paid':p.due&&p.due<today()?'Overdue':'Pending',p.paid?'green':'amber'),`${btn('payment-toggle',p.paid?'Mark unpaid':'Mark paid',e.id+'|'+p.id,'text')}${btn('payment-edit','Edit',e.id+'|'+p.id,'text')}${btn('payment-delete','Remove',e.id+'|'+p.id,'text danger')}`]))):'<p class="muted">No payments scheduled yet.</p>'}${btn('payment-edit','+ Deposit / installment',e.id,'text')}</article>`;}).join(''):empty('Start with the big pieces','Add your venue, catering, outfits, photography, and other costs.','expense-edit','Add your first expense')}</section>`;
}
function tasksPage() { return `<section class="panel"><div class="section-head"><div><h2>Your wedding checklist</h2><p class="muted">Give each task an owner, a due date, and a next step.</p></div><div>${btn('starter-tasks','Add starter checklist')}${btn('task-edit','+ Task','','primary')}</div></div>${plan.tasks.length?table(['Task','Owner','Due date','Priority','Progress',''],[...plan.tasks].sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).map(t=>row([`<strong>${esc(t.title)}</strong><small>${esc(t.notes||'')}</small>`,esc(t.owner||'Together'),`${esc(dateLabel(t.due))}${t.due&&t.due<today()&&t.status!=='Done'?badge('Overdue','amber'):''}`,badge(t.priority),badge(t.status,t.status==='Done'?'green':''),actions('task-edit',t.id,'task-delete')]))):empty('Begin with a few simple steps','Use the starter checklist or add your own tasks.','starter-tasks','Add starter checklist')}</section>`; }
function eventsPage() { return `<section class="panel"><div class="section-head"><h2>Your celebrations</h2>${btn('event-edit','+ Event','','primary')}</div>${plan.events.length?`<div class="event-grid">${plan.events.map(e=>`<article class="event-card"><span class="eyebrow">${esc(dateLabel(e.date))}</span><h3>${esc(e.name)}</h3><p>${esc(e.time||'Time not set')} · ${esc(e.venue||'Venue not set')}</p><p>${esc(e.address||'')}</p>${badge(guestList().filter(g=>g.invited&&guestRsvp(g,e.id)==='Attending').length+' confirmed','green')}${actions('event-edit',e.id,'event-delete')}</article>`).join('')}</div>`:empty('More than one beautiful moment','Add your ceremony, reception, homecoming, or engagement.','event-edit','Add an event')}</section><section class="panel"><div class="section-head"><h2>Wedding-day timeline</h2>${btn('timeline-edit','+ Timeline item','','primary')}</div>${plan.timeline.length?table(['Event','Time','Activity','Responsible','Notes',''],[...plan.timeline].sort((a,b)=>(eventName(a.eventId)+a.time).localeCompare(eventName(b.eventId)+b.time)).map(t=>row([esc(eventName(t.eventId)),esc(t.time),`<strong>${esc(t.title)}</strong>`,esc(t.owner),esc(t.notes),actions('timeline-edit',t.id,'timeline-delete')]))):empty('Give the day a gentle rhythm','Add arrival times, ceremonies, meals, photos, and other moments.')}</section>`; }
function vendorsPage() { return `<section class="panel"><div class="section-head"><h2>Your wedding team</h2>${btn('vendor-edit','+ Vendor','','primary')}</div>${plan.vendors.length?table(['Vendor','Service','Contact','Booking','Notes',''],plan.vendors.map(v=>row([`<strong>${esc(v.name)}</strong>`,esc(v.category),`${esc(v.contact)}<small>${esc(v.phone)}<br>${esc(v.email)}</small>`,badge(v.status,v.status==='Booked'?'green':''),esc(v.notes),actions('vendor-edit',v.id,'vendor-delete')]))):empty('Bring your team together','Keep venues, photographers, florists, and other contacts in one place.','vendor-edit','Add a vendor')}</section>`; }
function seatingPage() { return `<section class="panel"><div class="section-head"><div><h2>A place for everyone</h2><p class="muted">Separate tables for each event. A guest can sit at only one table per event.</p></div>${btn('table-edit','+ Table','','primary')}</div>${plan.tables.length?`<div class="seating-grid">${plan.tables.map(t=>{const g=guestList(); return `<article class="seat-card"><span class="eyebrow">${esc(eventName(t.eventId))}</span><div class="section-head"><h3>${esc(t.name)}</h3>${badge(`${t.guests.length} / ${t.capacity}`)}</div><ul>${t.guests.map(id=>{const p=g.find(x=>x.id===id); return `<li>${esc(p?.name||'Removed guest')}${!p?.invited||['Not invited','Declined'].includes(guestRsvp(p||{},t.eventId))?badge('Review','amber'):''}</li>`;}).join('')||'<li class="muted">No guests assigned yet</li>'}</ul><div class="row-actions">${btn('seat-guests','Assign guests',t.id,'primary')}${actions('table-edit',t.id,'table-delete')}</div></article>`;}).join('')}</div>`:empty('Start your seating plan','Create an event first, then add tables and assign invited guests.','table-edit','Add a table')}</section>`; }
function settingsPage() { return `<div class="two-col"><section class="panel"><h2>Your wedding</h2><dl><dt>Names</dt><dd>${esc([plan.settings.partner1,plan.settings.partner2].filter(Boolean).join(' & ')||'Set these later')}</dd><dt>Wedding date</dt><dd>${esc(dateLabel(plan.settings.date))}</dd><dt>Budget</dt><dd>${money(plan.settings.budget)}</dd><dt>Currency & time zone</dt><dd>LKR · Asia/Colombo</dd></dl>${btn('settings-edit','Edit wedding details','','primary')}</section><section class="panel"><h2>Your shared space</h2><p class="muted">${demo?'This is a local demonstration. Exit demo to configure online storage and sign in.':'Both partners have full editing access. Send the invitation code privately to your partner after they create an account.'}</p>${!demo?btn('partner-invite','Create partner invitation','','primary'):btn('exit','Set up shared access','','primary')}<div id="invite-code"></div>${!demo?btn('refresh','Check for partner’s changes','','text'):''}</section><section class="panel"><h2>Keep a copy</h2><p class="muted">Download your complete plan or restore a backup. Restoring replaces this workspace after confirmation.</p>${btn('backup','Download full backup','','primary')}${btn('restore','Restore backup')}${recovery?btn('recover','Recover unsaved changes','','secondary'):''}</section><section class="panel"><h2>Bring your guest lists together</h2><p class="muted">Import your original guest sheets as categories. Existing names are kept, including duplicates, so you can review them yourself.</p>${btn('legacy-import','Import old sheets','','primary')}<p><a href="legacy.html">Open the original guest planner ↗</a></p></section></div>`; }
function render() { if (!plan) return; const content=({overview,guests:guestsPage,budget:budgetPage,tasks:tasksPage,events:eventsPage,vendors:vendorsPage,seating:seatingPage,settings:settingsPage})[tab](); shell(content); }

function settingsEdit() { const s=plan.settings; dialog('Your wedding details',[['title','Wedding name','text',s.title,[],true],['partner1','Your name','text',s.partner1],['partner2','Partner’s name','text',s.partner2],['date','Wedding date','date',s.date],['budget','Total budget (LKR)','number',s.budget]],f=>commit(p=>{p.settings={title:text(f,'title'),partner1:text(f,'partner1'),partner2:text(f,'partner2'),date:text(f,'date'),budget:num(f,'budget')};})); }
function guestEdit(id,parent) {
  const g=id?find(plan.tree,id):{name:'',invited:false}; if(!g) return;
  const groups=[]; function walk(n,path=[]) { if(n.children) { groups.push([n.id,path.length?path.join(' / '):'Wedding (no branch)']); n.children.forEach(c=>{if(c.children)walk(c,[...path,c.name]);}); } } walk(plan.tree);
  function parentOf(n) { if(n.children?.some(x=>x.id===id)) return n.id; for(const c of n.children||[]) {const r=parentOf(c);if(r)return r;} }
  const fields=[['name','Guest name','text',g.name,[],true],['parent','Category / family branch','select',parent||parentOf(plan.tree),groups],['side','Side','select',g.side||'Together',['Together','Bride','Groom']],['household','Household / family name','text',g.household||''],['phone','Phone','tel',g.phone||''],['address','Address','textarea',g.address||''],['age','Guest type','select',g.age||'Adult',['Adult','Child']],['invited','Selected to invite','checkbox',g.invited],['sent','Invitation sent','checkbox',g.sent],['notes','Notes','textarea',g.notes||'']];
  plan.events.forEach((e,i)=>fields.push(['rsvp'+i,e.name+' — RSVP','select',guestRsvp(g,e.id),['Not invited','Pending','Attending','Declined']],['meal'+i,e.name+' — Meal preference','text',g.events?.[e.id]?.meal||'']));
  dialog(id?'Guest details':'Add a guest',fields,f=>commit(p=>{
    const n={...g,id:g.id||uid(),type:'person',name:text(f,'name'),side:text(f,'side'),household:text(f,'household'),phone:text(f,'phone'),address:text(f,'address'),age:text(f,'age'),notes:text(f,'notes'),invited:f.has('invited'),sent:f.has('sent'),events:{}};
    plan.events.forEach((e,i)=>n.events[e.id]={rsvp:text(f,'rsvp'+i),meal:text(f,'meal'+i)});
    if(id) remove(p.tree,id); find(p.tree,text(f,'parent')).children.push(n);
  }),'Each card is one person. Add a plus-one or child as a separate guest.');
}
function recordEdit(kind,id,extra) {
  const defs={
    task:{list:'tasks',title:'Task',defaults:{status:'To do',priority:'Normal'},fields:[['title','Task','text',true],['owner','Responsible person'],['due','Due date','date'],['priority','Priority','select',['Normal','High','Low']],['status','Progress','select',['To do','In progress','Done']],['notes','Notes','textarea']]},
    event:{list:'events',title:'Event',fields:[['name','Event name','text',true],['date','Date','date'],['time','Start time','time'],['venue','Venue'],['address','Address'],['notes','Notes','textarea']]},
    vendor:{list:'vendors',title:'Vendor',defaults:{status:'Researching'},fields:[['name','Business / vendor name','text',true],['category','Service category'],['contact','Contact person'],['phone','Phone','tel'],['email','Email','email'],['status','Booking status','select',['Researching','Contacted','Shortlisted','Booked']],['notes','Notes','textarea']]},
    expense:{list:'expenses',title:'Expense',defaults:{estimate:0,actual:0,payments:[]},fields:[['name','Expense name','text',true],['category','Category','select',['Venue','Catering','Photography','Outfits','Decor','Entertainment','Transport','Stationery','Other']],['vendorId','Vendor','select',[['','Not assigned'],...plan.vendors.map(v=>[v.id,v.name])]],['estimate','Estimated cost (LKR)','number'],['actual','Actual / agreed cost (LKR)','number'],['notes','Notes','textarea']]},
    timeline:{list:'timeline',title:'Timeline item',fields:[['eventId','Event','select',optsEvents()],['time','Time','time',true],['title','Activity','text',true],['owner','Responsible person'],['notes','Notes','textarea']]},
    table:{list:'tables',title:'Seating table',defaults:{capacity:8,guests:[]},fields:[['eventId','Event','select',optsEvents()],['name','Table name','text',true],['capacity','Seats','number',true]]}
  };
  if(['timeline','table'].includes(kind)&&!plan.events.length) {toast('Add an event first in Events & Timeline.');return;}
  const d=defs[kind], existing=plan[d.list].find(x=>x.id===id), record=existing||d.defaults||{};
  dialog((existing?'Edit ':'Add ')+d.title,d.fields.map(([key,label,type='text',req])=>[key,label,type,record[key]??'',Array.isArray(req)?req:[],req===true||key==='eventId']),f=>commit(p=>{
    const n={...record,id:existing?.id||uid()};
    for(const [key,,type] of d.fields) n[key]=type==='number'?num(f,key):text(f,key);
    if(kind==='table') {if(n.capacity<1||!Number.isInteger(n.capacity)||n.capacity<n.guests.length)throw Error('Capacity must be a whole number and fit assigned guests.');if(existing&&n.eventId!==existing.eventId&&existing.guests.length)throw Error('Unassign guests before changing this table’s event.');}
    if(existing) p[d.list]=p[d.list].map(x=>x.id===id?n:x); else p[d.list].push(n);
  }));
}
function paymentEdit(key) {
  const [expenseId,paymentId]=key.split('|'), e=plan.expenses.find(x=>x.id===expenseId), old=e.payments.find(x=>x.id===paymentId), p=old||{name:'',amount:0,due:'',paid:false};
  dialog(old?'Edit payment':'Add deposit / installment',[['name','Payment label','text',p.name,[],true],['amount','Amount (LKR)','number',p.amount,[],true],['due','Due date','date',p.due],['paid','Already paid','checkbox',p.paid]],f=>commit(next=>{const n={id:paymentId||uid(),name:text(f,'name'),amount:num(f,'amount'),due:text(f,'due'),paid:f.has('paid')}; const e=next.expenses.find(x=>x.id===expenseId); if(paymentId)e.payments=e.payments.map(x=>x.id===paymentId?n:x);else e.payments.push(n);}));
}
function assignSeats(id) {
  const t=plan.tables.find(x=>x.id===id), available=guestList().filter(g=>g.invited&&!['Not invited','Declined'].includes(guestRsvp(g,t.eventId))&&!plan.tables.some(other=>other.id!==id&&other.eventId===t.eventId&&other.guests.includes(g.id)));
  dialog('Assign guests — '+t.name,[],f=>commit(p=>{const ids=f.getAll('seat'), issue=seatingIssue(p,t,ids);if(issue)throw Error(issue);p.tables.find(x=>x.id===id).guests=ids;}),`${t.capacity} seats. Only guests invited to ${eventName(t.eventId)} are available.`, `<div class="seat-options">${available.map(g=>`<label><input type="checkbox" name="seat" value="${g.id}" ${t.guests.includes(g.id)?'checked':''}> ${esc(g.name)} <small>${esc(g.path)}</small></label>`).join('')||'<p>No eligible guests. Set event invitations on their guest cards first.</p>'}</div>`);
}
function legacyImport(raw) {
  try { const legacy=raw||JSON.parse(localStorage.getItem('wedding-guest-tree-v1')||'null'); if(!legacy) {toast('No old sheets in this browser. Use Settings → Restore backup and select your original JSON backup.');return;}
    const result=migrateLegacy(plan,legacy); if(!result.added){toast('These sheets have already been imported.');return;}
    dialog('Import original guest sheets',[],()=>commit(p=>{const next=migrateLegacy(p,legacy);Object.assign(p,next.plan);}),`${result.added} sheets will become new categories, adding ${people(result.plan.tree).length-guestList().length} people. Original sheets remain untouched. Duplicate names are kept for your review.`);
  } catch(e){toast(e.message);}
}
function printCurrent() {
  let content=''; const title=tabs.find(x=>x[0]===tab)[2];
  if(tab==='guests') content=table(['Guest','Category','Phone','Invitation sent'],guestList().filter(g=>g.invited).map(g=>row([esc(g.name),esc(g.path),esc(g.phone),g.sent?'Yes':'No'])));
  else if(tab==='budget') content=table(['Expense','Category','Estimated','Actual','Paid','Balance'],plan.expenses.map(e=>{const paid=sum(e.payments.filter(x=>x.paid).map(x=>x.amount));return row([esc(e.name),esc(e.category),money(e.estimate),money(e.actual),money(paid),money(sum([e.actual,-paid]))]);}));
  else content=$('page').innerHTML;
  $('print-view').innerHTML=`<p>TOGETHER · WEDDING PLANNER</p><h1>${esc(plan.settings.title)}</h1><h2>${esc(title)}</h2><p>${esc(dateLabel(today()))}${tab==='guests'?` · ${guestList().filter(g=>g.invited).length} invited guests`:''}</p>${content}`; window.print();
}
async function exportExcel() {
  const {guestWorkbook,budgetWorkbook}=await import('./planner-export.js');
  const {writeFileXLSX}=await import('./xlsx.mjs');
  const {exportFilename}=await import('./excel-export.js');
  writeFileXLSX(tab==='guests'?guestWorkbook(plan):budgetWorkbook(plan),tab==='guests'?exportFilename(plan.settings.title):'wedding-budget.xlsx',{compression:true});
}
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]'); if(!b)return;
  const a=b.dataset.action,id=b.dataset.id;
  try {
    if(a==='demo'){demo=true;try{plan=validatePlan(JSON.parse(localStorage.getItem(DEMO)));}catch{plan=emptyPlan();}render();return;}
    if(a==='connect'){connectionDialog();return;}
    if(a==='login'||a==='signup'||a==='reset'){authDialog(a);return;}
    if(a==='create-workspace'){const {error}=await client.rpc('create_wedding',{p_payload:emptyPlan()});if(error)throw error;await loadWorkspace();return;}
    if(a==='join-workspace'){dialog('Join your partner’s wedding',[['code','Invitation code','text','',[],true]],async f=>{const {error}=await client.rpc('join_wedding',{p_token:text(f,'code')});if(error)throw error;await loadWorkspace();});return;}
    if(a==='exit'){clearInterval(refreshTimer);refreshTimer=undefined;if(!demo&&client)await client.auth.signOut();demo=false;plan=null;session=null;recovery=undefined;weddingId=undefined;revision=undefined;tab='overview';landing();return;}
    if(a==='nav'){tab=id;query='';render();return;}
    if(a==='settings-edit'){settingsEdit();return;}
    if(a==='guest-view'){view=id;render();return;}
    if(a==='collapse'){closed.has(id)?closed.delete(id):closed.add(id);render();return;}
    if(a==='expand-all'){closed.clear();render();return;}
    if(a==='person-add'){guestEdit('',id);return;}
    if(a==='guest-edit'){guestEdit(id);return;}
    if(a==='group-add'||a==='group-edit'){const n=find(plan.tree,id);dialog(a==='group-add'?'Add a family branch':'Rename branch',[['name','Branch name','text',a==='group-edit'?n.name:'',[],true]],f=>commit(p=>{const n=find(p.tree,id);if(a==='group-add')n.children.push(branch(text(f,'name')));else n.name=text(f,'name');}));return;}
    if(a==='node-delete'){const n=find(plan.tree,id);confirmAction('Remove '+n.name+'?','This removes the person or branch and its people. Export a backup first if needed.',p=>{const ids=new Set(n.type==='person'?[n.id]:people(n).map(g=>g.id));remove(p.tree,id);p.tables.forEach(t=>t.guests=t.guests.filter(x=>!ids.has(x)));});return;}
    const kind=a.split('-')[0];
    if(['task','event','vendor','expense','timeline','table'].includes(kind)&&a.endsWith('-edit')){recordEdit(kind,id);return;}
    if(['task','event','vendor','expense','timeline','table'].includes(kind)&&a.endsWith('-delete')){
      const list={task:'tasks',event:'events',vendor:'vendors',expense:'expenses',timeline:'timeline',table:'tables'}[kind];
      confirmAction('Remove this '+kind+'?',kind==='event'?'This also removes its RSVP entries, timeline and seating tables.':'This removes the record. Export a backup first if needed.',p=>{p[list]=p[list].filter(x=>x.id!==id);if(kind==='event'){p.timeline=p.timeline.filter(x=>x.eventId!==id);p.tables=p.tables.filter(x=>x.eventId!==id);function walk(n){if(n.events)delete n.events[id];n.children?.forEach(walk);}walk(p.tree);}if(kind==='vendor')p.expenses.forEach(x=>{if(x.vendorId===id)x.vendorId='';});});return;
    }
    if(a==='payment-edit'){paymentEdit(id);return;}
    if(a==='payment-toggle'){await commit(p=>{const [eid,pid]=id.split('|');const pay=p.expenses.find(x=>x.id===eid).payments.find(x=>x.id===pid);pay.paid=!pay.paid;});return;}
    if(a==='payment-delete'){confirmAction('Remove this installment?','This will change your recorded payment totals.',p=>{const [eid,pid]=id.split('|');const expense=p.expenses.find(x=>x.id===eid);expense.payments=expense.payments.filter(x=>x.id!==pid);});return;}
    if(a==='seat-guests'){assignSeats(id);return;}
    if(a==='starter-tasks'){const names=['Agree on your wedding budget','Choose ceremony and reception dates','Shortlist venues','Prepare the guest list','Book photographer and videographer','Choose catering and menu','Plan outfits and fittings','Send invitations','Confirm guest responses','Prepare wedding-day timeline'];const missing=names.filter(name=>!plan.tasks.some(t=>t.title===name));if(!missing.length){toast('Starter tasks are already in your checklist.');return;}await commit(p=>missing.forEach(title=>p.tasks.push({id:uid(),title,owner:'Together',due:'',priority:'Normal',status:'To do',notes:''})));return;}
    if(a==='legacy-import'){legacyImport();return;}
    if(a==='backup'){download('wedding-planner-backup.json',JSON.stringify(plan,null,2));return;}
    if(a==='recover'){download('wedding-unsaved-changes.json',JSON.stringify(recovery,null,2));return;}
    if(a==='restore'){$('backup-file').click();return;}
    if(a==='excel'){await exportExcel();toast('Excel download started.');return;}
    if(a==='print'){printCurrent();return;}
    if(a==='refresh'){await loadWorkspace();toast('Loaded the latest shared version.');return;}
    if(a==='partner-invite'){const {data,error}=await client.rpc('invite_wedding_partner',{p_id:weddingId});if(error)throw error;$('invite-code').textContent=`Invitation code: ${data}. Expires in 7 days; can be used once. Your partner should sign in, then choose Join wedding.`;return;}
  } catch(err){toast(err.message||'Unable to complete this action.');}
});
document.addEventListener('change',async e=>{
  if(e.target.dataset.invite){const id=e.target.dataset.invite,value=e.target.checked;try{await commit(p=>find(p.tree,id).invited=value);}catch{e.target.checked=!value;}}
  if(e.target.id==='guest-event'){selectedEvent=e.target.value;render();}
});
document.addEventListener('input',e=>{if(e.target.id==='guest-search'){query=e.target.value;const pos=e.target.selectionStart;render();const f=$('guest-search');f.focus();f.setSelectionRange(pos,pos);}});
$('backup-file').onchange=async()=>{const f=$('backup-file').files[0];if(!f)return;try{if(f.size>5000000)throw Error('Backup must be under 5 MB.');const raw=JSON.parse(await f.text());if(raw.version===1){legacyImport(raw);return;}validatePlan(raw);dialog('Restore wedding backup',[],()=>commit(p=>Object.assign(p,raw)),`Replace the current plan with “${raw.settings.title}”: ${people(raw.tree).length} people, ${raw.events.length} events, ${raw.tasks.length} tasks. Download your current backup first if needed.`);}catch(e){toast(e.message);}finally{$('backup-file').value='';}};

function landing() {
  $('app').innerHTML=`<div class="welcome"><div class="welcome-art"><a class="brand" href="./"><span>✧</span><div>Together<small>YOUR WEDDING PLANNER</small></div></a><div><p class="eyebrow">ONE WEDDING. ALL YOUR POSSIBILITIES.</p><h1>A beautiful day<br>begins together.</h1><p>A calm home for your people, plans, and everything in between.</p><div class="welcome-tags"><span>Guests & family trees</span><span>Budget & payments</span><span>Your day, planned</span></div></div><span class="art-flower">✧</span></div><section class="welcome-card"><p class="eyebrow">WELCOME TO YOUR PLANNING SPACE</p><h2>${config.url?'Your next chapter awaits.':'Let’s make it yours.'}</h2><p class="muted">${config.url?'Sign in to your private wedding workspace. Both partners can plan together.':'Connect a free Supabase project to enable accounts and shared online storage. You can explore the planner in demo mode while setting up.'}</p><div class="welcome-actions">${config.url?btn('login','Sign in','','primary')+btn('signup','Create an account'):btn('connect','Connect Supabase','','primary')}${btn('demo','Explore local demo')}</div>${config.url?btn('connect','Connection settings','','text'):''}<p class="muted small">${config.url?'Only wedding members can access its data.':'The demo saves only to this browser; it does not sync with your partner.'}</p><a href="SETUP.md" target="_blank" rel="noopener">Read the setup guide ↗</a><a href="legacy.html">Open your original guest planner ↗</a></section></div>`;
}
function validateConnection(url,key) {
  let u;try{u=new URL(url);}catch{throw Error('Enter the Supabase project URL.');}
  if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co')||u.pathname!=='/')throw Error('Use the HTTPS project URL from Supabase, such as https://your-project.supabase.co.');
  if(key.startsWith('sb_secret_'))throw Error('Use a publishable key, never a secret key.');
  if(!key.startsWith('sb_publishable_')){try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.role!=='anon')throw Error();}catch{throw Error('Use a publishable key or the legacy anon public key. Never use service_role.');}}
  return {url:u.origin,key};
}
function connectionDialog(){dialog('Connect your private workspace',[['url','Supabase Project URL','url',config.url||'',[],true],['key','Publishable key (safe for browser use)','text',config.key||'',[],true]],async f=>{const next=validateConnection(text(f,'url'),text(f,'key'));localStorage.setItem(CONFIG,JSON.stringify(next));location.reload();},'First run planner-schema.sql in your Supabase SQL Editor. This connection is saved on this browser; configure the same project on your partner’s device. Never enter your database password or secret key here.');}
function authDialog(mode){
  const fields=[['email','Email address','email','',[],true]];if(mode!=='reset')fields.push(['password','Password','password','',[],true]);
  dialog(mode==='login'?'Welcome back':mode==='signup'?'Create your account':'Reset your password',fields,async f=>{
    if(mode==='login'){const {error}=await client.auth.signInWithPassword({email:text(f,'email'),password:String(f.get('password'))});if(error)throw error;await loadWorkspace();}
    if(mode==='signup'){const {data,error}=await client.auth.signUp({email:text(f,'email'),password:String(f.get('password')),options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;if(data.session)await loadWorkspace();else toast('Check your email to confirm your account, then sign in.');}
    if(mode==='reset'){const {error}=await client.auth.resetPasswordForEmail(text(f,'email'),{redirectTo:location.origin+location.pathname});if(error)throw error;toast('If the address is registered, a password reset email will be sent.');}
  },mode==='signup'?'Use separate accounts for you and your partner. The first partner creates the wedding; the second joins using an invitation code.':'',mode==='login'?'<p><button type="button" id="forgot-password" class="text">Forgot your password?</button></p>':'');
  if(mode==='login')$('forgot-password').onclick=()=>{$('modal').close();authDialog('reset');};
}
async function loadWorkspace(background=false) {
  if(demo||busy)return;
  const {data:{session:s}}=await client.auth.getSession();session=s;if(!session){plan=null;landing();return;}
  const {data,error}=await client.from('wedding_workspaces').select('id,payload,revision').limit(1);if(error)throw Error('Unable to load the wedding. Confirm planner-schema.sql has been run in this project. '+error.message);
  if(!data.length){plan=null;$('app').innerHTML=`<div class="onboarding"><p class="eyebrow">YOU’RE SIGNED IN</p><h1>Make this your space.</h1><p>Create your wedding, or join the one your partner has already started.</p>${btn('create-workspace','Create our wedding','','primary')}${btn('join-workspace','Join partner’s wedding')}${btn('exit','Sign out','','text')}</div>`;return;}
  const w=data[0];if(background&&w.revision===revision)return;
  validatePlan(w.payload);plan=w.payload;weddingId=w.id;revision=w.revision;render();if(background)toast('Updated with your partner’s latest changes.');
  if(!refreshTimer)refreshTimer=setInterval(()=>{if(!demo&&!busy&&!$('modal').open&&!document.hidden&&document.activeElement?.tagName!=='INPUT')loadWorkspace(true).catch(e=>toast('Sync paused: '+e.message));},20000);
}
async function init(){
  try{config=JSON.parse(localStorage.getItem(CONFIG)||'null')||await fetch('planner-config.json').then(r=>r.json());}catch{config={};}
  if(config.url&&config.key){
    try{validateConnection(config.url,config.key);if(!window.supabase)throw Error('Account library did not load. Please refresh.');client=window.supabase.createClient(config.url,config.key);
      client.auth.onAuthStateChange((event,s)=>{session=s;if(event==='PASSWORD_RECOVERY'){setTimeout(()=>dialog('Choose a new password',[['password','New password','password','',[],true]],async f=>{const {error}=await client.auth.updateUser({password:String(f.get('password'))});if(error)throw error;await loadWorkspace();}),0);}if(event==='SIGNED_OUT'&&!demo){plan=null;landing();}});
      await loadWorkspace();
    }catch(e){landing();toast(e.message);}
  }else landing();
}
init();

