'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource, context } = loadUserscript();
const {
  Config, Settings, CreatorDirectory, CreatorState, CreatorStatusFilters,
  CreatorAggregateCondition, CreatorFilterEngine, CreatorSorter,
  CreatorCatalogueSummary, CatalogueModel, CardDimTreatment,
  CatalogueJobManager, NativeActionAlignment,
} = api;

assert.equal(Config.version, '0.10.9');
assert.match(originalSource, /\/\/ @version\s+0\.10\.9/);
assert.equal(Config.databaseVersion, 5);
assert.match(originalSource, /createObjectStore\('creatorDirectory'/);
assert.match(originalSource, /createObjectStore\('creatorStates'/);

const migrated = Settings.normalize(Settings.migrate({
  settingsSchemaVersion: 2,
  creatorCardBadges: { enabled: false, types: { videos: false } },
}));
assert.equal(migrated.settingsSchemaVersion, 4);
assert.equal(migrated.creatorCardBadgeCountMode, 'posts');
assert.equal(migrated.creatorStatusBadgeSize, 'small');
assert.equal(migrated.creatorStatusBadges.enabled, true);
assert.equal(migrated.hiddenCreatorTreatment.enabled, false);
assert.equal(migrated.creatorCardBadges.enabled, false);
assert.equal(migrated.creatorCardBadges.types.videos, false);

const first = CreatorDirectory.normalize({
  creatorKey: 'pawchive.pw|patreon|1',
  creatorName: 'One',
  indexedAt: 100,
  updatedAt: 120,
});
const merged = CreatorDirectory.merge(first, {
  ...first,
  creatorName: 'One Updated',
  indexedAt: 200,
  updatedAt: 300,
});
assert.equal(merged.creatorName, 'One Updated');
assert.equal(merged.indexedAt, 100);
assert.equal(merged.updatedAt, 300);

const state = CreatorState.normalize({ creatorKey:first.creatorKey, liked:true, hidden:false });
assert.equal(state.liked, true);
assert.equal(state.hidden, false);
assert.equal(state.favoriteDirectValue, null);
assert.equal(CreatorStatusFilters.matches({ favorite:null, state, scanned:true }, {
  favorite:'match', liked:'off', hidden:'off', scanned:'off',
}), false);
assert.equal(CreatorStatusFilters.matches({ favorite:null, state, scanned:true }, {
  favorite:'no-match', liked:'off', hidden:'off', scanned:'off',
}), false);
assert.equal(CreatorStatusFilters.matches({ favorite:null, state, scanned:true }, {
  favorite:'off', liked:'match', hidden:'no-match', scanned:'match',
}), true);

assert.equal(CreatorAggregateCondition.test(10, { operator:'at-least', from:10 }), true);
assert.equal(CreatorAggregateCondition.test(10, { operator:'at-most', from:9 }), false);
assert.equal(CreatorAggregateCondition.test(10, { operator:'exactly', from:10 }), true);
assert.equal(CreatorAggregateCondition.test(10, { operator:'between', from:9, to:11 }), true);
assert.equal(CreatorAggregateCondition.percentage(1, 4), 25);
assert.equal(CreatorAggregateCondition.valid({ operator:'between', from:10, to:20 }, true), true);

const filter = CreatorFilterEngine.normalizeState({
  media: { videos: {
    enabled:true,
    measure:'posts',
    count:{ operator:'at-least', from:2 },
    percentageEnabled:true,
    percentage:{ operator:'at-least', from:50 },
  } },
});
const filterRecord = {
  directory:{ service:'patreon' },
  catalogueState:'complete',
  summary:{ completeness:'complete', sourcePostCount:4, media:{ videos:{ posts:2, attachments:7 } } },
};
assert.equal(CreatorFilterEngine.matches(filterRecord, filter), true);
assert.equal(CreatorFilterEngine.matches({
  ...filterRecord,
  catalogueState:'partial',
  summary:{ ...filterRecord.summary, completeness:'partial' },
}, filter), false);
filter.includePartialLowerBounds = true;
assert.equal(CreatorFilterEngine.matches({
  ...filterRecord,
  catalogueState:'partial',
  summary:{ ...filterRecord.summary, completeness:'partial' },
}, filter), false);
filter.media.videos.percentageEnabled = false;
assert.equal(CreatorFilterEngine.matches({
  ...filterRecord,
  catalogueState:'partial',
  summary:{ ...filterRecord.summary, completeness:'partial' },
}, filter), true);

const sorted = CreatorSorter.sort([
  { id:'unknown', directory:{}, summary:{} },
  { id:'high', directory:{ publicFavoriteCount:20 }, summary:{} },
  { id:'low', directory:{ publicFavoriteCount:2 }, summary:{} },
], { mode:'popularity', direction:'desc' });
assert.deepEqual(sorted.map((item) => item.id), ['high', 'low', 'unknown']);
assert.deepEqual(CreatorSorter.sort(sorted, { mode:'popularity', direction:'asc' }).map((item) => item.id), ['low', 'high', 'unknown']);

const catalogue = {
  ...CatalogueModel.empty().catalogue,
  status:'complete',
  totalExpectedPosts:2,
  storedPostCount:2,
  pageCoverage:{ 0:{ offset:0, rawCount:2, usableCount:2, postIds:['a','b'], finalPage:true } },
  paginationEndReached:true,
  fullBuildCoverageComplete:true,
};
const summary = CreatorCatalogueSummary.compute([
  { id:'a', scanSchemaVersion:2, cacheSources:{ catalogue:true }, videoCount:2, imageCount:0, archiveCount:0, projectFileCount:0, externalLinkCount:1, published:'2025-01-01' },
  { id:'b', scanSchemaVersion:2, cacheSources:{ catalogue:true }, videoCount:1, imageCount:3, archiveCount:0, projectFileCount:0, externalLinkCount:0, published:'2026-01-01' },
], catalogue, 123);
assert.equal(summary.version, 4);
assert.deepEqual(JSON.parse(JSON.stringify(summary.media.videos)), { posts:2, attachments:3 });
assert.deepEqual(JSON.parse(JSON.stringify(summary.media.images)), { posts:1, attachments:3 });
assert.equal(summary.earliestPublishedAt, Date.parse('2025-01-01'));
assert.equal(summary.latestPublishedAt, Date.parse('2026-01-01'));
assert.equal(summary.completeness, 'complete');

const card = context.document.createElement('article');
CardDimTreatment.apply({ card, active:true, enabled:true, strength:'high', scope:'creator' });
assert.equal(card.classList.contains('pmf-hidden-creator-dimmed'), true);
assert.equal(card.classList.contains('pmf-hidden-creator-dim-high'), true);
CardDimTreatment.cleanup(card, 'creator');
assert.equal(card.classList.contains('pmf-hidden-creator-dimmed'), false);

assert.equal(NativeActionAlignment.clamp(20), 6);
assert.equal(NativeActionAlignment.clamp(-20), -6);
assert.match(api.PostPageController.alignToNative.toString(), /NativeActionAlignment\.align/);

CatalogueJobManager.shutdown();
CatalogueJobManager.maintenanceActive = true;
const makeContext = (id) => ({ creatorKey:`pawchive.pw|patreon|${id}`, domain:'pawchive.pw', service:'patreon', creatorId:String(id) });
CatalogueJobManager.enqueue(makeContext(1), 'build', { creatorName:'One', batchId:'batch', batchSequence:1 });
CatalogueJobManager.enqueue(makeContext(2), 'build', { creatorName:'Two', batchId:'batch', batchSequence:2 });
assert.equal(CatalogueJobManager.moveToTop(makeContext(2).creatorKey), true);
assert.equal(CatalogueJobManager.pendingJobs[0].creatorName, 'Two');
assert.equal(CatalogueJobManager.batchCounts('batch').waiting, 2);
assert.equal(CatalogueJobManager.batchCounts('batch').remaining, 2);
CatalogueJobManager.shutdown();
CatalogueJobManager.maintenanceActive = false;

assert.match(originalSource, /root\.id\s*=\s*'pmf-artists-root'/);
assert.match(originalSource, /CreatorCardRightRail/);
assert.match(originalSource, /CreatorQueuePanel/);
assert.match(originalSource, /pmf-field-availability/);
assert.match(originalSource, /Public creator favorite count/);
assert.match(originalSource, /Total Catalogue posts/);
assert.match(originalSource, /Posts published within/);
assert.match(originalSource, /Native-favorited posts/);
assert.match(originalSource, /CreatorPresets\.apply/);
assert.match(originalSource, /records\.forEach\(\(record\)=>ArtistsPageController\.scheduleBackfill/);
assert.doesNotMatch(originalSource, /width:\s*100vw/);

console.log('Pawchive Media Filter v0.10.0 unified creator index and queue tests passed.');
