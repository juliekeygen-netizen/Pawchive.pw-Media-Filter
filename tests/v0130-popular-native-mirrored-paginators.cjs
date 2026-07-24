'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(() => {
  const { api, originalSource } = loadUserscript();
  const {
    App,
    Config,
    NativePaginatorMirror,
    PopularPageController,
  } = api;

  assert.equal(Config.version, '0.13.9');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.9/);

  const mountSource = PopularPageController.mountUI.toString();
  assert.match(mountSource, /nativeTopMirror/);
  assert.match(mountSource, /nativeBottomMirror/);
  assert.match(mountSource, /pmf-popular-native-paginator/);
  assert.ok(
    mountSource.indexOf("found.grid.insertAdjacentElement('beforebegin',root)")
      < mountSource.indexOf("found.grid.insertAdjacentElement('beforebegin',paginator)"),
    'The top PMF paginator must be mounted below the Native/Local toolbar and immediately above the cards',
  );
  assert.match(mountSource, /grid\.insertAdjacentElement\('afterend',paginatorBottom\)/,
    'The second PMF paginator remains immediately below the card grids');

  assert.match(NativePaginatorMirror.render.toString(), /countText=''/);
  assert.match(NativePaginatorMirror.render.toString(), /String\(countText\|\|nativeCount\?\.textContent/);

  const cards = Array.from({ length: 50 }, () => ({ isConnected: true }));
  App.totalPosts = 500;
  assert.equal(
    PopularPageController.nativeCountText({ nativeCards: cards, totalPosts: 500 }, { offset: 0 }),
    'Showing 1–50 of 500',
  );
  assert.equal(
    PopularPageController.nativeCountText({ nativeCards: cards, totalPosts: 500 }, { offset: 50 }),
    'Showing 51–100 of 500',
  );
  App.totalPosts = 467;
  assert.equal(
    PopularPageController.nativeCountText({ nativeCards: cards.slice(0, 17), totalPosts: 467 }, { offset: 450 }),
    'Showing 451–467 of 467',
  );

  const localParts = Array.from({ length: 5 }, () => ({ hidden: false }));
  const nativeParts = Array.from({ length: 2 }, () => ({ hidden: true }));
  App.ui = {
    statusFilters: localParts[0],
    filteredCount: localParts[1],
    filteredControls: localParts[2],
    filteredCountBottom: localParts[3],
    filteredControlsBottom: localParts[4],
    nativeTopMirror: nativeParts[0],
    nativeBottomMirror: nativeParts[1],
  };
  PopularPageController.setPaginatorMode('native');
  assert.equal(localParts.every((node) => node.hidden), true);
  assert.equal(nativeParts.every((node) => !node.hidden), true);
  PopularPageController.setPaginatorMode('local');
  assert.equal(localParts.every((node) => !node.hidden), true);
  assert.equal(nativeParts.every((node) => node.hidden), true);

  assert.match(PopularPageController.renderNativePaginators.toString(), /nativeTopMirror/);
  assert.match(PopularPageController.renderNativePaginators.toString(), /nativeBottomMirror/);
  assert.match(PopularPageController.renderNativePaginators.toString(), /omitFirstLast:true/);
  assert.match(PopularPageController.renderNativePaginators.toString(), /maxPageButtons:10/);
  assert.match(NativePaginatorMirror.items.toString(), /a\[href\]/);
  assert.equal(NativePaginatorMirror.displayLabel('previous', '<'), '‹');
  assert.equal(NativePaginatorMirror.displayLabel('next', '>'), '›');
  assert.match(PopularPageController.renderNativePaginators.toString(), /countText:PopularPageController\.nativeCountText/);
  assert.match(PopularPageController.renderNative.toString(), /setPaginatorMode\('native'\)/);
  assert.match(PopularPageController.renderNative.toString(), /renderNativePaginators/);
  assert.match(PopularPageController.renderLocal.toString(), /setPaginatorMode\('local'\)/);
  assert.match(PopularPageController.bind.toString(), /data-native-paginator-index/);
  assert.match(PopularPageController.bind.toString(), /navigateNativePage/);
  assert.match(PopularPageController.navigateNativePage.toString(), /NativePaginatorMirror\.activate/);

  const visibility = PopularPageController.applyNativeControlVisibility.toString();
  assert.match(visibility, /found\?\.paginators\|\|\[\]/);
  assert.match(visibility, /found\?\.countNodes\|\|\[\]/);
  assert.doesNotMatch(visibility, /showPaginators|placeNativeTopControls/);
  assert.doesNotMatch(originalSource, /placeNativeTopControls\(/);

  console.log('Pawchive Media Filter v0.13.9 mirrored Native Popular paginator tests passed.');
})();
