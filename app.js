import { uid, branch, person, newSheet, people, find, remove, validate } from './model.js';
const $ = id => document.getElementById(id), KEY = 'wedding-guest-tree-v1';
let data = { version: 1, sheets: [] }, active, view = 'tree', editAction, deleteAction, storageFailed = false;
const collapsed = new Set();
try { const saved = localStorage.getItem(KEY); if (saved) data = validate(JSON.parse(saved)); active = data.sheets.find(s => s.id === data.active)?.id || data.sheets[0]?.id; } catch { storageFailed = true; }
const sheet = () => data.sheets.find(s => s.id === active);
function message(text) { $('notice').textContent = text; }
function save() { data.active = active; try { localStorage.setItem(KEY, JSON.stringify(data)); message('Saved on this browser'); } catch { message('Changes are not saved: browser storage is unavailable or full. Export a backup now.'); } render(); }
function el(tag, text, cls) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
function button(text, action, cls = 'text-button', label) { const b = el('button', text, cls); b.type = 'button'; if (label) b.setAttribute('aria-label', label); b.onclick = action; return b; }
function editor(title, initial, callback, help = '') { editAction = callback; $('dialog-title').textContent = title; $('name').value = initial; $('dialog-help').textContent = help; $('editor').showModal(); $('name').focus(); }
function confirmDelete(title, description, action) { deleteAction = action; $('confirm-title').textContent = title; $('confirm-message').textContent = description; $('confirm-dialog').showModal(); }
function createSheet() { editor('Create a new sheet', '', name => { const s = newSheet(name); data.sheets.push(s); active = s.id; save(); }, 'Give each person or celebration a separate planning sheet.'); }
function addTo(node, type) { editor(type === 'group' ? 'Add a branch' : 'Add a person', '', name => { node.children.push(type === 'group' ? branch(name) : person(name)); collapsed.delete(node.id); save(); }, type === 'person' ? 'One card represents one person. Select Invite to include them in your count.' : 'For example: cousins, colleagues, or family friends.'); }
function renderNode(node, root = false, depth = 0) {
  const li = el('li'), card = el('div', undefined, 'card ' + (root ? 'root-card' : node.type === 'person' ? 'person-card' : 'group-card'));
  if (node.type === 'person') {
    const label = el('label', undefined, 'person-label'), input = document.createElement('input'); input.type = 'checkbox'; input.checked = node.invited; input.setAttribute('aria-label', `Invite ${node.name}`); input.onchange = () => { node.invited = input.checked; save(); }; label.append(input, el('span', node.name)); card.classList.toggle('selected', node.invited); card.append(label, el('small', node.invited ? 'Invited' : 'Not invited', 'invite-status'));
  } else {
    const heading = el('div', undefined, 'node-heading');
    const toggle = button(collapsed.has(node.id) ? '▸' : '▾', () => { collapsed.has(node.id) ? collapsed.delete(node.id) : collapsed.add(node.id); render(); }, 'toggle', `${collapsed.has(node.id) ? 'Expand' : 'Collapse'} ${node.name}`); toggle.setAttribute('aria-expanded', String(!collapsed.has(node.id)));
    heading.append(toggle, el('strong', node.name)); const guests = people(node); card.append(heading, el('small', `${guests.filter(p => p.invited).length} invited · ${guests.length} people`, 'node-count'));
    const actions = el('div', undefined, 'node-actions'); actions.append(button('＋ Person', () => addTo(node, 'person'))); if (depth < 18) actions.append(button('＋ Branch', () => addTo(node, 'group'))); card.append(actions);
  }
  if (!root) { const actions = el('div', undefined, 'edit-actions'); actions.append(button('✎', () => editor('Rename ' + (node.type === 'person' ? 'person' : 'branch'), node.name, name => { node.name = name; save(); }), 'icon', `Rename ${node.name}`), button('×', () => confirmDelete(`Delete ${node.name}?`, node.type === 'group' ? 'This removes this branch and everyone inside it. Export a backup first if you may need them again.' : 'This removes this person from this sheet.', () => { remove(sheet(), node.id); save(); }), 'icon', `Delete ${node.name}`)); card.append(actions); }
  li.append(card);
  if (node.children?.length && !collapsed.has(node.id)) { const ul = el('ul'); node.children.forEach(child => ul.append(renderNode(child, false, depth + 1))); li.append(ul); }
  return li;
}
function table(list) { const t = el('table'), head = el('thead'), hr = el('tr'); ['#', 'Guest name', 'Branch'].forEach(s => hr.append(el('th', s))); head.append(hr); const body = el('tbody'); list.forEach((p, i) => { const r = el('tr'); [i + 1, p.name, p.path].forEach(v => r.append(el('td', v))); body.append(r); }); t.append(head, body); return t; }
function render() {
  const s = sheet(); $('sheets').replaceChildren(); data.sheets.forEach(item => { const b = button('♧  ' + item.name, () => { active = item.id; save(); }, 'sheet ' + (item.id === active ? 'active' : '')); b.setAttribute('aria-current', item.id === active ? 'page' : 'false'); b.append(el('span', people(item).filter(p => p.invited).length, 'sheet-count')); $('sheets').append(b); });
  $('empty').hidden = !!s; $('workspace').hidden = !s; $('print').disabled = !s; $('export').disabled = !data.sheets.length;
  $('title').textContent = s?.name || 'Make room for everyone.'; $('subtitle').textContent = s ? 'Bring your people together, one branch at a time.' : 'Your people, thoughtfully brought together.';
  if (!s) return;
  const all = people(s), invited = all.filter(p => p.invited); $('invited').textContent = invited.length; $('total').textContent = all.length; $('pending').textContent = all.length - invited.length; $('list-count').textContent = invited.length;
  $('tree').replaceChildren(); const ul = el('ul', undefined, 'tree-root'); ul.append(renderNode(s, true)); $('tree').append(ul);
  $('tree-view').hidden = view !== 'tree'; $('list-view').hidden = view !== 'list'; $('tree-tab').setAttribute('aria-pressed', String(view === 'tree')); $('list-tab').setAttribute('aria-pressed', String(view === 'list'));
  $('guest-list').replaceChildren(invited.length ? table(invited) : el('p', 'No invitations selected yet. Tick Invite on a person’s card to add them here.', 'list-empty'));
  $('print-area').replaceChildren(el('p', 'WEDDING GUEST TREE', 'eyebrow'), el('h1', s.name), el('p', `Invited guest list · ${invited.length} ${invited.length === 1 ? 'person' : 'people'}`), table(invited), el('p', `Total invited: ${invited.length}`, 'print-total'));
}
$('edit-form').onsubmit = e => { e.preventDefault(); const name = $('name').value.trim(); if (!name) { $('name').setCustomValidity('Please enter a name.'); $('name').reportValidity(); return; } $('editor').close(); editAction(name); };
$('name').oninput = () => $('name').setCustomValidity(''); $('cancel').onclick = () => $('editor').close(); $('keep').onclick = () => $('confirm-dialog').close(); $('confirm-delete').onclick = () => { $('confirm-dialog').close(); deleteAction(); };
['new-sheet', 'create-sheet', 'first-sheet'].forEach(id => $(id).onclick = createSheet);
$('rename-sheet').onclick = () => editor('Rename sheet', sheet().name, name => { sheet().name = name; save(); });
$('delete-sheet').onclick = () => confirmDelete('Delete this sheet?', 'This removes all its branches and people. Other sheets are kept. Export a backup first if needed.', () => { data.sheets = data.sheets.filter(s => s.id !== active); active = data.sheets[0]?.id; save(); });
$('tree-tab').onclick = () => { view = 'tree'; render(); }; $('list-tab').onclick = () => { view = 'list'; render(); };
$('expand').onclick = () => { collapsed.clear(); render(); }; $('collapse').onclick = () => { function walk(n) { if (n.type === 'group') collapsed.add(n.id); n.children?.forEach(walk); } walk(sheet()); render(); };
$('zoom').onchange = () => { $('tree').style.zoom = $('zoom').value; };
$('print').onclick = () => { render(); window.print(); };
$('export').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = el('a'); a.href = url; a.download = 'wedding-guest-tree-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); message('Backup exported. Keep this file to restore your sheets.'); };
$('import').onclick = () => $('file').click();
$('file').onchange = async () => { const file = $('file').files[0]; if (!file) return; try { if (file.size > 5000000) throw Error('Backup is too large (maximum 5 MB).'); const imported = validate(JSON.parse(await file.text())); if (data.sheets.length + imported.sheets.length > 200) throw Error('Maximum 200 sheets.'); function rekey(n) { n.id = uid(); n.children?.forEach(rekey); } imported.sheets.forEach(rekey); data.sheets.push(...imported.sheets); active = imported.sheets[0]?.id || active; save(); message('Backup imported as new sheets. Your existing sheets were kept.'); } catch (e) { message('Import failed: ' + e.message); } finally { $('file').value = ''; } };
window.addEventListener('storage', e => { if (e.key === KEY) { try { data = e.newValue ? validate(JSON.parse(e.newValue)) : { version: 1, sheets: [] }; active = data.sheets.find(s => s.id === active)?.id || data.sheets[0]?.id; render(); message('Updated from another tab.'); } catch { message('Another tab saved unreadable data. Export your current work.'); } } });
render(); if (storageFailed) message('Saved data could not be loaded. Export any backup before making changes; browser storage may be unavailable.');
