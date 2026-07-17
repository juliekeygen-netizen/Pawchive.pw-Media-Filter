'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource } = loadUserscript();
const { Cache, CreatorCatalogueSummary, Config } = api;
const json = (value) => JSON.parse(JSON.stringify(value));
const base = {
  key: 'creator|1', creatorKey: 'creator', id: '1', title: 'Post',
  scanSchemaVersion: Config.schemaVersion,
};

let post = Cache.mergePost(null, base);
assert.deepEqual(json(post.cacheSources), { scan:false, catalogue:true });

post = Cache.mergePost(
  { ...base, cacheSources:{ scan:true, catalogue:false }, legacyField:'preserved' },
  { ...base, title:'Catalogue title' },
);
assert.deepEqual(json(post.cacheSources), { scan:false, catalogue:true });
assert.equal(post.legacyField, 'preserved');
assert.equal(post.title, 'Catalogue title');

const usable = CreatorCatalogueSummary.cataloguePosts([
  post,
  { ...base, id:'2', scanSchemaVersion:Config.schemaVersion, cacheSources:{ scan:true, catalogue:false } },
  { ...base, id:'3', scanSchemaVersion:Config.schemaVersion - 1, cacheSources:{ scan:false, catalogue:true } },
]);
assert.deepEqual(json(usable.map((item) => item.id)), ['1']);

assert.match(Cache.getCreatorPosts.toString(), /cacheSources\?\.catalogue===true/);
assert.match(Cache.clearCreatorCatalogue.toString(), /transaction\(\['posts', 'creators'\], 'readwrite'\)/);
assert.match(Cache.clearAllCatalogues.toString(), /objectStore\('posts'\)\.clear\(\)/);
assert.doesNotMatch(originalSource, /sourceClearPost|sourceClearedMeta|sourceClearedUI|stripSource/);
assert.doesNotMatch(originalSource, /putPostsWithSource/);

console.log('Pawchive Media Filter Catalogue ownership tests passed.');
