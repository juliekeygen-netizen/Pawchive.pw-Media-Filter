'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource } = loadUserscript();
const {
  Config, CatalogueModel, Catalogue, Cache, UI, App, CompactGridScale,
} = api;
const json = (value) => JSON.parse(JSON.stringify(value));
const creator = {
  domain:'pawchive.pw', service:'fanbox', creatorId:'123',
  creatorKey:'pawchive.pw|fanbox|123', creatorUrl:'https://pawchive.pw/fanbox/user/123',
};
const manifest = (offset, count = 50, finalPage = false) => ({
  offset, rawCount:count, usableCount:count,
  postIds:Array.from({ length:count }, (_, index) => String(offset + index + 1)),
  invalidRecordCount:0, fetchedAt:1, endpointIndex:0, finalPage,
  endReason:finalPage?'short-page':'', legacy:false,
});

let catalogue = {
  status:'complete', totalExpectedPosts:724, storedPostCount:724,
  pageCoverage:Object.fromEntries(Array.from({ length:15 }, (_, index) => {
    const offset=index*50;
    return [offset, manifest(offset, index===14?24:50, index===14)];
  })),
  failedOffsets:[], retryableMetadataIds:[], malformedListRecords:[],
  fullBuildCoverageComplete:true, endReason:'short-page',
};
let health = CatalogueModel.healthSummary(catalogue);
assert.equal(health.coverage, 'complete');
assert.equal(health.severity, 'success');
assert.equal(health.pagesVerified, 15);

catalogue = { ...catalogue, retryableMetadataIds:['1'], retryableMetadataReasons:{ 1:['explicit-partial-record'] } };
health = CatalogueModel.healthSummary(catalogue);
assert.equal(health.coverage, 'complete');
assert.equal(health.severity, 'warning');
assert.equal(CatalogueModel.button({ catalogue }).label, 'Update');

const failedCoverage={...catalogue.pageCoverage};delete failedCoverage[250];
health = CatalogueModel.healthSummary({ ...catalogue, failedOffsets:[250], fullBuildCoverageComplete:false, pageCoverage:failedCoverage });
assert.equal(health.coverage, 'error');
assert.equal(health.severity, 'error');

for (const scale of ['big','medium','small']) {
  const result = CompactGridScale.calculate({
    containerWidth:1200, nativeCardWidth:220, nativeColumns:5, columnGap:8, scale,
  });
  assert.equal(result.scale, scale);
}
const big = CompactGridScale.calculate({ containerWidth:1200, nativeCardWidth:220, nativeColumns:5, columnGap:8, scale:'big' });
const medium = CompactGridScale.calculate({ containerWidth:1200, nativeCardWidth:220, nativeColumns:5, columnGap:8, scale:'medium' });
const small = CompactGridScale.calculate({ containerWidth:1200, nativeCardWidth:220, nativeColumns:5, columnGap:8, scale:'small' });
assert.ok(big.columns >= 1);
assert.ok(big.columns < medium.columns);
assert.ok(medium.columns < small.columns);
assert.ok(big.cardWidth > medium.cardWidth);
assert.ok(medium.cardWidth > small.cardWidth);

