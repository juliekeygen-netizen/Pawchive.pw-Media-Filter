'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api } = loadUserscript();
const { Config, Settings, CompactGridScale } = api;

assert.equal(Config.version, '0.11.0');
assert.equal(Config.filteredPageSize, 50);
assert.equal(CompactGridScale.pageSizeForColumns(1), 50);
assert.equal(CompactGridScale.pageSizeForColumns(2), 50);
assert.equal(CompactGridScale.pageSizeForColumns(3), 48);
assert.equal(CompactGridScale.pageSizeForColumns(6), 48);
assert.equal(CompactGridScale.pageSizeForColumns(7), 49);
assert.equal(CompactGridScale.pageSizeForColumns(8), 48);
assert.equal(CompactGridScale.pageSizeForColumns(51), 50);

Settings.load();
for (const ratio of ['16-9', '4-3', '1-1']) {
  const layout = CompactGridScale.calculateLayout({
    availableWidth:1920,
    cardWidth:220,
    nativeCardHeight:124,
    nativeVisibleCardRatio:16 / 9,
    columnGap:8,
    scale:'medium',
    ratio,
  });
  assert.equal(layout.pageSize % layout.columns, 0, `${ratio} page size fills complete rows`);
  assert.ok(layout.pageSize <= Config.filteredPageSize, `${ratio} page size never exceeds hard cap`);
}

console.log('Pawchive Media Filter v0.8.2 dynamic full-row page size tests passed.');
