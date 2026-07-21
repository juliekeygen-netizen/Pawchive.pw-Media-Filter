'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api } = loadUserscript();
const { Config, CreatorPageController, Lifecycle } = api;

assert.equal(Config.version, '0.12.1');

assert.match(CreatorPageController.cleanup.toString(), /retainSession&&App\.context/);
assert.match(CreatorPageController.cleanup.toString(), /App\.persistUIState\(\);App\.detachPage\(\);return/);
assert.match(Lifecycle.performEnsureMounted.toString(), /CreatorPageController\.cleanup\(\{retainSession:true\}\)/);
assert.match(Lifecycle.ensureMounted.toString(), /route-mount-reused/);
assert.match(Lifecycle.prepareSnapshot.toString(), /event\?\.persisted/);
assert.match(Lifecycle.prepareSnapshot.toString(), /event\?\.persisted\|\|reason==='turbo:before-cache'/);
assert.match(Lifecycle.handlePageShow.toString(), /CatalogueJobManager\.resumeFromBfcache\(\)/);
assert.match(Lifecycle.handlePageShow.toString(), /if\(healthy\)\{Lifecycle\.activePageKey=Lifecycle\.pageKey\(page\);Lifecycle\.mountedPageKey=Lifecycle\.activePageKey;return;\}/);

console.log('Pawchive Media Filter v0.8.2 lifecycle and BFCache tests passed.');
