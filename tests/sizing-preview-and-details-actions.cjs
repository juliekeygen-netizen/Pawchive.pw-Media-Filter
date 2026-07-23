'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, stored, originalSource, makeClassList } = loadUserscript();
const {
  Config, Settings, CompactGridScale, CompactThumbnailRatio, CatalogueModel, CatalogueJobManager, Catalogue, UI, App,
} = api;

assert.equal(Config.version, '0.13.5');
assert.equal(Config.settingsKey, 'pmf-settings-v5');

Settings.load();
Settings.save({ compactCardScale:'big', compactThumbnailAspectRatio:'native' });
App.displayMode='dim';
CompactGridScale.preview('medium');
assert.equal(CompactGridScale.previewScale,'medium');
assert.equal(CompactThumbnailRatio.currentAspectRatio(),'1-1');
CompactThumbnailRatio.preview('1-1');
assert.equal(CompactThumbnailRatio.previewRatio,'1-1');
assert.equal(CompactGridScale.currentScale(),'medium');
assert.equal(Settings.value.compactCardScale,'big','scale preview does not persist settings');
assert.equal(Settings.value.compactThumbnailAspectRatio,'1-1','ratio preview does not persist settings');
assert.equal(stored.get(Config.settingsKey).compactCardScale,'big');
assert.equal(stored.get(Config.settingsKey).compactThumbnailAspectRatio,'1-1');
CompactGridScale.restorePreview({apply:false});
CompactThumbnailRatio.restorePreview({apply:false});
assert.equal(CompactGridScale.previewScale,null);
assert.equal(CompactThumbnailRatio.previewRatio,null);

assert.equal(CompactGridScale.median([210,220,230]),220);
assert.equal(CompactGridScale.median([200,220,240,260]),230);

CompactGridScale.resetForCreator('creator-a');
const reliable={
  creatorKey:'creator-a',containerWidth:1200,gridWidth:1200,cardWidth:220,
  columnCount:5,columnGap:8,rowGap:8,nativeCardHeight:124,nativeVisibleCardRatio:220/124,nativeThumbnailWidth:220,nativeThumbnailHeight:124,
  nativeThumbnailRatio:220/124,measuredAt:1,
};
assert.equal(CompactGridScale.commitMeasurement(reliable).cardWidth,220);
assert.equal(CompactGridScale.commitMeasurement({...reliable,gridWidth:0,cardWidth:0}).cardWidth,220,'zero measurement does not replace reliable geometry');
CompactGridScale.resetForCreator('creator-b');
assert.equal(CompactGridScale.measurement,null,'new creator clears prior geometry');

const visibleGrid={hidden:false,isConnected:true,clientWidth:910,getBoundingClientRect:()=>({width:910})};
const parent={clientWidth:840,getBoundingClientRect:()=>({width:840})};
assert.equal(CompactGridScale.availableWidth(visibleGrid,parent,700),910);
visibleGrid.hidden=true;
assert.equal(CompactGridScale.availableWidth(visibleGrid,parent,700),840);
assert.equal(CompactGridScale.availableWidth(null,null,700),700);

for(const width of [960,1200,1600]){
  const input={availableWidth:width,gridWidth:width,cardWidth:220,nativeCardHeight:124,nativeVisibleCardRatio:220/124,columnCount:5,columnGap:8};
  const big=CompactGridScale.calculateLayout({...input,scale:'big'});
  const medium=CompactGridScale.calculateLayout({...input,scale:'medium'});
  const small=CompactGridScale.calculateLayout({...input,scale:'small'});
  assert.ok(big.columns<=medium.columns,`Medium never fits fewer columns at ${width}px`);
  assert.ok(medium.columns<=small.columns,`Small never fits fewer columns at ${width}px`);
  assert.ok(big.cardWidth>medium.cardWidth);
  assert.ok(medium.cardWidth>small.cardWidth);
  assert.equal(big.legacySmall,Math.max(110,Math.round(124*1.26)));
  assert.equal(big.newBig,Math.round(big.legacySmall/1.25));
  assert.equal(big.newMedium,Math.round(big.newBig/1.5));
  assert.equal(big.newSmall,Math.round(big.newBig/2));
}

