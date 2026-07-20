'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource } = loadUserscript();
const {
  Config, Settings, CreatorAggregateCondition, CreatorCustomRule,
  CreatorFilterEngine, CreatorCatalogueSummary, CreatorSorter,
  ArtistsDOM, CreatorGridGeometry, CreatorBulkSelection, CatalogueJobManager, CatalogueModel,
} = api;

assert.equal(Config.version, '0.11.2');
assert.match(originalSource, /\/\/ @version\s+0\.11\.2/);
assert.equal(Config.databaseVersion, 5);
assert.equal(Settings.schema.version, 5);
const migrated = Settings.migrate({ settingsSchemaVersion:3 });
assert.equal(migrated.settingsSchemaVersion, 5);
assert.equal(migrated.creatorCardBadgeCountMode, 'posts');
assert.equal(Settings.normalize({ creatorCardBadgeCountMode:'attachments' }).creatorCardBadgeCountMode, 'attachments');

assert.equal(CreatorAggregateCondition.validateRaw({ operator:'at-least', from:'' }).valid, false);
assert.equal(CreatorAggregateCondition.validateRaw({ operator:'between', from:'10', to:'2' }).valid, false);
assert.equal(CreatorAggregateCondition.validateRaw({ operator:'between', from:'10', to:'20' }).valid, true);
assert.equal(CreatorAggregateCondition.safeForPartial({ operator:'at-least' }, false), true);
assert.equal(CreatorAggregateCondition.safeForPartial({ operator:'at-most' }, false), false);
assert.equal(CreatorAggregateCondition.safeForPartial({ operator:'at-least' }, true), false);

const customRule = CreatorCustomRule.normalize({
  enabled:true, field:'tags', match:'contains', value:'animation',
  count:{ operator:'at-least', from:1 },
});
assert.equal(CreatorCustomRule.valid(customRule), true);
assert.equal(CreatorCustomRule.valid({ ...customRule, value:'' }), false);
assert.equal(CreatorFilterEngine.requiresCatalogue({ customRules:[customRule] }), true);
assert.equal(CreatorGridGeometry.median([300, 320, 340]), 320);
assert.equal(CreatorGridGeometry.median([300, 340]), 320);

const catalogue = {
  ...CatalogueModel.empty().catalogue,
  status:'complete',
  totalExpectedPosts:2,
  storedPostCount:2,
  pageCoverage:{ 0:{ offset:0, rawCount:2, usableCount:2, postIds:['a','b'], finalPage:true } },
  paginationEndReached:true,
  fullBuildCoverageComplete:true,
};
const posts = [
  {
    id:'a', key:'pawchive.pw|patreon|1|a', creatorKey:'pawchive.pw|patreon|1',
    scanSchemaVersion:2, cacheSources:{ catalogue:true }, videoCount:1,
    imageCount:0, archiveCount:0, projectFileCount:0, hasProjectFiles:true,
    externalLinkCount:0, fileExtensions:['blend'], title:'Animation source',
    tags:['animation'], published:'2025-03-01',
  },
  {
    id:'b', key:'pawchive.pw|patreon|1|b', creatorKey:'pawchive.pw|patreon|1',
    scanSchemaVersion:2, cacheSources:{ catalogue:true }, videoCount:0,
    imageCount:1, archiveCount:0, projectFileCount:0, hasProjectFiles:false,
    externalLinkCount:1, fileExtensions:['png'], title:'Still',
    tags:['image'], published:'2026-04-01',
  },
];
const filterState = CreatorFilterEngine.normalizeState({
  media:{ customExtensions:{ enabled:true, extensions:['blend'], count:{ operator:'at-least', from:1 } } },
  customRules:[customRule],
});
const summary = CreatorCatalogueSummary.compute(posts, catalogue, 100, {
  filterState,
  statuses:[
    { postId:'a', creatorKey:'pawchive.pw|patreon|1', liked:true, seen:true },
    { postId:'b', creatorKey:'pawchive.pw|patreon|1', liked:false, seen:true },
  ],
});
assert.equal(summary.version, 5);
assert.deepEqual(JSON.parse(JSON.stringify(summary.media.projectFiles)), { posts:1, attachments:0 });
assert.equal(summary.statuses.liked, 1);
assert.equal(summary.statuses.seen, 2);
assert.equal(summary.publishedTimestamps.length, 2);
assert.equal(CreatorCatalogueSummary.publishedWithin(summary, '2025-01-01', '2025-12-31'), 1);
assert.equal(summary.customExtensionAggregates.blend.posts, 1);
assert.equal(summary.customRuleAggregates[CreatorCatalogueSummary.ruleFingerprint(customRule)].posts, 1);

