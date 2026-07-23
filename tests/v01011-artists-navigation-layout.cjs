'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(async () => {
  const { api, context, originalSource, makeElement } = loadUserscript();
  const {
    Config,
    CreatorGridGeometry,
    CreatorIndexUI,
    NativePaginatorMirror,
    NativeArtistsPageCoordinator,
    PawchiveDOM,
    CreatorEarlyTakeover,
    Lifecycle,
  } = api;

  assert.equal(Config.version, '0.13.7');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.7/);

  // Local grid visibility must be authoritative even against display:grid!important.
  const localGrid = makeElement('section');
  CreatorIndexUI.grid = localGrid;
  CreatorIndexUI.setLocalGridVisible(false);
  assert.equal(localGrid.hidden, true);
  assert.equal(localGrid.getAttribute('aria-hidden'), 'true');
  assert.equal(localGrid.style.getPropertyValue('display'), 'none');
  assert.equal(localGrid.style.getPropertyPriority('display'), 'important');
  CreatorIndexUI.setLocalGridVisible(true);
  assert.equal(localGrid.hidden, false);
  assert.equal(localGrid.style.getPropertyValue('display'), '');
  assert.match(originalSource, /\.pmf-creator-index-grid\[hidden\]\{display:none!important\}/);

  // Wide desktops get a wider root and larger Local creator-card height without changing 1080p.
  const geometry = { columnCount:4, cardWidth:320, cardHeight:90, columnGap:8, rowGap:8 };
  context.innerWidth = 1920;
  CreatorGridGeometry.apply(localGrid, geometry);
  assert.equal(localGrid.style.getPropertyValue('--pmf-native-creator-card-height'), '90px');
  context.innerWidth = 2560;
  CreatorGridGeometry.apply(localGrid, geometry);
  assert.equal(localGrid.style.getPropertyValue('--pmf-native-creator-card-height'), '108px');
  assert.match(originalSource, /@media\(min-width:2200px\)\{#pmf-artists-root\{width:min\(1980px/);

  // Both native paginator mirrors share one pending navigation state.
  const topMirror = makeElement('div');
  const bottomMirror = makeElement('div');
  let topRenders = 0;
  let bottomRenders = 0;
  const topHost = { querySelector: () => topMirror };
  const bottomHost = { querySelector: () => bottomMirror };
  CreatorIndexUI.paginator = topHost;
  CreatorIndexUI.bottomPaginator = bottomHost;
  CreatorIndexUI.found = { paginators:[{}] };
  const originalItems = NativePaginatorMirror.items;
  const originalRender = NativePaginatorMirror.render;
  const originalActivate = NativePaginatorMirror.activate;
  const originalSchedule = Lifecycle.schedule;
  let current = false;
  NativePaginatorMirror.items = () => [{ index:4, label:'7', role:'page:7', disabled:false, current }];
  NativePaginatorMirror.render = (_native, host, options) => {
    if (host === topMirror) topRenders += 1;
    if (host === bottomMirror) bottomRenders += 1;
    host.options = options;
    return true;
  };
  NativePaginatorMirror.activate = () => true;
  Lifecycle.schedule = () => {};
  assert.equal(NativeArtistsPageCoordinator.navigate(CreatorIndexUI.found, 4), true);
  assert.equal(NativeArtistsPageCoordinator.pending.role, 'page:7');
  assert.equal(topMirror.options.pendingRole, 'page:7');
  assert.equal(bottomMirror.options.pendingRole, 'page:7');
  assert.equal(topMirror.options.navigationPending, true);
  assert.ok(topRenders >= 1 && bottomRenders >= 1);
  current = true;
  NativeArtistsPageCoordinator.reconcile(CreatorIndexUI.found);
  assert.equal(NativeArtistsPageCoordinator.pending, null);
  NativePaginatorMirror.items = originalItems;
  NativePaginatorMirror.render = originalRender;
  NativePaginatorMirror.activate = originalActivate;
  Lifecycle.schedule = originalSchedule;
  NativeArtistsPageCoordinator.reset();

  // Retained creator sessions conceal pixels without removing native layout geometry.
  const nativeGrid = makeElement('div');
  const originalFind = PawchiveDOM.find;
  context.location.href = 'https://pawchive.pw/patreon/user/123';
  context.location.hostname = 'pawchive.pw';
  PawchiveDOM.find = () => ({ grid:nativeGrid });
  const takeover = CreatorEarlyTakeover.begin({ creatorKey:'pawchive.pw|patreon|123' }, { knownCatalogue:true });
  assert.ok(takeover);
  assert.equal(nativeGrid.hidden, false);
  assert.equal(nativeGrid.style.getPropertyValue('display'), '');
  assert.equal(nativeGrid.style.getPropertyValue('visibility'), 'hidden');
  assert.equal(nativeGrid.style.getPropertyPriority('visibility'), 'important');
  assert.equal(nativeGrid.dataset.pmfEarlyConcealed, 'true');
  assert.equal(CreatorEarlyTakeover.active.shell?.id, 'pmf-creator-early-shell');
  CreatorEarlyTakeover.cleanup({ restore:true });
  assert.equal(nativeGrid.hidden, false);
  assert.equal(nativeGrid.style.getPropertyValue('visibility'), '');
  assert.equal(nativeGrid.dataset.pmfEarlyConcealed, undefined);
  PawchiveDOM.find = originalFind;

  // Native-grid replacement is watched from a stable parent and rebound before refresh work.
  assert.match(originalSource, /observeNativeRoot\(root=ArtistsPageController\.found\?\.main\)/);
  assert.match(originalSource, /ArtistsPageController\.observer\.observe\(root,\{childList:true,subtree:true\}\)/);
  assert.doesNotMatch(originalSource, /ArtistsPageController\.observer\.observe\(found\.grid/);
  assert.match(originalSource, /rebindNativeDom\(reason='native-rebind'\)/);
  assert.match(originalSource, /artists-native-dom-rebound/);

  // Bulk dialogs expose bounded previews without imposing Scan's 1,000 cap on Update/Resume.
  assert.match(originalSource, /const firstMaximum=kind==='build'\?' max="1000"':''/);
  assert.match(originalSource, /data-bulk-more hidden/);
  assert.match(originalSource, /…and \$\{remaining\.toLocaleString\(\)\} more/);
  assert.match(originalSource, /action==='resume'\?'Resume scan'/);

  console.log('Pawchive Media Filter v0.11.3 artists navigation and responsive layout tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
