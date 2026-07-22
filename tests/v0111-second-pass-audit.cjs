'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource } = loadUserscript();
const {
  Config,
  Settings,
  CreatorFilterEngine,
  CreatorCustomRule,
  CreatorPresets,
  CreatorSorter,
  CreatorCatalogueSummary,
} = api;

assert.equal(Config.version, '0.13.4');
assert.match(originalSource, /\/\/ @version\s+0\.13\.4/);

// The advanced sort follows the specified Images-first type order and remembers a safe default.
assert.deepEqual(JSON.parse(JSON.stringify(CreatorSorter.mediaTypes)), ['images', 'videos', 'archives', 'projectFiles', 'externalLinks']);
assert.equal(CreatorSorter.normalize({ mode: 'advanced' }).advancedType, 'images');

// Turning a saved date group off must stay off even though its dates are retained.
const disabledDate = CreatorFilterEngine.normalizeState({
  publishedDate: {
    enabled: false,
    operator: 'between',
    from: '2026-01-01',
    to: '2026-12-31',
  },
});
assert.equal(disabledDate.publishedDate.enabled, false);
assert.equal(CreatorFilterEngine.activeGroupCount(disabledDate), 0);

// The Advanced-rules group switch is independent from each row's own enabled state.
const catRule = CreatorCustomRule.normalize({
  enabled: true,
  outcome: 'match',
  fields: ['title'],
  match: 'contains',
  value: 'cat',
  method: 'amount',
  count: { operator: 'at-least', from: 3 },
});
const ruleFingerprint = CreatorCatalogueSummary.ruleFingerprint(catRule);
const baseRecord = {
  directory: { service: 'patreon', creatorName: 'Alpha' },
  catalogueState: 'complete',
  summary: {
    completeness: 'complete',
    sourcePostCount: 10,
    aggregateEligiblePostCount: 10,
    media: {
      videos: { posts: 4, attachments: 8 },
      images: { posts: 5, attachments: 10 },
      archives: { posts: 1, attachments: 1 },
      projectFiles: { posts: 1, attachments: 2 },
      externalLinks: { posts: 2, links: 3 },
    },
    customExtensionAggregates: { psd: { posts: 1, files: 2 } },
    customRuleAggregates: { [ruleFingerprint]: { posts: 3 } },
  },
};
let state = CreatorFilterEngine.normalizeState({ customRulesEnabled: false, customRules: [catRule] });
assert.equal(CreatorFilterEngine.activeGroupCount(state), 0);
assert.equal(CreatorFilterEngine.matches(baseRecord, state), true);

// No match counts the complement of matching posts, rather than negating the aggregate condition.
state = CreatorFilterEngine.normalizeState({
  customRulesEnabled: true,
  customRules: [{ ...catRule, outcome: 'no-match', count: { operator: 'at-least', from: 7 } }],
});
assert.equal(CreatorFilterEngine.matches(baseRecord, state), true);
state.customRules[0].count = { operator: 'at-least', from: 8, to: 8 };
assert.equal(CreatorFilterEngine.matches(baseRecord, state), false);

// A safe partial lower-bound No-match condition is evaluated from stored eligible posts.
const partialRecord = {
  ...baseRecord,
  catalogueState: 'partial',
  summary: { ...baseRecord.summary, completeness: 'partial' },
};
state = CreatorFilterEngine.normalizeState({
  includePartialLowerBounds: true,
  customRulesEnabled: true,
  customRules: [{ ...catRule, outcome: 'no-match', count: { operator: 'at-least', from: 7 } }],
});
assert.equal(CreatorFilterEngine.matches(partialRecord, state), true);

// Custom-extension Amount does not depend on a percentage denominator.
Settings.value.creatorCardBadgeCountMode = 'attachments';
const noDenominatorRecord = {
  ...baseRecord,
  summary: {
    completeness: 'complete',
    customExtensionAggregates: { psd: { posts: 1, files: 2 } },
  },
};
state = CreatorFilterEngine.normalizeState({
  media: {
    customExtensions: {
      enabled: true,
      method: 'amount',
      extensions: ['psd'],
      count: { operator: 'at-least', from: 2 },
    },
  },
});
assert.equal(CreatorFilterEngine.matches(noDenominatorRecord, state), true);

