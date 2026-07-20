'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, stored, originalSource } = loadUserscript();
const {
  Config, Util, Settings, Route, MediaClassifier, ExternalLinkDetector,
  ProjectDetector, PostNormalizer, FilterEngine, FilterSummary, CatalogueModel,
  Presets, PawchiveAPI, UI, App,
} = api;
const json = (value) => JSON.parse(JSON.stringify(value));
const creator = Route.parse('https://pawchive.pw/fanbox/user/12345?o=50&q=cat');

assert.equal(Config.version, '0.10.11');
assert.equal(Config.schemaVersion, 2);
assert.equal(Config.databaseVersion, 5);
assert.equal(Config.settingsKey, 'pmf-settings-v5');
assert.equal(Config.presetsKey, 'pmf-presets-v1');
assert.equal(Config.catalogueOnlyMigrationKey, 'pmf-catalogue-only-migration-v1');
assert.equal(creator.creatorKey, 'pawchive.pw|fanbox|12345');
assert.equal(creator.nativePageKey, 'pawchive.pw|fanbox|12345|50|cat');
assert.equal(Route.parsePostUrl('https://pawchive.pw/fanbox/user/123/post/9').postKey, 'pawchive.pw|fanbox|123|9');

assert.equal(PawchiveAPI.normalizeResponse([{ id: 1 }]).rawShape, 'array');
assert.ok(PawchiveAPI.endpointTemplates(creator, 50).some((url) => url.includes('?offset=50&limit=50')));
assert.deepEqual(json(Util.normalizeExtensions(['.PSD', 'psd', ' TAR.GZ ']).values), ['psd', 'tar.gz']);
assert.deepEqual(json(MediaClassifier.classify({ path: '/x/archive.tar.gz?x=1' })), { ext: 'tar.gz', type: 'archive' });

const baseRaw = {
  id: '99', user: '12345', service: 'fanbox', title: 'Ordinary post',
  published: '2025-01-15T10:00:00Z', content: '', tags: [], file: null, attachments: [],
};
const normalize = (patch) => PostNormalizer.normalize({ ...baseRaw, ...patch }, creator);
assert.equal(normalize({ attachments: [{ name: 'layers.PSD', path: '/a/layers.psd' }] }).projectFileCount, 1);
assert.equal(normalize({ title: 'PSD rewards' }).hasProjectFiles, true);
assert.equal(ProjectDetector.detect({ files: [], title: '', tags: [], contentText: '' }).projectFileCount, 0);
assert.equal(ExternalLinkDetector.detect('<a href="https://youtube.com/watch?v=1">link</a>', creator.creatorUrl).mediaDownloadLinks.length, 1);

let filterState = FilterEngine.createDefaultState();
filterState.media.enabled = { videos: true, images: false, archives: true, projectFiles: false, externalLinks: false, customExtensions: false };
filterState.media.matchMode = 'any';
assert.equal(FilterEngine.mediaPredicate(normalize({ attachments: [{ name: 'x.mp4' }] }), filterState), true);
assert.equal(FilterSummary.label(FilterEngine.createDefaultState()), 'Videos');

stored.set(Config.settingsKey, {
  displayMode: 'hide',
  compactCardScale: 'medium',
  compactThumbnailAspectRatio: '4-3',
  attachmentBadgeSize: 'big',
  confirmCreatorCardScan: false,
  scanMode: 'verify',
  range: '5',
  customFrom: 2,
  customTo: 7,
  reuseCache: true,
});
Settings.load();
assert.equal('displayMode' in Settings.value, false);
assert.equal(Settings.value.compactCardScale, 'big');
assert.equal(Settings.value.compactThumbnailAspectRatio, '4-3');
assert.equal(Settings.value.postAttachmentBadgeSize, 'big');
assert.equal(Settings.value.creatorAttachmentBadgeSize, 'big');
assert.equal('attachmentBadgeSize' in Settings.value, false);
assert.equal(Settings.value.confirmCreatorCardScan, false);
for (const key of ['scanMode','range','customFrom','customTo','reuseCache']) {
  assert.equal(key in Settings.value, false);
  assert.equal(key in stored.get(Config.settingsKey), false);
}

stored.delete(Config.presetsKey);
const presets = Presets.load(FilterEngine.createDefaultState());
assert.equal(presets.schemaVersion, 1);
assert.equal('sortMode' in Presets.snapshot(FilterEngine.createDefaultState()), false);
assert.equal('attachmentBadgeSize' in Presets.snapshot(FilterEngine.createDefaultState()), false);

const covered = {
  status: 'complete', totalExpectedPosts: 122, storedPostCount: 122,
  pageCoverage: {
    0: { offset: 0, rawCount: 50 },
    50: { offset: 50, rawCount: 50 },
    100: { offset: 100, rawCount: 22, finalPage: true },
  },
  failedOffsets: [], fullBuildCoverageComplete: true,
};
assert.equal(CatalogueModel.evaluateCoverage(covered).coverageComplete, true);
assert.equal(CatalogueModel.button({ catalogue: covered }, { hasPosts: true }).label, 'Update');
assert.equal(CatalogueModel.button(CatalogueModel.empty()).label, 'Scan');

const settingsMethod = originalSource.slice(originalSource.indexOf('  const SettingsUI = {'),originalSource.indexOf('  UI.openSettings=SettingsUI.open;'));
assert.ok(settingsMethod.includes("['scanning', 'Scanning']"));
assert.ok(settingsMethod.includes('Show attachment badges on post cards'));
assert.ok(settingsMethod.includes('Attachment badge size'));
assert.ok(settingsMethod.includes('Confirm creator card scans'));
assert.ok(settingsMethod.includes('Clear all full catalogue scans'));
assert.ok(!settingsMethod.includes('Display mode'));
assert.ok(!settingsMethod.includes('Remember active preset'));

assert.ok(originalSource.includes("sortButton.className='pmf-sort-button'"));
assert.ok(originalSource.includes('aria-haspopup="menu"'));
assert.ok(originalSource.includes('PostSorter.sort'));
assert.ok(originalSource.includes('pmf-post-attachment-size-small'));
assert.ok(originalSource.includes('pmf-creator-attachment-size-small'));
assert.ok(originalSource.includes('MetadataDetailPool'));
assert.ok(originalSource.includes('OperationIssues'));
assert.ok(originalSource.includes('data-pmf-retry-incomplete'));
assert.ok(originalSource.includes("operation:'route-transition'"));
assert.ok(originalSource.includes("operation:'creator-dom-bound'"));
assert.ok(originalSource.includes("operation:'filtered-page-change'"));
assert.ok(!/\bconst Scanner\b/.test(originalSource));
assert.ok(!originalSource.includes('putPostsWithSource'));
assert.ok(!originalSource.includes('openCustomRange'));
assert.ok(!originalSource.includes('closeCustomRange'));
assert.ok(!originalSource.includes('.pmf-custom-range'));
assert.ok(!UI.renderErrors.toString().includes('Retry unresolved'));

const renderStatusSource = App.renderStatus.toString();
assert.match(renderStatusSource, /count\?matches\.length:App\.dom\.nativeCards\.length/);
assert.doesNotMatch(renderStatusSource, /selected page|scanned range|Scan mode/);

console.log('Pawchive Media Filter v0.8.0 static smoke tests passed.');
