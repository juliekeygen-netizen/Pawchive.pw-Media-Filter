'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(async () => {
  const { api, stored, originalSource, makeElement } = loadUserscript();
  const {
    Config,
    Cache,
    MissingAttachmentMaintenance,
    CreatorProfileRepairManager,
    CatalogueJobManager,
    CreatorIndexUI,
    CreatorDirectory,
    CreatorState,
  } = api;

  assert.equal(Config.version, '0.13.5');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.5/);
  assert.doesNotMatch(originalSource, /const LegacyCreatorIndexUI/);
  assert.doesNotMatch(originalSource, /creatorOpenChildBase/);
  assert.match(Cache.scanCataloguePostChunk.toString(), /openCursor/);
  assert.doesNotMatch(MissingAttachmentMaintenance.run.toString(), /\.plan\(/);
  assert.match(MissingAttachmentMaintenance.openScopeDialog.toString(), /Checking stored post count/);
  assert.match(originalSource, /currentRate/);
  assert.match(originalSource, /averageRate/);

  const makePost = (index, creator = 1) => {
    const creatorKey = `pawchive.pw|patreon|${creator}`;
    return {
      id: `post-${String(index).padStart(4, '0')}`,
      key: `${creatorKey}|post-${String(index).padStart(4, '0')}`,
      creatorKey,
      service: 'patreon',
      creatorId: String(creator),
      postUrl: `https://pawchive.pw/patreon/user/${creator}/post/post-${index}`,
      scanSchemaVersion: 2,
      cacheSources: { catalogue: true },
      missingStatsKnown: false,
      missingStatsParserVersion: 0,
    };
  };

  // The cache cursor API returns bounded chunks and a resumable cursor rather
  // than one array containing the whole library.
  Cache.dbPromise = Promise.resolve(null);
  Cache.memory.clear();
  const memoryPosts = Array.from({ length: 401 }, (_, index) => makePost(index + 1, index < 210 ? 1 : 2));
  memoryPosts.forEach((post) => Cache.memory.set(post.key, post));
  let cursor = null;
  let seen = 0;
  let rounds = 0;
  do {
    const result = await Cache.scanCataloguePostChunk({ cursor, scanLimit: 73 });
    assert.ok(result.records.length <= 73);
    assert.ok(result.scanned <= 73);
    seen += result.records.length;
    rounds += 1;
    cursor = result.cursor;
    if (result.done) break;
  } while (rounds < 20);
  assert.equal(seen, 401);
  assert.ok(rounds > 1);

  const selectedFirst = await Cache.scanCataloguePostChunk({ creatorKeys: ['pawchive.pw|patreon|2'], scanLimit: 50 });
  assert.ok(selectedFirst.records.length <= 50);
  assert.ok(selectedFirst.records.every((post) => post.creatorKey === 'pawchive.pw|patreon|2'));

  // Exercise the authoritative streaming maintenance runner with six bounded
  // chunks. It must not build or persist a 120-item planned-ID list.
  const streamedPosts = Array.from({ length: 120 }, (_, index) => makePost(index + 1, (index % 3) + 1));
  let scanCalls = 0;
  let countCalls = 0;
  let acquired = 0;
  let released = 0;
  let persistedPosts = 0;
  Cache.countCataloguePosts = async () => { countCalls += 1; return streamedPosts.length; };
  Cache.scanCataloguePostChunk = async ({ cursor: scanCursor }) => {
    const offset = Number(scanCursor?.offset) || 0;
    const records = streamedPosts.slice(offset, offset + 20);
    const next = offset + records.length;
    scanCalls += 1;
    return {
      records,
      scanned: records.length,
      done: next >= streamedPosts.length,
      cursor: next >= streamedPosts.length ? null : { mode: 'all', offset: next },
    };
  };
  Cache.putPosts = async (posts) => { persistedPosts += posts.length; };
  MissingAttachmentMaintenance.inspect = async () => ({
    missingStatsKnown: true,
    missingStatsParserVersion: 1,
    hasMissingStats: false,
    missingAttachmentCount: 0,
  });
  MissingAttachmentMaintenance.recomputeAffected = async () => {};
  CatalogueJobManager.acquireMaintenanceSlot = async () => { acquired += 1; };
  CatalogueJobManager.releaseMaintenanceSlot = () => { released += 1; };

  await MissingAttachmentMaintenance.run({ scope: 'all' });
  const checkpoint = stored.get(Config.missingAttachmentMaintenanceKey);
  assert.equal(countCalls, 1);
  assert.equal(scanCalls, 6);
  assert.equal(persistedPosts, 120);
  assert.equal(checkpoint.version, 3);
  assert.equal(checkpoint.scanDone, true);
  assert.equal(checkpoint.completed, 120);
  assert.equal(checkpoint.discovered, 120);
  assert.equal(checkpoint.pendingIds.length, 0);
  assert.equal(checkpoint.remainingIds.length, 0);
  assert.equal(checkpoint.failedIds.length, 0);
  assert.ok(checkpoint.plannedIds.length <= MissingAttachmentMaintenance.scanChunkSize);
  assert.equal(acquired, 1);
  assert.equal(released, 1);

  const finishedSnapshot = MissingAttachmentMaintenance.snapshot();
  assert.equal(finishedSnapshot.completed, 120);
  assert.ok('currentRate' in finishedSnapshot);
  assert.ok('averageRate' in finishedSnapshot);
  assert.equal(finishedSnapshot.remainingEstimated, false);

  // Planning/setup failures release the shared maintenance slot instead of
  // leaving Queue maintenance permanently locked.
  Cache.countCataloguePosts = async () => { throw new Error('count failed'); };
  await assert.rejects(MissingAttachmentMaintenance.run({ scope: 'all' }), /count failed/);
  assert.equal(acquired, 2);
  assert.equal(released, 2);
  assert.equal(MissingAttachmentMaintenance.active, null);

  CreatorProfileRepairManager.records = async () => { throw new Error('creator planning failed'); };
  await assert.rejects(CreatorProfileRepairManager.run(), /creator planning failed/);
  assert.equal(acquired, 3);
  assert.equal(released, 3);
  assert.equal(CreatorProfileRepairManager.active, null);

  // Multiple summary patches invalidate and render the Local catalogue once.
  const makeRecord = (index) => {
    const creatorKey = `pawchive.pw|patreon|batch-${index}`;
    return {
      directory: CreatorDirectory.normalize({
        creatorKey,
        domain: 'pawchive.pw',
        service: 'patreon',
        creatorId: `batch-${index}`,
        creatorName: `Batch ${index}`,
        creatorUrl: `https://pawchive.pw/patreon/user/batch-${index}`,
      }),
      meta: null,
      state: CreatorState.empty(creatorKey),
      summary: null,
      scanned: true,
    };
  };
  CreatorIndexUI.records = [makeRecord(1), makeRecord(2), makeRecord(3)];
  CreatorIndexUI.root = makeElement('section');
  CreatorIndexUI.mode = 'catalogue';
  CreatorIndexUI.retainedSession = null;
  let renders = 0;
  CreatorIndexUI.renderCatalogue = () => { renders += 1; };
  const changed = CreatorIndexUI.patchRecords(CreatorIndexUI.records.map((record, index) => ({
    creatorKey: record.directory.creatorKey,
    patch: { summary: { generatedAt: index + 1 } },
  })));
  assert.equal(changed, 3);
  assert.equal(renders, 1);
  assert.deepEqual(CreatorIndexUI.records.map((record) => record.summary.generatedAt), [1, 2, 3]);

  console.log('Pawchive Media Filter v0.11.3 streaming maintenance tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
