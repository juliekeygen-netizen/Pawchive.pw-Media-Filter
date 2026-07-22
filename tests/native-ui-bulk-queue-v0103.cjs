'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource } = loadUserscript();
const { Config, Util, CatalogueJobManager, CreatorBulkSelection, NativeArtistsProxy } = api;

assert.equal(Config.version, '0.13.0');
assert.match(originalSource, /\/\/ @version\s+0\.13\.0/);
for (const [name, source] of [
  ['userscript', originalSource],
  ...['README.md', 'SPEC.md', 'TESTING.md'].map((name) => [
    name,
    fs.readFileSync(path.resolve(__dirname, '..', name), 'utf8'),
  ]),
]) {
  assert.doesNotMatch(source, /Ã|Â|â[^a-zA-Z\s]|�/, `${name} contains a known mojibake signature`);
}
assert.match(originalSource, /pmf-mode-segments/);
assert.match(originalSource, /--pmf-search-control-width/);
assert.match(originalSource, /data-creator-index-action="native-service"/);
assert.match(originalSource, /data-creator-index-action="native-sort"/);
assert.doesNotMatch(originalSource, /data-creator-index-action="native-direction"/);
assert.match(originalSource, /data-proxy-direction/);
assert.match(originalSource, />Scan<\/button>/);
assert.match(originalSource, />Update<\/button>/);
assert.match(originalSource, /label:'Retry\/resume incomplete'/);
assert.doesNotMatch(originalSource, /Retry\/resume incomplete (?:scans|Catalogues)/);
assert.doesNotMatch(originalSource, /All matching eligible creators/);
assert.match(originalSource, /Current visible result page/);
assert.match(originalSource, /First matching creators/);
assert.match(originalSource, /\/api\/v1\/creators/);
assert.match(originalSource, /NativeCreatorDirectorySource/);
assert.match(originalSource, /data-native-paginator-index/);
assert.match(originalSource, /const chosen=new Map/);
assert.match(originalSource, /pmf-native-status/);
assert.match(originalSource, /Queue · recently completed/);
assert.match(originalSource, /Queue idle/);
assert.match(originalSource, /terminalJobs/);
assert.match(originalSource, /finished,remaining/);
assert.match(originalSource, /version:4,waiting,active,recent,batches/);
assert.match(originalSource, /host\.dataset\.selectedTab/);
assert.match(originalSource, /host\.scrollTop=scrollTop/);
assert.match(originalSource, /balanceTrailing/);
assert.match(originalSource, /relativeAnchorGeometry/);
assert.match(originalSource, /menu\.style\.width=`\$\{rect\.width\}px`/);

assert.equal(
  JSON.stringify(Util.relativeAnchorGeometry(
    { left:240, bottom:196, width:384 },
    { left:90, top:40 },
  )),
  JSON.stringify({ left:150, top:160, width:384 }),
);

assert.equal(NativeArtistsProxy.nextSort('favorited', 'desc', 'favorited').direction, 'asc');
assert.equal(NativeArtistsProxy.nextSort('favorited', 'asc', 'name').direction, 'asc');
assert.equal(NativeArtistsProxy.nextSort('name', 'asc', 'favorited').direction, 'asc');

CatalogueJobManager.shutdown();
CatalogueJobManager.maintenanceActive = true;
const context = (id) => ({ creatorKey:`pawchive.pw|patreon|${id}`, domain:'pawchive.pw', service:'patreon', creatorId:String(id) });
const batch = CatalogueJobManager.createBatch({ label:'Durable test', total:2 });
CatalogueJobManager.enqueue(context(1), 'build', { batchId:batch.id, batchLabel:batch.label });
CatalogueJobManager.enqueue(context(2), 'build', { batchId:batch.id, batchLabel:batch.label });
const first = CatalogueJobManager.queuedForCreator(context(1).creatorKey);
CatalogueJobManager.pendingJobs = CatalogueJobManager.pendingJobs.filter((job) => job !== first);
CatalogueJobManager.queuedByCreator.delete(first.creatorKey);
first.status = 'complete';
CatalogueJobManager.recordTerminal(first);
CatalogueJobManager.updateBatch(batch.id);
assert.equal(CatalogueJobManager.batchCounts(batch.id).finished, 1);
assert.equal(CatalogueJobManager.batchCounts(batch.id).remaining, 1);
CatalogueJobManager.recentJobs.set(first.creatorKey, first);
CatalogueJobManager.recentJobs.delete(first.creatorKey);
assert.equal(CatalogueJobManager.batchCounts(batch.id).finished, 1);
assert.equal(CatalogueJobManager.batchCounts(batch.id).total, 2);
assert.equal(CatalogueJobManager.recordTerminal(first), false);
assert.equal(CatalogueJobManager.batchCounts(batch.id).completed, 1);

const failed = CatalogueJobManager.queuedForCreator(context(2).creatorKey);
CatalogueJobManager.pendingJobs = CatalogueJobManager.pendingJobs.filter((job) => job !== failed);
CatalogueJobManager.queuedByCreator.delete(failed.creatorKey);
failed.status = 'failed';
CatalogueJobManager.recordTerminal(failed);
CatalogueJobManager.recentJobs.set(failed.creatorKey, failed);
assert.equal(CatalogueJobManager.batchCounts(batch.id).finished, 2);
const retried = CatalogueJobManager.retry(failed.creatorKey);
assert.equal(retried.accepted, true);
assert.equal(retried.job.id, failed.id);
assert.equal(CatalogueJobManager.batchCounts(batch.id).finished, 1);
assert.equal(CatalogueJobManager.batchCounts(batch.id).remaining, 1);
assert.equal(CatalogueJobManager.batchCounts(batch.id).total, 2);

const record = (id, state) => ({
  directory:{ creatorKey:`pawchive.pw|patreon|${id}`, creatorName:id },
  scanned:state !== 'unscanned',
  catalogueState:state,
  summary:state === 'complete' ? { completeness:'complete' } : null,
});
const candidates = [
  record('queued', 'unscanned'),
  record('unscanned', 'unscanned'),
  record('partial', 'partial'),
  record('complete', 'complete'),
];
CatalogueJobManager.enqueue(context('queued'), 'build');
const scan = CreatorBulkSelection.first(candidates, 'build', 2);
assert.equal(JSON.stringify(scan.map((item) => item.record.directory.creatorKey.split('|').at(-1))), JSON.stringify(['unscanned', 'partial']));
assert.equal(JSON.stringify(scan.map((item) => item.action)), JSON.stringify(['build', 'resume']));
assert.equal(JSON.stringify(CreatorBulkSelection.first(candidates, 'update', 3).map((item) => item.action)), JSON.stringify(['update']));
assert.equal(JSON.stringify(CreatorBulkSelection.first(candidates, 'resume', 3).map((item) => item.action)), JSON.stringify(['resume']));

CatalogueJobManager.shutdown();
console.log('Pawchive Media Filter v0.10.3 native UI, bulk selection, and durable queue tests passed.');