(async () => {
  App.context=creator;App.sessionToken=1;App.catalog=new Map();
  const oldPosts=Array.from({ length:81 }, (_, index) => {
    const id=String(index+1);
    return {
      key:`${creator.creatorKey}|${id}`,creatorKey:creator.creatorKey,id,
      creatorId:'123',service:'fanbox',title:`Post ${id}`,publishedAt:'2026-01-01',
      importedAt:'',editedAt:'',thumbnailUrl:'',mainFile:index<48?{}:null,
      attachments:[{ path:`/image-${id}.png` }],content:'',tags:[],
      cacheSources:{scan:false,catalogue:true},attachmentCount:index<48?2:1,
      completeness:index<54?'partial':'complete',scannedAt:1,scanSchemaVersion:Config.schemaVersion,
    };
  });
  oldPosts.forEach((post)=>App.catalog.set(post.id,post));
  const reasons={};
  for(let index=0;index<48;index+=1)reasons[String(index+1)]=['invalid-file-structure'];
  for(let index=48;index<54;index+=1)reasons[String(index+1)]=['explicit-partial-record'];
  App.catalogueState=CatalogueModel.normalize({
    catalogue:{
      status:'complete',totalExpectedPosts:81,storedPostCount:81,
      pageCoverage:{0:manifest(0),50:manifest(50,31,true)},
      retryableMetadataIds:Object.keys(reasons),retryableMetadataReasons:reasons,
      fullBuildCoverageComplete:true,endReason:'short-page',metadataPolicyVersion:0,
    },
  });
  const originalPut=Cache.putPosts;const originalPatch=Cache.patchMeta;
  Cache.putPosts=async()=>{};Cache.patchMeta=async(_key,patch)=>({creatorKey:creator.creatorKey,...patch});
  const changed=await Catalogue.reconcileMetadataPolicy();
  Cache.putPosts=originalPut;Cache.patchMeta=originalPatch;
  assert.equal(changed,true);
  assert.equal(App.catalogueState.catalogue.metadataPolicyVersion,2);
  assert.equal(Object.keys(App.catalogueState.catalogue.pageCoverage).length,2);
  assert.equal(CatalogueModel.evaluateCoverage(App.catalogueState.catalogue).coverageComplete,true);
  assert.deepEqual(json(App.catalogueState.catalogue.retryableMetadataIds),['49','50','51','52','53','54']);
  assert.equal(App.catalog.get('1').mainFile,null);
  assert.equal(App.catalog.get('1').attachmentCount,1);
  assert.equal(CatalogueModel.button(App.catalogueState).label,'Update');
  assert.equal(await Catalogue.reconcileMetadataPolicy(),false,'policy reconciliation is idempotent');

  App.ui={details:{hidden:false,innerHTML:'',className:'',replaceChildren(){this.innerHTML='';}}};
  UI.refreshDetails();
  assert.match(App.ui.details.innerHTML,/^<div class="pmf-details-summary pmf-details-success"/);
  assert.match(App.ui.details.innerHTML,/✓ Catalogue complete/);
  assert.match(App.ui.details.innerHTML,/2 of 2 pages verified/);
  assert.match(App.ui.details.innerHTML,/The API marked this post as partial/);
  assert.match(App.ui.details.innerHTML,/<details><summary>Show verified offsets/);
  assert.equal((App.ui.details.innerHTML.match(/data-pmf-retry-incomplete/g)||[]).length,1);
  assert.match(App.ui.details.innerHTML,/Retry optional details for 6 posts/);
  assert.doesNotMatch(App.ui.details.innerHTML,/pmf-error-details/);

  const largePosts=Array.from({ length:724 }, (_, index) => {
    const id=String(index+1);
    return {
      key:`${creator.creatorKey}|${id}`,creatorKey:creator.creatorKey,id,
      creatorId:'123',service:'fanbox',title:`Large post ${id}`,publishedAt:'2026-01-01',
      importedAt:'',editedAt:'',thumbnailUrl:'',mainFile:index<3?{}:null,
      attachments:[{ path:`/large-image-${id}.png` }],content:'',tags:[],
      cacheSources:{scan:false,catalogue:true},attachmentCount:index<3?2:1,
      completeness:index<4?'partial':'complete',scannedAt:1,scanSchemaVersion:Config.schemaVersion,
    };
  });
  App.catalog=new Map(largePosts.map((post)=>[post.id,post]));
  App.catalogueState=CatalogueModel.normalize({
    catalogue:{
      status:'complete',totalExpectedPosts:724,storedPostCount:724,
      pageCoverage:Object.fromEntries(Array.from({ length:15 }, (_, index) => {
        const offset=index*50;
        return [offset,manifest(offset,index===14?24:50,index===14)];
      })),
      retryableMetadataIds:['1','2','3','4'],
      retryableMetadataReasons:{
        1:['invalid-file-structure'],
        2:['invalid-file-structure'],
        3:['invalid-file-structure'],
        4:['explicit-partial-record'],
      },
      fullBuildCoverageComplete:true,endReason:'short-page',metadataPolicyVersion:0,
    },
  });
  Cache.putPosts=async()=>{};Cache.patchMeta=async(_key,patch)=>({creatorKey:creator.creatorKey,...patch});
  assert.equal(await Catalogue.reconcileMetadataPolicy(),true);
  Cache.putPosts=originalPut;Cache.patchMeta=originalPatch;
  assert.deepEqual(json(App.catalogueState.catalogue.retryableMetadataIds),['4']);
  assert.equal(App.catalogueState.catalogue.storedPostCount,724);
  assert.equal(Object.keys(App.catalogueState.catalogue.pageCoverage).length,15);
  assert.equal(CatalogueModel.evaluateCoverage(App.catalogueState.catalogue).coverageComplete,true);
  assert.equal(App.catalogueState.catalogue.fieldAvailability.file.invalidCount,0);
  assert.equal(App.catalogueState.catalogue.fieldAvailability.file.status,'not-provided');
  assert.equal(CatalogueModel.button(App.catalogueState).label,'Update');
  assert.equal(await Catalogue.reconcileMetadataPolicy(),false);
  assert.doesNotMatch(Catalogue.reconcileMetadataPolicy.toString(),/ApiClient|fetch\(/);

  UI.refreshDetails();
  assert.match(App.ui.details.innerHTML,/15 of 15 pages verified/);
  assert.match(App.ui.details.innerHTML,/1 post may benefit from an optional detail retry/);
  assert.equal((App.ui.details.innerHTML.match(/data-pmf-retry-incomplete/g)||[]).length,1);
  assert.match(App.ui.details.innerHTML,/Retry optional details for 1 post/);
  assert.doesNotMatch(App.ui.details.innerHTML,/Invalid main-file metadata \(3\)/);

  assert.ok(originalSource.includes('html.pmf-post-attachment-size-small{--pmf-post-badge-height:20px;--pmf-post-badge-min-width:21px'));
  assert.ok(originalSource.includes('.pmf-badge{height:var(--pmf-post-badge-height);min-width:var(--pmf-post-badge-min-width)'));
  assert.ok(originalSource.includes('.pmf-card-has-badges .post-card__footer{position:relative;min-height:var(--pmf-post-footer-height)}'));
  assert.ok(originalSource.includes('.pmf-many-badges .post-card__footer{min-height:var(--pmf-post-many-footer-height)}'));
  assert.ok(!originalSource.includes('min-height:49px'));

  console.log('Pawchive Media Filter details and sizing tests passed.');
})().catch((error)=>{
  console.error(error);
  process.exitCode=1;
});
