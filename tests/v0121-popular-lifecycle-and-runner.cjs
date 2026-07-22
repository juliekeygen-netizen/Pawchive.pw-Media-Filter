'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadUserscript } = require('./test-helper.cjs');

(async () => {
  const { api, originalSource, makeElement } = loadUserscript();
  const {
    Config,
    Settings,
    PopularDOM,
    PopularPageController,
    PopularPeriod,
    PopularJobManager,
    Cache,
    MissingAttachmentMaintenance,
    MaintenanceCommandRunner,
  } = api;

  assert.equal(Config.version, '0.13.2');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.2/);
  assert.equal(Settings.schema.version, 6);

  const oldDefaultHosts = [
    'youtube.com','youtu.be','vimeo.com','mega.nz','drive.google.com','dropbox.com',
    'pixeldrain.com','pixeldrain.net','gofile.io','mediafire.com','streamable.com',
  ];
  const migrated = Settings.normalize(Settings.migrate({ settingsSchemaVersion:5, knownHosts:oldDefaultHosts }));
  assert.ok(migrated.knownHosts.includes('iframely.net'), 'untouched v0.11 host defaults should gain iframely.net');
  const customized = Settings.normalize(Settings.migrate({ settingsSchemaVersion:5, knownHosts:[...oldDefaultHosts, 'example.test'] }));
  assert.ok(customized.knownHosts.includes('example.test'));
  assert.ok(!customized.knownHosts.includes('iframely.net'), 'custom host lists must remain customized');

  const grid = makeElement('div');
  grid.querySelector = () => ({ tagName:'ARTICLE' });
  const broad = makeElement('section');
  broad.querySelector = (selector) => selector.includes('article.post-card') ? ({}) : null;
  broad.contains = (node) => node === grid;
  assert.equal(PopularDOM.isSafeNativeControlGroup(broad, grid), false, 'a navigation container may never own the post grid');
  const safe = makeElement('nav');
  safe.contains = () => false;
  safe.querySelector = () => null;
  assert.equal(PopularDOM.isSafeNativeControlGroup(safe, grid), true);

  const context = { period:'month', date:'2026-07-01', offset:100, periodKey:'pawchive.pw|popular|month|2026-07-01' };
  assert.match(PopularPeriod.pageUrl(context, 450), /o=450/);

  assert.equal(PopularPageController.actionFor(null), 'scan');
  assert.equal(PopularPageController.actionFor({ status:'complete', storedEntryCount:0 }), 'scan');
  assert.equal(PopularPageController.actionFor({ status:'partial', storedEntryCount:20, workingRunId:'run' }), 'resume');
  assert.equal(PopularPageController.actionFor({ status:'complete', storedEntryCount:500 }), 'update');

  assert.equal(MaintenanceCommandRunner.parse('https://pawchive.pw/artists?pmf_maintenance=watch-missing'), 'watch-missing');
  assert.equal(MaintenanceCommandRunner.parse('https://pawchive.pw/artists?pmf_maintenance=resume-missing'), 'resume-missing');
  assert.equal(MaintenanceCommandRunner.parse('https://pawchive.pw/artists?pmf_maintenance=not-real'), '');

  const originalCheckpoint = MissingAttachmentMaintenance.checkpoint;
  const originalRun = MissingAttachmentMaintenance.run;
  const originalSnapshot = MissingAttachmentMaintenance.snapshot;
  const calls = [];
  MissingAttachmentMaintenance.active = null;
  MissingAttachmentMaintenance.checkpoint = () => null;
  MissingAttachmentMaintenance.snapshot = () => ({ running:false, stopped:false, remaining:0, failed:0 });
  MissingAttachmentMaintenance.run = async (options) => { calls.push(options); return { complete:true }; };
  await MaintenanceCommandRunner.execute('watch-missing');
  assert.equal(JSON.stringify(calls), JSON.stringify([{ scope:'all' }]), 'watch mode should start all unknown metadata when no checkpoint exists');
  const originalInventory = Cache.countMissingAttachmentStats;
  MissingAttachmentMaintenance.checkpoint = () => ({ version:3, operation:'missing-attachment-metadata', scope:'all', scanDone:true, pendingIds:[], failedIds:[], completed:2, total:2, stopped:false });
  MissingAttachmentMaintenance.snapshot = () => ({ running:false, stopped:false, remaining:0, failed:0 });
  Cache.countMissingAttachmentStats = async () => ({ total:10, known:7, unknown:3, missing:0, complete:7 });
  MaintenanceCommandRunner.lastInventoryCheckAt = 0;
  await MaintenanceCommandRunner.execute('watch-missing');
  assert.equal(JSON.stringify(calls.at(-1)), JSON.stringify({ scope:'all', estimatedStoredPosts:10 }), 'watch mode should start a new pass when later catalogue work creates unknown metadata');
  MissingAttachmentMaintenance.checkpoint = originalCheckpoint;
  MissingAttachmentMaintenance.run = originalRun;
  MissingAttachmentMaintenance.snapshot = originalSnapshot;
  Cache.countMissingAttachmentStats = originalInventory;
  MaintenanceCommandRunner.stop();

  PopularJobManager.pendingJobs = [
    { periodKey:'a', queueOrder:1 },
    { periodKey:'b', queueOrder:2 },
    { periodKey:'c', queueOrder:3 },
  ];
  PopularJobManager.moveToTop('c');
  assert.equal(JSON.stringify(PopularJobManager.pendingJobs.map((job) => [job.periodKey, job.queueOrder])), JSON.stringify([['c',1],['a',2],['b',3]]));
  PopularJobManager.pendingJobs = [];

  assert.match(originalSource, /MaintenanceCommandRunner\.start\(\)/);
  assert.doesNotMatch(originalSource, /data-popular-period-role|data-popular-native-page-action|const PopularNativePaginator/);
  assert.match(originalSource, /pmf-popular-native-paginator/);
  assert.match(PopularPageController.applyNativeControlVisibility.toString(), /setVisible\(node,true\)/);
  assert.match(PopularPageController.applyNativeControlVisibility.toString(), /setVisible\(node,false\)/);
  assert.match(originalSource, /refreshRevision/);
  assert.match(originalSource, /observerSchedule=Util\.debounce/);
  assert.match(PopularPageController.mount.toString(), /forwardAbort/);
  assert.match(PopularPageController.load.toString(), /assertMountCurrent/);
  assert.doesNotMatch(PopularDOM.find.toString(), /closest\?\.\('\.paginator/);
  assert.match(originalSource.slice(originalSource.indexOf('const PopularPageController'), originalSource.indexOf('const App =')), /NativePaginatorMirror\.render/);

  const toolsDir = path.resolve(__dirname, '..', 'tools');
  const runner = fs.readFileSync(path.join(toolsDir, 'Start-PawchiveMetadataRunner.ps1'), 'utf8');
  const readme = fs.readFileSync(path.join(toolsDir, 'README.md'), 'utf8');
  assert.match(runner, /pmf_maintenance=\$Mode/);
  assert.match(runner, /disable-background-timer-throttling/);
  assert.match(runner, /SetThreadExecutionState/);
  assert.match(runner, /disable-background-mode/);
  assert.match(runner, /MaintenanceRootProcessId/);
  assert.match(runner, /ProfileDirectory/);
  assert.match(readme, /browser-origin IndexedDB/);
  assert.match(readme, /watch-missing/);

  console.log('Pawchive Media Filter v0.12.5 Popular lifecycle and external metadata-runner tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
