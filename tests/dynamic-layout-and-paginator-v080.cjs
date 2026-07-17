'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource } = loadUserscript();
const { Config, CompactGridScale, Paginator } = api;
const json = (value) => JSON.parse(JSON.stringify(value));

assert.deepEqual(json(Paginator.pageButtons(1, 16, 5)), [1,2,3,4,5]);
assert.deepEqual(json(Paginator.pageButtons(3, 16, 5)), [1,2,3,4,5]);
assert.deepEqual(json(Paginator.pageButtons(4, 16, 5)), [2,3,4,5,6]);
assert.deepEqual(json(Paginator.pageButtons(14, 16, 5)), [12,13,14,15,16]);
assert.deepEqual(json(Paginator.pageButtons(16, 16, 5)), [12,13,14,15,16]);
assert.deepEqual(json(Paginator.pageButtons(2, 4, 5)), [1,2,3,4]);
assert.deepEqual(json(Paginator.pageButtons(6, 12, 3)), [5,6,7]);
assert.equal(Paginator.windowSize(900), 5);
assert.equal(Paginator.windowSize(390), 3);
assert.equal(Paginator.targetForAction('previous', 0, 7, 16), 6);
assert.equal(Paginator.targetForAction('next', 0, 7, 16), 8);
assert.equal(Paginator.targetForAction('first', 0, 7, 16), 1);
assert.equal(Paginator.targetForAction('last', 0, 7, 16), 16);

const base = {
  availableWidth:1200,
  nativeCardHeight:130,
  cardWidth:220,
  nativeVisibleCardRatio:16/9,
  columnGap:8,
  scale:'medium',
};
const wide = CompactGridScale.calculateLayout({ ...base, ratio:16/9 });
const square = CompactGridScale.calculateLayout({ ...base, ratio:1 });
assert.equal(wide.targetHeight, square.targetHeight);
assert.ok(square.columns > wide.columns);
assert.equal(wide.pageSize, CompactGridScale.pageSizeForColumns(wide.columns));
assert.equal(square.pageSize, CompactGridScale.pageSizeForColumns(square.columns));
assert.ok(Math.abs(wide.cardWidth / wide.cardHeight - 16/9) < .01);
assert.ok(Math.abs(square.cardWidth / square.cardHeight - 1) < .01);

assert.match(originalSource, /data-pmf-page-action/);
assert.doesNotMatch(Paginator.render.toString(), /pmf-page-gap|textContent = '…'/);
assert.match(originalSource, /data-pmf-quick-status/);

console.log('Pawchive Media Filter v0.8.0 dynamic layout and sliding paginator tests passed.');
