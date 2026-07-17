'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api } = loadUserscript();
const { Settings, BadgeRenderer, FilterEngine, App } = api;
const json = (value) => JSON.parse(JSON.stringify(value));

App.filterState = FilterEngine.createDefaultState();
Object.keys(App.filterState.media.enabled).forEach((key) => { App.filterState.media.enabled[key] = false; });
Settings.value.catalogueBadges = {
  alwaysShow: true,
  types: { videos: true, images: true, archives: true, projectFiles: true, externalLinks: true },
};

assert.deepEqual(
  json([...BadgeRenderer.getVisibleCategories()].sort()),
  ['archives', 'externalLinks', 'images', 'projectFiles', 'videos'],
);

App.filterState.media.enabled.videos = true;
assert.equal([...BadgeRenderer.getVisibleCategories()].filter((item) => item === 'videos').length, 1);

const keywordOnly = {
  hasProjectFiles: true, projectFileCount: 0, projectExtensions: [],
  projectKeywordMatches: ['psd'], projectMatchSources: ['post-title'],
};
assert.equal(BadgeRenderer.create(keywordOnly, 'projectFiles', { allowKeywordProject: false }), null);
assert.ok(BadgeRenderer.create(keywordOnly, 'projectFiles', { allowKeywordProject: true }));

const attachmentProject = {
  hasProjectFiles: true, projectFileCount: 1, projectExtensions: ['psd'],
  projectKeywordMatches: [], projectMatchSources: ['attachment-extension'],
};
assert.ok(BadgeRenderer.create(attachmentProject, 'projectFiles', { allowKeywordProject: false }));

console.log('Pawchive Media Filter settings and badge tests passed.');
