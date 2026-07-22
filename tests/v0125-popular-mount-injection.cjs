'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(() => {
  const { api, originalSource } = loadUserscript();
  const { Config, PopularPageController, CompactLayoutEngine } = api;

  assert.equal(Config.version, '0.12.6');
  assert.match(originalSource, /\/\/ @version\s+0\.12\.6/);

  const mountSource = PopularPageController.mount.toString();
  const mountUiSource = PopularPageController.mountUI.toString();
  const renderLocalSource = PopularPageController.renderLocal.toString();
  const cleanupSource = PopularPageController.cleanup.toString();
  const visibilitySource = PopularPageController.applyNativeControlVisibility.toString();
  const layoutSource = PopularPageController.applyLocalLayout.toString();
  const connectSource = CompactLayoutEngine.connect.toString();

  assert.match(mountSource, /PopularPageController\.controller=controller;App\.pageController=controller/,
    'Popular mounts must publish their controller before shared UI code can use it');
  assert.match(mountUiSource, /found\.grid\.insertAdjacentElement\('beforebegin',root\)/,
    'Popular UI must mount beside the stable native grid, matching the artists-page injection pattern');
  assert.doesNotMatch(mountUiSource, /navContainer\|\|found\.heading/,
    'Popular UI must not be anchored inside native period-navigation containers that PMF later hides');
  assert.doesNotMatch(mountUiSource, /CompactLayoutEngine\.connect/,
    'Popular mounting must not connect the creator-only compact-layout lifecycle');
  assert.doesNotMatch(renderLocalSource, /CompactLayoutEngine\.apply/,
    'Popular Local rendering must use its own grid geometry instead of creator-only layout state');
  assert.match(renderLocalSource, /PopularPageController\.applyLocalLayout\(\)/,
    'Popular Local rendering must apply the period grid layout');
  assert.match(layoutSource, /CompactGridScale\.setOwnedGridStyles\(grid,layout,base\)/,
    'Popular Local layout may reuse the pure sizing calculation after measuring the native Popular grid');
  assert.match(visibilitySource, /contains\?\.\(PopularPageController\.root\)/,
    'Native-control hiding must never hide a container that owns the mounted Popular root');
  assert.doesNotMatch(cleanupSource, /CompactLayoutEngine\.cleanup/,
    "Popular cleanup must not disconnect another route's creator-specific layout observer");
  assert.match(cleanupSource, /if\(App\.pageController===controller\)App\.pageController=null/,
    'Popular cleanup must clear only the controller it owns');
  assert.match(connectSource, /LegacyCompactGridScale\.connect\(options\)/,
    'The compact layout facade remains defensive for creator pages');
  assert.match(originalSource, /connect\(\{signal=App\.pageController\?\.signal\}=\{\}\)/,
    'Shared creator layout code must still tolerate an absent controller');

  console.log('Pawchive Media Filter v0.12.6 Popular mount injection regression tests passed.');
})();
