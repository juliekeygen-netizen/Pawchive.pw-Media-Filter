'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, context } = loadUserscript();
const { Config, Settings, Cache, PawchiveAPI, CatalogueModel, CatalogueRunner, UI, App } = api;
const json = (value) => JSON.parse(JSON.stringify(value));
const creator = {
  domain: 'pawchive.pw', service: 'fanbox', creatorId: '123',
  creatorKey: 'pawchive.pw|fanbox|123', creatorUrl: 'https://pawchive.pw/fanbox/user/123',
};
const raw = (id, patch = {}) => ({
  id: String(id), user: '123', service: 'fanbox', title: `Post ${id}`,
  published: '2026-01-01T00:00:00Z', file: null, attachments: [], tags: [], content: '',
  ...patch,
});

async function setup(totalExpectedPosts) {
  const model = CatalogueModel.empty();
  model.catalogue.status = 'building';
  model.catalogue.totalExpectedPosts = totalExpectedPosts;
  Cache.commitCataloguePage = async (_creatorKey, posts, patch) => ({
    creatorKey: creator.creatorKey, ...patch, committedPostCount: posts.length,
  });
  Cache.patchMeta = async (_creatorKey, patch) => ({ creatorKey: creator.creatorKey, ...patch });
  return {
    context: creator,
    creatorMeta: { creatorKey: creator.creatorKey },
    model,
    catalogueState: model.catalogue,
    postsById: new Map(),
    workingEndpoint: null,
    totalPosts: totalExpectedPosts,
    totalPages: Math.ceil(totalExpectedPosts / Config.pageSize),
  };
}

