'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const json = (value) => JSON.parse(JSON.stringify(value));

function migrateSettings(saved) {
  const fixture = loadUserscript();
  const { Config, Settings } = fixture.api;
  fixture.stored.set(Config.settingsKey, json(saved));
  const first = json(Settings.load());
  const persisted = json(fixture.stored.get(Config.settingsKey));
  const second = json(Settings.load());
  return { first, persisted, second };
}

for (const legacy of ['original','small','compact']) {
  const migrated = migrateSettings({ compactCardSize:legacy });
  assert.equal(migrated.first.compactCardScale, 'big', 'v0.8.3 maps every legacy size to the new Big once');
  assert.equal(migrated.first.compactThumbnailAspectRatio, '1-1');
  assert.equal('compactCardSize' in migrated.first, false);
  assert.equal('compactCardSize' in migrated.persisted, false);
  assert.deepEqual(migrated.second, migrated.first, `${legacy} migration is idempotent`);
}

const preferred = migrateSettings({
  compactCardSize:'compact',
  compactCardScale:'medium',
  compactThumbnailAspectRatio:'4-3',
});
assert.equal(preferred.first.compactCardScale, 'big', 'first v0.8.3 load maps an existing selection to new Big');
assert.equal(preferred.first.compactThumbnailAspectRatio, '4-3', 'new ratio takes precedence');

const invalidPreferred = migrateSettings({
  compactCardSize:'compact',
  compactCardScale:'wide',
  compactThumbnailAspectRatio:'portrait',
});
assert.equal(invalidPreferred.first.compactCardScale, 'big');
assert.equal(invalidPreferred.first.compactThumbnailAspectRatio, '1-1');

const { api, stored, originalSource, makeClassList } = loadUserscript();
const {
  Config, Settings, CompactGridScale, CompactThumbnailRatio, CompactLayoutEngine, App, Presets, FilterEngine,
} = api;

Settings.load();
for (const value of ['big','medium','small']) {
  Settings.save({ compactCardScale:value });
  assert.equal(Settings.value.compactCardScale, value);
}
Settings.save({ compactCardScale:'invalid' });
assert.equal(Settings.value.compactCardScale, 'big');
for (const value of ['16-9','4-3','1-1']) {
  Settings.save({ compactThumbnailAspectRatio:value });
  assert.equal(Settings.value.compactThumbnailAspectRatio, value);
}
Settings.save({ compactThumbnailAspectRatio:'invalid' });
assert.equal(Settings.value.compactThumbnailAspectRatio, '1-1');
assert.equal('compactCardScale' in Presets.snapshot(FilterEngine.createDefaultState()), false);
assert.equal('compactThumbnailAspectRatio' in Presets.snapshot(FilterEngine.createDefaultState()), false);

const desktop = {
  availableWidth:1200,
  gridWidth:1200,
  cardWidth:220,
  columnCount:5,
  columnGap:8,
};
const layouts = Object.fromEntries(['big','medium','small'].map((scale)=>[
  scale,
  CompactGridScale.calculateLayout({ ...desktop, scale }),
]));
assert.ok(layouts.big.columns >= 1);
assert.ok(layouts.big.columns < layouts.medium.columns);
assert.ok(layouts.medium.columns < layouts.small.columns);
assert.ok(layouts.big.cardWidth > layouts.medium.cardWidth);
assert.ok(layouts.medium.cardWidth > layouts.small.cardWidth);
assert.ok(layouts.big.targetHeight > layouts.medium.targetHeight);
assert.ok(layouts.medium.targetHeight > layouts.small.targetHeight);
assert.equal(layouts.big.pageSize, CompactGridScale.pageSizeForColumns(layouts.big.columns));

const wideRatio=CompactGridScale.calculateLayout({...desktop,scale:'medium',ratio:16/9});
const squareRatio=CompactGridScale.calculateLayout({...desktop,scale:'medium',ratio:1});
assert.equal(wideRatio.targetHeight,squareRatio.targetHeight,'aspect ratios share one fixed selected height');
assert.ok(squareRatio.columns>wideRatio.columns,'narrower ratios dynamically fit more columns');
assert.ok(squareRatio.cardWidth<wideRatio.cardWidth,'aspect ratio changes the whole card width');

assert.ok(Math.abs(CompactThumbnailRatio.numericRatio('16-9') - 16/9) < .00001);
assert.ok(Math.abs(CompactThumbnailRatio.numericRatio('4-3') - 4/3) < .00001);
assert.equal(CompactThumbnailRatio.numericRatio('1-1'), 1);
assert.equal(CompactThumbnailRatio.numericRatio('native', 1.625), 1);

