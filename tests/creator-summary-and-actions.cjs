'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api } = loadUserscript();
const {
  Config, Settings, CreatorCatalogueSummary, CreatorCardBadgeRenderer,
  ArtistCatalogueAction, CatalogueModel,
} = api;

const catalogue = {
  ...CatalogueModel.empty().catalogue,
  status:'complete',
  totalExpectedPosts:2,
  storedPostCount:2,
  pageCoverage:{
    0:{offset:0,rawCount:2,usableCount:2,postIds:['a','b'],invalidRecordCount:0,finalPage:true,endReason:'short-page'},
  },
  paginationEndReached:true,
  endReason:'short-page',
  fullBuildCoverageComplete:true,
  retryableMetadataIds:['b'],
};
const posts = [
  {
    id:'a', scanSchemaVersion:Config.schemaVersion, cacheSources:{catalogue:true,scan:false},
    videoCount:2, imageCount:1, archiveCount:0, projectFileCount:1, externalLinkCount:3, mediaDownloadLinkCount:3,
  },
  {
    id:'b', scanSchemaVersion:Config.schemaVersion, cacheSources:{catalogue:true,scan:true},
    videoCount:0, imageCount:4, archiveCount:2, projectFileCount:0,
    hasProjectFiles:true, externalLinkCount:1, mediaDownloadLinkCount:1,
  },
  {
    id:'scan-only', scanSchemaVersion:Config.schemaVersion, cacheSources:{catalogue:false,scan:true},
    videoCount:100, imageCount:100, archiveCount:100, projectFileCount:100, externalLinkCount:100,
  },
];
const summary = CreatorCatalogueSummary.compute(posts, catalogue, 123);
assert.deepEqual(JSON.parse(JSON.stringify(summary.counts)), {
  videos:2, images:5, archives:2, projectFiles:1, externalLinks:4,
});
assert.equal(summary.sourcePostCount, 2);
assert.equal(summary.retryableMetadataCount, 1);
assert.equal(summary.computedAt, 123);
catalogue.creatorCardSummary = summary;
assert.equal(CreatorCatalogueSummary.valid(summary, catalogue, 2), true);
assert.equal(CreatorCatalogueSummary.valid({ ...summary, version:0 }, catalogue, 2), false);
assert.equal(CreatorCatalogueSummary.valid(summary, catalogue, 3), false);
const oldFingerprint = summary.classificationFingerprint;
Settings.value.videoExtensions = [...Settings.value.videoExtensions, 'newvideo'];
assert.notEqual(CreatorCatalogueSummary.fingerprint(), oldFingerprint);
assert.equal(CreatorCatalogueSummary.valid(summary, catalogue, 2), false);

assert.equal(CreatorCardBadgeRenderer.formatCount(0), '0');
assert.equal(CreatorCardBadgeRenderer.formatCount(999), '999');
assert.equal(CreatorCardBadgeRenderer.formatCount(1247), '1.2k');
assert.deepEqual(JSON.parse(JSON.stringify(CreatorCardBadgeRenderer.columns(['videos','images','archives','projectFiles','externalLinks']))), [
  ['videos','images'], ['archives','projectFiles'], ['externalLinks'],
]);

assert.equal(ArtistCatalogueAction.forState(null), 'build');
assert.equal(ArtistCatalogueAction.forState({creatorKey:'x',catalogue:{...CatalogueModel.empty().catalogue,status:'partial'}}), 'resume');
assert.equal(ArtistCatalogueAction.forState({creatorKey:'x',catalogue}), 'update');
assert.equal(ArtistCatalogueAction.forState({creatorKey:'x',catalogue},{creatorKey:'x'}), 'stop');
assert.equal(ArtistCatalogueAction.forState(null,null,{loadError:true}), 'unavailable');

console.log('Pawchive Media Filter creator summary and action tests passed.');
