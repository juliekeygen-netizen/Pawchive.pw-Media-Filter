'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(() => {
  const { api, originalSource } = loadUserscript();
  const {
    Config,
    PopularDOM,
    PopularPageController,
    QueuePanelView,
    PopularQueuePanel,
    CreatorQueuePanel,
    PopularCardDecorator,
    PopularScanner,
  } = api;

  assert.equal(Config.version, '0.13.9');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.9/);

  assert.equal(
    PopularPageController.routeDateEvidence({
      periodLinks: [],
      heading: { textContent: 'Popular Posts For The Past 24 Hours' },
    }, { period:'day' }),
    '',
    'The generic current-day heading must not be treated as evidence that an explicitly dated route is stale',
  );
  assert.equal(
    PopularPageController.routeDateEvidence({
      periodLinks: [],
      heading: { textContent: 'Popular Posts for June 9, 2026' },
    }, { period:'day' }),
    '2026-06-09',
  );
  assert.doesNotMatch(PopularPageController.waitForDOM.toString(), /found\.heading\)/,
    'A usable Popular grid/cards mount must not depend on a heading node being present');

  assert.match(PopularDOM.paginationGroupFor.toString(), /nav,menu,ul,ol/,
    'Native Popular pagination menus must be discovered even when Pawchive uses a bare MENU element');
  assert.match(PopularDOM.find.toString(), /paginatorCandidates\(document,\{main,grid\}\)/,
    'Paginator discovery must be constrained by the real Popular main/grid');

  const aggregate = PopularQueuePanel.aggregate({
    active:[{ status:'running' }],
    pending:[{ status:'queued' }, { status:'queued' }],
    recent:[{ status:'complete' }, { status:'failed' }, { status:'stopped' }],
  });
  assert.deepEqual({
    total:aggregate.total,
    active:aggregate.active,
    waiting:aggregate.waiting,
    finished:aggregate.finished,
    remaining:aggregate.remaining,
  }, { total:6, active:1, waiting:2, finished:3, remaining:3 });
  assert.match(QueuePanelView.render.toString(), /pmf-queue-tabs/);
  assert.match(QueuePanelView.render.toString(), /pmf-queue-progress/);
  assert.match(QueuePanelView.render.toString(), /data-queue-tab/);
  assert.match(PopularQueuePanel.render.toString(), /QueuePanelView\.render/);
  assert.match(CreatorQueuePanel.render.toString(), /QueuePanelView\.render/);
  assert.match(PopularQueuePanel.row.toString(), /pmf-queue-row/);
  assert.match(PopularPageController.mountUI.toString(), /pmf-creator-queue-panel pmf-popular-queue-panel/);
  assert.match(PopularPageController.bind.toString(), /ui\.queueButton\.addEventListener/);
  assert.match(PopularPageController.primaryAction.toString(), /PopularPageController\.setQueueOpen\(true\)/,
    'A successfully queued Popular action opens the shared queue panel');

  assert.match(PopularCardDecorator.normalizeFooter.toString(), /footer\.replaceChildren\(row\)/,
    'Local Popular cards rebuild the native footer instead of retaining native favorite-count text');
  assert.match(PopularCardDecorator.platformIcon.toString(), /small_icons/);
  assert.match(PopularCardDecorator.platformIcon.toString(), /fanbox/);
  assert.match(PopularCardDecorator.platformIcon.toString(), /patreon/);
  assert.match(PopularCardDecorator.apply.toString(), /StatusBadgeRenderer\.apply\(card,post\)/,
    'Status badges are explicitly re-applied after the Local Popular card is connected');
  assert.match(PopularCardDecorator.apply.toString(), /BadgeRenderer\.apply\(card,post\)/);
  assert.match(originalSource, /bottom:calc\(var\(--pmf-popular-footer-height/,
    'The rank/favorite chip sits above the footer backdrop');
  assert.match(originalSource, /\.pmf-popular-platform-icon\{position:absolute;left:4px;top:calc/);
  assert.doesNotMatch(originalSource, /pmf-popular-local-grid>\.post-card \.post-card__footer\{padding-bottom:21px/,
    'The old footer padding hack must not distort Local Popular cards');
  assert.doesNotMatch(originalSource, /pmf-popular-period-title|pmf-popular-period-card/,
    'The custom Popular period/date card must not exist');
  assert.match(originalSource, /\.pmf-popular-toolbar \.pmf-status\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(originalSource, /\.pmf-popular-toolbar \.pmf-status-left\{display:none!important/);
  assert.match(originalSource, /\.pmf-popular-local-grid \.post-card__footer\{text-align:left!important/);

  const marked = PopularScanner.markNoMissing({ id:'post' }, 1234);
  assert.equal(marked.missingStatsKnown, true);
  assert.equal(marked.hasMissingStats, false);
  assert.equal(marked.missingStatsSource, 'popular-page');
  assert.equal(marked.missingStatsObservedAt, 1234);

  console.log('Pawchive Media Filter v0.13.9 Popular queue, cards, paginator, and dated-mount tests passed.');
})();
