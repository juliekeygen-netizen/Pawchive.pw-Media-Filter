'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource, stored } = loadUserscript();
const {
  Config, PostStatus, FavoriteStateResolver, PostStatusFilters,
  FilterEngine, Settings, Presets,
} = api;
const json = (value) => JSON.parse(JSON.stringify(value));

assert.equal(Config.version, '0.12.2');
assert.equal(Config.databaseVersion, 6);
assert.equal(Config.postStatusFiltersKey, 'pmf-post-status-filters-v1');
assert.match(originalSource, /favoriteSnapshotEntries/);
assert.match(originalSource, /favoriteSyncMeta/);
assert.doesNotMatch(originalSource, /maybeAutoSync\s*\(/);
assert.doesNotMatch(originalSource, /setTimeout\(\(\)=>FavoriteSyncCoordinator/);
assert.doesNotMatch(originalSource, /existing\.filter\(\(status\)=>status\.domain===domain&&status\.favorite\)/);
assert.doesNotMatch(originalSource, /row\('status-liked'/);

const base = PostStatus.normalize({
  key:'pawchive.pw|fanbox|creator|post',
  creatorKey:'pawchive.pw|fanbox|creator',
  postId:'post',
});
assert.equal(base.favoriteDirectValue, null);
assert.equal(FavoriteStateResolver.resolve({postStatus:base}), null);

const snapshotMeta = { complete:true, completedAt:200 };
const membership = new Set([base.key]);
assert.equal(FavoriteStateResolver.resolve({postStatus:base,snapshotMeta,snapshotMembership:membership}), true);
assert.equal(FavoriteStateResolver.resolve({postStatus:base,snapshotMeta,snapshotMembership:new Set()}), false);
assert.equal(FavoriteStateResolver.resolve({
  postStatus:{...base,favoriteDirectValue:false,favoriteDirectObservedAt:300},
  snapshotMeta,snapshotMembership:membership,
}), false);
assert.equal(FavoriteStateResolver.resolve({
  postStatus:{...base,favoritePartialPositiveAt:300},
  snapshotMeta,snapshotMembership:new Set(),
}), true);

PostStatusFilters.load();
assert.deepEqual(json(PostStatusFilters.value), {favorite:'off',liked:'off',seen:'off'});
assert.equal(stored.has(Config.postStatusFiltersKey), true);
PostStatusFilters.cycle('favorite');
assert.equal(PostStatusFilters.value.favorite, 'match');
PostStatusFilters.cycle('favorite');
assert.equal(PostStatusFilters.value.favorite, 'no-match');
PostStatusFilters.cycle('favorite');
assert.equal(PostStatusFilters.value.favorite, 'off');

assert.equal(FilterEngine.statusPredicate({...base,resolvedFavorite:null},{favorite:'match',liked:'off',seen:'off'}),false);
assert.equal(FilterEngine.statusPredicate({...base,resolvedFavorite:null},{favorite:'no-match',liked:'off',seen:'off'}),false);
assert.equal(FilterEngine.statusPredicate({...base,resolvedFavorite:false},{favorite:'no-match',liked:'off',seen:'off'}),true);
assert.equal(FilterEngine.statusPredicate({...base,liked:false},{favorite:'off',liked:'no-match',seen:'off'}),true);

const legacyFilter = FilterEngine.normalizeState({status:{favorite:true,liked:true}});
assert.equal(legacyFilter.status, undefined);
const legacyPreset = Presets.snapshot({...legacyFilter,status:{liked:true}});
assert.equal(legacyPreset.status, undefined);

const normalizedSettings = Settings.normalize({});
assert.equal(normalizedSettings.postStatusBadgeSize, 'small');
assert.deepEqual(json(normalizedSettings.postStatusBadges), {
  enabled:true,
  types:{favorited:true,liked:true,seen:true},
});
assert.equal(normalizedSettings.synchronizeNativeFavorites, true);

assert.match(originalSource, /Synchronize native favorites now/);
assert.match(originalSource, /Synchronize native favorites during Scan and Update/);
assert.match(originalSource, /Show status badges on post cards/);
assert.match(originalSource, /Show attachment badges on post cards/);
assert.match(originalSource, /pmf-card-statuses-\$\{/);
assert.match(originalSource, /--pmf-status-header-height/);
assert.match(originalSource, /\['favorite','liked','seen'\]/);
assert.match(originalSource, /aria-pressed',mode==='off'\?'false':mode==='match'\?'true':'mixed'/);

console.log('Pawchive Media Filter corrective status and Favorite sync tests passed.');
