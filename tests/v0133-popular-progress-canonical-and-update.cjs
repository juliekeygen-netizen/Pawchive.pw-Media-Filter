'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(async () => {
  const { api, originalSource, context } = loadUserscript();
  const { Config, Route, PopularScanner, PopularJobManager, PopularQueuePanel, QueuePanelView, Lifecycle } = api;

  assert.equal(Config.version, '0.13.8');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.8/);

  const canonical = Route.canonicalPopularUrl('https://pawchive.pw/posts/popular');
  assert.match(canonical, /^https:\/\/pawchive\.pw\/posts\/popular\?/);
  assert.match(canonical, /period=day/);
  assert.match(canonical, /date=\d{4}-\d{2}-\d{2}/);
  assert.equal(Route.canonicalPopularUrl('https://pawchive.pw/posts/popular?date=2026-07-22&period=day'), '');
  assert.match(Lifecycle.start.toString(), /redirectCanonicalPopular\(\)/);
  assert.match(Lifecycle.schedule.toString(), /redirectCanonicalPopular\(\)/);
  assert.match(Lifecycle.redirectCanonicalPopular.toString(), /location\.replace/);

  const job = {
    status: 'running',
    context: { totalPosts: 500 },
    progress: { completed: 100, total: 500, detailCompleted: 25, detailTotal: 50 },
  };
  assert.equal(PopularQueuePanel.jobPercent(job), 25, '100 completed plus 25 in-flight details out of 500 should be 25%');
  const overall = PopularQueuePanel.aggregate({ active:[job], pending:[], recent:[], issues:[] });
  assert.equal(overall.total, 1);
  assert.equal(overall.percent, 25);
  assert.match(QueuePanelView.render.toString(), /explicitPercent/);
  assert.match(originalSource, /pmf-queue-clear-completed/);
  assert.match(originalSource, /PopularQueuePanel\.jobPercent\(job\)/);

  PopularJobManager.progressNotifyTimer = null;
  context.document.visibilityState = 'hidden';
  let notifications = 0;
  const originalNotify = PopularJobManager.notify;
  PopularJobManager.notify = () => { notifications += 1; };
  PopularJobManager.notifyProgress();
  PopularJobManager.notifyProgress();
  assert.ok(PopularJobManager.progressNotifyTimer, 'progress renders should be coalesced');
  clearTimeout(PopularJobManager.progressNotifyTimer);
  PopularJobManager.progressNotifyTimer = null;
  PopularJobManager.notify = originalNotify;

  assert.equal(PopularScanner.needsDetail({
    scanSchemaVersion: Config.schemaVersion,
    completeness: 'complete',
    attachmentNormalizationStatus: 'valid',
    tagNormalizationStatus: 'valid',
    fileNormalizationStatus: 'valid',
  }), false, 'Popular Update must reuse complete stored post metadata');
  assert.match(PopularScanner.run.toString(), /detailCompleted:0,detailTotal:0/,
    'starting a new native page must reset the in-page progress so the aggregate bar never double-counts the previous page');
  assert.match(PopularScanner.run.toString(), /prunePopularEntries/,
    'Update must remove entries that disappeared from the native period after the complete list refresh');
  assert.match(PopularScanner.run.toString(), /displayedFavoriteCount|putPopularEntries/,
    'Update must rewrite native rank/favorite entry data');

  console.log('Pawchive Media Filter v0.13.8 Popular progress, canonical route, and incremental Update tests passed.');
})();
