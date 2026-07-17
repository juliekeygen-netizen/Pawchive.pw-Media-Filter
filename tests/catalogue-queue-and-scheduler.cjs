'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');
const { CatalogueJobManager:jobs, CatalogueRequestScheduler:scheduler, Cache, CatalogueModel, Config } = loadUserscript().api;

function context(id) {
  return {domain:'pawchive.pw',service:'patreon',creatorId:id,creatorKey:`pawchive.pw|patreon|${id}`,creatorUrl:`https://pawchive.pw/patreon/user/${id}`};
}

jobs.shutdown();
jobs.setConcurrency(1);
const started=[];
jobs.startJob=(job)=>{
  job.status='running';job.controller=new AbortController();jobs.activeJobs.set(job.creatorKey,job);started.push(job);
};

const bulk=Array.from({length:101},(_,index)=>context(`bulk-${index}`));
bulk.forEach((item)=>assert.equal(jobs.enqueue(item,'build').accepted,true));
assert.equal(jobs.activeJobs.size,1);
assert.equal(jobs.pendingJobs.length,100,'the FIFO pending queue accepts at least 100 waiting creators');
assert.equal(jobs.enqueue(bulk[50],'update').accepted,false);
jobs.shutdown();jobs.setConcurrency(1);started.length=0;

const a=context('a');const b=context('b');const c=context('c');
assert.equal(jobs.enqueue(a,'build').state,'started');
assert.equal(jobs.enqueue(b,'update').state,'queued');
assert.equal(jobs.enqueue(c,'resume').state,'queued');
assert.equal(jobs.queuePosition(b.creatorKey),1);
assert.equal(jobs.queuePosition(c.creatorKey),2);
assert.equal(jobs.enqueue(b,'resume').accepted,false,'a creator cannot be queued twice');
assert.equal(jobs.snapshot().pending.length,2,'the pending queue is not capped at one item');

jobs.setConcurrency(2);
assert.deepEqual(started.map((job)=>job.creatorKey),[a.creatorKey,b.creatorKey]);
assert.equal(jobs.queuePosition(c.creatorKey),1);
assert.equal(jobs.removeQueued(c.creatorKey),true);
assert.equal(jobs.queuedForCreator(c.creatorKey),null);
assert.equal(jobs.stop(a.creatorKey),true);
assert.equal(started[0].controller.signal.aborted,true);
jobs.setConcurrency(1);
assert.equal(jobs.activeJobs.size,2,'lowering concurrency does not abort active work');

(async()=>{
const originalGetMeta=Cache.getMeta;
Cache.getMeta=async(key)=>key===a.creatorKey
  ? {creatorKey:key,catalogue:CatalogueModel.empty().catalogue}
  : {creatorKey:key,catalogue:{...CatalogueModel.empty().catalogue,status:'complete',fullBuildCoverageComplete:true,totalExpectedPosts:1,storedPostCount:1,pageCoverage:{0:{offset:0,rawCount:1,usableCount:1,postIds:['1'],finalPage:true,endReason:'short-page'}}}};
assert.equal(await jobs.reevaluate({creatorKey:a.creatorKey,requestedAction:'update'}),'build','queued intent is re-evaluated when it starts');
assert.equal(await jobs.reevaluate({creatorKey:b.creatorKey,requestedAction:'build'}),'update');
assert.equal(await jobs.reevaluate({creatorKey:b.creatorKey,requestedAction:'metadata-retry'}),'metadata-retry');
Cache.getMeta=originalGetMeta;

jobs.pendingJobs=[];jobs.activeJobs.clear();jobs.queuedByCreator.clear();jobs.recentJobs.clear();

  scheduler.reset();
  const starts=[];
  await Promise.all([0,1,2].map(async(index)=>{await scheduler.waitTurn({creatorKey:String(index),requestKind:'test'});starts.push(Date.now());}));
  starts.sort((x,y)=>x-y);
  const spacingIntervals=[starts[1]-starts[0],starts[2]-starts[1]];
  assert.ok(spacingIntervals[0]>=Config.pageRequestSpacingMs-15,'request starts share the global spacing gate');
  assert.ok(spacingIntervals[1]>=Config.pageRequestSpacingMs-15,'spacing also applies across a third worker');

  scheduler.reset();scheduler.applyRateLimit(80,{creatorKey:'rate-limited'});const limitedAt=Date.now();await scheduler.waitTurn({creatorKey:'other'});const cooldownElapsed=Date.now()-limitedAt;assert.ok(cooldownElapsed>=65,'one worker rate limit pauses other workers');

  scheduler.reset();scheduler.applyRateLimit(80);const controller=new AbortController();const aborted=scheduler.waitTurn({signal:controller.signal,creatorKey:'aborted'});controller.abort();await assert.rejects(aborted,{name:'AbortError'});await scheduler.waitTurn({creatorKey:'after-abort'});
  console.log(`Pawchive Media Filter catalogue queue and request scheduler tests passed (spacing ${spacingIntervals.join('/')} ms; cooldown ${cooldownElapsed} ms).`);
})().catch((error)=>{console.error(error);process.exitCode=1;});
