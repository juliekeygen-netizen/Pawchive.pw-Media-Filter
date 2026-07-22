'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(() => {
  const { api, originalSource } = loadUserscript();
  const {
    Config,
    PopularNavigation,
    PopularNativePaginator,
    PopularPageController,
    SettingsUI,
    Lifecycle,
  } = api;

  assert.equal(Config.version, '0.12.7');
  assert.match(originalSource, /\/\/ @version\s+0\.12\.7/);

  const link = (href, text, rel = '') => ({
    href,
    textContent: text,
    getAttribute(name) {
      if (name === 'href') return href;
      if (name === 'rel') return rel;
      if (name === 'aria-label') return '';
      return null;
    },
  });

  const context = {
    domain: 'pawchive.pw',
    period: 'day',
    date: '2026-07-21',
    label: 'Jul 21, 2026 · Day',
  };
  const found = {
    periodLinks: [
      link('/posts/popular?date=2026-07-20&period=day', '« prev'),
      link('/posts/popular?date=2026-07-22&period=day', 'next »'),
      link('/posts/popular?date=2026-07-14&period=week', '« prev'),
      link('/posts/popular?date=2026-07-21&period=week', 'Week'),
      link('/posts/popular?date=2026-07-28&period=week', 'next »'),
      link('/posts/popular?date=2026-06-01&period=month', '« prev'),
      link('/posts/popular?date=2026-07-01&period=month', 'Month'),
      link('/posts/popular?date=2026-08-01&period=month', 'next »'),
    ],
  };

  const model = PopularPageController.periodNavigationModel(found, context);
  assert.deepEqual(Array.from(model, (item) => item.role), ['previous', 'day', 'week', 'month', 'next']);
  assert.match(model[0].href, /date=2026-07-20&period=day/,
    'Day navigation must use the Day previous link instead of a later Week/Month link');
  assert.match(model[4].href, /date=2026-07-22&period=day/,
    'Day navigation must use the Day next link instead of a later Week/Month link');
  assert.equal(model.find((item) => item.role === 'day').current, true);
  assert.equal(model.find((item) => item.role === 'week').current, false);

  const withoutNext = PopularPageController.periodNavigationModel({
    periodLinks: found.periodLinks.filter((item) => !/2026-07-22/.test(item.href)),
  }, context);
  assert.equal(withoutNext.at(-1).role, 'next');
  assert.equal(withoutNext.at(-1).disabled, true,
    'Unavailable next navigation remains visible as a disabled control');

  const markup = PopularPageController.periodNavMarkup({ periodLinks: [] }, context);
  assert.match(markup, /data-popular-period-role="previous"/);
  assert.match(markup, /data-popular-period-role="next"/);
  assert.match(markup, /disabled aria-disabled="true"/);

  assert.doesNotMatch(PopularNavigation.visit.toString(), /Turbo\.visit/,
    'Popular period navigation must use a full document navigation instead of Turbo');
  assert.match(PopularNavigation.visit.toString(), /location\.assign/);
  assert.match(PopularNativePaginator.navigate.toString(), /PopularNavigation\.visit/);

  const mountSource = PopularPageController.mount.toString();
  assert.ok(mountSource.indexOf('waitForDOM') < mountSource.indexOf('PopularPageController.cleanup()'),
    'The existing Popular UI must remain mounted until the replacement native DOM is ready');
  assert.match(PopularPageController.waitForDOM.toString(), /observedDate!==page\.date/,
    'A new route must not bind stale cards from the previous period');
  assert.match(Lifecycle.performEnsureMounted.toString(), /page\.kind==='popular'.*await PopularPageController\.mount/s);
  assert.doesNotMatch(
    Lifecycle.performEnsureMounted.toString().match(/if\(page\.kind==='popular'\)[\s\S]*?return;/)?.[0] || '',
    /PopularPageController\.cleanup\(\)|Lifecycle\.removeStaleRoots\(\)/,
    'Lifecycle must not tear down the old Popular root before the replacement route is ready',
  );

  const mountUi = PopularPageController.mountUI.toString();
  assert.match(mountUi, /pmf-toolbar pmf-creator-index-toolbar pmf-popular-toolbar/,
    'Popular uses the same toolbar width and control grid as the creator directory');
  assert.match(mountUi, /data-popular-primary/);
  assert.match(mountUi, /data-popular-settings/);
  assert.match(PopularPageController.bind.toString(), /ui\.scanButton\.addEventListener/);
  assert.match(PopularPageController.bind.toString(), /ui\.settingsButton\.addEventListener/);
  assert.doesNotMatch(PopularPageController.renderAction.toString(), /Scan in Native|nativeRequired/);
  assert.match(PopularPageController.renderNative.toString(), /Native Popular Posts · Pawchive controls/);
  assert.match(PopularPageController.renderLocal.toString(), /Local Popular Posts · \$\{App\.popularEntries\.size\} stored/);
  assert.match(SettingsUI.preview.toString(), /App\.pageKind==='popular'/,
    'Settings preview must use the Popular-owned local layout path');

  assert.match(originalSource, /\.pmf-popular-period\{width:max-content/);
  assert.match(originalSource, /\.pmf-popular-period-links button:disabled/);

  console.log('Pawchive Media Filter v0.12.6 Popular controls and navigation regression tests passed.');
})();
