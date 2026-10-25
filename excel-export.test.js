import test from 'node:test';
import assert from 'node:assert/strict';
import { newSheet, branch, person } from './model.js';
import { buildWorkbook, exportRows, exportFilename, workbookBytes } from './excel-export.js';
import { read, utils } from './xlsx.mjs';

test('Excel export categorizes nested guests once and keeps sheets separate', () => {
  const sheet = newSheet('Wedding'), other = newSheet('Other');
  const group = branch('Cousins / family'), child = branch('Second cousins'), guest = person('සිංහල Guest');
  guest.invited = true; child.children.push(guest); group.children.push(child); sheet.children[0].children.push(group, person('Unselected'));
  sheet.children.push(person('Direct guest'));
  other.children[0].children.push(person('Other sheet guest'));
  const result = exportRows(sheet);
  assert.equal(result.guests.length, 3);
  assert.deepEqual(result.categories[1], ['Father’s side', 2, 1, 1]);
  assert.equal(result.guests.find(p => p.name === guest.name).subgroup, 'Cousins / family / Second cousins');
  const reopened = read(workbookBytes(sheet), { type: 'array' });
  assert.deepEqual(reopened.SheetNames, ['Category Summary', 'All Guests', 'Invited Guests']);
  const invited = utils.sheet_to_json(reopened.Sheets['Invited Guests'], { range: 3 });
  assert.equal(invited.length, 1); assert.equal(invited[0]['Guest name'], guest.name);
  const all = utils.sheet_to_json(reopened.Sheets['All Guests'], { range: 3 });
  assert.equal(all.length, 3); assert.equal(all[0]['No.'], 1);
  assert.equal(reopened.Sheets['All Guests']['!autofilter'].ref, 'A4:E7');
});
test('empty exports have headers and numeric zero totals', () => {
  const wb = buildWorkbook(newSheet('Empty'));
  assert.equal(wb.Sheets['All Guests'].A4.v, 'No.');
  assert.equal(wb.Sheets['All Guests'].A5, undefined);
  assert.equal(wb.Sheets['Category Summary'].B9.v, 0);
});
test('formula-looking names remain literal text and filenames are safe', () => {
  const sheet = newSheet('=SUM(A1)'); const p = person('=HYPERLINK("https://example.com")'); p.invited = true; sheet.children[0].children.push(p);
  const wb = read(workbookBytes(sheet), { type: 'array' });
  assert.equal(wb.Sheets['All Guests'].D5.t, 's');
  assert.equal(wb.Sheets['All Guests'].D5.f, undefined);
  assert.equal(wb.Sheets['All Guests'].D5.v, p.name);
  assert.equal(exportFilename('Our / Wedding: 2026'), 'Our - Wedding- 2026-guest-list.xlsx');
});
