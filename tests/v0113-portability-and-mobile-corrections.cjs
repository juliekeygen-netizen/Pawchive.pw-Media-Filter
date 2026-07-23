'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, context, stored, originalSource } = loadUserscript();
const {
  Config,
  NativePaginatorMirror,
  DataPortability,
  Cache,
  Settings,
  Presets,
  CreatorPresets,
  FilterEngine,
} = api;

(async () => {
assert.equal(Config.version, '0.13.6');
assert.match(originalSource, /\/\/ @version\s+0\.13\.6/);

// Native directory pagination compacts to the same five-control shape used by
// PMF-owned paginators on phones.
const items = [
  { index: 0, role: 'first', label: '<<' },
  { index: 1, role: 'previous', label: '<' },
  { index: 2, role: 'page:1', label: '1', current: false },
  { index: 3, role: 'page:2', label: '2', current: true },
  { index: 4, role: 'page:3', label: '3', current: false },
  { index: 5, role: 'page:4', label: '4', current: false },
  { index: 6, role: 'next', label: '>' },
  { index: 7, role: 'last', label: '>>' },
];
context.matchMedia = () => ({ matches: true });
assert.deepEqual(
  JSON.parse(JSON.stringify(NativePaginatorMirror.compactItems(items))),
  [items[0], items[1], items[3], items[6], items[7]],
);
context.matchMedia = () => ({ matches: false });
assert.equal(NativePaginatorMirror.compactItems(items).length, items.length);

// Backup validation and summaries are deterministic and versioned.
const backup = {
  format: DataPortability.format,
  formatVersion: 1,
  catalogue: { stores: {
    posts: [{ key: 'post-1' }, { key: 'post-2' }],
    creators: [{ creatorKey: 'creator-1' }],
    creatorDirectory: [{ creatorKey: 'creator-1' }],
  } },
  settings: { value: { concurrency: 7 } },
  presets: {
    post: { schemaVersion: 1, presets: [{ id: 'post-default', name: 'Default', snapshot: FilterEngine.createDefaultState() }] },
    creator: { version: 1, activeId: 'default', presets: [{ id: 'default', name: 'Default', state: {} }] },
  },
};
assert.equal(DataPortability.validate(backup), backup);
assert.deepEqual(JSON.parse(JSON.stringify(DataPortability.summary(backup))), {
  posts: 2,
  creators: 1,
  directory: 1,
  popularPeriods: 0,
  popularEntries: 0,
  hasSettings: true,
  postPresets: 1,
  creatorPresets: 1,
});
assert.throws(() => DataPortability.validate({}), /not a Pawchive Media Filter backup/i);


// Merge keeps unmatched local scan rows; replace clears them before writing.
Cache.memory.set('local-only', { key: 'local-only', creatorKey: 'creator-local', cacheSources: { catalogue: true }, scanSchemaVersion: Config.schemaVersion });
await DataPortability.writeCatalogue({ stores: { posts: [{ key: 'imported', creatorKey: 'creator-imported', cacheSources: { catalogue: true }, scanSchemaVersion: Config.schemaVersion }] } }, { mode: 'merge' });
assert.equal(Cache.memory.has('local-only'), true);
assert.equal(Cache.memory.has('imported'), true);
await DataPortability.writeCatalogue({ stores: { posts: [{ key: 'replacement', creatorKey: 'creator-replacement', cacheSources: { catalogue: true }, scanSchemaVersion: Config.schemaVersion }] } }, { mode: 'replace' });
assert.equal(Cache.memory.has('local-only'), false);
assert.equal(Cache.memory.has('imported'), false);
assert.equal(Cache.memory.has('replacement'), true);

// Imported settings and both preset systems remain on their stable storage
// keys, so userscript updates do not replace them with new defaults.
DataPortability.importSettings({
  value: { ...Settings.value, concurrency: 7 },
  auxiliary: {
    [Config.postStatusFiltersKey]: { favorite: 'match', liked: 'off', seen: 'off' },
    [Config.creatorDirectoryModeKey]: 'catalogue',
  },
});
assert.equal(Settings.value.concurrency, 7);
assert.equal(stored.get(Config.settingsKey).concurrency, 7);
assert.equal(stored.get(Config.postStatusFiltersKey).favorite, 'match');
assert.equal(stored.get(Config.creatorDirectoryModeKey), 'catalogue');

assert.equal(DataPortability.importPresets(backup.presets), true);
assert.equal(Presets.all().length, 1);
assert.equal(CreatorPresets.load().presets.some((preset) => preset.id === 'default'), true);

// Reset moved into Data & performance; modal footers only carry Cancel/Save.
assert.match(originalSource, /const portability=SettingsUI\.section\('Backup and reset'\)/);
assert.match(originalSource, /SettingsUI\.action\('Export \/ Import catalogue','data-portability'\)/);
assert.doesNotMatch(originalSource, /footer\.append\(SettingsUI\.action\('Reset all settings'/);
assert.doesNotMatch(originalSource, /footer\.append\(SettingsUI\.action\('Reset all settings','reset'/);

// Mobile batch previews have a bounded scrolling area and a fixed footer.
assert.ok(originalSource.includes('.pmf-bulk-dialog .pmf-confirm-body section:last-child{min-height:0;max-height:190px'));
assert.ok(originalSource.includes('.pmf-bulk-dialog [data-bulk-preview]{min-height:0;max-height:108px'));
assert.ok(originalSource.includes('.pmf-bulk-dialog>footer{position:relative;z-index:2'));

// Import supports file picking, drag/drop, selectable data groups, and
// merge/replace catalogue conflict handling.
assert.match(originalSource, /data-import-dropzone/);
assert.match(originalSource, /name="importCatalogue"/);
assert.match(originalSource, /name="importSettings"/);
assert.match(originalSource, /name="importPresets"/);
assert.match(originalSource, /name="importMode" value="merge"/);
assert.match(originalSource, /name="importMode" value="replace"/);
assert.match(originalSource, /Finish or stop the creator and Popular queues before importing a backup/);

console.log('Pawchive Media Filter v0.11.3 portability and mobile correction tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
