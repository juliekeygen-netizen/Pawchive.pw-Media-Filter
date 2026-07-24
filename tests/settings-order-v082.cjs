'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource } = loadUserscript();
const { Config, Settings, SettingsUI } = api;

assert.equal(Config.version, '0.13.9');
Settings.load();
const collectText = (node, output = []) => {
  if (!node) return output;
  if (node.textContent) output.push(String(node.textContent));
  for (const child of node.children || []) collectText(child, output);
  return output;
};
const generalText = collectText(SettingsUI.buildGeneral(structuredClone(Settings.value))).join('\n');
const scanningText = collectText(SettingsUI.buildScanning(structuredClone(Settings.value))).join('\n');
const generalOrder = [
  'Show attachment badges on post cards',
  'Show status badges on post cards',
  'Dim seen post cards',
  'Show attachment badges on creator cards',
].map((text) => generalText.indexOf(text));
generalOrder.forEach((index, offset) => assert.ok(index >= 0, `general settings item ${offset} exists`));
for (let index = 1; index < generalOrder.length; index += 1) assert.ok(generalOrder[index - 1] < generalOrder[index]);
for (const text of ['Synchronize native favorites during Scan and Update','Count method','Hide and don’t count posts with missing attachments']) assert.ok(scanningText.includes(text), `Scanning & detection contains ${text}`);
assert.match(originalSource, /Seen dim strength/);
assert.doesNotMatch(originalSource, /Confirm initial and resumed scans from creator cards|Confirm creator card scans/);

console.log('Pawchive Media Filter v0.13.9 settings order tests passed.');
