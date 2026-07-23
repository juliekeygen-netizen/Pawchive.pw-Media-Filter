'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, stored, originalSource } = loadUserscript();
const {
  Config,
  CreatorFilterEngine,
  CreatorPresets,
  CreatorCustomRule,
  CreatorFilterUI,
  CreatorSortUI,
} = api;

assert.equal(Config.version, '0.13.6');

const migrated = CreatorFilterEngine.normalizeState({
  service: 'fanbox',
  catalogueState: 'partial',
  publicFavorites: { operator: 'at-least', from: 100 },
  dateIndexedFrom: '2025-01-01',
  postStatuses: { liked: { enabled: true, count: { operator: 'at-least', from: 4 } } },
  publishedWithinFrom: '2026-01-01',
  publishedWithinTo: '2026-02-01',
  media: {
    videos: { enabled: true, measure: 'attachments', count: { operator: 'at-least', from: 2 } },
    customExtensions: { enabled: true, extensions: ['PSD', '.clip'], count: { operator: 'at-least', from: 1 } },
  },
  customRules: [{
    enabled: true,
    field: 'title',
    match: 'contains',
    value: 'cat',
    count: { operator: 'at-least', from: 1 },
  }],
});

assert.equal(migrated.service, 'fanbox');
assert.equal(migrated.matchMode, 'all');
assert.equal(migrated.publishedDate.enabled, true);
assert.equal(migrated.publishedDate.from, '2026-01-01');
assert.equal(migrated.media.videos.enabled, true);
assert.equal(migrated.media.customExtensions.enabled, true);
assert.deepEqual(JSON.parse(JSON.stringify(migrated.media.customExtensions.extensions)), ['psd', 'clip']);
assert.equal(migrated.customRules.length, 1);
assert.equal('catalogueState' in migrated, false, 'obsolete hidden fields must not remain active after migration');
assert.equal('postStatuses' in migrated, false);
assert.equal('publicFavorites' in migrated, false);

let presets = CreatorPresets.normalize({});
const created = CreatorPresets.create(presets, 'Media-heavy', {
  service: 'patreon',
  matchMode: 'any',
  includePartialLowerBounds: true,
  media: {
    customExtensions: {
      enabled: true,
      method: 'amount',
      extensions: ['psd', 'clip'],
      count: { operator: 'between', from: 2, to: 5 },
    },
  },
  customRules: [CreatorCustomRule.normalize({
    enabled: true,
    join: 'if',
    outcome: 'no-match',
    fields: ['title', 'tags'],
    match: 'contains',
    value: 'preview',
    method: 'percentage',
    percentage: { operator: 'at-most', from: 10 },
  })],
});
assert.equal(created.valid, true);
presets = created.record;

const activeId = presets.activeId;
const applied = CreatorPresets.apply(presets, activeId);
assert.equal(applied.matchMode, 'any');
assert.equal(applied.includePartialLowerBounds, true);
assert.deepEqual(JSON.parse(JSON.stringify(applied.media.customExtensions.extensions)), ['psd', 'clip']);
assert.equal(applied.customRules[0].outcome, 'no-match');
assert.deepEqual(JSON.parse(JSON.stringify(applied.customRules[0].fields)), ['title', 'tags']);
assert.equal(applied.customRules[0].method, 'percentage');
assert.ok(stored.has(Config.creatorPresetsKey));

assert.equal(CreatorFilterUI.buttonLabel(CreatorFilterEngine.normalizeState({})), 'All Local catalogue creators');
assert.match(CreatorFilterUI.buttonLabel(applied), /^Creator filters · 2 · Patreon$/);
assert.match(CreatorSortUI.label({ mode: 'advanced', direction: 'desc', advancedType: 'projectFiles', advancedMethod: 'percentage' }), /Project files · Percentage ▼/);

assert.match(originalSource, /Preset: \$\{Util\.escapeHtml\(activePreset\?\.name\|\|'Default'\)\}/);
assert.match(originalSource, /Fields: \$\{Util\.escapeHtml/);
assert.match(originalSource, /Match selected filters/);
assert.match(originalSource, /Custom extensions/);
assert.match(originalSource, /Advanced rules/);
assert.match(originalSource, /openPresetName/);
assert.doesNotMatch(originalSource, /globalThis\.prompt\?\./);
assert.match(originalSource, /Highest first/);
assert.match(originalSource, /Lowest first/);
assert.doesNotMatch(originalSource, /Public creator favorite count/);
assert.doesNotMatch(originalSource, /Native-favorited posts/);

console.log('Pawchive Media Filter v0.11.3 creator preset and migration tests passed.');
