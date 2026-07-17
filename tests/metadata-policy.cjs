'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api } = loadUserscript();
const { PawchiveData, CatalogueMetadataPolicy, PostNormalizer, Route } = api;
const json = (value) => JSON.parse(JSON.stringify(value));
const creator = Route.parse('https://pawchive.pw/fanbox/user/123');
const base = { id:'1', user:'123', service:'fanbox', title:'Post', content:'', tags:[], attachments:[], file:null };

for (const value of [undefined, null, '', '   ', {}, { name:'', path:'', url:'' }]) {
  const normalized = PawchiveData.normalizeFileValue(value);
  assert.equal(normalized.status, 'absent');
  assert.equal(normalized.file, null);
}

let file = PawchiveData.normalizeFileValue({ path:'/data/file.psd' });
assert.equal(file.status, 'present');
assert.equal(file.file.path, '/data/file.psd');
file = PawchiveData.normalizeFileValue('https://example.test/file.zip');
assert.equal(file.status, 'present');
assert.equal(file.file.name, 'file.zip');
assert.equal(PawchiveData.normalizeFileValue({ unsupportedIdentifier:'abc', size:100 }).status, 'invalid');

for (const raw of [
  { attachments: [], tags: [], content: '', file: null },
  { file: {} },
  { tags: null },
  { tags: 'PSD' },
  { tags: { name:'PSD' } },
  {},
]) {
  assert.equal(CatalogueMetadataPolicy.evaluate(raw).retryable, false);
}

for (const [raw, reason] of [
  [{ has_full: false }, 'explicit-partial-record'],
  [{ partial: true }, 'explicit-partial-record'],
  [{ substring: 'preview' }, 'substring-without-content'],
  [{ attachments: { unexpected:'data' } }, 'invalid-attachments-structure'],
  [{ file: { unsupportedIdentifier:'abc', size:100 } }, 'invalid-file-structure'],
  [{ tags: { unsupportedIdentifier:'abc' } }, 'invalid-tags-structure'],
  [{ attachment_count: 2, attachments: [{ name: 'one.jpg' }], file: {} }, 'attachment-count-mismatch'],
]) {
  const result = CatalogueMetadataPolicy.evaluate(raw);
  assert.equal(result.retryable, true);
  assert.ok(result.reasons.includes(reason));
}

let post = PostNormalizer.normalize({
  ...base,
  file: {},
  attachments: [{ path:'/image.png' }],
}, creator);
assert.equal(post.mainFile, null);
assert.equal(post.attachmentCount, 1);
assert.equal(post.imageCount, 1);
assert.equal(post.completeness, 'complete');

post = PostNormalizer.normalize({
  ...base,
  file: { path:'/same/image.png' },
  attachments: [{ path:'/same/image.png' }, null, {}],
}, creator);
assert.equal(post.attachmentCount, 1, 'valid duplicate main/attachment records are deduplicated');
assert.equal(post.attachments.length, 1, 'empty attachment placeholders are ignored');

post = PostNormalizer.normalize({ ...base, file:'/source/project.psd' }, creator);
assert.equal(post.projectFileCount, 1);
post = PostNormalizer.normalize({ ...base, file:'https://example.test/archive.zip' }, creator);
assert.equal(post.archiveCount, 1);

for (const [value, status, tags] of [
  [[], 'present', []],
  [null, 'absent', []],
  ['PSD', 'present', ['PSD']],
  [{ name:'PSD' }, 'present', ['PSD']],
  [{}, 'absent', []],
  [{ unsupported:'x' }, 'invalid', []],
]) {
  const result = PawchiveData.normalizeTags(value, { provided:true });
  assert.equal(result.status, status);
  assert.deepEqual(json(result.tags), tags);
}

const allMissingTags = CatalogueMetadataPolicy.summarize(
  Array.from({ length: 50 }, () => CatalogueMetadataPolicy.availability({ attachments: [], content: '', file: null })),
);
assert.equal(allMissingTags.tags.status, 'not-provided');
assert.equal(allMissingTags.tags.absentCount, 50);

const mixedTags = CatalogueMetadataPolicy.summarize([
  CatalogueMetadataPolicy.availability({ tags: [] }),
  CatalogueMetadataPolicy.availability({}),
]);
assert.equal(mixedTags.tags.status, 'mixed');
assert.equal(mixedTags.tags.presentCount, 1, 'legitimate empty arrays count as provided');

console.log('Pawchive Media Filter metadata policy tests passed.');
