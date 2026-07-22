'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource } = loadUserscript();
const { Route, Lifecycle, PostPageController, App } = api;

const creator = Route.parsePage('https://pawchive.pw/patreon/user/77');
const post = Route.parsePage('https://pawchive.pw/patreon/user/77/post/99');
assert.equal(Lifecycle.pageKey(creator), 'creator|pawchive.pw|patreon|77|0|');
assert.equal(Lifecycle.pageKey(post), 'post|pawchive.pw|patreon|77|99');
assert.match(Lifecycle.performEnsureMounted.toString(), /page\.kind==='post'/);
assert.match(Lifecycle.ensureMounted.toString(), /Lifecycle\.healthy/);
assert.match(Lifecycle.healthy.toString(), /PostPageController\.health/);
assert.match(Lifecycle.handlePageShow.toString(), /PostPageController\.cleanup/);
assert.match(PostPageController.mount.toString(), /generation!==Lifecycle\.routeGeneration/);
assert.match(PostPageController.mount.toString(), /PostStatus\.toggle/);
assert.match(PostPageController.mount.toString(), /native-favorite-click/);
assert.match(App.uiStateRecord.toString(), /filteredAnchorId/);
assert.match(App.restoreAnchorPage.toString(), /App\.filteredPageSize/);
assert.match(originalSource, /turbo:before-cache/);
assert.match(originalSource, /popstate/);
assert.match(originalSource, /pageshow/);

console.log('Pawchive Media Filter post navigation lifecycle tests passed.');