const partialRecord = {
  directory:{ service:'patreon' },
  catalogueState:'partial',
  summary:{ ...summary, completeness:'partial' },
};
const safePartial = CreatorFilterEngine.normalizeState({
  includePartialLowerBounds:true,
  media:{ videos:{ enabled:true, count:{ operator:'at-least', from:1 } } },
});
assert.equal(CreatorFilterEngine.matches(partialRecord, safePartial), true);
safePartial.media.videos.count.operator = 'at-most';
assert.equal(CreatorFilterEngine.matches(partialRecord, safePartial), false);

const owned = { matches:(selector)=>selector.includes('pmf-owned'), closest:()=>null };
const native = { matches:()=>false, closest:()=>null };
const root = { querySelectorAll:()=>[
  { getAttribute:()=>'/patreon/user/1', href:'https://pawchive.pw/patreon/user/1', ...owned },
  { getAttribute:()=>'/patreon/user/2', href:'https://pawchive.pw/patreon/user/2', ...native },
] };
assert.equal(ArtistsDOM.creatorLinks(root, { nativeOnly:true }).length, 1);

const sortRecords = [
  { id:'unknown', directory:{ creatorName:'Z' }, summary:{} },
  { id:'known', directory:{ creatorName:'A' }, summary:{ sourcePostCount:2, media:{ images:{ posts:1, attachments:4 } } } },
];
assert.deepEqual(CreatorSorter.sort(sortRecords, { mode:'images:attachments', direction:'desc' }).map((record)=>record.id), ['known','unknown']);

CatalogueJobManager.shutdown();
CatalogueJobManager.maintenanceActive = true;
const batch = CatalogueJobManager.createBatch({ label:'Test batch', total:2 });
const context = (id) => ({ creatorKey:`pawchive.pw|patreon|${id}`, domain:'pawchive.pw', service:'patreon', creatorId:String(id) });
CatalogueJobManager.enqueue(context(1), 'build', { batchId:batch.id, batchLabel:batch.label });
CatalogueJobManager.enqueue(context(2), 'build', { batchId:batch.id, batchLabel:batch.label });
assert.equal(CatalogueJobManager.batchCounts(batch.id).total, 2);
CatalogueJobManager.removeQueued(context(1).creatorKey);
assert.equal(CatalogueJobManager.batchCounts(batch.id).total, 2);
assert.equal(CatalogueJobManager.batchCounts(batch.id).removed, 1);
const bulk = CreatorBulkSelection.evaluate([
  { directory:{ creatorKey:context(2).creatorKey }, scanned:false },
  { directory:{ creatorKey:'pawchive.pw|patreon|3' }, scanned:false },
], 'build');
assert.equal(bulk.eligible.length, 1);
assert.equal(bulk.skipped[0].reason, 'already queued');
CatalogueJobManager.shutdown();
CatalogueJobManager.maintenanceActive = false;

assert.doesNotMatch(originalSource, /grid\.className=`\$\{found\.grid\.className\}/);
assert.doesNotMatch(originalSource, /template:templates\.get\(key\)\|\|fallback/);
assert.match(originalSource, /NativeArtistsVisibility\.apply/);
assert.match(originalSource, /--pmf-native-creator-card-width/);
assert.match(originalSource, /creator-dynamic-aggregates-hydrated/);
assert.match(originalSource, /requestRefresh\(reason='request'\)/);
assert.match(originalSource, /version:4,waiting,active,recent,batches/);

console.log('Pawchive Media Filter v0.10.1 creator-index corrective tests passed.');