const narrowInput={availableWidth:430,gridWidth:430,cardWidth:200,nativeCardHeight:112,nativeVisibleCardRatio:16/9,columnCount:2,columnGap:8};
const narrowBig=CompactGridScale.calculateLayout({...narrowInput,scale:'big'});
const narrowMedium=CompactGridScale.calculateLayout({...narrowInput,scale:'medium'});
const narrowSmall=CompactGridScale.calculateLayout({...narrowInput,scale:'small'});
assert.ok(narrowBig.columns<=narrowMedium.columns);
assert.ok(narrowMedium.columns<=narrowSmall.columns);
assert.ok(narrowSmall.cardWidth>0);

const styleValues=new Map();
const grid={
  classList:makeClassList(),dataset:{},
  style:{
    setProperty(name,value,priority){styleValues.set(name,{value,priority});},
    getPropertyValue(name){return styleValues.get(name)?.value||'';},
  },
};
CompactGridScale.setOwnedGridStyles(grid,{scale:'medium',columns:7},{columnGap:8,rowGap:10});
assert.equal(styleValues.get('display').value,'flex');
assert.equal(styleValues.get('display').priority,'important');
assert.equal(styleValues.get('flex-wrap').value,'wrap');
assert.equal(styleValues.get('justify-content').value,'center');
assert.equal(styleValues.get('width').value,'100%');
assert.equal(styleValues.get('width').priority,'important');
assert.equal(styleValues.get('column-gap').value,'8px');
assert.equal(styleValues.get('row-gap').value,'10px');
assert.equal(grid.classList.contains('pmf-card-scale-medium'),true);
assert.equal(grid.classList.contains('pmf-card-scale-big'),false);
CompactGridScale.setOwnedGridStyles(grid,{scale:'small',columns:8},{columnGap:8,rowGap:10});
assert.equal(grid.classList.contains('pmf-card-scale-medium'),false);
assert.equal(grid.classList.contains('pmf-card-scale-small'),true);
assert.equal(grid.dataset.pmfCardScale,'small');
assert.equal(grid.dataset.pmfColumns,'8');

const pageCoverage=Object.fromEntries(Array.from({length:7},(_,index)=>{
  const offset=index*50;
  return [offset,{offset,rawCount:index===6?28:50,usableCount:index===6?28:50,postIds:[],finalPage:index===6}];
}));
App.catalog=new Map();
App.catalogueState=CatalogueModel.normalize({
  catalogue:{
    status:'complete',totalExpectedPosts:328,storedPostCount:328,pageCoverage,
    retryableMetadataIds:Array.from({length:11},(_,index)=>String(index+1)),
    retryableMetadataReasons:Object.fromEntries(Array.from({length:11},(_,index)=>[String(index+1),['explicit-partial-record']])),
    fullBuildCoverageComplete:true,endReason:'short-page',metadataPolicyVersion:2,
  },
});
Catalogue.active=null;Catalogue.metadataRetry=null;
let html=UI.buildCatalogueDetailsHtml();
assert.equal((html.match(/data-pmf-retry-incomplete/g)||[]).length,1);
assert.match(html,/Retry optional details for 11 posts/);
assert.match(html,/pmf-details-summary-actions/);
assert.ok(html.indexOf('data-pmf-retry-incomplete')<html.indexOf('Creator-page coverage'),'retry action is beneath the summary and before technical sections');
assert.match(html,/Optional metadata can be retried using the button above/);

App.context={creatorKey:'pawchive.pw|patreon|test',service:'patreon',creatorId:'test'};
CatalogueJobManager.activeJobs.set(App.context.creatorKey,{creatorKey:App.context.creatorKey,kind:'metadata-retry',status:'running'});
html=UI.buildCatalogueDetailsHtml();
assert.match(html,/>Retrying…<\/button>/);
assert.match(html,/aria-busy="true"/);
assert.match(html,/disabled/);
CatalogueJobManager.activeJobs.clear();
CatalogueJobManager.activeJobs.set(App.context.creatorKey,{creatorKey:App.context.creatorKey,kind:'update',status:'running'});
html=UI.buildCatalogueDetailsHtml();
assert.match(html,/>Retry incomplete<\/button>/);
assert.match(html,/aria-busy="false"/);
assert.match(html,/disabled/);
Catalogue.active=null;

