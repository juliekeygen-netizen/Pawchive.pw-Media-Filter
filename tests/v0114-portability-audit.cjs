'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, context, stored, originalSource } = loadUserscript();
const {
  Config,
  Cache,
  DataPortability,
  FilterEngine,
} = api;

(async () => {
  context.location.hostname = 'pawchive.pw';
  context.location.origin = 'https://pawchive.pw';
  context.location.href = 'https://pawchive.pw/artists';

  assert.equal(Config.version, '0.12.9');
  assert.match(originalSource, /\/\/ @version\s+0\.12\.9/);

  const emptyStores = () => Object.fromEntries(DataPortability.catalogueStores.map((store) => [store, []]));
  const backup = {
    format: DataPortability.format,
    formatVersion: 1,
    sourceHost: 'www.pawchive.pw',
    catalogue: {
      stores: {
        ...emptyStores(),
        posts: [{ key: 'www.pawchive.pw|patreon|123|p1', creatorKey: 'www.pawchive.pw|patreon|123', id: 'p1', postUrl: 'https://www.pawchive.pw/patreon/user/123/post/p1' }],
        creators: [{ creatorKey: 'www.pawchive.pw|patreon|123', domain: 'www.pawchive.pw', creatorUrl: 'https://www.pawchive.pw/patreon/user/123' }],
        uiStates: [{ creatorKey: 'www.pawchive.pw|patreon|123', filteredPage: 2 }],
        postStatuses: [{ key: 'www.pawchive.pw|patreon|123|p1', creatorKey: 'www.pawchive.pw|patreon|123', postId: 'p1', liked: true }],
        favoriteSnapshotEntries: [{ key: 'www.pawchive.pw|snap-1|www.pawchive.pw|patreon|123|p1', host: 'www.pawchive.pw', snapshotId: 'snap-1', hostSnapshot: 'www.pawchive.pw|snap-1', postKey: 'www.pawchive.pw|patreon|123|p1' }],
        favoriteSyncMeta: [{ host: 'www.pawchive.pw', activeSnapshotId: 'snap-1', sourceUrl: 'https://www.pawchive.pw/favorites' }],
        creatorDirectory: [{ creatorKey: 'www.pawchive.pw|patreon|123', domain: 'www.pawchive.pw', service: 'patreon', creatorId: '123', creatorName: 'Creator', creatorUrl: 'https://www.pawchive.pw/patreon/user/123' }],
        creatorStates: [{ creatorKey: 'www.pawchive.pw|patreon|123', liked: true }],
      },
      auxiliary: {
        [Config.favoriteSyncKey]: { host: 'www.pawchive.pw', activeSnapshotId: 'snap-1', sourceUrl: 'https://www.pawchive.pw/favorites' },
      },
    },
    settings: { value: { settingsSchemaVersion: 5 }, auxiliary: {} },
    presets: {
      post: { schemaVersion: 1, presets: [{ id: 'post-default', name: 'Default', snapshot: FilterEngine.createDefaultState() }] },
      creator: { version: 1, activeId: 'default', presets: [{ id: 'default', name: 'Default', state: {} }] },
    },
  };

  const prepared = DataPortability.prepareImport(backup, { catalogue: true, settings: true, presets: true });
  assert.equal(prepared.catalogue.stores.posts[0].key, 'pawchive.pw|patreon|123|p1');
  assert.equal(prepared.catalogue.stores.posts[0].creatorKey, 'pawchive.pw|patreon|123');
  assert.equal(prepared.catalogue.stores.posts[0].postUrl, 'https://pawchive.pw/patreon/user/123/post/p1');
  assert.equal(prepared.catalogue.stores.creatorDirectory[0].domain, 'pawchive.pw');
  assert.equal(prepared.catalogue.stores.favoriteSnapshotEntries[0].hostSnapshot, 'pawchive.pw|snap-1');
  assert.equal(prepared.catalogue.stores.favoriteSnapshotEntries[0].postKey, 'pawchive.pw|patreon|123|p1');
  assert.equal(prepared.catalogue.stores.favoriteSyncMeta[0].host, 'pawchive.pw');
  assert.equal(prepared.catalogue.auxiliary[Config.favoriteSyncKey].host, 'pawchive.pw');

  const mixedHostBackup = structuredClone(backup);
  mixedHostBackup.catalogue.stores.posts.push({
    key: 'pawchive.pw|patreon|123|p1',
    creatorKey: 'pawchive.pw|patreon|123',
    id: 'p1',
    scannedAt: 999,
    title: 'newer local host row',
  });
  const mixedPrepared = DataPortability.prepareImport(mixedHostBackup, { catalogue: true, settings: true, presets: true });
  assert.equal(mixedPrepared.catalogue.stores.posts.length, 1);
  assert.equal(mixedPrepared.catalogue.stores.posts[0].title, 'newer local host row');

  await DataPortability.writeCatalogue(prepared.catalogue, { mode: 'replace' });
  assert.equal(Cache.memory.has('pawchive.pw|patreon|123|p1'), true);
  assert.equal(Cache.metaMemory.has('pawchive.pw|patreon|123'), true);
  assert.equal(Cache.uiStateMemory.has('pawchive.pw|patreon|123'), true);
  assert.equal(Cache.favoriteSnapshotMemory.get('pawchive.pw|snap-1').has('pawchive.pw|patreon|123|p1'), true);

  const missingStore = structuredClone(backup);
  delete missingStore.catalogue.stores.uiStates;
  assert.throws(
    () => DataPortability.validateImportSelection(missingStore, { catalogue: true, settings: false, presets: false }),
    /missing the uiStates store/i,
  );
  const duplicatePreset = structuredClone(backup);
  duplicatePreset.presets.post.presets.push(structuredClone(duplicatePreset.presets.post.presets[0]));
  assert.throws(
    () => DataPortability.validateImportSelection(duplicatePreset, { catalogue: false, settings: false, presets: true }),
    /duplicate post preset ID/i,
  );

  Cache.uiStateMemory.set('pawchive.pw|patreon|123', { creatorKey: 'pawchive.pw|patreon|123', filteredPage: 3 });
  Cache.favoriteSnapshotMemory.set('pawchive.pw|snap-2', new Set(['pawchive.pw|patreon|123|p2']));
  stored.set(Config.favoriteSyncKey, { host: 'pawchive.pw', activeSnapshotId: 'snap-2' });
  const exported = await DataPortability.exportCatalogue();
  assert.equal(exported.stores.uiStates.length, 1);
  assert.equal(exported.stores.favoriteSnapshotEntries.length, 2);
  assert.equal(exported.stores.favoriteSyncMeta.length, 1);

  Cache.memory.set('stale-post', { key: 'stale-post' });
  Cache.metaMemory.set('stale-creator', { creatorKey: 'stale-creator' });
  Cache.uiStateMemory.set('stale-ui', { creatorKey: 'stale-ui' });
  Cache.favoriteSnapshotMemory.set('stale|snapshot', new Set(['stale-post']));
  await DataPortability.writeCatalogue({ stores: emptyStores(), auxiliary: {} }, { mode: 'replace' });
  assert.equal(Cache.memory.size, 0);
  assert.equal(Cache.metaMemory.size, 0);
  assert.equal(Cache.uiStateMemory.size, 0);
  assert.equal(Cache.favoriteSnapshotMemory.size, 0);

  assert.ok(originalSource.includes("db.transaction(DataPortability.catalogueStores,'readonly')"));
  assert.ok(originalSource.includes("const transactionStores=mode==='replace'?DataPortability.catalogueStores:names"));

  console.log('Pawchive Media Filter v0.11.4 portability audit tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
