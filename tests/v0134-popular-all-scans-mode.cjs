'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(async () => {
  const { api, originalSource, stored, makeElement } = loadUserscript();
  const {
    Config,
    Cache,
    PopularAggregate,
    PopularPageController,
    PopularNavigation,
    UI,
    App,
  } = api;

  assert.equal(Config.version, '0.13.4');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.4/);
  assert.equal(Config.popularAggregatePeriodKey, 'pmf-popular-aggregate-period-v1');
  assert.equal(typeof Cache.getPopularEntriesForPeriods, 'function');

  const collapsed = PopularAggregate.collapse([
    { periodKey:'pawchive.pw|popular|day|2026-07-20', postKey:'post-a', displayedFavoriteCount:102, observedAt:10, rank:2 },
    { periodKey:'pawchive.pw|popular|day|2026-07-21', postKey:'post-a', displayedFavoriteCount:124, observedAt:20, rank:4 },
    { periodKey:'pawchive.pw|popular|day|2026-07-21', postKey:'post-b', displayedFavoriteCount:90, observedAt:20, rank:1 },
    { periodKey:'pawchive.pw|popular|day|2026-07-22', postKey:'post-c', displayedFavoriteCount:null, observedAt:30, rank:3 },
    { periodKey:'pawchive.pw|popular|day|2026-07-23', postKey:'post-c', displayedFavoriteCount:null, observedAt:40, rank:2 },
  ]);
  assert.equal(collapsed.length, 3, 'duplicate post keys collapse to one aggregate entry');
  assert.equal(collapsed[0].postKey, 'post-a');
  assert.equal(collapsed[0].displayedFavoriteCount, 124, 'the highest observed favorite count wins');
  assert.equal(collapsed[0].sourcePeriodKey, 'pawchive.pw|popular|day|2026-07-21');
  assert.equal(collapsed[0].rank, 1, 'aggregate ranks are rebuilt after deduplication');
  assert.equal(collapsed.find((entry)=>entry.postKey==='post-c').sourcePeriodKey, 'pawchive.pw|popular|day|2026-07-23', 'unknown favorite ties use the latest observation');

  const originalPeriods = Cache.getPopularPeriods;
  const originalEntries = Cache.getPopularEntriesForPeriods;
  const originalPosts = Cache.getPostsByKeys;
  Cache.getPopularPeriods = async () => [
    { periodKey:'d1', domain:'pawchive.pw', period:'day', updatedAt:1 },
    { periodKey:'d2', domain:'pawchive.pw', period:'day', updatedAt:2 },
    { periodKey:'m1', domain:'pawchive.pw', period:'month', updatedAt:3 },
    { periodKey:'other', domain:'www.pawchive.pw', period:'day', updatedAt:4 },
  ];
  Cache.getPopularEntriesForPeriods = async (keys) => {
    assert.deepEqual([...keys], ['d1','d2']);
    return [
      { periodKey:'d1', postKey:'post-a', displayedFavoriteCount:10, observedAt:1 },
      { periodKey:'d2', postKey:'post-a', displayedFavoriteCount:12, observedAt:2 },
      { periodKey:'d2', postKey:'post-b', displayedFavoriteCount:11, observedAt:2 },
    ];
  };
  Cache.getPostsByKeys = async (keys) => new Map(keys.map((key)=>[key,{ key, cacheSources:{catalogue:true}, scanSchemaVersion:Config.schemaVersion }]));
  const loaded = await PopularAggregate.load({ domain:'pawchive.pw', period:'day' });
  assert.equal(loaded.meta.periodCount, 2);
  assert.equal(loaded.meta.sourceEntryCount, 3);
  assert.equal(loaded.meta.storedEntryCount, 2);
  assert.equal(loaded.entries[0].displayedFavoriteCount, 12);
  Cache.getPopularPeriods = originalPeriods;
  Cache.getPopularEntriesForPeriods = originalEntries;
  Cache.getPostsByKeys = originalPosts;

  assert.match(PopularPageController.mountUI.toString(), /data-popular-mode="aggregate"/);
  assert.match(PopularPageController.mountUI.toString(), />All Scans<\/button>/);
  assert.match(PopularPageController.syncAggregatePeriodControls.toString(), /\^\(day\|week\|month\)\$/i);
  assert.match(PopularPageController.syncAggregatePeriodControls.toString(), /display','none','important'/);
  assert.match(PopularPageController.setAggregatePeriod.toString(), /Config\.popularAggregatePeriodKey/);
  assert.match(PopularPageController.refresh.toString(), /PopularAggregate\.load/);
  assert.match(PopularPageController.renderLocal.toString(), /unique posts from/);
  assert.match(PopularPageController.renderAction.toString(), /aggregate\?'All scans'/);
  assert.match(PopularNavigation.visit.toString(), /\['native','local','aggregate'\]/);

  const makePeriodLink = (label, period, date='2026-07-22') => {
    const link = makeElement('a');
    link.textContent = label;
    link.href = `https://pawchive.pw/posts/popular?date=${date}&period=${period}`;
    return link;
  };
  const day = makePeriodLink('Day','day');
  const week = makePeriodLink('Week','week');
  const month = makePeriodLink('Month','month');
  const previous = makePeriodLink('« prev','week','2026-07-15');
  const next = makePeriodLink('next »','week','2026-07-29');
  const nav = makeElement('nav');
  const heading = makeElement('h1');
  heading.textContent = 'Popular Posts For July 2026';
  App.dom = { periodLinks:[previous,day,week,month,next], navContainers:[nav] };
  PopularPageController.nativeSnapshot = { heading:{node:heading,text:heading.textContent} };
  App.popularMode = 'aggregate';
  App.popularAggregatePeriod = 'week';
  PopularPageController.syncAggregatePeriodControls(App.dom);
  assert.equal(previous.hidden, true);
  assert.equal(next.hidden, true);
  assert.equal(day.hidden, false);
  assert.equal(week.dataset.pmfAggregatePeriod, 'week');
  assert.equal(week.classList.contains('pmf-popular-aggregate-period-active'), true);
  assert.equal(heading.textContent, 'All Scanned Popular Posts · Week');
  PopularPageController.restoreAggregatePeriodControls();
  assert.equal(previous.hidden, false);
  assert.equal(next.hidden, false);
  assert.equal(heading.textContent, 'Popular Posts For July 2026');

  App.popularMode = 'aggregate';
  App.popularAggregatePeriod = 'month';
  App.filteredPage = 4;
  App.filteredFirstResultIndex = 150;
  App.filteredAnchorId = 'old';
  const originalRefresh = PopularPageController.refresh;
  const originalRender = App.render;
  const originalSync = PopularPageController.syncAggregatePeriodControls;
  let refreshed = 0;
  PopularPageController.refresh = async () => { refreshed += 1; };
  PopularPageController.syncAggregatePeriodControls = () => {};
  App.render = () => {};
  await PopularPageController.setAggregatePeriod('week');
  assert.equal(App.popularAggregatePeriod, 'week');
  assert.equal(App.filteredPage, 1);
  assert.equal(App.filteredFirstResultIndex, 0);
  assert.equal(App.filteredAnchorId, '');
  assert.equal(stored.get(Config.popularAggregatePeriodKey), 'week');
  assert.equal(refreshed, 1);
  PopularPageController.refresh = originalRefresh;
  PopularPageController.syncAggregatePeriodControls = originalSync;
  App.render = originalRender;

  assert.equal(typeof PopularPageController.refreshStateCurrent, 'function');
  PopularPageController.root = { isConnected:true };
  PopularPageController.context = { periodKey:'pawchive.pw|popular|day|2026-07-22' };
  App.pageKind = 'popular';
  App.popularMode = 'local';
  App.popularAggregatePeriod = 'day';
  assert.equal(PopularPageController.refreshStateCurrent('local','day'), true);
  assert.equal(PopularPageController.refreshStateCurrent('aggregate','day'), false);

  const originalFlash = UI.flash;
  let flashes = 0;
  UI.flash = () => { flashes += 1; };
  let rejectRefresh;
  PopularPageController.refresh = () => new Promise((resolve,reject)=>{ rejectRefresh = reject; });
  const staleModeSwitch = PopularPageController.setMode('aggregate');
  App.popularMode = 'native';
  rejectRefresh(new Error('stale aggregate failure'));
  await staleModeSwitch;
  assert.equal(flashes, 0, 'a superseded mode request must not flash a stale error');

  App.popularMode = 'aggregate';
  App.popularAggregatePeriod = 'day';
  const stalePeriodSwitch = PopularPageController.setAggregatePeriod('week');
  App.popularAggregatePeriod = 'month';
  rejectRefresh(new Error('stale period failure'));
  await stalePeriodSwitch;
  assert.equal(flashes, 0, 'a superseded period request must not flash a stale error');
  UI.flash = originalFlash;
  PopularPageController.root = null;
  PopularPageController.context = null;

  console.log('Pawchive Media Filter v0.13.4 All Scans Popular mode tests passed.');
})();
