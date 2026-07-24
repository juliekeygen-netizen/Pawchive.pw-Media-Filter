'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(() => {
  const { api, originalSource } = loadUserscript();
  const { Config, CreatorFilterUI, CreatorCardReconstructor, UI } = api;
  assert.equal(Config.version, '0.13.9');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.9/);

  const buildTemplate = CreatorCardReconstructor.buildFromTemplate.toString();
  const buildFallback = CreatorCardReconstructor.build.toString();
  assert.match(buildTemplate, /linear-gradient\(rgba\(0,0,0,\.5\),rgba\(0,0,0,\.8\)\)/);
  assert.doesNotMatch(buildTemplate, /rgba\(67,70,74|rgba\(78,29,25/);
  assert.match(buildTemplate, /pmfCreatorServiceBadge=card\.dataset\.pmfCreatorService/);
  assert.match(buildFallback, /pmfCreatorServiceBadge=card\.dataset\.pmfCreatorService/);
  assert.doesNotMatch(originalSource, /pmf-catalogue-creator-card\[data-pmf-creator-service="fanbox"\][^{]*\{background-color/);
  assert.match(originalSource, /\[data-pmf-creator-service-badge="fanbox"\]\{background:#30343a!important/);

  const open = CreatorFilterUI.open.toString();
  assert.doesNotMatch(open, /configure-date|openPublishedDate\(opener\).*event\.target\.checked/);
  assert.match(open, /if\(toggle==='publishedDate'\)next\.publishedDate\.enabled=event\.target\.checked/);
  const general = open.indexOf('<div class="pmf-popover-section">General</div>');
  const videos = open.indexOf("row('videos','Videos')");
  const advanced = open.indexOf('<div class="pmf-popover-section">Advanced</div>');
  const custom = open.indexOf("row('customExtensions','Custom extensions')");
  const date = open.indexOf('data-creator-filter-toggle="publishedDate"');
  assert.ok(general >= 0 && general < videos && videos < advanced && advanced < custom && custom < date);
  assert.doesNotMatch(open, /<div class="pmf-popover-section">Media<\/div>/);

  const dateEditor = CreatorFilterUI.openPublishedDate.toString();
  assert.match(dateEditor, /dialog\('Date published'/);
  assert.doesNotMatch(dateEditor, /!from|!to|Choose a valid date condition/);
  assert.match(dateEditor, /operator==='between'&&from&&to&&Date\.parse\(to\)<Date\.parse\(from\)/);
  assert.match(dateEditor, /enabled:rule\.enabled/);

  const postFilter = UI.toggleFilterPopover.toString();
  const postEditor = UI.openFilterEditor.toString();
  assert.match(postFilter, /row\('publishedDate', 'Date published', true\)/);
  assert.match(postEditor, /editorShell\('Date published'/);
  assert.doesNotMatch(postFilter, /row\('publishedDate', 'Published date'/);

  assert.match(originalSource, /\.pmf-creator-filter-popover \ .pmf-filter-row|\.pmf-creator-filter-popover \.pmf-filter-row\{grid-template-columns:minmax\(0,1fr\) 42px/);
  assert.match(originalSource, /\.pmf-page-controls\{max-width:100%;flex-wrap:wrap/);
  assert.match(originalSource, /\.pmf-reconstructed-creator-content\{padding-left:86px;padding-right:48px\}/);

  console.log('Pawchive Media Filter v0.13.9 creator badge, date filter, ordering, labels, and mobile tests passed.');
})();
