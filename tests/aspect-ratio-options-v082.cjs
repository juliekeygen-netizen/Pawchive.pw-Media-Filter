'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, stored, originalSource } = loadUserscript();
const { Config, Settings, CompactThumbnailRatio, UI } = api;

assert.equal(Config.version, '0.12.3');

Settings.load();
assert.equal(Settings.value.compactThumbnailAspectRatio, '1-1');
assert.equal(CompactThumbnailRatio.normalizeAspectRatio('native'), '1-1');
assert.equal(CompactThumbnailRatio.normalizeAspectRatio('16-9'), '16-9');
assert.equal(CompactThumbnailRatio.normalizeAspectRatio('4-3'), '4-3');
assert.equal(CompactThumbnailRatio.normalizeAspectRatio('1-1'), '1-1');
assert.equal(CompactThumbnailRatio.normalizeAspectRatio('bogus'), '1-1');
assert.equal(CompactThumbnailRatio.numericRatio('native'), 1);

Settings.save({ compactThumbnailAspectRatio:'native' });
assert.equal(Settings.value.compactThumbnailAspectRatio, '1-1');
assert.equal(stored.get(Config.settingsKey).compactThumbnailAspectRatio, '1-1');

const settingsMethod = originalSource.slice(
  originalSource.lastIndexOf('    openSettings() {'),
  originalSource.indexOf('    autoSizeTextarea', originalSource.lastIndexOf('    openSettings() {')),
);
assert.match(settingsMethod, /<option value="16-9"[^>]*>16:9<\/option>/);
assert.match(settingsMethod, /<option value="4-3"[^>]*>4:3<\/option>/);
assert.match(settingsMethod, /<option value="1-1"[^>]*>1:1 \(original\)<\/option>/);
assert.doesNotMatch(settingsMethod, /value="native"|Original \(site\)/);
assert.match(UI.saveSettings.toString(), /compactThumbnailAspectRatio:[^,]+\|\|'1-1'/);

console.log('Pawchive Media Filter v0.8.2 aspect ratio option tests passed.');
