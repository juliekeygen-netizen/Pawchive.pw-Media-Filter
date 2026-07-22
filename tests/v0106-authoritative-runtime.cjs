const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const loaded = loadUserscript();
const { originalSource, context } = loaded;
const {
  Config, CreatorDirectory, CreatorFilterEngine, CreatorSorter,
  CatalogueJobManager, Paginator, MissingAttachmentMaintenance,
} = loaded.api;

assert.equal(Config.version, '0.12.8');
assert.equal((originalSource.match(/const CreatorBulkUI =/g) || []).length, 1);
assert.equal((originalSource.match(/CreatorBulkUI\.open\s*=/g) || []).length, 0);
assert.equal((originalSource.match(/SettingsUI\.open\s*=/g) || []).length, 0);
assert.equal((originalSource.match(/CreatorIndexUI\.renderCatalogue\s*=/g) || []).length, 0);
assert.doesNotMatch(originalSource, /RetainedQueueHistory|persistSessionWithDirectorySnapshot|restoreSessionV4/);
assert.doesNotMatch(originalSource, /setTimeout\([^)]*8000|page-2|max="150"/);
assert.match(originalSource, /version:4,waiting,active,recent,batches/);

for (const total of [1, 3, 5, 6, 10, 100]) {
  for (const current of [1, 2, Math.ceil(total / 2), Math.max(1, total - 1), total]) {
    const pages = Array.from(Paginator.pageButtons(current, total, 5));
    assert.equal(pages.length, Math.min(5, total));
    assert.ok(pages.includes(Math.min(total, current)));
  }
}

const summary = {
  completeness: 'complete',
  sourcePostCount: 500,
  aggregateEligiblePostCount: 480,
  media: { images: { posts: 240, attachments: 240 } },
  statuses: { liked: 240, seen: 240, favorited: 240, favoriteKnown: 480 },
  customExtensionAggregates: { png: { posts: 240, files: 240 } },
  customRuleAggregates: { [JSON.stringify({ field: 'title', match: 'contains', value: 'cat' })]: { posts: 240 } },
};
const record = { directory: { service: 'fanbox', creatorName: 'Test' }, summary, catalogueState: 'complete' };
for (const type of ['images']) {
  assert.equal(CreatorFilterEngine.matches(record, { media: { [type]: { enabled: true, percentageEnabled: true, percentage: { operator: 'exactly', from: 50 } } } }), true);
}
for (const type of ['liked', 'seen', 'favorited']) {
  assert.equal(CreatorFilterEngine.matches(record, { postStatuses: { [type]: { enabled: true, percentageEnabled: true, percentage: { operator: 'exactly', from: 50 } } } }), true);
}
assert.equal(CreatorFilterEngine.matches(record, { media: { customExtensions: { enabled: true, extensions: ['png'], percentageEnabled: true, percentage: { operator: 'exactly', from: 50 } } } }), true);
assert.equal(CreatorFilterEngine.matches(record, { customRules: [{ enabled: true, field: 'title', match: 'contains', value: 'cat', percentageEnabled: true, percentage: { operator: 'exactly', from: 50 } }] }), true);
assert.equal(CreatorSorter.value(record, 'images:percentage'), 50);

assert.equal(CreatorDirectory.isWeak({ creatorKey: 'pawchive.pw|fanbox|123', creatorName: '123', avatarUrl: '', bannerUrl: '' }), true);
const strong = CreatorDirectory.merge(
  CreatorDirectory.normalize({ creatorKey: 'pawchive.pw|fanbox|123', creatorName: 'Real Name', avatarUrl: 'https://pawchive.pw/a.jpg', bannerUrl: 'https://pawchive.pw/b.jpg', publicFavoriteCount: 42, creatorUrl: 'https://pawchive.pw/fanbox/user/123', serviceLabel: 'Fanbox' }),
  { creatorKey: 'pawchive.pw|fanbox|123', creatorName: '123', avatarUrl: '', bannerUrl: '', publicFavoriteCount: null },
);
assert.equal(strong.creatorName, 'Real Name');
assert.equal(strong.publicFavoriteCount, 42);
assert.match(strong.avatarUrl, /a\.jpg/);

const queueStore = new Map();
context.sessionStorage = {
  getItem: (key) => queueStore.get(key) || null,
  setItem: (key, value) => queueStore.set(key, value),
};
CatalogueJobManager.pendingJobs = [{
  id: 'job-1', creatorKey: 'pawchive.pw|fanbox|123', creatorName: 'Real Name',
  context: { creatorKey: 'pawchive.pw|fanbox|123', service: 'fanbox', creatorId: '123' },
  directorySnapshot: strong, requestedAction: 'build', status: 'queued', queueOrder: 1, queuedAt: 1,
}];
assert.equal(CatalogueJobManager.persistSession(), true);
const saved = JSON.parse(queueStore.get(Config.creatorQueueSessionKey));
assert.equal(saved.version, 4);
assert.equal(saved.waiting[0].directorySnapshot.creatorName, 'Real Name');
assert.ok('concurrency' in saved);

assert.match(MissingAttachmentMaintenance.fetchStructured.toString(), /PostMissingStats\.fromRaw/);
assert.match(MissingAttachmentMaintenance.run.toString(), /remainingIds|failedIds/);
assert.equal(typeof MissingAttachmentMaintenance.resume, 'function');

console.log('Pawchive Media Filter v0.11.3 authoritative runtime tests passed.');
