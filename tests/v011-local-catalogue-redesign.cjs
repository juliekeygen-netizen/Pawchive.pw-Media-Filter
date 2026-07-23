'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const loaded = loadUserscript();
const { api, originalSource } = loaded;
const {
  Config,
  Settings,
  CreatorFilterEngine,
  CreatorSorter,
  CreatorSortUI,
  CreatorCustomRule,
  CreatorCatalogueSummary,
} = api;

assert.equal(Config.version, '0.13.5');
assert.match(originalSource, /\/\/ @version\s+0\.13\.5/);
assert.deepEqual(
  JSON.parse(JSON.stringify(CreatorSortUI.modes)),
  [
    ['popularity', 'Popularity'],
    ['alphabetical', 'Alphabetical'],
    ['posts', 'Catalogue post count'],
    ['published', 'Post publish date'],
    ['advanced', 'Advanced attachment amounts ›'],
  ],
);

const complete = {
  directory: { service: 'patreon', creatorName: 'Alpha', publicFavoriteCount: 50 },
  catalogueState: 'complete',
  summary: {
    completeness: 'complete',
    sourcePostCount: 10,
    aggregateEligiblePostCount: 10,
    latestPublishedAt: Date.parse('2026-06-15'),
    publishedTimestamps: [Date.parse('2025-01-01'), Date.parse('2026-06-15')],
    media: {
      videos: { posts: 4, attachments: 8 },
      images: { posts: 5, attachments: 10 },
      archives: { posts: 1, attachments: 1 },
      projectFiles: { posts: 1, attachments: 2 },
      externalLinks: { posts: 2, links: 3 },
    },
    customExtensionAggregates: {
      psd: { posts: 1, files: 2 },
    },
    customRuleAggregates: {
      [JSON.stringify({ field: 'title', match: 'contains', value: 'cat' })]: { posts: 3 },
      [JSON.stringify({ field: 'tags', match: 'contains', value: 'dog' })]: { posts: 2 },
    },
  },
};

const otherService = {
  ...complete,
  directory: { ...complete.directory, service: 'fanbox', creatorName: 'Beta' },
};

Settings.value.creatorCardBadgeCountMode = 'posts';
let filters = CreatorFilterEngine.normalizeState({
  service: 'patreon',
  matchMode: 'all',
  media: {
    videos: { enabled: true, method: 'amount', count: { operator: 'at-least', from: 4 } },
    images: { enabled: true, method: 'amount', count: { operator: 'at-least', from: 5 } },
  },
});
assert.equal(CreatorFilterEngine.matches(complete, filters), true);
assert.equal(CreatorFilterEngine.matches(otherService, filters), false, 'service must remain an independent AND constraint');
filters.media.images.count = { operator: 'at-least', from: 99, to: 99 };
assert.equal(CreatorFilterEngine.matches(complete, filters), false);
filters.matchMode = 'any';
assert.equal(CreatorFilterEngine.matches(complete, filters), true);

Settings.value.creatorCardBadgeCountMode = 'attachments';
assert.equal(CreatorFilterEngine.mediaAmount(complete, 'videos'), 8);
assert.equal(CreatorFilterEngine.totalAttachmentUniverse(complete), 24);
assert.equal(CreatorFilterEngine.mediaPercentage(complete, 'videos'), 33.3);
filters = CreatorFilterEngine.normalizeState({
  media: {
    videos: { enabled: true, method: 'percentage', percentage: { operator: 'at-least', from: 33 } },
  },
});
assert.equal(CreatorFilterEngine.matches(complete, filters), true);

const partial = {
  ...complete,
  catalogueState: 'partial',
  summary: { ...complete.summary, completeness: 'partial' },
};
filters = CreatorFilterEngine.normalizeState({
  includePartialLowerBounds: true,
  media: { videos: { enabled: true, method: 'amount', count: { operator: 'at-least', from: 4 } } },
});
assert.equal(CreatorFilterEngine.matches(partial, filters), true);
filters.media.videos.count = { operator: 'at-most', from: 8, to: 8 };
assert.equal(CreatorFilterEngine.matches(partial, filters), false);
filters.media.videos.method = 'percentage';
filters.media.videos.percentageEnabled = true;
filters.media.videos.percentage = { operator: 'at-least', from: 1, to: 1 };
assert.equal(CreatorFilterEngine.matches(partial, filters), false);

