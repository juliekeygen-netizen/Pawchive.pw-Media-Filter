'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, stored, context, originalSource } = loadUserscript();
const { Config, Settings, AttachmentBadgeSizing } = api;

Settings.load();
assert.equal(Settings.value.postAttachmentBadgeSize, 'small');
assert.equal(Settings.value.creatorAttachmentBadgeSize, 'small');
assert.equal(Settings.value.confirmCreatorCardScan, false);

const { small, medium, big } = AttachmentBadgeSizing.metrics;
assert.deepEqual(
  JSON.parse(JSON.stringify(small.post)),
  {height:20,minWidth:21,icon:13,font:10,padding:3,gap:2,spacing:3,footer:26,manyHeight:19,manyMinWidth:19,manyPadding:2,manyFooter:38,tightWidth:210},
);
assert.deepEqual(
  JSON.parse(JSON.stringify(small.creator)),
  {height:21,minWidth:34,icon:13,font:10,padding:4,gap:3,spacing:4,columnGap:4},
);
for (const group of ['post','creator']) {
  for (const key of ['height','minWidth','icon','font','padding','gap','spacing']) {
    assert.ok(medium[group][key] > small[group][key], `${group}.${key}: medium > small`);
    assert.ok(big[group][key] > medium[group][key], `${group}.${key}: big > medium`);
  }
}

const originalCounts = {videos:7,images:3};
const originalCategories = ['videos','images'];
const originalScale = Settings.value.compactCardScale;
const originalRatio = Settings.value.compactThumbnailAspectRatio;

AttachmentBadgeSizing.applyAll({reason:'test'});
assert.equal(context.document.documentElement.classList.contains('pmf-post-attachment-size-small'), true);
assert.equal(context.document.documentElement.classList.contains('pmf-creator-attachment-size-small'), true);
AttachmentBadgeSizing.preview('post','medium');
assert.equal(AttachmentBadgeSizing.current('post'), 'medium');
assert.equal(AttachmentBadgeSizing.current('creator'), 'small');
assert.equal(context.document.documentElement.classList.contains('pmf-post-attachment-size-medium'), true);
assert.equal(stored.get(Config.settingsKey).postAttachmentBadgeSize, 'small', 'preview is not persisted');
AttachmentBadgeSizing.restorePreview();
assert.equal(AttachmentBadgeSizing.current('post'), 'small');

Settings.save({postAttachmentBadgeSize:'medium',creatorAttachmentBadgeSize:'big'});
AttachmentBadgeSizing.commit();
assert.equal(AttachmentBadgeSizing.current('post'), 'medium');
assert.equal(AttachmentBadgeSizing.current('creator'), 'big');
assert.equal(stored.get(Config.settingsKey).postAttachmentBadgeSize, 'medium');
assert.equal(stored.get(Config.settingsKey).creatorAttachmentBadgeSize, 'big');
Settings.reset();
AttachmentBadgeSizing.commit();
assert.equal(AttachmentBadgeSizing.current('post'), 'small');
assert.equal(AttachmentBadgeSizing.current('creator'), 'small');

assert.deepEqual(originalCounts, {videos:7,images:3});
assert.deepEqual(originalCategories, ['videos','images']);
assert.equal(Settings.value.compactCardScale, originalScale);
assert.equal(Settings.value.compactThumbnailAspectRatio, originalRatio);
assert.match(originalSource, /\.pmf-badge\{height:var\(--pmf-post-badge-height\)/);
assert.match(originalSource, /\.pmf-creator-badge\{width:var\(--pmf-creator-column-badge-width,auto\);height:var\(--pmf-creator-badge-height\)/);
assert.match(originalSource, /min-height:var\(--pmf-post-footer-height\)/);
assert.match(originalSource, /--pmf-creator-badge-width/);

console.log('Pawchive Media Filter attachment badge sizing tests passed.');