const styleValues = new Map();
const cardStyleValues = new Map();
const card = {
  dataset:{},
  style:{
    setProperty(name,value,priority=''){cardStyleValues.set(name,{value:String(value),priority:String(priority)});},
    removeProperty(name){cardStyleValues.delete(name);},
  },
  getBoundingClientRect(){return {width:300,height:300,left:0};},
  querySelector(){return null;},
};
const grid = {
  classList:makeClassList(),
  dataset:{},
  style:{
    setProperty(name,value,priority=''){styleValues.set(name,{value:String(value),priority:String(priority)});},
    getPropertyValue(name){return styleValues.get(name)?.value||'';},
    removeProperty(name){styleValues.delete(name);},
  },
  querySelectorAll(selector){return selector===':scope > .post-card'?[card]:[];},
};
App.ui={grid};
App.displayMode='compact';
App.context={creatorKey:'creator'};
CompactGridScale.resetForCreator('creator');
CompactGridScale.commitMeasurement({
  creatorKey:'creator',
  containerWidth:1200,
  gridWidth:1200,
  cardWidth:220,
  nativeCardHeight:132,
  nativeVisibleCardRatio:5/3,
  columnCount:5,
  columnGap:8,
  rowGap:10,
  nativeThumbnailWidth:220,
  nativeThumbnailHeight:132,
  nativeThumbnailRatio:5/3,
});
CompactGridScale.setOwnedGridStyles(grid, layouts.medium, CompactGridScale.measurement);
const columnsBeforeRatio = grid.dataset.pmfColumns;
CompactGridScale.previewScale='medium';
CompactThumbnailRatio.applyAspectRatio('1-1',{verify:false});
assert.equal(grid.classList.contains('pmf-card-scale-medium'), true);
assert.equal(grid.classList.contains('pmf-thumb-ratio-1-1'), true);
assert.equal(grid.dataset.pmfCardScale, 'medium');
assert.equal(grid.dataset.pmfThumbnailRatio, '1-1');
assert.notEqual(grid.dataset.pmfColumns, columnsBeforeRatio);
assert.equal(styleValues.get('--pmf-card-aspect-ratio').value, '1');
assert.equal(styleValues.get('--pmf-native-visible-card-ratio').value, String(5/3));
assert.equal(cardStyleValues.has('aspect-ratio'), false);
CompactGridScale.setOwnedGridStyles(grid, layouts.small, CompactGridScale.measurement);
assert.equal(grid.classList.contains('pmf-thumb-ratio-1-1'), true, 'changing scale retains ratio class');
assert.equal(grid.dataset.pmfThumbnailRatio, '1-1');
CompactGridScale.previewScale=null;

Settings.save({ compactCardScale:'big', compactThumbnailAspectRatio:'native' });
App.displayMode='dim';
CompactGridScale.preview('medium');
CompactThumbnailRatio.preview('1-1');
assert.equal(CompactGridScale.currentScale(), 'medium');
assert.equal(CompactThumbnailRatio.currentAspectRatio(), '1-1');
assert.equal(stored.get(Config.settingsKey).compactCardScale, 'big');
assert.equal(stored.get(Config.settingsKey).compactThumbnailAspectRatio, '1-1');
CompactGridScale.restorePreview({apply:false});
CompactThumbnailRatio.restorePreview({apply:false});
assert.equal(CompactGridScale.currentScale(), 'big');
assert.equal(CompactThumbnailRatio.currentAspectRatio(), '1-1');

assert.match(originalSource,/\.pmf-filter-grid>\.post-card\{[^}]*flex:0 0 var\(--pmf-card-width\)!important/);
assert.match(originalSource,/\.pmf-filter-grid>\.post-card\{[^}]*aspect-ratio:auto!important/);
assert.match(originalSource,/\.pmf-filter-grid \.post-card__image-container\{[^}]*position:absolute!important;[^}]*height:100%!important;[^}]*aspect-ratio:auto!important/);
assert.match(originalSource,/\.pmf-filter-grid \.post-card__image-container \.post-card__image\{[^}]*position:absolute!important;[^}]*object-fit:cover!important;[^}]*object-position:50% 50%!important;[^}]*transform:none!important;[^}]*transform-origin:50% 50%!important/);
assert.match(originalSource,/\.pmf-filter-grid \.post-card:hover \.post-card__image\{[^}]*object-position:50% 50%!important;[^}]*transform:none!important/);
assert.match(originalSource,/\.pmf-filter-grid>\.post-card>a\.image-link,\.pmf-filter-grid>\.post-card>\.image-link\{[^}]*height:100%!important;[^}]*aspect-ratio:auto!important/);
assert.match(CompactLayoutEngine.apply.toString(),/CompactGridScale\.applyScale/);
assert.doesNotMatch(originalSource,/applying visible-card height correction/);
assert.match(originalSource,/\.pmf-fallback-thumb\{min-height:0;/);
assert.doesNotMatch(originalSource,/\.pmf-fallback-thumb\{min-height:100px/);
assert.doesNotMatch(originalSource,/pmf-card-size-/);
const aspectRatioSelectors = [...originalSource.matchAll(/([^{}]+)\{[^{}]*aspect-ratio:/g)]
  .map((match)=>match[1].trim());
assert.ok(aspectRatioSelectors.length >= 3);
assert.ok(aspectRatioSelectors.every((selector)=>selector.includes('.pmf-filter-grid')));

const settingsMethod = originalSource.slice(
  originalSource.lastIndexOf('    openSettings() {'),
  originalSource.indexOf('    autoSizeTextarea', originalSource.lastIndexOf('    openSettings() {')),
);
assert.match(settingsMethod,/Post thumbnail size/);
assert.match(settingsMethod,/>Big<\/option>/);
assert.doesNotMatch(settingsMethod,/Big \(OG\)/);
assert.match(settingsMethod,/Post thumbnail aspect ratio/);
assert.match(settingsMethod,/1:1 \(original\)/);
assert.doesNotMatch(settingsMethod,/Original \(site\)|value="native"/);
assert.doesNotMatch(settingsMethod,/Applies to Compact matching posts only/);
assert.match(originalSource,/const SettingsUI = \{/);
assert.match(originalSource,/CompactLayoutEngine\.restorePreview/);

console.log('Pawchive Media Filter card scale and aspect ratio tests passed.');
