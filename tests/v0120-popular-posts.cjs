'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(async () => {
  const { api, originalSource } = loadUserscript();
  const {
    Config, Route, PopularPeriod, PopularDOM, PopularSorter, PopularScanner,
    PopularJobManager, DataPortability, PopularCardDecorator, PopularPageController, Lifecycle, App, UI,
  } = api;

  assert.equal(Config.version, '0.13.4');
  assert.equal(Config.databaseVersion, 6);
  assert.match(originalSource, /\/\/ @version\s+0\.13\.4/);
  assert.equal(Config.likelyHosts.includes('iframely.net'), true);

  const day = Route.parsePage('https://pawchive.pw/posts/popular?date=2026-07-14&period=day');
  const week = Route.parsePage('https://www.pawchive.pw/posts/popular?date=2026-07-12&period=week&o=50');
  const month = Route.parsePage('https://pawchive.pw/posts/popular?date=2026-07-01&period=month');
  assert.equal(day.kind, 'popular');
  assert.equal(day.periodKey, 'pawchive.pw|popular|day|2026-07-14');
  assert.equal(week.offset, 50);
  assert.equal(week.periodKey, 'www.pawchive.pw|popular|week|2026-07-12');
  assert.equal(month.period, 'month');
  assert.equal(Lifecycle.pageKey(month), 'popular|pawchive.pw|popular|month|2026-07-01|0');

  assert.equal(PopularPeriod.dateFromHeading('Popular Posts For July 01, 2026'), '2026-07-01');
  assert.equal(PopularPeriod.normalizeDate('2026-02-31'), '');
  assert.equal(PopularPeriod.normalizeDate('2026-02-28'), '2026-02-28');
  assert.equal(PopularPeriod.label(month).includes('Month'), true);
  assert.match(PopularPeriod.pageUrl(month, 100), /o=100/);

  const posts = [
    { key:'a', id:'a', title:'A' },
    { key:'b', id:'b', title:'B' },
    { key:'c', id:'c', title:'C' },
  ];
  const sorted = PopularSorter.sort(posts, [
    { postKey:'a', displayedFavoriteCount:25, rank:3 },
    { postKey:'b', displayedFavoriteCount:50, rank:2 },
    { postKey:'c', displayedFavoriteCount:50, rank:1 },
  ]);
  assert.deepEqual(Array.from(sorted, (post) => post.id), ['c','b','a']);

  const known = PopularScanner.markNoMissing({ id:'1', cacheSources:{ scan:true, catalogue:false } }, 123);
  assert.equal(known.missingStatsKnown, true);
  assert.equal(known.hasMissingStats, false);
  assert.equal(known.missingStatsSource, 'popular-page');
  assert.equal(known.cacheSources.catalogue, true);
  assert.equal(known.cacheSources.scan, false);
  assert.deepEqual(Array.from(PopularScanner.resumeCoveredOffsets({ workingRunId:'run', coveredOffsets:[0,50], retryableCount:0 }, 'resume')), [0,50]);
  assert.deepEqual(Array.from(PopularScanner.resumeCoveredOffsets({ workingRunId:'run', coveredOffsets:[0,50], retryableCount:2 }, 'resume')), []);
  assert.match(PopularScanner.preparePage.toString(), /output\[index\]=post/);
  assert.match(PopularScanner.preparePage.toString(), /PostNormalizer\.rawFromStored\(prior\)/);
  assert.match(PopularScanner.run.toString(), /returned no posts before the expected end/);
  assert.match(PopularScanner.run.toString(), /unrecognized post card/);

  App.pageKind = 'popular';
  assert.equal(App.postAnchorKey({ id:'same', key:'pawchive.pw|patreon|a|same' }), 'pawchive.pw|patreon|a|same');
  App.pageKind = 'creator';
  assert.equal(App.postAnchorKey({ id:'same', key:'pawchive.pw|patreon|a|same' }), 'same');


  const nativeGrid = {};
  const unsafeNavigation = {
    contains:(node) => node === nativeGrid,
    querySelector:() => null,
  };
  const safeNavigation = {
    contains:() => false,
    querySelector:() => null,
  };
  assert.equal(PopularDOM.isSafeNativeControlGroup(unsafeNavigation, nativeGrid), false);
  assert.equal(PopularDOM.isSafeNativeControlGroup(safeNavigation, nativeGrid), true);
  assert.match(PopularDOM.find.toString(), /navContainers/);

  const favoriteCard = { querySelector(){ return { textContent:'4 attachments 1,234 favorites' }; }, textContent:'' };
  assert.equal(PopularDOM.favoriteCount(favoriteCard), 1234);

  assert.deepEqual(Array.from(DataPortability.catalogueStores.slice(-3)), ['popularPeriods','popularEntries','popularUiStates']);
  const oldStores = {};
  for (const store of DataPortability.catalogueStores.slice(0,-3)) oldStores[store] = [];
  const legacy = DataPortability.validateImportSelection({
    format:DataPortability.format,
    formatVersion:1,
    sourceHost:'pawchive.pw',
    catalogue:{ stores:oldStores },
  }, { catalogue:true, settings:false, presets:false });
  assert.equal(Array.from(legacy.catalogue.stores.popularPeriods).length, 0);
  assert.equal(Array.from(legacy.catalogue.stores.popularEntries).length, 0);
  assert.equal(Array.from(legacy.catalogue.stores.popularUiStates).length, 0);

  const remapped = DataPortability.remapRecordHost('popularEntries', {
    key:'pawchive.pw|popular|day|2026-07-14|pawchive.pw|patreon|creator|post',
    periodKey:'pawchive.pw|popular|day|2026-07-14',
    postKey:'pawchive.pw|patreon|creator|post',
  }, 'pawchive.pw', 'www.pawchive.pw');
  assert.equal(remapped.periodKey, 'www.pawchive.pw|popular|day|2026-07-14');
  assert.equal(remapped.postKey, 'www.pawchive.pw|patreon|creator|post');
  assert.equal(remapped.key, `${remapped.periodKey}|${remapped.postKey}`);
  const newerObservation = DataPortability.mergeCollision('popularEntries',
    { key:'entry', observedAt:100, displayedFavoriteCount:10 },
    { key:'entry', observedAt:200, displayedFavoriteCount:20 });
  assert.equal(newerObservation.displayedFavoriteCount, 20);
  const summary = DataPortability.summary({
    format:DataPortability.format,
    formatVersion:1,
    catalogue:{ stores:{ ...Object.fromEntries(DataPortability.catalogueStores.map((store) => [store, []])), popularPeriods:[{ periodKey:'p' }], popularEntries:[{ key:'e' }, { key:'f' }] } },
    settings:{ value:{} }, presets:{ post:{ presets:[] }, creator:{ presets:[] } },
  });
  assert.equal(summary.popularPeriods, 1);
  assert.equal(summary.popularEntries, 2);

  PopularJobManager.pendingJobs = [];
  PopularJobManager.recentJobs.clear();
  PopularJobManager.recentJobs.set(day.periodKey, { periodKey:day.periodKey, status:'complete' });
  PopularJobManager.activeJob = { periodKey:'block', status:'running' };
  const first = PopularJobManager.enqueue({ ...day, label:'Day' }, 'scan');
  const second = PopularJobManager.enqueue({ ...month, label:'Month' }, 'scan');
  const duplicate = PopularJobManager.enqueue({ ...day, label:'Day' }, 'scan');
  assert.equal(first.accepted, true);
  assert.equal(PopularJobManager.recentJobs.has(day.periodKey), false);
  assert.equal(second.accepted, true);
  assert.equal(duplicate.accepted, false);
  assert.equal(PopularJobManager.pendingJobs.length, 2);
  assert.match(PopularJobManager.shutdown.toString(), /paused=true/);
  assert.match(PopularJobManager.pump.toString(), /PopularJobManager\.paused/);
  assert.match(PopularJobManager.restore.toString(), /Math\.max\(PopularJobManager\.sequence/);
  PopularJobManager.pendingJobs = [];
  PopularJobManager.activeJob = null;

  const controllerSource = PopularPageController.mountUI.toString() + PopularPageController.renderNative.toString() + PopularPageController.renderLocal.toString();
  assert.match(controllerSource, /data-popular-mode=\\?"native\\?"/);
  assert.match(controllerSource, /data-popular-mode=\\?"local\\?"/);
  assert.match(controllerSource, /Sort: Popular/);
  assert.match(controllerSource, /All posts/);
  assert.match(PopularPageController.primaryAction.toString(), /paragraphs:\[`Period: \${context\.label}`,`Posts: up to \${total\.toLocaleString\(\)}`\]/);
  assert.doesNotMatch(PopularPageController.primaryAction.toString(), /Media files are not downloaded|marked as having no missing attachments/);
  assert.doesNotMatch(PopularPageController.primaryAction.toString(), /Math\.max\([^)]*500/);
  assert.match(PopularPageController.load.toString(), /String\(post\.key\)/);
  assert.match(PopularPageController.refresh.toString(), /String\(post\.key\)/);
  assert.match(PopularPageController.renderLocal.toString(), /postAnchorKey/);
  assert.match(PopularCardDecorator.normalizeFooter.toString(), /footer\.replaceChildren/);
  assert.match(PopularCardDecorator.apply.toString(), /pmf-popular-card-metric/);
  assert.doesNotMatch(originalSource, /\x08/);
  assert.match(PopularPageController.load.toString(), /found\.totalPosts/);
  assert.match(PopularPageController.saveNative.toString(), /found\.navContainers/);
  assert.match(UI.saveSettings.toString(), /App\.pageKind===['"]creator['"]/);
  assert.match(App.reclassifyCatalog.toString(), /contextForPost/);
  assert.match(originalSource, /Clear this Popular period/);
  assert.match(originalSource, /Clear all Popular Posts history/);
  assert.match(originalSource, /#pmf-popular-root/);
  assert.doesNotMatch(controllerSource, /Search scanned posts/);

  console.log('Pawchive Media Filter v0.12.5 Popular Posts tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
