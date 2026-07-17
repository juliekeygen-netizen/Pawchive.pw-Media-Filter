'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

async function runUpdate(pages, existingIds) {
  const { api } = loadUserscript();
  const { Config, Cache, PawchiveAPI, CatalogueModel, CatalogueRunner, App } = api;
  const creatorContext = {domain:'pawchive.pw',service:'patreon',creatorId:'a',creatorKey:'pawchive.pw|patreon|a',creatorUrl:'https://pawchive.pw/patreon/user/a'};
  const catalogue = {
    ...CatalogueModel.empty().catalogue,
    status:'complete',
    totalExpectedPosts:existingIds.length,
    storedPostCount:existingIds.length,
    pageCoverage:{0:{offset:0,rawCount:Math.min(50,existingIds.length),usableCount:Math.min(50,existingIds.length),postIds:existingIds.slice(0,50),invalidRecordCount:0,finalPage:existingIds.length<50,endReason:existingIds.length<50?'short-page':''}},
    paginationEndReached:true,endReason:'known-total',fullBuildCoverageComplete:true,
  };
  const postsById = new Map(existingIds.map((id)=>[String(id),{
    id:String(id),key:`pawchive.pw|patreon|a|${id}`,creatorKey:creatorContext.creatorKey,
    scanSchemaVersion:Config.schemaVersion,cacheSources:{catalogue:true,scan:false},
    videoCount:0,imageCount:0,archiveCount:0,projectFileCount:0,externalLinkCount:0,
  }]));
  const runtime={context:creatorContext,creatorMeta:{creatorKey:creatorContext.creatorKey},model:{catalogue},catalogueState:catalogue,postsById,workingEndpoint:null,totalPosts:existingIds.length,totalPages:Math.ceil(existingIds.length/50)};
  const written=[];const patches=[];let calls=0;
  Cache.putPosts=async(posts)=>written.push(...posts);
  Cache.patchMeta=async(key,patch)=>{patches.push({key,patch});return{creatorKey:key,...patch};};
  PawchiveAPI.fetchCreatorPage=async(context,offset)=>{
    assert.equal(context.creatorKey, creatorContext.creatorKey);
    const posts=pages[calls++]||[];
    return {posts:posts.map((id)=>({id:String(id),user:'a',service:'patreon',title:`Post ${id}`,published:'2026-01-01',attachments:[],tags:[],content:''})),warnings:[],endpointIndex:0,endReason:posts.length<50?'short-page':''};
  };
  const otherContext={creatorKey:'pawchive.pw|fanbox|b'};App.context=otherContext;App.catalog=new Map([['untouched',{id:'untouched'}]]);
  const result=await CatalogueRunner.runUpdate(runtime,{signal:new AbortController().signal});
  assert.equal(App.context, otherContext, 'runner never replaces active creator-page context');
  assert.equal(App.catalog.has('untouched'), true, 'runner does not mutate another creator page catalogue');
  return {result,runtime,written,patches,calls};
}

(async()=>{
  const existing=Array.from({length:100},(_,index)=>199-index);
  const first=await runUpdate([[203,202,201,200,199,198]],existing);
  assert.equal(first.result.newCount,4);
  assert.equal(first.written.length,4);
  assert.equal(first.runtime.catalogueState.lastUpdateCheckAt>0,true);
  assert.equal(first.runtime.catalogueState.creatorCardSummary.sourcePostCount,104);

  const sixty=Array.from({length:60},(_,index)=>260-index);
  const multi=await runUpdate([sixty.slice(0,50),[...sixty.slice(50),199,198]],existing);
  assert.equal(multi.result.newCount,60);
  assert.equal(multi.calls,2);
  assert.equal(multi.written.length,60);

  const none=await runUpdate([[199,198,197]],existing);
  assert.equal(none.result.newCount,0);
  assert.equal(none.written.length,0);
  assert.equal(none.runtime.catalogueState.lastUpdateCheckAt>0,true);

  console.log('Pawchive Media Filter Update new-post tests passed.');
})().catch((error)=>{console.error(error);process.exitCode=1;});
