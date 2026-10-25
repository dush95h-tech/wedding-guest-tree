// SheetJS CE 0.20.3 is vendored locally; see SHEETJS-LICENSE.txt.
import { utils, write, writeFileXLSX } from './xlsx.mjs';

export function exportRows(sheet) {
  const guests = [], categories = [];
  function walk(node, category, path = []) {
    if (node.type === 'person') {
      guests.push({ name: node.name, category, subgroup: path.join(' / '), invited: node.invited });
      return;
    }
    for (const child of node.children || []) walk(child, category, child.type === 'group' ? [...path, child.name] : path);
  }
  const direct = sheet.children.filter(n => n.type === 'person');
  if (direct.length) {
    direct.forEach(n => walk(n, 'Directly under wedding'));
    categories.push(['Directly under wedding', direct.length, direct.filter(n => n.invited).length, direct.filter(n => !n.invited).length]);
  }
  for (const group of sheet.children.filter(n => n.type === 'group')) {
    const start = guests.length;
    walk(group, group.name);
    const members = guests.slice(start), invited = members.filter(n => n.invited).length;
    categories.push([group.name, members.length, invited, members.length - invited]);
  }
  return { guests, categories };
}

export function buildWorkbook(sheet, now = new Date()) {
  const { guests, categories } = exportRows(sheet);
  const wb = utils.book_new();
  wb.Props = { Title: sheet.name + ' — Wedding invitation list', Author: 'Wedding Guest Tree', CreatedDate: now };
  const note = `Exported ${now.toISOString()} · Snapshot of this planning sheet; Excel edits do not update the app.`;
  function append(name, headers, rows, widths) {
    const ws = utils.aoa_to_sheet([[sheet.name], [note], [], headers, ...rows]);
    ws['!cols'] = widths.map(wch => ({ wch }));
    // Merged title and note keep long sheet names readable without widening data columns.
    ws['!merges'] = [0, 1].map(r => ({ s: { r, c: 0 }, e: { r, c: headers.length - 1 } }));
    ws['!rows'] = [{ hpt: 26 }, { hpt: 24 }, { hpt: 10 }, { hpt: 24 }];
    ws['!autofilter'] = { ref: utils.encode_range({ s: { r: 3, c: 0 }, e: { r: Math.max(3, rows.length + 3), c: headers.length - 1 } }) };
    utils.book_append_sheet(wb, ws, name);
    return ws;
  }
  const summary = append('Category Summary', ['Category', 'Total people', 'Invited', 'Not invited'], categories, [42, 18, 18, 18]);
  const totalRow = categories.length + 5;
  utils.sheet_add_aoa(summary, [['TOTAL', guests.length, guests.filter(n => n.invited).length, guests.filter(n => !n.invited).length]], { origin: totalRow });
  const headers = ['No.', 'Category', 'Subgroup / family branch', 'Guest name', 'Invitation status'];
  const rows = list => list.map((p, i) => [i + 1, p.category, p.subgroup, p.name, p.invited ? 'Invited' : 'Not invited']);
  append('All Guests', headers, rows(guests), [8, 32, 55, 42, 20]);
  append('Invited Guests', headers, rows(guests.filter(n => n.invited)), [8, 32, 55, 42, 20]);
  return wb;
}

export function exportFilename(name) {
  return (name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').slice(0, 80) || 'wedding') + '-guest-list.xlsx';
}
export function downloadExcel(sheet) {
  writeFileXLSX(buildWorkbook(sheet), exportFilename(sheet.name), { compression: true });
}
export function workbookBytes(sheet) {
  return write(buildWorkbook(sheet), { bookType: 'xlsx', type: 'array', compression: true });
}
