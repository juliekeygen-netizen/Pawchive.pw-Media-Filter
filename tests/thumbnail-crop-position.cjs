'use strict';

const assert = require('node:assert/strict');
const { loadUserscript, makeClassList } = require('./test-helper.cjs');

const { api, context, originalSource } = loadUserscript();
const { Config, CardRenderer, CompactGridScale, CompactThumbnailRatio, App } = api;

assert.equal(Config.version, '0.13.9');

function makeStyle(initial = {}) {
  const values = new Map(Object.entries(initial).map(([name, value]) => [name, { value, priority:'' }]));
  return {
    values,
    setProperty(name, value, priority = '') { values.set(name, { value:String(value), priority:String(priority) }); },
    getPropertyValue(name) { return values.get(name)?.value || ''; },
    getPropertyPriority(name) { return values.get(name)?.priority || ''; },
    removeProperty(name) { values.delete(name); },
  };
}

const link = { style:makeStyle({ transform:'scale(1.1)', top:'8px' }) };
const container = {
  style:makeStyle({ transform:'translateY(-10px)', padding:'56.25% 0 0' }),
  getBoundingClientRect() { return { width:320, height:180 }; },
};
let loadListenerCount = 0;
const image = {
  style:makeStyle({
    'object-position':'50% 0%',
    transform:'translateY(-20px) scale(1.1)',
    translate:'0 -20px',
    scale:'1.1',
    top:'-20px',
    height:'120%',
  }),
  complete:false,
  naturalWidth:640,
  naturalHeight:480,
  addEventListener(type) { if (type === 'load') loadListenerCount += 1; },
  getBoundingClientRect() { return { width:320, height:180 }; },
  closest(selector) {
    if (selector === '.post-card') return card;
    if (selector === '.post-card__image-container') return container;
    if (selector === '.pmf-filter-grid') return grid;
    return null;
  },
};
const card = {
  classList:makeClassList(),
  dataset:{},
  style:makeStyle(),
  querySelector(selector) {
    if (selector === 'a.image-link, .image-link') return link;
    if (selector === '.post-card__image-container') return container;
    if (selector === '.post-card__image') return image;
    return null;
  },
};
card.classList.add('post-card', 'pmf-filter-card');
const grid = {
  hidden:false,
  dataset:{ pmfColumns:'3' },
  classList:makeClassList(),
  style:makeStyle(),
  querySelectorAll(selector) { return selector === ':scope > .post-card' ? [card] : []; },
  querySelector(selector) { return selector === ':scope > .post-card .post-card__image' ? image : null; },
};

App.ui={grid};
App.displayMode='compact';
App.context={creatorKey:'creator'};
App.sessionToken=12;
App.filteredPage=1;
App.pageController=new AbortController();
CompactGridScale.previewScale='big';
CompactGridScale.measurement={nativeVisibleCardRatio:16/9};
CompactThumbnailRatio.previewRatio='16-9';

CardRenderer.normalizeThumbnailGeometry(card);
assert.equal(image.style.getPropertyValue('object-fit'), 'cover');
assert.equal(image.style.getPropertyValue('object-position'), '50% 50%');
assert.equal(image.style.getPropertyValue('transform'), 'none');
assert.equal(image.style.getPropertyValue('transform-origin'), '50% 50%');
assert.equal(image.style.getPropertyValue('translate'), 'none');
assert.equal(image.style.getPropertyValue('scale'), 'none');
assert.equal(image.style.getPropertyValue('rotate'), 'none');
assert.equal(image.style.getPropertyValue('top'), '0');
assert.equal(image.style.getPropertyValue('left'), '0');
assert.equal(image.style.getPropertyValue('width'), '100%');
assert.equal(image.style.getPropertyValue('height'), '100%');
assert.equal(container.style.getPropertyValue('transform'), 'none');
assert.equal(container.style.getPropertyValue('padding'), '0');
assert.equal(link.style.getPropertyValue('transform'), 'none');
assert.equal(loadListenerCount, 1);

CardRenderer.normalizeThumbnailGeometry(card);
CardRenderer.normalizeThumbnailGeometry(card);
assert.equal(loadListenerCount, 1, 'normalization is idempotent and binds one load listener');
assert.equal(image.style.getPropertyValue('object-position'), '50% 50%');

context.getComputedStyle = () => ({
  objectFit:image.style.getPropertyValue('object-fit'),
  objectPosition:image.style.getPropertyValue('object-position'),
  transform:image.style.getPropertyValue('transform'),
  transformOrigin:image.style.getPropertyValue('transform-origin'),
});
const healthy = CardRenderer.verifyThumbnailCrop({
  reason:'render',
  sessionToken:12,
  creatorKey:'creator',
  corrected:false,
});
assert.equal(healthy.centered, true);
assert.equal(healthy.objectFit, 'cover');
assert.equal(healthy.objectPosition, '50% 50%');
assert.equal(healthy.transform, 'none');

image.style.setProperty('object-position', '50% 0%', 'important');
image.style.setProperty('transform', 'matrix(1, 0, 0, 1, 0, -20)', 'important');
const overridden = CardRenderer.verifyThumbnailCrop({
  reason:'ratio-preview',
  sessionToken:12,
  creatorKey:'creator',
  corrected:false,
});
assert.equal(overridden.centered, false);
assert.equal(overridden.reapplicationScheduled, true);
assert.equal(image.style.getPropertyValue('object-position'), '50% 50%');
assert.equal(image.style.getPropertyValue('transform'), 'none');
assert.equal(CardRenderer.lastCropVerified.centered, true);
assert.equal(CardRenderer.lastCropVerified.reapplied, true);

CompactThumbnailRatio.applyAspectRatio('1-1', { verify:false });
assert.equal(image.style.getPropertyValue('object-position'), '50% 50%', 'ratio changes retain centered crop');
CompactGridScale.previewScale='small';
CardRenderer.normalizeGridThumbnails(grid, { reason:'scale-preview', verify:false });
assert.equal(image.style.getPropertyValue('object-position'), '50% 50%', 'scale changes retain centered crop');

assert.match(originalSource,/\.pmf-filter-grid \.post-card__image-container \.post-card__image\{[^}]*object-fit:cover!important;[^}]*object-position:50% 50%!important;[^}]*transform:none!important;[^}]*transform-origin:50% 50%!important/);
assert.match(originalSource,/\.pmf-filter-grid \.post-card:hover \.post-card__image\{[^}]*transform:none!important/);
assert.match(CardRenderer.normalizeThumbnailGeometry.toString(),/'object-position':'50% 50%'/);
assert.match(CardRenderer.normalizeThumbnailGeometry.toString(),/transform:'none'/);
assert.match(CardRenderer.verifyThumbnailCrop.toString(),/getComputedStyle\(image\)/);
assert.match(CardRenderer.clone.toString(),/CardRenderer\.normalizeThumbnailGeometry\(card\);\s*BadgeRenderer\.apply/);
assert.match(CardRenderer.fallback.toString(),/CardRenderer\.normalizeThumbnailGeometry\(card\);\s*BadgeRenderer\.apply/);
assert.match(originalSource,/PMF thumbnail crop was overridden; reapplying centered crop\./);

console.log('Pawchive Media Filter thumbnail crop position tests passed.');
