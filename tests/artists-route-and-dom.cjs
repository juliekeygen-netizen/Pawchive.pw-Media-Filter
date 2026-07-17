'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api } = loadUserscript();
const { Route, ArtistsDOM } = api;

let page = Route.parsePage('https://pawchive.pw/patreon/user/123');
assert.equal(page.kind, 'creator');
assert.equal(page.context.service, 'patreon');
assert.equal(page.context.creatorId, '123');

page = Route.parsePage('https://pawchive.pw/artists');
assert.equal(page.kind, 'artists');

const filtered = Route.parsePage('https://pawchive.pw/artists?o=50&q=test&service=patreon&sort=popularity');
assert.equal(filtered.kind, 'artists');
assert.equal(filtered.offset, 50);
assert.equal(filtered.query, 'test');
assert.match(filtered.pageKey, /o=50/);
assert.match(filtered.pageKey, /service=patreon/);
assert.equal(Route.parsePage('https://pawchive.pw/posts').kind, 'other');
assert.equal(Route.parseCreatorUrl('/fanbox/user/abc').creatorKey, 'pawchive.pw|fanbox|abc');

function fixture(href, name) {
  const card = {
    querySelector() { return null; },
  };
  const link = {
    textContent:name,
    href:`https://pawchive.pw${href}`,
    getAttribute(attribute) { return attribute === 'href' ? href : null; },
    closest() { return card; },
  };
  return { card, link };
}

const one = fixture('/patreon/user/123', 'Maplestar');
const duplicate = {
  ...one.link,
  textContent:'Maplestar duplicate',
};
const two = fixture('/fanbox/user/abc', 'Creator B');
const invalid = fixture('/posts/123', 'Not a creator');
const grid = {
  querySelectorAll(selector) {
    return selector === 'a[href]' ? [one.link, duplicate, two.link, invalid.link] : [];
  },
  contains(node) {
    return [one.card, two.card, invalid.card].includes(node);
  },
};
const cards = ArtistsDOM.creatorCards({ grid });
assert.equal(cards.length, 2);
assert.equal(cards[0].creatorName, 'Maplestar');
assert.equal(cards[0].context.creatorKey, 'pawchive.pw|patreon|123');
assert.equal(cards[1].context.creatorId, 'abc');

console.log('Pawchive Media Filter artists route and DOM tests passed.');
