'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(() => {
  const { api, originalSource } = loadUserscript();
  const {
    Config,
    PopularNavigation,
    PopularDOM,
    PopularPageController,
    SettingsUI,
    Lifecycle,
  } = api;

  assert.equal(Config.version, '0.13.3');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.3/);

  assert.doesNotMatch(PopularNavigation.visit.toString(), /Turbo\.visit/,
    'Popular period navigation must use a full document navigation instead of Turbo');
  assert.match(PopularNavigation.visit.toString(), /GM_setValue\(Config\.popularModeKey,App\.popularMode\)/,
    'The selected Native or Local mode must be saved before native period navigation');
  assert.match(PopularNavigation.visit.toString(), /location\.assign/);

  const mountSource = PopularPageController.mount.toString();
  assert.ok(mountSource.indexOf('waitForDOM') < mountSource.indexOf('PopularPageController.cleanup()'),
    'The existing Popular UI must remain mounted until the replacement native DOM is ready');
  assert.match(PopularPageController.waitForDOM.toString(), /observedDate!==page\.date/,
    'A new route must not bind stale cards from the previous period');
  assert.match(Lifecycle.performEnsureMounted.toString(), /page\.kind==='popular'.*await PopularPageController\.mount/s);

  const mountUi = PopularPageController.mountUI.toString();
  assert.match(mountUi, /pmf-toolbar pmf-creator-index-toolbar pmf-popular-toolbar/);
  assert.match(mountUi, /data-popular-primary/);
  assert.match(mountUi, /data-popular-settings/);
  assert.doesNotMatch(mountUi, /pmf-popular-period|periodNavMarkup/,
    'The custom date and period card must not be mounted');
  assert.match(mountUi, /pmf-popular-native-paginator/,
    'The PMF paginator hosts include Native-mode mirror containers');

  const bindSource = PopularPageController.bind.toString();
  assert.match(bindSource, /App\.dom\?\.periodLinks/,
    'Native Pawchive period links are the navigation source');
  assert.match(bindSource, /popular-native-period/);
  assert.match(bindSource, /data-native-paginator-index/);
  assert.match(bindSource, /navigateNativePage/);

  assert.match(PopularDOM.find.toString(), /countNodes=PopularDOM\.countCandidates/);
  assert.match(PopularPageController.saveNative.toString(), /counts:/);
  assert.match(PopularPageController.restoreNative.toString(), /nativeSnapshot\?\.counts/);
  assert.match(PopularPageController.applyNativeControlVisibility.toString(), /navContainers/);
  assert.match(PopularPageController.applyNativeControlVisibility.toString(), /setVisible\(node,true\)/,
    'Native Day, Week, and Month controls stay visible in both modes');
  assert.match(PopularPageController.renderNative.toString(), /setPaginatorMode\('native'\)/);
  assert.match(PopularPageController.renderNative.toString(), /renderNativePaginators/);
  assert.match(PopularPageController.renderLocal.toString(), /setPaginatorMode\('local'\)/,
    'Local mode restores the filtered paginator while retaining native period navigation');
  assert.match(PopularPageController.renderLocal.toString(), /paginator\.hidden=false/);

  assert.match(PopularPageController.load.toString(), /\['native','local'\]\.includes\(globalMode\)\?globalMode/,
    'The global selected mode wins over stale per-period saved state');
  assert.match(PopularPageController.renderNative.toString(), /Native Popular Posts · Pawchive controls/);
  assert.match(PopularPageController.renderLocal.toString(), /Local Popular Posts · \$\{App\.popularEntries\.size\} stored/);
  assert.doesNotMatch(PopularPageController.renderLocal.toString(), /Local Popular posts/);
  assert.match(SettingsUI.preview.toString(), /App\.pageKind==='popular'/);

  assert.doesNotMatch(originalSource, /\.pmf-popular-period\{|\.pmf-popular-period-links/);
  assert.match(originalSource, /pmf-popular-native-paginator/);

  console.log('Pawchive Media Filter v0.13.3 native Popular mirrored controls regression tests passed.');
})();
