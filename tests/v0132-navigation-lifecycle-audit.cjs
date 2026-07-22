'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(async () => {
  const { api, originalSource } = loadUserscript();
  const { Config, Lifecycle, PopularJobManager } = api;

  assert.equal(Config.version, '0.13.2');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.2/);

  assert.match(Lifecycle.installHistorySignals.toString(), /history\.pushState=function/);
  assert.match(Lifecycle.installHistorySignals.toString(), /history\.replaceState=function/);
  assert.match(Lifecycle.installHistorySignals.toString(), /pmf:historychange/);
  assert.match(Lifecycle.start.toString(), /installHistorySignals\(signal\)/);

  const originalEnsureMounted = Lifecycle.ensureMounted;
  let mountCalls = 0;
  Lifecycle.stopped = false;
  Lifecycle.microtaskQueued = false;
  Lifecycle.ensureMounted = () => { mountCalls += 1; return Promise.resolve(); };
  Lifecycle.schedule('spam-1');
  Lifecycle.schedule('spam-2');
  Lifecycle.schedule('spam-3');
  await Promise.resolve();
  assert.equal(mountCalls, 1, 'same-turn route signals should coalesce to one mount attempt');
  assert.equal(Lifecycle.microtaskQueued, false);
  Lifecycle.ensureMounted = originalEnsureMounted;

  let aborted = 0;
  PopularJobManager.paused = false;
  PopularJobManager.activeJob = {
    periodKey: 'pawchive.pw|popular|day|2026-07-22',
    context: { periodKey: 'pawchive.pw|popular|day|2026-07-22' },
    status: 'running',
    controller: { abort(){ aborted += 1; } },
  };
  PopularJobManager.suspendForBfcache();
  assert.equal(PopularJobManager.paused, true);
  assert.equal(PopularJobManager.activeJob.interruptedByNavigation, true);
  assert.equal(aborted, 1);
  PopularJobManager.pendingJobs = [];
  PopularJobManager.activeJob = null;
  PopularJobManager.resumeFromBfcache();
  assert.equal(PopularJobManager.paused, false);

  assert.match(Lifecycle.prepareSnapshot.toString(), /mountController\?\.abort\(\)/);
  assert.match(Lifecycle.prepareSnapshot.toString(), /PopularJobManager\.suspendForBfcache\(\)/);
  assert.match(Lifecycle.handlePageShow.toString(), /PopularJobManager\.resumeFromBfcache\(\)/);
  assert.match(Lifecycle.ensureMounted.toString(), /currentKey===nextKey&&Lifecycle\.healthy\(current\)/,
    'a stale mount completion must not be recorded as the mounted route');
  assert.match(Lifecycle.routeHealth.toString(), /Lifecycle\.healthy\(page\)/);

  console.log('Pawchive Media Filter v0.13.2 navigation lifecycle audit tests passed.');
})();
