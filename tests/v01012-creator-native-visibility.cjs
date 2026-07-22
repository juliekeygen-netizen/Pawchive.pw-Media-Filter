'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(async () => {
  const { api, context, originalSource, makeElement } = loadUserscript();
  const {
    Config,
    App,
    CompactGridScale,
    CreatorEarlyTakeover,
    PawchiveDOM,
  } = api;

  assert.equal(Config.version, '0.12.3');
  assert.match(originalSource, /\/\/ @version\s+0\.12\.3/);

  // An actually unscanned creator must never enter early takeover.
  App.context = { creatorKey:'pawchive.pw|patreon|unscanned' };
  App.catalog = new Map();
  assert.equal(CreatorEarlyTakeover.begin(App.context, { knownCatalogue:false }), null);

  // A known Catalogue may visually conceal native cards, but must leave them measurable.
  const nativeGrid = makeElement('div');
  nativeGrid.clientWidth = 960;
  const nativeParent = makeElement('main');
  nativeParent.clientWidth = 960;
  nativeGrid.parentElement = nativeParent;
  const originalFind = PawchiveDOM.find;
  context.location.href = 'https://pawchive.pw/patreon/user/known';
  context.location.hostname = 'pawchive.pw';
  PawchiveDOM.find = () => ({ grid:nativeGrid });
  const takeover = CreatorEarlyTakeover.begin({ creatorKey:'pawchive.pw|patreon|known' }, { knownCatalogue:true });
  assert.ok(takeover);
  assert.equal(nativeGrid.hidden, false);
  assert.equal(nativeGrid.style.getPropertyValue('visibility'), 'hidden');
  assert.notEqual(nativeGrid.style.getPropertyValue('display'), 'none');

  // Even if real native-card measurements are unavailable, compact layout gets safe non-zero geometry.
  App.context = { creatorKey:'pawchive.pw|patreon|known' };
  App.dom = { grid:nativeGrid, nativeCards:[] };
  const compactGrid = makeElement('div');
  compactGrid.parentElement = nativeParent;
  App.ui = { grid:compactGrid };
  CompactGridScale.disconnect();
  const layout = CompactGridScale.applyScale('big', { reason:'creator-rebind' });
  assert.ok(layout);
  assert.ok(layout.cardWidth > 0);
  assert.ok(layout.cardHeight > 0);
  assert.ok(layout.pageSize > 0);
  assert.equal(compactGrid.style.getPropertyValue('display'), 'flex');

  // Final PMF ownership removes only the temporary concealment and preserves final hidden state.
  nativeGrid.hidden = true;
  nativeGrid.style.setProperty('display', 'none', 'important');
  CreatorEarlyTakeover.cleanup({ restore:false });
  assert.equal(nativeGrid.hidden, true);
  assert.equal(nativeGrid.style.getPropertyValue('display'), 'none');
  assert.equal(nativeGrid.style.getPropertyValue('visibility'), '');
  assert.equal(nativeGrid.dataset.pmfEarlyConcealed, undefined);

  PawchiveDOM.find = originalFind;
  console.log('Pawchive Media Filter v0.11.3 creator native-visibility regression tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
