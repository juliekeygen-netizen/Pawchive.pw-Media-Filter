'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(async () => {
  const { api, context, stored, originalSource, makeElement } = loadUserscript();
  const {
    Config,
    Settings,
    CreatorDirectory,
    CreatorState,
    CreatorFilterEngine,
    CreatorStatusFilters,
    CreatorIndexUI,
    CreatorCardReconstructor,
    CreatorCardRightRail,
    CreatorProfileRepairManager,
    MissingAttachmentMaintenance,
    CatalogueJobManager,
    Cache,
    SettingsUI,
  } = api;

  assert.equal(Config.version, '0.13.8');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.8/);
  assert.ok(!CreatorIndexUI.render.toString().includes('repairVisible'));
  assert.ok(!CreatorIndexUI.renderCatalogue.toString().includes('repairVisible'));
  assert.ok(CreatorIndexUI.renderCatalogue.toString().includes('createDocumentFragment'));

  const makeRecord = (index) => {
    const creatorKey = `pawchive.pw|patreon|${index}`;
    return {
      directory: CreatorDirectory.normalize({
        creatorKey,
        domain: 'pawchive.pw',
        service: 'patreon',
        creatorId: String(index),
        creatorName: `Creator ${String(index).padStart(3, '0')}`,
        creatorUrl: `https://pawchive.pw/patreon/user/${index}`,
        publicFavoriteCount: index,
      }),
      meta: null,
      state: CreatorState.empty(creatorKey),
      summary: null,
      catalogueState: 'complete',
      scanned: true,
      favorite: null,
    };
  };

  // Exercise the real Local catalogue renderer. Page changes must reuse the
  // filtered/sorted array and must not invoke creator profile repair.
  const matches = makeElement('strong');
  const summary = makeElement('div');
  const count = makeElement('small');
  const controls = makeElement('div');
  const toolbar = makeElement('section');
  const paginator = makeElement('div');
  toolbar.querySelector = (selector) => selector === '[data-creator-matches]' ? matches
    : selector === '[data-creator-summary]' ? summary : null;
  paginator.querySelector = (selector) => selector === '.pmf-filtered-count' ? count
    : selector === '.pmf-page-controls' ? controls : null;
  paginator.querySelectorAll = () => [];
  paginator.clientWidth = 900;

  CreatorIndexUI.root = makeElement('section');
  CreatorIndexUI.toolbar = toolbar;
  CreatorIndexUI.paginator = paginator;
  CreatorIndexUI.grid = makeElement('div');
  CreatorIndexUI.stateNode = makeElement('div');
  CreatorIndexUI.mode = 'catalogue';
  CreatorIndexUI.page = 1;
  CreatorIndexUI.pageSize = 50;
  CreatorIndexUI.query = '';
  CreatorIndexUI.records = Array.from({ length: 120 }, (_, index) => makeRecord(index + 1));
  CreatorIndexUI.recordsRevision = 1;
  CreatorIndexUI.filterState = CreatorFilterEngine.normalizeState({});
  CreatorIndexUI.statusFilters = CreatorStatusFilters.normalize({});
  CreatorIndexUI.filteredCache = null;
  CreatorIndexUI.renderedPageKey = '';
  CreatorIndexUI.loading = false;
  CreatorIndexUI.refreshing = false;

  let cardBuilds = 0;
  let repairCalls = 0;
  CreatorCardReconstructor.build = (record) => {
    cardBuilds += 1;
    return { card: makeElement('article'), record };
  };
  CreatorCardRightRail.render = () => {};
  CreatorProfileRepairManager.repair = async () => { repairCalls += 1; };

  CreatorIndexUI.renderCatalogue();
  const cachedResult = CreatorIndexUI.filteredCache.records;
  assert.equal(CreatorIndexUI.grid.children.length, 50);
  assert.equal(cardBuilds, 50);

  CreatorIndexUI.page = 2;
  CreatorIndexUI.renderCatalogue();
  assert.strictEqual(CreatorIndexUI.filteredCache.records, cachedResult);
  assert.equal(CreatorIndexUI.grid.children.length, 50);
  assert.equal(cardBuilds, 100);
  assert.equal(repairCalls, 0);
  assert.strictEqual(CreatorIndexUI.toolbar, toolbar);

  // Retained data/state must survive repeated Local catalogue restoration.
  CreatorIndexUI.query = 'creator';
  CreatorIndexUI.page = 2;
  CreatorIndexUI.retainSession();
  for (let cycle = 0; cycle < 20; cycle += 1) {
    CreatorIndexUI.records = [];
    CreatorIndexUI.filteredCache = null;
    CreatorIndexUI.page = 1;
    assert.equal(CreatorIndexUI.restoreRetainedSession(), true);
    assert.equal(CreatorIndexUI.records.length, 120);
    assert.equal(CreatorIndexUI.page, 2);
    assert.equal(CreatorIndexUI.query, 'creator');
  }

  const strongIdentity = CreatorDirectory.normalize({
    creatorKey: 'pawchive.pw|fanbox|abc',
    domain: 'pawchive.pw',
    service: 'fanbox',
    creatorId: 'abc',
    creatorName: 'Real Creator',
    creatorUrl: 'https://pawchive.pw/fanbox/user/abc',
    avatarUrl: '',
    bannerUrl: '',
    publicFavoriteCount: null,
  });
  assert.equal(CreatorDirectory.identityWeak(strongIdentity), false);
  assert.equal(CreatorDirectory.enrichmentWeak(strongIdentity), true);
  assert.equal(CreatorDirectory.identityWeak({ ...strongIdentity, creatorName: '12345', creatorId: '12345' }), true);

  const collectText = (node, output = []) => {
    if (!node) return output;
    if (node.textContent) output.push(String(node.textContent));
    for (const child of node.children || []) collectText(child, output);
    return output;
  };
  const generalText = collectText(SettingsUI.buildGeneral(Settings.normalize(Settings.value))).join('\n');
  const scanningText = collectText(SettingsUI.buildScanning(Settings.normalize(Settings.value))).join('\n');
  const dataText = collectText(SettingsUI.buildData(Settings.normalize(Settings.value))).join('\n');
  for (const label of ['Count method','Posts containing media','Total attachments/links from every post','Hide and don’t count posts with missing attachments']) {
    assert.ok(scanningText.includes(label), `Missing visible Scanning & detection setting: ${label}`);
    assert.equal(generalText.includes(label), false, `${label} is no longer in General`);
  }
  assert.ok(dataText.includes('Open catalogue maintenance'));
  for (const label of ['Missing-attachment metadata','Repair creator profiles','Resume','Retry failed','Stop synchronization','Clear all full catalogue scans']) assert.ok(originalSource.toLocaleLowerCase().includes(label.toLocaleLowerCase()), `Missing maintenance action: ${label}`);

  // Verify profile HTML keeps avatar and banner extraction distinct and never
  // treats one og:image as both fields.
  const node = (attributes = {}, textContent = '') => ({
    textContent,
    style: {},
    getAttribute(name) { return attributes[name] ?? null; },
  });
  context.DOMParser = class {
    parseFromString() {
      return {
        querySelector(selector) {
          if (selector === '[data-avatar] img') return node({ src: '/avatar.png' });
          if (selector === '[data-banner] img') return node({ src: '/banner.png' });
          if (selector === 'meta[property="og:image"]') return node({ content: '/og.png' });
          if (selector === 'meta[property="og:title"]') return node({ content: 'Profile Name' });
          return null;
        },
        body: { textContent: '42 favorites' },
      };
    }
  };
  const repairedFromHtml = CreatorProfileRepairManager.fromHtml('', strongIdentity);
  assert.equal(repairedFromHtml.avatarUrl, 'https://pawchive.pw/avatar.png');
  assert.equal(repairedFromHtml.bannerUrl, 'https://pawchive.pw/banner.png');
  assert.notEqual(repairedFromHtml.avatarUrl, repairedFromHtml.bannerUrl);

  // Maintenance failures must stay resumable; a successful retry only clears
  // them after the batched write has committed.
  CatalogueJobManager.acquireMaintenanceSlot = async () => {};
  CatalogueJobManager.releaseMaintenanceSlot = () => {};
  MissingAttachmentMaintenance.recomputeAffected = async () => {};
  const task = {
    creatorKey: 'pawchive.pw|patreon|1',
    post: {
      id: 'post-1',
      key: 'pawchive.pw|patreon|1|post-1',
      creatorKey: 'pawchive.pw|patreon|1',
      service: 'patreon',
      creatorId: '1',
      cacheSources: { catalogue: true },
      scanSchemaVersion: 2,
      missingStatsKnown: false,
    },
  };
  const taskId = MissingAttachmentMaintenance.taskId(task);
  Cache.countCataloguePosts = async () => 1;
  Cache.scanCataloguePostChunk = async () => ({ records: [task.post], scanned: 1, done: true, cursor: null });
  Cache.getPostsByKeys = async () => new Map([[task.post.key, task.post]]);
  MissingAttachmentMaintenance.inspect = async () => {
    const error = new Error('temporary failure');
    error.retryable = true;
    throw error;
  };
  await MissingAttachmentMaintenance.run({ scope: 'first', limit: 1 });
  let missingCheckpoint = stored.get(Config.missingAttachmentMaintenanceKey);
  assert.ok(missingCheckpoint.remainingIds.includes(taskId));
  assert.ok(missingCheckpoint.failedIds.includes(taskId));
  assert.equal(missingCheckpoint.completed, 0);

  Cache.putPosts = async () => {};
  MissingAttachmentMaintenance.inspect = async () => ({
    missingStatsKnown: true,
    missingStatsParserVersion: 1,
    hasMissingStats: false,
    missingStats: null,
  });
  await MissingAttachmentMaintenance.retryFailed();
  missingCheckpoint = stored.get(Config.missingAttachmentMaintenanceKey);
  assert.equal(missingCheckpoint.remainingIds.length, 0);
  assert.equal(missingCheckpoint.failedIds.length, 0);
  assert.equal(missingCheckpoint.completed, 1);

  // Creator profile failures follow the same Resume/Retry contract.
  const repairRecord = makeRecord(999);
  CreatorProfileRepairManager.records = async () => [repairRecord];
  CreatorProfileRepairManager.repair = async () => { throw new Error('temporary creator failure'); };
  await CreatorProfileRepairManager.run();
  let repairCheckpoint = stored.get(Config.creatorProfileRepairKey);
  assert.ok(repairCheckpoint.remainingKeys.includes(repairRecord.directory.creatorKey));
  assert.ok(repairCheckpoint.failedKeys.includes(repairRecord.directory.creatorKey));

  CreatorProfileRepairManager.repair = async () => repairRecord.directory;
  await CreatorProfileRepairManager.retryFailed();
  repairCheckpoint = stored.get(Config.creatorProfileRepairKey);
  assert.equal(repairCheckpoint.remainingKeys.length, 0);
  assert.equal(repairCheckpoint.failedKeys.length, 0);

  assert.ok(MissingAttachmentMaintenance.openScopeDialog.toString().includes('Current Local catalogue page'));
  assert.ok(MissingAttachmentMaintenance.openScopeDialog.toString().includes('First N unknown posts'));
  assert.ok(MissingAttachmentMaintenance.openScopeDialog.toString().includes('All unknown posts'));

  console.log('Pawchive Media Filter v0.11.3 Local performance and maintenance runtime tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
