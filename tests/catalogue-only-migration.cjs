'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api } = loadUserscript();
const { CatalogueOnlyMigration, CatalogueModel, Config } = api;
const json = (value) => JSON.parse(JSON.stringify(value));

const completeMeta = {
  creatorKey:'creator',
  storageMode:'catalogue',
  totalPosts:122,
  totalPages:3,
  previousNormalScanRange:'5',
  scannedOffsets:[0,50],
  workingEndpoint:2,
  catalogue:{
    ...CatalogueModel.empty().catalogue,
    status:'complete',
    totalExpectedPosts:122,
    storedPostCount:122,
    pageCoverage:{
      0:{offset:0,rawCount:50},
      50:{offset:50,rawCount:50},
      100:{offset:100,rawCount:22,finalPage:true,endReason:'short-page'},
    },
    fullBuildCoverageComplete:true,
    creatorCardSummary:{version:1,sourcePostCount:122,counts:{videos:3}},
    retryableMetadataIds:['9'],
    retryableMetadataReasons:{9:['explicit-partial-record']},
    lastFullBuildAt:100,
    lastUpdateCheckAt:200,
  },
};
const scanOnlyMeta = {
  creatorKey:'scan-only',
  storageMode:'scan',
  scannedOffsets:[0],
  catalogue:CatalogueModel.empty().catalogue,
};
const posts = {
  A:{id:'A',cacheSources:{scan:true,catalogue:false}},
  B:{id:'B',cacheSources:{scan:true,catalogue:true}},
  C:{id:'C',cacheSources:{scan:false,catalogue:true}},
  legacy:{id:'legacy'},
};

assert.equal(CatalogueOnlyMigration.shouldKeepPost(posts.A, completeMeta), false);
assert.equal(CatalogueOnlyMigration.shouldKeepPost(posts.B, completeMeta), true);
assert.equal(CatalogueOnlyMigration.shouldKeepPost(posts.C, completeMeta), true);
assert.equal(CatalogueOnlyMigration.shouldKeepPost(posts.legacy, completeMeta), true);
assert.equal(CatalogueOnlyMigration.shouldKeepPost(posts.legacy, scanOnlyMeta), false);

const normalizedB = CatalogueOnlyMigration.normalizePost(posts.B);
assert.deepEqual(json(normalizedB.cacheSources), {scan:false,catalogue:true});
const normalizedMeta = CatalogueOnlyMigration.normalizeMeta(completeMeta);
assert.equal(normalizedMeta.catalogue.status, 'complete');
assert.deepEqual(Object.keys(normalizedMeta.catalogue.pageCoverage), ['0','50','100']);
assert.equal(normalizedMeta.catalogue.pageCoverage['0'].rawCount, 50);
assert.equal(normalizedMeta.catalogue.pageCoverage['50'].rawCount, 50);
assert.equal(normalizedMeta.catalogue.pageCoverage['100'].rawCount, 22);
assert.equal(normalizedMeta.catalogue.pageCoverage['100'].finalPage, true);
assert.equal(normalizedMeta.catalogue.pageCoverage['100'].endReason, 'short-page');
assert.deepEqual(json(normalizedMeta.catalogue.creatorCardSummary), json(completeMeta.catalogue.creatorCardSummary));
assert.equal(normalizedMeta.catalogue.lastUpdateCheckAt, 200);
assert.deepEqual(json(normalizedMeta.catalogue.retryableMetadataIds), ['9']);
assert.equal(normalizedMeta.workingEndpoint, 2);
for (const key of ['storageMode','previousNormalScanRange','scannedOffsets']) assert.equal(key in normalizedMeta, false);
assert.equal(CatalogueOnlyMigration.normalizeMeta(scanOnlyMeta), null);

const ui = CatalogueOnlyMigration.normalizeUIState({
  creatorKey:'creator',
  storageMode:'catalogue',
  previousNormalScanRange:'10',
  scanRange:'5',
  scannedOffsetsOrRanges:[0,50],
  filterState:{preserved:true},
  activePresetId:'preset',
  sortMode:'invalid',
  sortDirection:'invalid',
});
assert.deepEqual(json(ui.filterState), {preserved:true});
assert.equal(ui.activePresetId, 'preset');
assert.equal(ui.sortMode, 'published');
assert.equal(ui.sortDirection, 'default');
for (const key of ['storageMode','previousNormalScanRange','scanRange','scannedOffsetsOrRanges']) assert.equal(key in ui, false);

const rerunMeta = CatalogueOnlyMigration.normalizeMeta(normalizedMeta);
assert.deepEqual(json(rerunMeta), json(normalizedMeta), 'normalization is idempotent');
assert.equal(Config.catalogueOnlyMigrationKey, 'pmf-catalogue-only-migration-v1');

console.log('Pawchive Media Filter Catalogue-only migration tests passed.');
