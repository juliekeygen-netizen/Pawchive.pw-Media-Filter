'use strict';

const assert = require('node:assert/strict');
const { loadUserscript, makeClassList } = require('./test-helper.cjs');

const { api, originalSource } = loadUserscript();
const { Config, CompactThumbnailRatio, CompactGridScale, App } = api;

assert.equal(Config.version, '0.11.4');
assert.equal(CompactThumbnailRatio.expectedHeight(320, 1), 320);
assert.equal(CompactThumbnailRatio.expectedHeight(320, 4 / 3), 240);
assert.equal(CompactThumbnailRatio.expectedHeight(320, 16 / 9), 180);
assert.equal(CompactThumbnailRatio.correctionFor(320, 180, 1).needsCorrection, true);
assert.equal(CompactThumbnailRatio.correctionFor(320, 318.5, 1).needsCorrection, false);

function makeStyle() {
  const values = new Map();
  return {
    values,
    setProperty(name, value, priority = '') { values.set(name, { value:String(value), priority:String(priority) }); },
    getPropertyValue(name) { return values.get(name)?.value || ''; },
    removeProperty(name) { values.delete(name); },
  };
}

const cardStyle = makeStyle();
const link = {
  getBoundingClientRect() { return { width:320, height:180 }; },
};
const imageContainer = {
  getBoundingClientRect() { return { width:320, height:320 }; },
};
const card = {
  classList:makeClassList(),
  dataset:{},
  style:cardStyle,
  getBoundingClientRect() {
    const width = Number.parseFloat(cardStyle.getPropertyValue('width')) || 320;
    const height = Number.parseFloat(cardStyle.getPropertyValue('height')) || 180;
    return { width, height, left:0 };
  },
  querySelector(selector) {
    if (selector === ':scope > .image-link' || selector === 'a.image-link, .image-link') return link;
    if (selector === '.post-card__image-container') return imageContainer;
    return null;
  },
};
card.classList.add('post-card', 'pmf-filter-card');

const gridStyle = makeStyle();
const grid = {
  hidden:false,
  isConnected:true,
  parentElement:{ clientWidth:1200, getBoundingClientRect:() => ({ width:1200 }) },
  dataset:{ pmfColumns:'3' },
  classList:makeClassList(),
  style:gridStyle,
  getBoundingClientRect() { return { width:1200, height:400 }; },
  querySelectorAll(selector) {
    if (selector === ':scope > .post-card') return [card];
    return [];
  },
};

App.ui={grid};
App.displayMode='compact';
App.context={creatorKey:'creator'};
App.sessionToken=7;
App.filteredPage=1;
CompactGridScale.previewScale='big';
CompactGridScale.measurement={
  creatorKey:'creator',
  gridWidth:1200,
  cardWidth:220,
  columnCount:5,
  columnGap:8,
  rowGap:8,
  nativeCardHeight:132,
  nativeVisibleCardRatio:5/3,
  nativeThumbnailWidth:220,
  nativeThumbnailHeight:132,
  nativeThumbnailRatio:5/3,
};

const first = CompactThumbnailRatio.verifyVisibleCardRatio({
  reason:'ratio-preview',
  ratioSetting:'1-1',
  numericRatio:1,
  sessionToken:7,
  creatorKey:'creator',
  corrected:false,
  correctiveHeightApplied:false,
});
assert.equal(first.withinTolerance, false, 'ratio verifier observes mismatch without applying corrective geometry');
assert.equal(first.imageContainerRatio, 1);
assert.ok(Math.abs(first.visibleCardRatio - 16 / 9) < .001);
assert.equal(cardStyle.getPropertyValue('height'), '', 'ratio verifier does not resize cards');
assert.equal(cardStyle.getPropertyValue('block-size'), '');
assert.equal('pmfRatioCorrected' in card.dataset, false);

CompactThumbnailRatio.applyAspectRatio('16-9', { verify:false });
assert.equal(grid.dataset.pmfThumbnailRatio, '16-9');
assert.equal(gridStyle.getPropertyValue('--pmf-card-aspect-ratio'), String(16 / 9));
assert.equal(cardStyle.getPropertyValue('aspect-ratio'), '');
assert.match(cardStyle.getPropertyValue('height'), /px$/, 'CompactGridScale owns fixed card height');
assert.match(cardStyle.getPropertyValue('width'), /px$/, 'CompactGridScale owns fixed card width');
assert.match(cardStyle.getPropertyValue('flex'), /^0 0 \d+px$/, 'CompactGridScale owns flex basis');

cardStyle.setProperty('height', '180px', 'important');
cardStyle.setProperty('block-size', '180px', 'important');
cardStyle.setProperty('width', '320px', 'important');
cardStyle.setProperty('flex', '0 0 320px', 'important');
card.dataset.pmfRatioCorrected='true';
CompactThumbnailRatio.clear();
assert.equal(grid.classList.contains('pmf-thumb-ratio-16-9'), false);
assert.equal(gridStyle.getPropertyValue('--pmf-card-aspect-ratio'), '');
assert.equal(cardStyle.getPropertyValue('width'), '');
assert.equal(cardStyle.getPropertyValue('height'), '');
assert.equal(cardStyle.getPropertyValue('block-size'), '');
assert.equal(cardStyle.getPropertyValue('flex'), '');
assert.equal('pmfRatioCorrected' in card.dataset, false);

assert.match(originalSource,/\.pmf-filter-grid>\.post-card\{[^}]*aspect-ratio:auto!important/);
assert.match(originalSource,/\.pmf-filter-grid>\.post-card>a\.image-link,\.pmf-filter-grid>\.post-card>\.image-link\{[^}]*position:absolute!important;[^}]*inset:0!important;[^}]*height:100%!important/);
assert.doesNotMatch(originalSource,/,pmf-filter-grid>\.post-card>\.image-link/);
assert.match(originalSource,/\.pmf-filter-grid \.post-card__image-container\{[^}]*position:absolute!important;[^}]*inset:0!important;[^}]*height:100%!important;[^}]*aspect-ratio:auto!important/);
assert.doesNotMatch(originalSource,/pmf-thumb-ratio-(?:native|16-9|4-3|1-1) \.post-card__image-container/);
assert.match(originalSource,/operation:'compact-visible-card-ratio'/);
assert.match(originalSource,/operation:'compact-thumbnail-crop'/);
assert.match(originalSource,/Compact visible card ratio differs from requested ratio; CompactGridScale remains the only geometry owner/);
assert.doesNotMatch(originalSource,/applying visible-card height correction/);
assert.match(originalSource,/\.pmf-fallback-thumb\{min-height:0;/);

console.log('Pawchive Media Filter visible card aspect ratio ownership tests passed.');
