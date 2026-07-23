'use strict';

const assert = require('node:assert/strict');
const { loadUserscript, makeClassList } = require('./test-helper.cjs');

const { api } = loadUserscript();
const { Config, Settings, SeenCardTreatment } = api;

assert.equal(Config.version, '0.13.5');

const classList = makeClassList();
const card = { classList };
const post = { id:'7' };
const seenStatus = { postId:'7', seen:true };

Settings.load();
assert.equal(Settings.value.seenCardTreatment.enabled, false);
assert.equal(Settings.value.seenCardTreatment.strength, 'medium');
SeenCardTreatment.apply(card, post, seenStatus);
assert.equal(classList.contains('pmf-seen-dimmed'), false, 'seen dim is off by default');

Settings.save({ seenCardTreatment:{ enabled:true, strength:'high' } });
SeenCardTreatment.apply(card, post, seenStatus);
assert.equal(classList.contains('pmf-seen-dimmed'), true);
assert.equal(classList.contains('pmf-seen-dim-high'), true);
assert.equal(classList.contains('pmf-seen-dim-medium'), false);

SeenCardTreatment.apply(card, post, { postId:'7', seen:false });
assert.equal(classList.contains('pmf-seen-dimmed'), false);
assert.equal(classList.contains('pmf-seen-dim-high'), false);

Settings.save({ seenCardTreatment:{ enabled:true, strength:'banana' } });
assert.equal(Settings.value.seenCardTreatment.strength, 'medium');
SeenCardTreatment.apply(card, post, seenStatus);
assert.equal(classList.contains('pmf-seen-dim-medium'), true);
SeenCardTreatment.cleanup(card);
assert.equal(classList.contains('pmf-seen-dimmed'), false);

console.log('Pawchive Media Filter v0.8.2 seen card treatment tests passed.');
