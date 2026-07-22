'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(() => {
  const { api, originalSource, makeClassList, makeElement } = loadUserscript();
  const {
    App,
    Cache,
    Config,
    PopularDOM,
    PopularScanner,
    PopularJobManager,
    PopularCardDecorator,
    PopularPageController,
  } = api;

  assert.equal(Config.version, '0.13.2');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.2/);

  const button = {
    disabled: false,
    textContent: '',
    classList: makeClassList(),
    setAttribute(name, value) { this[name] = String(value); },
  };
  App.ui = {
    scanButton: button,
    progress: { hidden: true },
    progressBar: { style: { width: '' } },
  };
  App.popularContext = { periodKey: 'pawchive.pw|popular|month|2026-07-01' };
  App.dom = { totalPosts: 500 };
  App.popularEntries = new Map(Array.from({ length: 494 }, (_, index) => [`post-${index}`, {}]));
  PopularJobManager.activeJob = null;
  PopularJobManager.pendingJobs = [];
  PopularJobManager.recentJobs.clear();
  App.popularMode = 'native';

  App.popularMeta = {
    status: 'complete',
    storedEntryCount: 494,
    totalExpectedPosts: 500,
    completedRunId: 'old-run',
  };
  PopularPageController.renderAction();
  assert.equal(button.textContent, 'Retry scans');
  assert.equal(button.disabled, false);
  assert.equal(button.classList.contains('pmf-locked-control'), false);
  assert.equal(PopularPageController.periodState().missing, 6);
  assert.equal(PopularPageController.periodState().incomplete, true);

  App.popularEntries = new Map(Array.from({ length: 500 }, (_, index) => [`post-${index}`, {}]));
  App.popularMeta = {
    status: 'complete',
    storedEntryCount: 500,
    totalExpectedPosts: 500,
    completedRunId: 'complete-run',
  };
  PopularPageController.renderAction();
  assert.equal(button.textContent, 'Scanned');
  assert.equal(button.disabled, true);
  assert.equal(button.classList.contains('pmf-locked-control'), true);

  PopularJobManager.activeJob = {
    periodKey: App.popularContext.periodKey,
    status: 'running',
    progress: { completed: 3, total: 10 },
  };
  PopularPageController.renderAction();
  assert.equal(button.textContent, 'Scanned');
  assert.equal(button.disabled, true);
  PopularJobManager.activeJob = null;

  const primaryActionSource = PopularPageController.primaryAction.toString();
  assert.match(primaryActionSource, /retry\?'resume':'scan'/);
  assert.match(primaryActionSource, /retry\?'Retry Scan':'Scan'/);
  assert.match(PopularScanner.run.toString(), /missingEntryCount/);
  assert.match(PopularScanner.run.toString(), /countIncomplete/);
  assert.match(PopularScanner.run.toString(), /retry scan/);

  assert.match(PopularPageController.renderLocal.toString(), /This Popular Posts period has not been scanned\./);
  assert.doesNotMatch(PopularPageController.renderLocal.toString(), /Scan this period from Native mode/);

  const footer = makeElement('footer');
  footer.className = 'post-card__footer';
  const card = makeElement('article');
  card.dataset = {};
  card.querySelector = (selector) => selector === '.post-card__footer' ? footer : null;

  const fanboxIcon = PopularCardDecorator.platformIcon(card, { service: 'fanbox' });
  assert.ok(fanboxIcon);
  assert.equal(fanboxIcon.src, '/static/small_icons/fanbox.png');
  assert.equal(fanboxIcon.alt, 'Pixiv Fanbox');

  const pixivFanboxIcon = PopularCardDecorator.platformIcon(card, { service: 'pixiv_fanbox' });
  assert.ok(pixivFanboxIcon);
  assert.equal(pixivFanboxIcon.src, '/static/small_icons/fanbox.png');

  const patreonIcon = PopularCardDecorator.platformIcon(card, { service: 'patreon' });
  assert.ok(patreonIcon);
  assert.equal(patreonIcon.src, '/static/small_icons/patreon.png');
  assert.equal(patreonIcon.alt, 'Patreon');

  assert.match(Cache.getPostStatusesByKeys.toString(), /store\.get\(key\)/);
  assert.match(PopularPageController.loadStatuses.toString(), /getPostStatusesByKeys/);
  assert.doesNotMatch(PopularPageController.loadStatuses.toString(), /getAllPostStatuses/);

  assert.doesNotMatch(PopularDOM.countCandidates.toString(), /nativeCardCandidates/);
  assert.match(PopularDOM.countCandidates.toString(), /const scopes=new Set/);
  assert.match(PopularDOM.postAnchorCandidates.toString(), /a\[href\*=/);
  assert.match(PopularScanner.preparePage.toString(), /Config\.catalogueDetailConcurrency/);
  assert.match(PopularScanner.preparePage.toString(), /,2,items\.length/);

  assert.match(PopularJobManager.restore.toString(), /'interrupted'\?'interrupted':'queued'/);
  assert.match(PopularJobManager.restore.toString(), /recentJobs\.set/);
  assert.match(PopularJobManager.snapshot.toString(), /'interrupted'/);

  assert.doesNotMatch(PopularPageController.applyNativeControlVisibility.toString(), /placeNativeTopControls/);
  assert.match(PopularPageController.applyNativeControlVisibility.toString(), /for\(const node of found\?\.paginators\|\|\[\]\).*setVisible\(node,false\)/);
  assert.match(PopularPageController.applyNativeControlVisibility.toString(), /for\(const node of found\?\.countNodes\|\|\[\]\).*setVisible\(node,false\)/);
  assert.match(PopularPageController.nativeState.toString(), /nextSibling/);
  assert.match(PopularPageController.restoreNode.toString(), /insertBefore/);

  console.log('Pawchive Media Filter v0.13.2 Popular performance, retry, mirrored pagination, and platform-icon tests passed.');
})();
