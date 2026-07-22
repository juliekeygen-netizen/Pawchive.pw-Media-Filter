'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource } = loadUserscript();
const { Config } = api;

assert.equal(Config.version, '0.12.5');

assert.match(originalSource, /--pmf-status-summary-gap:7px;gap:var\(--pmf-status-summary-gap\)!important/);
assert.match(originalSource, /\.pmf-page-controls\{gap:5px!important;min-height:27px!important\}/);
assert.match(originalSource, /\.pmf-quick-status-filters\{gap:6px!important;min-height:28px!important;margin:0!important\}/);
assert.match(originalSource, /\.pmf-quick-status-filters button\{width:30px!important;height:28px!important\}/);
assert.match(originalSource, /\.pmf-quick-status-filters \.pmf-quick-status-negate\{display:none;position:absolute;right:1px;top:1px;width:10px;height:10px;color:#fff/);
assert.match(originalSource, /\.pmf-quick-status-filters button\.pmf-no-match \.pmf-quick-status-negate\{display:grid\}/);

console.log('Pawchive Media Filter v0.8.2 status filter polish tests passed.');
