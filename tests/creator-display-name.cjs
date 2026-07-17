'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource } = loadUserscript();
const { CreatorDisplayName, ArtistsDOM } = api;
const context = {
  service:'patreon', creatorId:'2350', creatorKey:'pawchive.pw|patreon|2350',
};

assert.equal(
  CreatorDisplayName.cleanText('Patreon Nagoonimation 11379 favorites 2350', context),
  'Nagoonimation',
);
assert.equal(CreatorDisplayName.serviceLabel('fanbox'), 'Pixiv Fanbox');
assert.equal(CreatorDisplayName.serviceLabel('pixiv_fanbox'), 'Pixiv Fanbox');
assert.equal(CreatorDisplayName.format({creatorName:'Nagoonimation',service:'patreon'}), 'Nagoonimation (Patreon)');

const heading = {textContent:'Nagoonimation'};
const card = {
  querySelectorAll() { return [heading]; },
};
const link = {textContent:'Patreon Nagoonimation 11379 favorites 2350'};
const identity = CreatorDisplayName.fromCard(card, link, context);
assert.deepEqual(JSON.parse(JSON.stringify(identity)), {
  creatorName:'Nagoonimation',
  serviceLabel:'Patreon',
  displayName:'Nagoonimation (Patreon)',
});
assert.doesNotMatch(identity.displayName, /favorites|11379|2350|Patreon.*Patreon/);

const openAction = api.ArtistsPageController.openAction.toString();
assert.match(openAction, /title:`Scan \$\{name\}\?`/);
assert.match(openAction, /This will scan every post for this creator and store the available post metadata locally/);
assert.match(openAction, /if\(action==='update'\|\|!Settings\.value\.confirmCreatorCardScan\)\{start\(\);return;\}/);
assert.match(openAction, /queuedForCreator/);
assert.match(openAction, /confirmCreatorCardScan/);
assert.equal(ArtistsDOM.creatorCards({grid:null}).length, 0);

console.log('Pawchive Media Filter creator display-name and dialog tests passed.');