// Attachment percentage uses every real attachment plus scoped external links,
// including attachments outside the five displayed media categories.
Settings.value.externalLinkScope = 'any';
const summary = CreatorCatalogueSummary.compute([
  {
    id: '1',
    key: 'pawchive.pw|patreon|creator|1',
    creatorKey: 'pawchive.pw|patreon|creator',
    creatorId: 'creator',
    service: 'patreon',
    cacheSources: { catalogue: true },
    scanSchemaVersion: Config.schemaVersion,
    completeness: 'complete',
    attachmentCount: 7,
    videoCount: 2,
    imageCount: 1,
    archiveCount: 0,
    projectFileCount: 1,
    hasProjectFiles: true,
    externalLinkCount: 3,
    published: '2026-01-01T00:00:00Z',
  },
], { storedPostCount: 1, pageCoverage: { 1: { state: 'verified' } }, expectedTotalPages: 1 });
assert.equal(summary.version, 5);
assert.equal(summary.totalAttachmentCount, 7);
assert.equal(summary.totalExternalLinkCount, 3);
assert.equal(summary.totalAttachmentLinkCount, 10);
assert.equal(CreatorFilterEngine.totalAttachmentUniverse({ summary }), 10);
assert.equal(CreatorFilterEngine.mediaPercentage({ summary }, 'videos'), 20);

// Missing advanced-sort metrics are unknown and always sort after known values.
const unknown = { id: 'unknown', directory: { creatorName: 'Unknown' }, summary: {} };
const known = { id: 'known', directory: { creatorName: 'Known' }, summary: { media: { videos: { posts: 0, attachments: 0 } }, aggregateEligiblePostCount: 1, totalAttachmentLinkCount: 0 } };
assert.equal(CreatorSorter.value(unknown, { mode: 'advanced', advancedType: 'videos', advancedMethod: 'amount' }), null);
assert.deepEqual(CreatorSorter.sort([unknown, known], { mode: 'advanced', direction: 'asc', advancedType: 'videos', advancedMethod: 'amount' }).map((item) => item.id), ['known', 'unknown']);
assert.deepEqual(CreatorSorter.sort([unknown, known], { mode: 'advanced', direction: 'desc', advancedType: 'videos', advancedMethod: 'amount' }).map((item) => item.id), ['known', 'unknown']);

// Legacy preset corruption is repaired, and blank/duplicate names are rejected.
const repaired = CreatorPresets.normalize({
  activeId: 'missing',
  presets: [
    { id: 'same', name: 'Example', state: {} },
    { id: 'same', name: 'example', state: {} },
  ],
});
assert.equal(repaired.activeId, 'default');
assert.equal(repaired.presets.some((preset) => preset.id === 'default'), true);
assert.equal(new Set(repaired.presets.map((preset) => preset.id)).size, repaired.presets.length);
assert.equal(new Set(repaired.presets.map((preset) => preset.name.toLocaleLowerCase())).size, repaired.presets.length);
assert.equal(CreatorPresets.validateName(repaired, '   ').valid, false);
assert.equal(CreatorPresets.validateName(repaired, repaired.presets[0].name).valid, false);

// Dynamic aggregate maps are bounded while active keys are retained.
const aggregateMap = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`key-${index}`, { posts: index }]));
const bounded = CreatorCatalogueSummary.boundedDynamicMap(aggregateMap, ['key-0'], 16);
assert.equal(Object.keys(bounded).length, 16);
assert.equal(Object.prototype.hasOwnProperty.call(bounded, 'key-0'), true);

// Source-level lifecycle/UI contracts that require a browser DOM.
assert.match(originalSource, /node\.style\.transform='none'/);
assert.match(originalSource, /if\(!overlay\)\{popover\.remove\(\);return null;\}/);
assert.match(originalSource, /matchWidth:true/);
assert.match(originalSource, /className='pmf-filter-popover pmf-creator-filter-popover/);
assert.match(originalSource, /<div class="pmf-popover-section">Media<\/div>/);
assert.match(originalSource, /Service: Patreon/);
assert.match(originalSource, /Date published/);
assert.match(originalSource, /pmf-aggregate-expression/);
assert.match(originalSource, /pmf-advanced-sort-expression/);
assert.match(originalSource, /remembered\.method==='percentage'\?'percentage':'amount'/);
assert.match(originalSource, /const hasStoredCatalogue=Number\(catalogue\.storedPostCount\)>0/);
assert.match(originalSource, /dynamicAggregateUpdatedAt/);
assert.match(originalSource, /boundedDynamicMap/);

assert.match(originalSource, /configure-date/);
assert.match(originalSource, /configure-extensions/);
assert.match(originalSource, /openMedia\('customExtensions',opener\)/);
assert.doesNotMatch(originalSource, /pmf-creator-filter-popover\{width:min\(370px/);
assert.match(originalSource, /pmf-creator-filter-popover\{max-width:calc\(100vw - 16px\)/);
assert.match(originalSource, /const openAbove=spaceBelow/);
assert.doesNotMatch(
  originalSource.slice(originalSource.indexOf('  const CreatorFilterUI = {'), originalSource.indexOf('  const AnchoredMenu = {', originalSource.indexOf('  const CreatorFilterUI = {'))),
  /fetch\s*\(/,
  'opening and applying Local catalogue filters must not issue Pawchive network requests',
);

console.log('Pawchive Media Filter v0.11.3 second-pass audit regression tests passed.');
