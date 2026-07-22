'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource } = loadUserscript();
const { Config, DataPortabilityUI } = api;

(() => {
  assert.equal(Config.version, '0.12.8');
  assert.match(originalSource, /\/\/ @version\s+0\.12\.8/);

  const source = DataPortabilityUI.open.toString();
  assert.doesNotMatch(source, /pmf-settings-back/);
  assert.doesNotMatch(source, /data-transfer-action=[\"']choice[\"']/);
  assert.doesNotMatch(source, /if\(action===['\"]choice['\"]\)/);
  assert.match(source, /data-transfer-action=[\"']cancel[\"']>Cancel<\/button>/);
  assert.match(source, /data-transfer-action=[\"']import[\"'][^>]*>Import backup<\/button>/);

  console.log('Pawchive Media Filter v0.12.5 import-dialog action tests passed.');
})();
