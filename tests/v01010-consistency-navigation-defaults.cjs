'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(async () => {
  const { api, context, stored, originalSource } = loadUserscript();
  const {
    Config,
    Settings,
    PostClassification,
    ExternalLinkDetector,
    ProjectDetector,
    PostNormalizer,
    Cache,
    CreatorCatalogueSummary,
    NativePaginatorMirror,
    NativeArtistsProxy,
    NativeCreatorDirectorySource,
    CreatorIndexUI,
    CatalogueJobManager,
    MissingAttachmentMaintenance,
    SettingsUI,
    App,
  } = api;

  assert.equal(Config.version, '0.13.1');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.1/);
  assert.equal(Settings.value.settingsSchemaVersion, 6);

  const expectedHosts = [
    'youtube.com', 'youtu.be', 'vimeo.com', 'mega.nz', 'drive.google.com',
    'dropbox.com', 'pixeldrain.com', 'pixeldrain.net', 'gofile.io',
    'mediafire.com', 'streamable.com', 'iframely.net',
  ];
  assert.deepEqual([...Settings.value.knownHosts], expectedHosts);
  assert.equal(Settings.value.knownHosts.includes('redgifs.com'), false);

  const previousHosts = expectedHosts.filter((host) => host !== 'iframely.net').concat('redgifs.com');
  const previousKeywords = [
    'PSD', 'Photoshop', 'PSB', 'CLIP', 'Clip Studio', 'CSP', 'SAI', 'Krita',
    'source file', 'project file', 'Blender', 'BLEND', 'Maya', 'C4D',
    'Cinema 4D', 'ZBrush',
  ];
  const migratedDefaults = Settings.migrate({
    settingsSchemaVersion: 4,
    knownHosts: previousHosts,
    projectKeywords: previousKeywords,
  });
  assert.deepEqual([...migratedDefaults.knownHosts], expectedHosts);
  assert.ok(migratedDefaults.projectKeywords.includes('プロジェクトファイル'));
  assert.ok(migratedDefaults.projectKeywords.includes('项目文件'));
  assert.ok(migratedDefaults.projectKeywords.includes('專案檔案'));
  assert.equal(migratedDefaults.settingsSchemaVersion, 6);
  const migratedCommaJoinedDefaults = Settings.migrate({
    settingsSchemaVersion: 4,
    knownHosts: previousHosts,
    projectKeywords: [previousKeywords.join(', ')],
  });
  assert.ok(migratedCommaJoinedDefaults.projectKeywords.includes('プロジェクトファイル'));

  const custom = Settings.migrate({
    settingsSchemaVersion: 4,
    knownHosts: ['files.example'],
    projectKeywords: ['custom project phrase'],
  });
  assert.deepEqual([...custom.knownHosts], ['files.example']);
  assert.deepEqual([...custom.projectKeywords], ['custom project phrase']);
  assert.deepEqual([...Settings.normalize({ projectKeywords:['PSD, project file\nプロジェクトファイル'] }).projectKeywords], ['PSD', 'project file', 'プロジェクトファイル']);

  assert.ok(ProjectDetector.matches('PSDファイルを配布します').includes('PSDファイル'));
  assert.ok(ProjectDetector.matches('プロジェクトファイルをダウンロード').includes('プロジェクトファイル'));
  assert.ok(ProjectDetector.matches('这里包含项目文件和分层文件').includes('项目文件'));
  assert.ok(ProjectDetector.matches('提供專案檔案與分層檔案').includes('專案檔案'));

  const scopedPost = {
    externalLinkCount: 4,
    mediaDownloadLinkCount: 1,
    externalLinks: ['https://one.example', 'https://two.example'],
    mediaDownloadLinks: ['https://mega.nz/file/abc'],
  };
  assert.equal(ExternalLinkDetector.countForScope(scopedPost, 'media-download'), 1);
  assert.equal(ExternalLinkDetector.countForScope(scopedPost, 'any'), 4);
  assert.equal(ExternalLinkDetector.matchesScope(scopedPost, 'media-download'), true);

  const savedSettings = structuredClone(Settings.value);
  const creatorKey = 'pawchive.pw|patreon|123';
  const cataloguePost = {
    ...scopedPost,
    id: 'scope-post',
    key: `${creatorKey}|scope-post`,
    creatorKey,
    scanSchemaVersion: Config.schemaVersion,
    cacheSources: { catalogue: true },
    videoCount: 0,
    imageCount: 0,
    archiveCount: 0,
    projectFileCount: 0,
    missingStatsKnown: true,
    missingStatsParserVersion: 2,
    hasMissingStats: false,
  };
  const catalogue = { storedPostCount: 1, retryableMetadataIds: [] };
  Settings.value.externalLinkScope = 'media-download';
  assert.equal(CreatorCatalogueSummary.compute([cataloguePost], catalogue).counts.externalLinks, 1);
  Settings.value.externalLinkScope = 'any';
  assert.equal(CreatorCatalogueSummary.compute([cataloguePost], catalogue).counts.externalLinks, 4);

  const normalizeContext = {
    creatorKey,
    domain: 'pawchive.pw',
    service: 'patreon',
    creatorId: '123',
    creatorUrl: 'https://pawchive.pw/patreon/user/123',
  };
  Settings.value = structuredClone(savedSettings);
  const raw = {
    id: 'reclassify',
    user: '123',
    service: 'patreon',
    file: null,
    attachments: [],
    tags: [],
    content: '<a href="https://redgifs.com/watch/example">external</a>',
    cacheSources: { catalogue: true },
  };
  const withoutRedgifs = PostNormalizer.normalize(raw, normalizeContext);
  assert.equal(withoutRedgifs.externalLinkCount, 1);
  assert.equal(withoutRedgifs.mediaDownloadLinkCount, 0);
  const oldFingerprint = PostClassification.fingerprint();
  Settings.value.knownHosts = [...Settings.value.knownHosts, 'redgifs.com'];
  assert.notEqual(PostClassification.fingerprint(), oldFingerprint);
  const withRedgifs = PostNormalizer.normalize(raw, normalizeContext);
  assert.equal(withRedgifs.mediaDownloadLinkCount, 1);

  let reclassifiedWrites = 0;
  const originalPutPosts = Cache.putPosts;
  Cache.putPosts = async (posts) => { reclassifiedWrites += posts.length; };
  const refreshed = await CreatorCatalogueSummary.reclassifyStored(normalizeContext, [withoutRedgifs]);
  Cache.putPosts = originalPutPosts;
  assert.equal(refreshed[0].mediaDownloadLinkCount, 1);
  assert.equal(reclassifiedWrites, 1);
  Settings.value = savedSettings;

  assert.equal(NativeArtistsProxy.nextSort('favorited', 'desc', 'name').direction, 'desc');
  assert.equal(NativeArtistsProxy.nextSort('name', 'desc', 'name').direction, 'asc');
  assert.equal(NativeArtistsProxy.nextSort('name', 'asc', 'service').direction, 'asc');
  assert.equal(NativePaginatorMirror.role('<<'), 'first');
  assert.equal(NativePaginatorMirror.role('<'), 'previous');
  assert.equal(NativePaginatorMirror.role('>'), 'next');
  assert.equal(NativePaginatorMirror.role('>>'), 'last');
  assert.equal(NativePaginatorMirror.role('12'), 'page:12');

  Cache.dbPromise = Promise.resolve(null);
  Cache.memory.clear();
  const inventoryPosts = [
    { id:'a', key:`${creatorKey}|a`, creatorKey, scanSchemaVersion:Config.schemaVersion, cacheSources:{catalogue:true}, missingStatsKnown:true, missingStatsParserVersion:2, hasMissingStats:false },
    { id:'b', key:`${creatorKey}|b`, creatorKey, scanSchemaVersion:Config.schemaVersion, cacheSources:{catalogue:true}, missingStatsKnown:true, missingStatsParserVersion:2, hasMissingStats:true },
    { id:'c', key:`${creatorKey}|c`, creatorKey, scanSchemaVersion:Config.schemaVersion, cacheSources:{catalogue:true}, missingStatsKnown:false, missingStatsParserVersion:0, hasMissingStats:false },
    { id:'d', key:`${creatorKey}|d`, creatorKey, scanSchemaVersion:Config.schemaVersion, cacheSources:{catalogue:true}, missingStatsKnown:true, missingStatsParserVersion:1, hasMissingStats:false },
  ];
  inventoryPosts.forEach((post) => Cache.memory.set(post.key, post));
  assert.deepEqual(
    JSON.parse(JSON.stringify(await Cache.countMissingAttachmentStats())),
    { total:4, known:2, unknown:2, missing:1, complete:1 },
  );

  context.location.hostname = 'pawchive.pw';
  Settings.value.concurrency = 10;
  api.MissingAttachmentMaintenance.structuredCapabilities.clear();
  const capabilityPost = { service:'fanbox' };
  for (let index = 0; index < 8; index += 1) {
    api.MissingAttachmentMaintenance.noteStructuredCapability(capabilityPost, false);
  }
  assert.equal(api.MissingAttachmentMaintenance.maxConcurrency(), 5);
  assert.equal(api.MissingAttachmentMaintenance.htmlConcurrency(), 2);
  assert.equal(
    api.MissingAttachmentMaintenance.structuredCapabilities.get('pawchive.pw|fanbox').unsupported,
    true,
  );
  Settings.value = savedSettings;

  CreatorIndexUI.found = {
    serviceControl: { value:'' },
    sortControl: { value:'name' },
    directionControl: { value:'desc' },
  };
  CreatorIndexUI.records = [];
  CreatorIndexUI.nativeRecords = [];
  CreatorIndexUI.searchInput = { value:'' };
  const originalCreators = NativeCreatorDirectorySource.creators;
  NativeCreatorDirectorySource.creators = async () => [{
    id:'987', service:'fanbox', name:'Artwork API', icon:'/icons/987',
    banner:'/banners/987', favorited:42, indexed:2, updated:3,
  }];
  const apiRecords = await NativeCreatorDirectorySource.records();
  assert.equal(apiRecords[0].directory.avatarUrl, '/icons/987');
  assert.equal(apiRecords[0].directory.bannerUrl, '/banners/987');
  assert.equal(apiRecords[0].directory.publicFavoriteCount, 42);
  CreatorIndexUI.records = [{ ...apiRecords[0], directory:{ ...apiRecords[0].directory, avatarUrl:'', thumbnailUrl:'', bannerUrl:'', backdropUrl:'' } }];
  CreatorIndexUI.nativeRecords = [];
  const mergedApiRecords = await NativeCreatorDirectorySource.records();
  assert.equal(mergedApiRecords[0].directory.avatarUrl, '/icons/987');
  assert.equal(mergedApiRecords[0].directory.bannerUrl, '/banners/987');
  NativeCreatorDirectorySource.creators = originalCreators;

  assert.match(originalSource, /pmf-bottom-paginator/);
  assert.match(originalSource, /paginatorBottom/);
  assert.match(originalSource, /NativePaginatorMirror\.activateRole/);
  assert.match(originalSource, /\['ArrowLeft','ArrowRight'\]/);
  assert.match(originalSource, /data-missing-attachment-inventory/);
  assert.match(originalSource, /Missing-attachment metadata: \$\{totals\.known\} known/);
  assert.match(originalSource, /Optional detail \/ metadata concurrency/);
  assert.match(originalSource, /App\.filterState\.externalLinks\.scope=Settings\.value\.externalLinkScope/);
  assert.match(originalSource, /CreatorCatalogueSummary\.computeAuthoritative\(App\.context/);

  // Destructive clear actions cancel pending maintenance, await active writers,
  // clear retained sessions, and refresh the mounted creator directory.
  stored.set(Config.missingAttachmentMaintenanceKey, { version:3, scope:'all', pendingIds:['x'] });
  await MissingAttachmentMaintenance.cancelAndReset();
  assert.equal(stored.has(Config.missingAttachmentMaintenanceKey), false);

  CatalogueJobManager.maintenanceActive = true;
  const queuedMaintenance = CatalogueJobManager.acquireMaintenanceSlot();
  assert.equal(CatalogueJobManager.cancelMaintenanceWaiters('test clear'), 1);
  await assert.rejects(queuedMaintenance, (error) => error?.name === 'AbortError');
  CatalogueJobManager.maintenanceActive = false;

  const collectActions = (node, output = []) => {
    if (node?.dataset?.settingsAction) output.push(node.dataset.settingsAction);
    for (const child of node?.children || []) collectActions(child, output);
    return output;
  };
  App.context = null;
  assert.equal(collectActions(SettingsUI.buildData(structuredClone(Settings.value))).includes('clear-creator'), false);
  App.context = { creatorKey };
  assert.equal(collectActions(SettingsUI.buildData(structuredClone(Settings.value))).includes('clear-creator'), true);
  App.context = null;

  assert.match(originalSource, /MissingAttachmentMaintenance\.cancelAndReset/);
  assert.match(originalSource, /CatalogueJobManager\.cancelAllAndForget/);
  assert.match(originalSource, /CreatorSessionCache\.clear\(\)/);
  assert.match(originalSource, /requestRefresh\('catalogue-clear'\)/);

  console.log('Pawchive Media Filter v0.11.3 consistency, defaults, inventory, navigation, and clear-safety tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
