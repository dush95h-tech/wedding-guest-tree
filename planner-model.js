import { uid, branch, people, validate as validateLegacy } from './model.js';
export { uid, branch, people };
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const money = n => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 2 }).format(Number(n) || 0);
export const sum = xs => xs.reduce((a, b) => a + Math.round(Number(b || 0) * 100), 0) / 100;
export function emptyPlan() {
  return { version: 2, settings: { title: 'Our wedding', partner1: '', partner2: '', date: '', budget: 0 }, tree: { id: uid(), name: 'Our guests', children: [branch('Bride’s family'), branch('Groom’s family'), branch('Friends')] }, tasks: [], events: [], vendors: [], expenses: [], timeline: [], tables: [], imports: [] };
}
export function budgetTotals(p) {
  const estimated = sum(p.expenses.map(e => e.estimate));
  const actual = sum(p.expenses.map(e => e.actual));
  const paid = sum(p.expenses.flatMap(e => e.payments.filter(x => x.paid).map(x => x.amount)));
  return { estimated, actual, paid, remaining: sum([actual, -paid]), available: sum([p.settings.budget, -actual]) };
}
export function guestRsvp(g, eventId) { return g.events?.[eventId]?.rsvp || 'Not invited'; }
export function reminders(p, day = today()) {
  const out = p.tasks.filter(t => t.status !== 'Done' && t.due && t.due <= day).map(t => ({ name: t.title, date: t.due, tab: 'tasks', kind: 'Task' }));
  p.expenses.forEach(e => e.payments.filter(x => !x.paid && x.due && x.due <= day).forEach(x => out.push({ name: `${e.name} — ${x.name}`, date: x.due, tab: 'budget', kind: 'Payment' })));
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
export function migrateLegacy(plan, legacy) {
  validateLegacy(legacy);
  const next = structuredClone(plan); let added = 0;
  function rekey(n) { n.id = uid(); n.children?.forEach(rekey); }
  for (const s of legacy.sheets) {
    if (next.imports.includes(s.id)) continue;
    const group = { id: s.id, type: 'group', name: s.name, children: structuredClone(s.children) };
    rekey(group); next.tree.children.push(group); next.imports.push(s.id); added++;
  }
  return { plan: next, added };
}
export function validatePlan(p) {
  if (!p || p.version !== 2 || typeof p.settings?.title !== 'string' || !Array.isArray(p.tree?.children)) throw Error('Not a Wedding Planner backup.');
  const arrays = ['tasks','events','vendors','expenses','timeline','tables','imports'];
  if (arrays.some(k => !Array.isArray(p[k]) || p[k].length > 20000)) throw Error('Invalid or oversized backup.');
  validateLegacy({ version: 1, sheets: [p.tree] });
  for (const k of arrays.filter(k => k !== 'imports')) {
    const ids = new Set(); for (const row of p[k]) { if (!row || typeof row.id !== 'string' || ids.has(row.id)) throw Error('Invalid records in ' + k); ids.add(row.id); }
  }
  const amount = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1e12;
  const checkText = (row, fields) => { for (const key of fields) if (row[key] !== undefined && (typeof row[key] !== 'string' || row[key].length > 3000)) throw Error('Invalid text field: ' + key); };
  checkText(p.settings, ['title','partner1','partner2','date']);
  for (const rows of [p.tasks,p.events,p.vendors,p.expenses,p.timeline,p.tables]) for (const r of rows) checkText(r, ['name','title','due','date','time','owner','status','priority','notes','category','contact','phone','email','venue','address','vendorId','eventId']);
  if (p.imports.some(id => typeof id !== 'string')) throw Error('Invalid import history.');
  for (const g of people(p.tree)) {
    checkText(g, ['side','household','phone','address','age','notes']);
    if (g.events !== undefined) {
      if (!g.events || typeof g.events !== 'object' || Array.isArray(g.events)) throw Error('Invalid guest event responses.');
      for (const response of Object.values(g.events)) {
        if (!response || !['Not invited','Pending','Attending','Declined'].includes(response.rsvp)) throw Error('Invalid RSVP.');
        checkText(response, ['meal']);
      }
    }
  }
  if (!amount(p.settings.budget)) throw Error('Invalid wedding budget.');
  for (const e of p.expenses) if (!amount(e.actual) || !amount(e.estimate) || !Array.isArray(e.payments) || e.payments.some(x => !amount(x.amount) || typeof x.paid !== 'boolean')) throw Error('Invalid payment amounts.');
  for (const e of p.expenses) for (const payment of e.payments) checkText(payment, ['id','name','due']);
  for (const t of p.tables) if (!Number.isInteger(t.capacity) || t.capacity < 1 || !Array.isArray(t.guests) || t.guests.some(id => typeof id !== 'string') || new Set(t.guests).size !== t.guests.length || t.guests.length > t.capacity) throw Error('Invalid seating table.');
  return p;
}
export function seatingIssue(plan, table, ids) {
  if (ids.length > table.capacity) return 'More guests selected than this table’s capacity.';
  const all = people(plan.tree);
  for (const id of ids) {
    const g = all.find(x => x.id === id);
    if (!g?.invited || ['Not invited','Declined'].includes(guestRsvp(g, table.eventId))) return 'Seat only invited guests who are not declined for this event.';
    if (plan.tables.some(t => t.id !== table.id && t.eventId === table.eventId && t.guests.includes(id))) return 'A selected guest already has a table at this event.';
  }
  return '';
}
