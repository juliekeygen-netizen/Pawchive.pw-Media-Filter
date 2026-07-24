'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(async () => {
  const { api, context, stored, originalSource, makeElement } = loadUserscript();
  const {
    Config,
    Settings,
    CreatorCatalogueSummary,
    CreatorArtworkFailureCache,
    CreatorCardBadgeRenderer,
    MissingAttachmentMaintenance,
    Cache,
  } = api;

  assert.equal(Config.version, '0.13.9');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.9/);

  // Aggregate-affecting settings may invalidate a fingerprint, but a structurally
  // compatible summary must remain renderable until its replacement is committed.
  const previousSettings = structuredClone(Settings.value);
  Settings.value.excludePostsWithMissingAttachments = false;
  const catalogue = { storedPostCount: 1 };
  const priorSummary = {
    version: CreatorCatalogueSummary.version,
    sourcePostCount: 1,
    classificationFingerprint: CreatorCatalogueSummary.fingerprint(),
    media: {
      videos: { posts: 1, attachments: 1 },
      images: { posts: 0, attachments: 0 },
      archives: { posts: 0, attachments: 0 },
      projectFiles: { posts: 0, attachments: 0 },
      externalLinks: { posts: 0, links: 0 },
    },
    aggregateEligiblePostCount: 1,
    completeness: 'complete',
  };
  Settings.value.excludePostsWithMissingAttachments = true;
  assert.equal(CreatorCatalogueSummary.compatible(priorSummary, catalogue), true);
  assert.equal(CreatorCatalogueSummary.valid(priorSummary, catalogue), false);
  assert.match(CreatorCardBadgeRenderer.render.toString(), /CreatorCatalogueSummary\.compatible/);
  Settings.value = previousSettings;

  // A failed artwork URL is remembered for the page session and is removed from
  // future reconstructed cards instead of being requested on every rerender.
  CreatorArtworkFailureCache.failed.clear();
  CreatorArtworkFailureCache.loaded.clear();
  CreatorArtworkFailureCache.probes.clear();
  const probes = [];
  context.Image = class {
    constructor() { probes.push(this); }
    set src(value) { this.url = value; }
  };
  const brokenBanner = 'https://pawchive.pw/banners/fanbox/11701235';
  const firstVisual = makeElement('span');
  const secondVisual = makeElement('span');
  CreatorArtworkFailureCache.applyBackground(firstVisual, brokenBanner);
  CreatorArtworkFailureCache.applyBackground(secondVisual, brokenBanner);
  assert.equal(probes.length, 1, 'concurrent card renders must share one artwork probe');
  assert.equal(firstVisual.style.backgroundImage, 'none');
  assert.equal(secondVisual.style.backgroundImage, 'none');
  probes[0].onerror();
  await Promise.resolve();
  assert.equal(CreatorArtworkFailureCache.has(brokenBanner), true);
  assert.equal(firstVisual.style.backgroundImage, 'none');
  assert.equal(secondVisual.style.backgroundImage, 'none');
  const thirdVisual = makeElement('span');
  CreatorArtworkFailureCache.applyBackground(thirdVisual, brokenBanner);
  assert.equal(probes.length, 1, 'known-broken artwork must not be requested again');
  assert.equal(thirdVisual.style.backgroundImage, 'none');

  // Legacy or adversarial terminal-failure lists are collapsed to a bounded
  // recent sample while preserving their cumulative count.
  const terminalIds = Array.from({ length: 600 }, (_, index) => `creator::post-${index}`);
  const normalized = MissingAttachmentMaintenance.normalizeCheckpoint({
    version: 3,
    permanentFailedIds: terminalIds,
  });
  assert.equal(normalized.permanentFailedIds.length, 50);
  assert.equal(normalized.permanentFailedCount, 600);

  const persisted = MissingAttachmentMaintenance.persist({
    scope: 'all',
    limit: 0,
    creatorKeys: [],
    scanCursor: null,
    scanDone: true,
    pendingIds: [],
    failedIds: [],
    permanentFailedIds: terminalIds,
    permanentFailedCount: 600,
    affected: new Set(),
    completed: 0,
    attempted: 600,
    discovered: 600,
    checkedComplete: 0,
    checkedMissing: 0,
    total: 600,
    scannedStoredPosts: 600,
    estimatedStoredPosts: 600,
    detailConcurrency: 1,
    recentCompletedAt: [],
    currentCreator: '',
    startedAt: Date.now(),
    stopped: false,
    pauseReason: '',
    message: 'done',
  });
  assert.equal(persisted.permanentFailedIds.length, 50);
  assert.equal(persisted.recentPermanentFailedIds.length, 50);
  assert.equal(persisted.permanentFailedCount, 600);
  assert.ok(JSON.stringify(persisted).length < 10000);

  // Resume reconciliation must count a pending item whose metadata had already
  // committed before the checkpoint save was interrupted.
  const creatorKey = 'pawchive.pw|fanbox|42';
  const postId = 'already-written';
  const taskId = `${creatorKey}::${postId}`;
  const storageKey = `${creatorKey}|${postId}`;
  const committedPost = {
    id: postId,
    key: storageKey,
    creatorKey,
    cacheSources: { catalogue: true },
    missingStatsKnown: true,
    missingStatsParserVersion: 2,
    hasMissingStats: true,
  };
  const originalGetPostsByKeys = Cache.getPostsByKeys;
  Cache.getPostsByKeys = async () => new Map([[storageKey, committedPost]]);
  const recoveryState = {
    pendingIds: [taskId],
    failedIds: [taskId],
    completed: 0,
    checkedComplete: 0,
    checkedMissing: 0,
    recoveredCompleted: 0,
  };
  const recoveredTasks = await MissingAttachmentMaintenance.tasksForIds([taskId], recoveryState);
  Cache.getPostsByKeys = originalGetPostsByKeys;
  assert.equal(recoveredTasks.length, 0);
  assert.equal(recoveryState.pendingIds.length, 0);
  assert.equal(recoveryState.failedIds.length, 0);
  assert.equal(recoveryState.completed, 1);
  assert.equal(recoveryState.checkedMissing, 1);
  assert.equal(recoveryState.checkedComplete, 0);
  assert.equal(recoveryState.recoveredCompleted, 1);

  // The specific failure-cap explanation is retained by finalization.
  assert.match(MissingAttachmentMaintenance.run.toString(), /pauseReason: ''/);
  assert.match(MissingAttachmentMaintenance.run.toString(), /if \(!state\.pauseReason\)/);
  assert.match(originalSource, /retryable-failure-cap/);
  assert.match(originalSource, /aggregate-settings-change/);
  assert.match(originalSource, /backfillKeys\.delete\(task\.context\.creatorKey\)/);

  console.log('Pawchive Media Filter v0.11.3 live-finding regression tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
