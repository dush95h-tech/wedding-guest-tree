export const uid = () => crypto.randomUUID();
export const branch = name => ({ id: uid(), type: 'group', name, children: [] });
export const person = name => ({ id: uid(), type: 'person', name, invited: false });
export function newSheet(name) { return { id: uid(), name, children: [branch("Father’s side"), branch("Mother’s side"), branch('Friends')] }; }
export function people(node, path = []) { return (node.children || []).flatMap(n => n.type === 'person' ? [{ ...n, path: path.join(' / ') || 'Wedding' }] : people(n, [...path, n.name])); }
export function find(node, id) { if (node.id === id) return node; for (const child of node.children || []) { const found = find(child, id); if (found) return found; } }
export function remove(node, id) { if (!node.children) return; node.children = node.children.filter(n => n.id !== id); node.children.forEach(n => remove(n, id)); }
export function validate(data) {
  if (data?.version !== 1 || !Array.isArray(data.sheets) || data.sheets.length > 200) throw Error('This is not a supported Wedding Guest Tree backup.');
  const ids = new Set(); let count = 0;
  function check(n, depth, sheet = false) {
    if (++count > 20000 || depth > 20 || !n || typeof n.id !== 'string' || !n.id || ids.has(n.id) || typeof n.name !== 'string' || !n.name.trim() || n.name.length > 120) throw Error('Invalid or oversized backup.');
    ids.add(n.id);
    if (sheet || n.type === 'group') { if (!Array.isArray(n.children)) throw Error('Invalid branch.'); n.children.forEach(c => check(c, depth + 1)); }
    else if (n.type !== 'person' || typeof n.invited !== 'boolean') throw Error('Invalid person.');
  }
  data.sheets.forEach(s => check(s, 0, true)); return data;
}
