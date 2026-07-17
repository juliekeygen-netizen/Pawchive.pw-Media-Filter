'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, context, originalSource } = loadUserscript();
const { Route, PawchiveDOM, Lifecycle, App } = api;

(async () => {
  const creator = Route.parsePage('https://pawchive.pw/patreon/user/35150295').context;
  context.location.href = 'https://pawchive.pw/patreon/user/35150295';
  App.context = null;
  const grid4 = {isConnected:true};
  const dom4 = {
    grid:grid4,
    nativeCards:[
      {dataset:{id:'10'}},
      {dataset:{id:'9'}},
    ],
    topPaginator:{querySelectorAll(){return[];}},
  };
  PawchiveDOM.find = () => dom4;

  Lifecycle.routeGeneration=2;
  const generation2 = Lifecycle.waitForCreatorDOM(creator,{
    generation:2,
    signal:new AbortController().signal,
  }).then(() => 'resolved', (error) => error.name);

  Lifecycle.routeGeneration=4;
  const generation4 = Lifecycle.waitForCreatorDOM(creator,{
    generation:4,
    signal:new AbortController().signal,
  });

  assert.equal(await generation2, 'AbortError', 'delayed generation 2 cannot complete after generation 4 starts');
  const mounted = await generation4;
  assert.equal(mounted.dom.grid, grid4);
  assert.equal(mounted.signature.cardCount, 2);
  assert.equal(mounted.signature.firstCardId, '10');
  assert.equal(mounted.signature.lastCardId, '9');

  assert.match(Lifecycle.ensureMounted.toString(), /const generation=\+\+Lifecycle\.routeGeneration/);
  assert.match(Lifecycle.ensureMounted.toString(), /Lifecycle\.mountController\?\.abort\(\)/);
  assert.match(api.CreatorPageController.mount.toString(), /generation===Lifecycle\.routeGeneration/);
  assert.match(api.ArtistsPageController.mount.toString(), /routeGeneration===Lifecycle\.routeGeneration/);
  assert.doesNotMatch(api.App.renderCompact.toString(), /length\|\|pagePosts\.length/, 'zero rendered cards cannot be mistaken for a successful slice');
  assert.match(api.CreatorPageController.health.toString(), /actual===expected/);
  assert.match(originalSource, /operation:'route-transition'/);
  assert.match(originalSource, /operation:'creator-dom-bound'/);

  console.log('Pawchive Media Filter navigation generation tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
