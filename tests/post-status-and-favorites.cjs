'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, context } = loadUserscript();
const {
  Route, Cache, PostStatus, FavoriteStateResolver, PostStatusFilters,
  FilterEngine, FilterSummary, Presets, FavoriteSyncCoordinator, PostPageController,
} = api;
const json = (value) => JSON.parse(JSON.stringify(value));

(async () => {
  const post = Route.parsePostUrl('https://www.pawchive.pw/fanbox/user/123/post/456');
  assert.equal(post.postKey, 'www.pawchive.pw|fanbox|123|456');
  assert.equal(post.creatorKey, 'www.pawchive.pw|fanbox|123');
  assert.equal(Route.parsePage(post.postUrl).kind, 'post');

  const records = new Map();
  Cache.getPostStatus = async (key) => records.get(key) || null;
  Cache.putPostStatus = async (status) => { records.set(status.key, json(status)); return status; };
  let status = await PostStatus.toggle(post, 'liked');
  assert.equal(status.liked, true);
  assert.equal(status.seen, false);
  assert.equal(status.favoriteDirectValue, null);
  status = await PostStatus.toggle(post, 'seen');
  assert.equal(status.liked, true);
  assert.equal(status.seen, true);
  assert.ok(status.likedAt);
  assert.ok(status.seenAt);

  const filter = FilterEngine.createDefaultState();filter.media.enabled.videos = false;
  PostStatusFilters.save({liked:'match',seen:'off',favorite:'off'});
  assert.equal(FilterEngine.statusPredicate(status, PostStatusFilters.value), true);
  assert.equal(FilterEngine.statusPredicate({ ...status, liked:false }, PostStatusFilters.value), false);
  assert.deepEqual(json(FilterSummary.names(filter)), []);

  const snapshot = Presets.snapshot(filter);
  assert.equal(snapshot.status, undefined);
  assert.equal(Presets.apply({...snapshot,status:{liked:true}}).status, undefined);

  const directFalse=PostStatus.normalize({...post,favorite:false,favoriteAt:100,updatedAt:100,source:'native-post-page'});
  assert.equal(directFalse.favoriteDirectValue,false);
  const ambiguousFalse=PostStatus.normalize({...post,favorite:false,updatedAt:100,source:'native-favorites-sync'});
  assert.equal(ambiguousFalse.favoriteDirectValue,null);
  assert.equal(FavoriteStateResolver.resolve({postStatus:directFalse}),false);
  const snapshotMeta={complete:true,completedAt:200};
  assert.equal(FavoriteStateResolver.resolve({postKey:post.postKey,postStatus:directFalse,snapshotMeta,snapshotMembership:new Set([post.postKey])}),true);
  assert.equal(FavoriteStateResolver.resolve({postKey:post.postKey,postStatus:{...directFalse,favoriteDirectObservedAt:300},snapshotMeta,snapshotMembership:new Set([post.postKey])}),false);

  const postAnchor={getAttribute(){return'/fanbox/user/123/post/456';}};
  const html={querySelectorAll(selector){return selector.startsWith('article.post-card')?[{dataset:{},querySelectorAll(){return[postAnchor];}}]:[];}};
  const contexts = FavoriteSyncCoordinator.postContexts(html);
  assert.equal(contexts.get('pawchive.pw|fanbox|123|456').postId, '456');
  const nextDoc={querySelectorAll(){return[{textContent:'Next',rel:'next',getAttribute(){return'/account/favorites?o=50';}}];}};
  assert.equal(FavoriteSyncCoordinator.pageLinks(nextDoc,'https://pawchive.pw/account/favorites?o=0'),'https://pawchive.pw/account/favorites?o=50');

  const favoriteNode = (text, pressed = null) => ({
    textContent:text,
    value:'',
    title:'',
    getAttribute(name){ return name === 'aria-pressed' ? pressed : ''; },
    classList:{contains(){return false;}},
  });
  assert.equal(PostPageController.favoriteState(favoriteNode('★ Favorite')), false);
  assert.equal(PostPageController.favoriteState(favoriteNode('★ Unfavorite')), true);
  assert.equal(PostPageController.favoriteState(favoriteNode('', 'true')), true);

  console.log('Pawchive Media Filter post status and native Favorites tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
