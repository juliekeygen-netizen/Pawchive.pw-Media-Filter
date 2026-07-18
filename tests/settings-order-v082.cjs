'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource } = loadUserscript();
const { Config } = api;

assert.equal(Config.version, '0.10.4');

const settingsMethod = originalSource.slice(
  originalSource.lastIndexOf('    openSettings() {'),
  originalSource.indexOf('    autoSizeTextarea', originalSource.lastIndexOf('    openSettings() {')),
);
const order = [
  'Confirm initial and resumed scans from creator cards',
  'Show attachment badges on post cards',
  'Show status badges on post cards',
  'Dim seen post cards',
  'Seen dim strength',
  'Show attachment badges on creator cards',
  'Synchronize native favorites during Scan and Update',
].map((text) => settingsMethod.indexOf(text));

order.forEach((index, offset) => assert.ok(index >= 0, `settings item ${offset} exists`));
for (let index = 1; index < order.length; index += 1) {
  assert.ok(order[index - 1] < order[index], 'settings rows remain in requested order');
}

console.log('Pawchive Media Filter v0.8.2 settings order tests passed.');
