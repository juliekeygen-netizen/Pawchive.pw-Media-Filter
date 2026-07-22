'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource } = loadUserscript();
const { Config, DataPortability, FilterEngine } = api;

(() => {
  assert.equal(Config.version, '0.12.9');
  assert.match(originalSource, /\/\/ @version\s+0\.12\.9/);

  const stores = Object.fromEntries(DataPortability.catalogueStores.map((store) => [store, []]));
  for (let index = 0; index < 120; index += 1) {
    stores.posts.push({
      key: `pawchive.pw|patreon|creator|post-${index}`,
      creatorKey: 'pawchive.pw|patreon|creator',
      id: `post-${index}`,
      title: `Post ${index}`,
      contentText: 'x'.repeat(1200),
    });
  }
  stores.creators.push({ creatorKey: 'pawchive.pw|patreon|creator' });
  stores.creatorDirectory.push({ creatorKey: 'pawchive.pw|patreon|creator', service: 'patreon', creatorId: 'creator', creatorName: 'Creator' });

  const payload = {
    format: DataPortability.format,
    formatVersion: DataPortability.version,
    appVersion: Config.version,
    exportedAt: '2026-07-20T00:00:00.000Z',
    sourceHost: 'pawchive.pw',
    catalogue: { databaseVersion: Config.databaseVersion, stores, auxiliary: {} },
    settings: { value: { settingsSchemaVersion: 5 }, auxiliary: {} },
    presets: {
      post: { schemaVersion: 1, presets: [{ id: 'default', name: 'Default', snapshot: FilterEngine.createDefaultState() }] },
      creator: { version: 1, activeId: 'default', presets: [{ id: 'default', name: 'Default', state: {} }] },
    },
  };

  // Export must never stringify the complete backup as one giant JavaScript
  // string. Each JSONL entry is serialized independently and grouped into
  // bounded Blob parts.
  const originalStringify = DataPortability.stringify;
  DataPortability.stringify = (value) => {
    assert.notEqual(value, payload, 'the entire backup was passed to JSON.stringify');
    return originalStringify(value);
  };
  const parts = DataPortability.serializeBackupParts(payload, { chunkChars: 16384 });
  DataPortability.stringify = originalStringify;
  assert.ok(parts.length > 2, 'large backups should be split into multiple bounded parts');
  assert.ok(parts.every((part) => typeof part === 'string'));
  assert.ok(parts.slice(0, -1).every((part) => part.length <= 18000));

  const restored = DataPortability.parseStreamText(parts.join(''));
  assert.equal(restored.catalogue.stores.posts.length, 120);
  assert.equal(restored.catalogue.stores.posts[119].contentText.length, 1200);
  assert.equal(restored.settings.value.settingsSchemaVersion, 5);
  assert.equal(restored.presets.post.presets[0].id, 'default');

  assert.match(DataPortability.filename(), /\.pmfbackup$/);
  assert.doesNotMatch(originalSource, /new Blob\(\[JSON\.stringify\(payload\)\]/);
  assert.match(originalSource, /new Blob\(parts,\{type:'application\/x-pawchive-backup\+jsonl'\}\)/);
  assert.match(originalSource, /file\.stream\(\)\.getReader\(\)/);
  assert.match(originalSource, /parsed=await DataPortability\.readBackupFile\(file\)/);
  assert.match(originalSource, /accept="\.pmfbackup,\.json,\.jsonl,application\/json,application\/x-pawchive-backup\+jsonl"/);

  console.log('Pawchive Media Filter v0.12.5 large streaming backup tests passed.');
})();