filters = CreatorFilterEngine.normalizeState({
  publishedDate: { enabled: true, operator: 'between', from: '2026-01-01', to: '2026-12-31' },
});
assert.equal(CreatorFilterEngine.matches(complete, filters), true);
filters.publishedDate = { enabled: true, operator: 'at-most', from: '2024-01-01', to: '', includeUnknown: false };
assert.equal(CreatorFilterEngine.matches(complete, filters), false);
assert.equal(CreatorFilterEngine.matches({ ...complete, summary: { ...complete.summary, publishedTimestamps: [] } }, {
  ...filters,
  publishedDate: { ...filters.publishedDate, includeUnknown: true },
}), true);

const ruleA = CreatorCustomRule.normalize({
  enabled: true,
  join: 'if',
  outcome: 'match',
  fields: ['title'],
  match: 'contains',
  value: 'cat',
  method: 'amount',
  count: { operator: 'at-least', from: 3 },
});
const ruleB = CreatorCustomRule.normalize({
  enabled: true,
  join: 'and',
  outcome: 'match',
  fields: ['tags'],
  match: 'contains',
  value: 'dog',
  method: 'amount',
  count: { operator: 'at-least', from: 2 },
});
filters = CreatorFilterEngine.normalizeState({ customRules: [ruleA, ruleB] });
assert.equal(CreatorFilterEngine.matches(complete, filters), true);
filters.customRules[1].count = { operator: 'at-least', from: 9, to: 9 };
assert.equal(CreatorFilterEngine.matches(complete, filters), false);
filters.customRules[1].join = 'or';
assert.equal(CreatorFilterEngine.matches(complete, filters), true);
filters.customRules[0].outcome = 'no-match';
filters.customRules[1].join = 'and';
filters.customRules[1].count = { operator: 'at-least', from: 2, to: 2 };
assert.equal(CreatorFilterEngine.matches(complete, filters), true);

Settings.value.creatorCardBadgeCountMode = 'posts';
const unknown = { id: 'unknown', directory: { creatorName: 'Unknown' }, summary: {} };
const older = { id: 'older', directory: { creatorName: 'Zed', publicFavoriteCount: 4 }, summary: { sourcePostCount: 3, latestPublishedAt: Date.parse('2024-01-01'), aggregateEligiblePostCount: 3, media: { videos: { posts: 1, attachments: 1 } } } };
const newer = { id: 'newer', directory: { creatorName: 'Alpha', publicFavoriteCount: 9 }, summary: { sourcePostCount: 8, latestPublishedAt: Date.parse('2026-01-01'), aggregateEligiblePostCount: 8, media: { videos: { posts: 4, attachments: 6 } } } };
assert.deepEqual(CreatorSorter.sort([unknown, older, newer], { mode: 'published', direction: 'desc' }).map((x) => x.id), ['newer', 'older', 'unknown']);
assert.deepEqual(CreatorSorter.sort([unknown, older, newer], { mode: 'published', direction: 'asc' }).map((x) => x.id), ['older', 'newer', 'unknown']);
assert.deepEqual(CreatorSorter.sort([older, newer], { mode: 'alphabetical', direction: 'asc' }).map((x) => x.id), ['newer', 'older']);
assert.equal(CreatorSorter.value(newer, { mode: 'advanced', advancedType: 'videos', advancedMethod: 'amount' }), 4);
assert.equal(CreatorSorter.normalize('images:percentage', 'desc').mode, 'advanced');
assert.equal(CreatorSorter.normalize('latest', 'desc').mode, 'published');

const multiField = CreatorCustomRule.normalize({ fields: ['tags', 'title'], match: 'contains', value: 'cat' });
assert.deepEqual(JSON.parse(JSON.stringify(multiField.fields)), ['tags', 'title']);
assert.equal(
  CreatorCatalogueSummary.ruleFingerprint(CreatorCustomRule.normalize({ field: 'title', match: 'contains', value: 'cat' })),
  JSON.stringify({ field: 'title', match: 'contains', value: 'cat' }),
  'single-field rules retain their old aggregate fingerprint',
);

assert.match(originalSource, /Search Local catalogue creators…/);
assert.match(originalSource, />Local catalogue<\/button>/);
assert.match(originalSource, /Advanced attachment amounts/);
assert.match(originalSource, /Include safe partial lower bounds/);
assert.match(originalSource, /data-pmf-quick-status="hidden"/);
assert.ok(originalSource.includes('.pmf-creator-status-badge.pmf-creator-status-hidden{color:#397dc4}'));
assert.match(originalSource, /dynamicAggregateSignature/);
assert.doesNotMatch(originalSource, /Any service<\/span><span aria-hidden="true">▾<\/span>/);

console.log('Pawchive Media Filter v0.11.3 Local catalogue redesign tests passed.');