(async () => {
  let runtime = await setup(50);
  const ordinaryMissingOptional = Array.from({ length: 50 }, (_, index) => ({
    id: String(index + 1), user: '123', service: 'fanbox', title: `Post ${index + 1}`,
  }));
  let committed = await CatalogueRunner.commitBuildPage(runtime, { posts: ordinaryMissingOptional, endpointIndex: 0, warnings: [] }, 0, 'build');
  assert.equal(committed.prepared.posts.length, 50);
  assert.equal(committed.prepared.entries.filter((entry) => entry.metadataPolicy.retryable).length, 0, 'mere optional-field absence does not queue details');
  assert.equal(runtime.catalogueState.pageCoverage['0'].fieldAvailability.tags.status, 'not-provided');
  assert.equal(runtime.catalogueState.retryableMetadataIds.length, 0);
  assert.equal(CatalogueModel.evaluateCoverage(runtime.catalogueState).coverageComplete, true);

  runtime = await setup(50);
  const explicitPartial = Array.from({ length: 50 }, (_, index) => raw(index + 1, index < 3 ? { has_full: false } : {}));
  committed = await CatalogueRunner.commitBuildPage(runtime, { posts: explicitPartial, endpointIndex: 0, warnings: [] }, 0, 'build');
  assert.equal(committed.prepared.entries.filter((entry) => entry.metadataPolicy.retryable).length, 3);
  assert.deepEqual(json(runtime.catalogueState.retryableMetadataIds), ['1', '2', '3']);
  assert.equal(CatalogueModel.evaluateCoverage(runtime.catalogueState).coverageComplete, true, 'retryable metadata never blocks coverage');

  runtime = await setup(50);
  const malformedPage = Array.from({ length: 50 }, (_, index) => index === 17 ? { title: 'missing ID' } : raw(index + 1));
  const partial = await CatalogueRunner.commitBuildPage(runtime, { posts: malformedPage, endpointIndex: 1, warnings: [] }, 0, 'build');
  assert.equal(partial.prepared.posts.length, 49);
  assert.equal(runtime.catalogueState.pageCoverage['0'].invalidRecordCount, 1);
  assert.equal(runtime.catalogueState.malformedListRecords[0].index, 17);
  assert.equal(CatalogueModel.evaluateCoverage(runtime.catalogueState).coverageComplete, true);

  runtime = await setup(50);
  await assert.rejects(
    CatalogueRunner.commitBuildPage(runtime, { posts: [{ title: 'bad' }], endpointIndex: 0, warnings: [] }, 0, 'build'),
    /zero usable post IDs/,
  );

  const migrated259 = CatalogueModel.normalize({
    storageMode: 'catalogue',
    catalogue: {
      status: 'complete', totalExpectedPosts: 259, storedPostCount: 259,
      successfulOffsets: [0, 50, 100, 150, 200, 250],
      incompleteMetadataIds: Array.from({ length: 259 }, (_, index) => String(index + 1)),
      incompleteMetadataReasons: Object.fromEntries(
        Array.from({ length: 259 }, (_, index) => [String(index + 1), ['tags', 'content', 'attachments']]),
      ),
      fullBuildCoverageComplete: true,
    },
  });
  assert.equal(migrated259.catalogue.storedPostCount, 259);
  assert.equal(Object.keys(migrated259.catalogue.pageCoverage).length, 6);
  assert.equal(migrated259.catalogue.retryableMetadataIds.length, 0);
  assert.equal(CatalogueModel.evaluateCoverage(migrated259.catalogue).coverageComplete, true);
  assert.equal(CatalogueModel.button(migrated259).label, 'Update');

  const genuineRetry = CatalogueModel.normalize({
    storageMode: 'catalogue',
    catalogue: {
      status: 'complete', fullBuildCoverageComplete: true,
      incompleteMetadataIds: ['9'],
      incompleteMetadataReasons: { 9: ['invalid-attachments-structure'] },
    },
  });
  assert.deepEqual(json(genuineRetry.catalogue.retryableMetadataIds), ['9']);

  App.catalogueState = CatalogueModel.normalize({
    catalogue: {
      status: 'partial', totalExpectedPosts: 100, storedPostCount: 0,
      pageCoverage: {}, failedOffsets: [],
    },
  });
  App.ui = { details: { hidden: false, textContent: '', innerHTML:'', className:'', replaceChildren() { this.innerHTML=''; this.textContent=''; } } };
  UI.refreshDetails();
  assert.match(App.ui.details.innerHTML, /0 of 100 expected posts are available locally/);
  App.catalogueState.catalogue.storedPostCount = 50;
  App.catalogueState.catalogue.pageCoverage['0'] = {
    offset: 0, rawCount: 50, usableCount: 50,
    fieldAvailability: api.CatalogueMetadataPolicy.summarize(
      Array.from({ length: 50 }, () => api.CatalogueMetadataPolicy.availability({ tags: [] })),
    ),
  };
  UI.refreshDetails();
  assert.match(App.ui.details.innerHTML, /50 of 100 expected posts are available locally/);
  assert.match(App.ui.details.innerHTML, /1 of 2 pages verified/);
  assert.doesNotMatch(App.ui.details.innerHTML, /<p>0 of 100 expected posts/);

  const durableComplete = {
    totalExpectedPosts: 125, storedPostCount: 125, fullBuildCoverageComplete: true,
    pageCoverage: { 0: { offset: 0 }, 50: { offset: 50 } }, failedOffsets: [],
  };
  assert.equal(CatalogueModel.evaluateCoverage(durableComplete).coverageComplete, true);

  Settings.value.retryFailed = false;
  context.fetch = async () => ({ ok: false, status: 400, headers: { get: () => null }, text: async () => '' });
  const end = await PawchiveAPI.fetchCreatorPage(creator, 50, null, new AbortController().signal, null, { allowOutOfRange400: true });
  assert.equal(end.endReason, 'http-400');
  assert.deepEqual(json(end.posts), []);
  await assert.rejects(PawchiveAPI.fetchCreatorPage(creator, 0, null, new AbortController().signal), /All creator endpoints failed/);

  console.log('Pawchive Media Filter v0.8.0 catalogue pipeline tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