App.catalogueState.catalogue.retryableMetadataIds=[];
App.catalogueState.catalogue.retryableMetadataReasons={};
html=UI.buildCatalogueDetailsHtml();
assert.doesNotMatch(html,/data-pmf-retry-incomplete/);
assert.match(html,/No optional retry action is currently needed/);

App.catalogueState.catalogue.retryableMetadataIds=['1'];
App.catalogueState.catalogue.retryableMetadataReasons={1:['explicit-partial-record']};
const details={
  hidden:false,className:'',innerHTML:'',scrollTop:120,scrollHeight:600,clientHeight:200,
  replaceChildren(){this.innerHTML='';},
};
App.ui={details};
UI.refreshDetails();
assert.equal(details.scrollTop,120,'live Details refresh preserves scroll position');
details.scrollTop=390;
UI.refreshDetails();
assert.equal(details.scrollTop,400,'near-bottom refresh remains near the bottom');

const renderErrorsSource=UI.renderErrors.toString();
assert.doesNotMatch(renderErrorsSource,/Retry incomplete/);
assert.doesNotMatch(renderErrorsSource,/Retry unresolved/);
assert.match(renderErrorsSource,/hasCatalogueDetails/);
assert.match(UI.bind.toString(),/data-pmf-retry-incomplete/);
assert.match(UI.bind.toString(),/Catalogue\.retryIncompleteMetadata\(\)/);
assert.match(UI.renderErrors.toString(),/if\(opening\)App\.ui\.details\.scrollTop=0/);

const renderCompactSource=App.renderCompact.toString();
assert.ok(renderCompactSource.indexOf('CompactLayoutEngine.apply')<renderCompactSource.indexOf('replaceChildren'),'layout establishes dynamic page capacity before the slice is inserted');
assert.doesNotMatch(CompactGridScale.applyScale.toString(),/Scanner|filteredPage|App\.query|primaryAction/);
assert.doesNotMatch(CompactThumbnailRatio.applyAspectRatio.toString(),/Scanner|filteredPage|App\.query|primaryAction/);
assert.match(originalSource,/setProperty\('display','flex','important'\)/);
assert.match(originalSource,/setProperty\('flex-wrap','wrap','important'\)/);
assert.match(originalSource,/\.pmf-filter-grid>\.post-card\{flex:0 0 var\(--pmf-card-width\)!important;width:var\(--pmf-card-width\)!important;min-width:var\(--pmf-card-width\)!important;max-width:var\(--pmf-card-width\)!important/);
assert.doesNotMatch(originalSource,/\.card-list__items>\.post-card\{width:auto!important/);
assert.match(originalSource,/grid\.isConnected===false\|\|grid\.hidden/);
assert.match(originalSource,/Compact grid sizing was overridden by page CSS/);
assert.match(originalSource,/operation:'compact-layout'/);
assert.match(originalSource,/\.pmf-filter-grid\{display:flex!important;flex-wrap:wrap!important;justify-content:center!important;align-items:flex-start!important;align-content:flex-start!important;width:100%!important/);
assert.match(originalSource,/\.pmf-filter-grid>\.post-card\{[^}]*height:var\(--pmf-thumbnail-height\)!important;[^}]*aspect-ratio:auto!important/);
assert.match(originalSource,/\.pmf-filter-grid>\.post-card>a\.image-link,\.pmf-filter-grid>\.post-card>\.image-link\{[^}]*position:absolute!important;[^}]*height:100%!important/);
assert.doesNotMatch(originalSource,/,pmf-filter-grid>\.post-card>\.image-link/);
assert.match(originalSource,/\.pmf-details-summary-actions\{display:flex;justify-content:center/);
assert.match(originalSource,/onClose:\(reason\).*CompactLayoutEngine\.restorePreview.*App\.render\(\)/s);
assert.match(originalSource,/UI\.closeSettings\('save'\)/);

console.log('Pawchive Media Filter sizing preview and Details action tests passed.');
