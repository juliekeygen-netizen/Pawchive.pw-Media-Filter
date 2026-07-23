'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(() => {
  const { api, originalSource, makeElement } = loadUserscript();
  const {
    Config,
    PopularDatePicker,
    PopularDOM,
    PopularSorter,
    PopularPageController,
    CardRenderer,
    UI,
    App,
  } = api;

  assert.equal(Config.version, '0.13.7');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.7/);

  assert.equal(PopularDatePicker.label('day'), 'Day');
  assert.equal(PopularDatePicker.label('week'), 'Week');
  assert.match(PopularDatePicker.help('week'), /any day inside the week/i);
  assert.match(PopularDatePicker.open.toString(), /input type="date"/);
  assert.match(PopularDatePicker.open.toString(), /popular-custom-date/);
  assert.match(PopularDatePicker.open.toString(), /App\.popularMode==='aggregate'\?'native'/);
  assert.match(PopularPageController.bind.toString(), /contextmenu/);
  assert.match(PopularPageController.bind.toString(), /PopularDatePicker\.open/);
  assert.match(PopularPageController.stylePeriodLinks.toString(), /Right click for custom date/);

  const previous = makeElement('a');
  previous.textContent = '« prev';
  previous.href = 'https://pawchive.pw/posts/popular?date=2026-07-21&period=day';
  const day = makeElement('a');
  day.textContent = 'Day';
  day.href = 'https://pawchive.pw/posts/popular?date=2026-07-22&period=day';
  PopularPageController.stylePeriodLinks({ periodLinks:[previous, day] });
  assert.equal(previous.classList.contains('pmf-popular-period-nav-link'), true);
  assert.equal(day.dataset.pmfPeriodType, 'day');
  assert.equal(day.title, 'Right click for custom date');
  assert.match(originalSource, /\.pmf-popular-period-nav-link:visited/);
  assert.match(originalSource, /\.pmf-popular-period-nav-link:active/);

  assert.match(PopularPageController.mountUI.toString(), /pmf-popular-aggregate-picker/);
  assert.match(PopularPageController.syncAggregatePeriodControls.toString(), /setVisible\(container,!aggregate\)/);
  assert.match(PopularPageController.syncAggregatePeriodControls.toString(), /pmfAggregatePeriod===App\.popularAggregatePeriod/);
  assert.match(PopularPageController.renderLocal.toString(), /sortButton\.disabled=false/);
  assert.match(PopularPageController.renderLocal.toString(), /UI\.updateSortButton/);

  const posts = [
    { key:'a', id:'1', title:'Zulu', publishedAt:'2026-07-01T00:00:00Z' },
    { key:'b', id:'2', title:'Alpha', publishedAt:'2026-07-03T00:00:00Z' },
    { key:'c', id:'3', title:'Middle', publishedAt:'2026-07-02T00:00:00Z' },
  ];
  const entries = [
    { postKey:'a', displayedFavoriteCount:10, rank:3 },
    { postKey:'b', displayedFavoriteCount:30, rank:1 },
    { postKey:'c', displayedFavoriteCount:20, rank:2 },
  ];
  assert.equal(PopularSorter.sort(posts, entries, { mode:'popular', direction:'default' }).map((post)=>post.key).join(','), 'b,c,a');
  assert.equal(PopularSorter.sort(posts, entries, { mode:'popular', direction:'reverse' }).map((post)=>post.key).join(','), 'a,c,b');
  assert.equal(PopularSorter.sort(posts, entries, { mode:'published', direction:'default' }).map((post)=>post.key).join(','), 'b,c,a');
  assert.equal(PopularSorter.sort(posts, entries, { mode:'title', direction:'default' }).map((post)=>post.key).join(','), 'b,c,a');
  const reversedTitle=PopularSorter.nextSelection('title','default','title');assert.equal(reversedTitle.mode,'title');assert.equal(reversedTitle.direction,'reverse');
  assert.equal(PopularSorter.label('popular','default').title, 'Popular');

  App.pageKind = 'popular';
  App.sortMode = 'popular';
  App.sortDirection = 'default';
  App.ui = { sortButton: makeElement('button') };
  UI.updateSortButton();
  assert.match(App.ui.sortButton.innerHTML, /Sort: Popular/);
  assert.match(UI.toggleSortMenu.toString(), /\['popular','Popular'\]/);

  assert.match(CardRenderer.clone.toString(), /querySelectorAll\?\.\('source'\)/);
  assert.match(CardRenderer.clone.toString(), /removeAttribute\?\.\('src'\)/);
  assert.match(CardRenderer.clone.toString(), /image\.loading='eager'/);
  assert.match(CardRenderer.fallback.toString(), /loading="eager"/);

  assert.match(PopularDOM.loggedIn.toString(), /log\\s\*out/);
  assert.match(PopularDOM.restrictionNoticeCandidates.toString(), /only available to registered users/);
  assert.match(PopularPageController.applyNativeControlVisibility.toString(), /restrictionNotices/);
  assert.match(PopularPageController.saveNative.toString(), /notices:/);

  console.log('Pawchive Media Filter v0.13.7 Popular period, custom-date, sort, thumbnail, and notice tests passed.');
})();
