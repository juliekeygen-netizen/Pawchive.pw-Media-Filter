'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(() => {
  const { api, originalSource, makeClassList } = loadUserscript();
  const {
    App,
    Config,
    PopularDOM,
    PopularNavigation,
    PopularJobManager,
    PopularPageController,
    PopularQueuePanel,
    CreatorQueuePanel,
    QueuePanelView,
  } = api;

  assert.equal(Config.version, '0.13.1');
  assert.doesNotMatch(originalSource, /pmf-popular-period-card|pmf-popular-period-title|data-popular-period-nav/,
    'PMF must not render a second period/date selector');
  assert.match(PopularPageController.mountUI.toString(), /pmf-popular-native-paginator/,
    'Native mode uses PMF-owned paginator mirrors rather than displaying Pawchive paginator nodes');
  assert.match(PopularDOM.find.toString(), /navContainers/);
  assert.match(PopularPageController.applyNativeControlVisibility.toString(), /setVisible\(node,true\)/,
    'Pawchive native period controls remain visible in both modes');
  assert.match(PopularPageController.renderNative.toString(), /renderNativePaginators/,
    'Native mode renders PMF paginator mirrors at both grid edges');
  assert.match(PopularPageController.applyNativeControlVisibility.toString(), /setVisible\(node,false\)/,
    'Original Pawchive paginator and count nodes are hidden in both modes');

  assert.match(PopularNavigation.visit.toString(), /GM_setValue\(Config\.popularModeKey,App\.popularMode\)/);
  assert.match(PopularPageController.load.toString(), /const globalMode=GM_getValue\(Config\.popularModeKey,'native'\)/,
    'Period navigation restores the selected Native/Local mode globally');
  assert.match(PopularPageController.bind.toString(), /popular-native-period/);

  const button = {
    disabled: false,
    textContent: '',
    classList: makeClassList(),
    setAttribute(name, value) { this[name] = String(value); },
  };
  App.ui = {
    scanButton: button,
    progress: { hidden: true },
    progressBar: { style: { width: '' } },
  };
  App.popularContext = { periodKey: 'pawchive.pw|popular|month|2026-07-01' };
  App.popularEntries = new Map();
  App.popularMeta = null;
  PopularJobManager.activeJob = null;
  PopularJobManager.pendingJobs = [];
  PopularJobManager.recentJobs.clear();

  App.popularMode = 'native';
  PopularPageController.renderAction();
  assert.equal(button.textContent, 'Scan');
  assert.equal(button.disabled, false);

  App.popularMeta = { storedEntryCount: 50, completedRunId: 'run-1' };
  PopularPageController.renderAction();
  assert.equal(button.textContent, 'Scanned');
  assert.equal(button.disabled, true);
  assert.equal(button.classList.contains('pmf-locked-control'), true);

  App.popularMode = 'local';
  PopularPageController.renderAction();
  assert.equal(button.textContent, 'Update');
  assert.equal(button.disabled, false);

  App.popularMeta = null;
  PopularPageController.renderAction();
  assert.equal(button.textContent, 'Update');
  assert.equal(button.disabled, true);
  assert.equal(button.classList.contains('pmf-locked-control'), true);

  PopularJobManager.activeJob = {
    periodKey: App.popularContext.periodKey,
    status: 'running',
    progress: { completed: 4, total: 10 },
  };
  App.popularMode = 'native';
  PopularPageController.renderAction();
  assert.equal(button.textContent, 'Scanned');
  assert.equal(button.disabled, true);
  assert.equal(App.ui.progress.hidden, false);

  App.popularMode = 'local';
  PopularPageController.renderAction();
  assert.equal(button.textContent, 'Update');
  assert.equal(button.disabled, true);
  PopularJobManager.activeJob = null;

  const primary = PopularPageController.primaryAction.toString();
  assert.match(primary, /paragraphs:\[`Period: \$\{context\.label\}`,`Posts: up to \$\{total\.toLocaleString\(\)\}`\]/);
  assert.doesNotMatch(primary, /Media files are not downloaded|missing attachments at this observation time/);

  assert.match(PopularQueuePanel.render.toString(), /QueuePanelView\.render/);
  assert.match(CreatorQueuePanel.render.toString(), /QueuePanelView\.render/);
  assert.match(QueuePanelView.render.toString(), /Overall batch progress/);
  assert.doesNotMatch(PopularQueuePanel.row.toString(), /Scan Popular Posts ·|Update Popular Posts ·/,
    'Popular queue rows use the same compact message layout as creator queue rows');

  assert.match(PopularPageController.renderLocal.toString(), /statusLeft\.hidden=true/);
  assert.match(PopularPageController.renderLocal.toString(), /statusLabel\.textContent=''/,
    'The redundant Local count is not rendered on the left side');
  assert.match(PopularPageController.renderLocal.toString(), /statusRight\.textContent=`Local Popular Posts · \$\{App\.popularEntries\.size} stored`/,
    'The single stored count remains on the right side');
  assert.match(originalSource, /\.pmf-popular-local-grid \.post-card__footer\{text-align:left!important/);

  console.log('Pawchive Media Filter v0.13.1 native period, mirrored pagination, action-state, queue reuse, and Local-card tests passed.');
})();
