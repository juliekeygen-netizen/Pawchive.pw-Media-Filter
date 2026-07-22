'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(() => {
  const { api, originalSource } = loadUserscript();
  const { Config, PopularPageController, CompactLayoutEngine } = api;

  assert.equal(Config.version, '0.13.2');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.2/);

  const mountSource = PopularPageController.mount.toString();
  const mountUiSource = PopularPageController.mountUI.toString();
  const cleanupSource = PopularPageController.cleanup.toString();
  const connectSource = CompactLayoutEngine.connect.toString();

  assert.match(mountSource, /PopularPageController\.controller=controller;App\.pageController=controller/,
    'Popular mounts must publish their AbortController to shared App UI code before mounting the toolbar');
  assert.match(mountUiSource, /PopularPageController\.bind\(\)/,
    'Popular UI event and resize listeners are bound through the controller-owned AbortSignal');
  assert.match(PopularPageController.bind.toString(), /PopularPageController\.controller\.signal/);
  assert.match(cleanupSource, /if\(App\.pageController===controller\)App\.pageController=null/,
    'Popular cleanup must clear only the controller it owns');
  assert.match(connectSource, /LegacyCompactGridScale\.connect\(options\)/,
    'The compact layout facade must forward explicit connection options');
  assert.match(originalSource, /connect\(\{signal=App\.pageController\?\.signal\}=\{\}\)/,
    'The legacy layout owner must tolerate an absent shared page controller instead of dereferencing null');
  assert.doesNotMatch(originalSource, /\{signal:App\.pageController\.signal\}/,
    'No unguarded App.pageController.signal resize listener may remain');

  console.log('Pawchive Media Filter v0.13.2 Popular page-controller signal regression tests passed.');
})();
