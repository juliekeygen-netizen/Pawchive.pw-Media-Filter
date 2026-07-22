'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadUserscript } = require('./test-helper.cjs');

(async () => {
  const { api, context, originalSource, makeElement } = loadUserscript();
  const { Config, PopularDOM, Route } = api;

  assert.equal(Config.version, '0.12.9');
  assert.match(originalSource, /\/\/ @version\s+0\.12\.9/);

  const main = makeElement('main');
  const grid = makeElement('div');
  grid.className = 'card-list__items';
  grid.closest = (selector) => selector.includes('main') ? main : null;

  const card = makeElement('article');
  card.className = 'post-card';
  card.dataset = {};
  const anchor = {
    href: 'https://pawchive.pw/patreon/user/example/post/123',
    getAttribute: () => '/patreon/user/example/post/123',
  };
  card.querySelector = (selector) => selector.includes('a[href*="/post/"]') ? anchor : null;
  card.closest = () => null;
  grid.querySelectorAll = (selector) => selector.includes('.post-card') ? [card] : [];
  grid.querySelector = (selector) => selector.includes('.post-card') ? card : null;

  const heading = makeElement('h1');
  heading.textContent = 'Popular Posts For July 21, 2026';
  context.document.querySelectorAll = (selector) => {
    if (selector === '.card-list__items') return [grid];
    if (selector === '.paginator,[id^="paginator"]') return [];
    if (selector === 'h1,h2,h3') return [heading];
    if (selector === 'a[href*="/posts/popular"]') return [];
    if (selector === 'article.post-card,.post-card') return [card];
    return [];
  };
  context.document.querySelector = (selector) => {
    if (selector.includes('main')) return main;
    if (selector.includes('article.post-card')) return card;
    return null;
  };

  const found = PopularDOM.find(Route.parsePage('https://pawchive.pw/posts/popular'));
  assert.equal(found.main, main, 'plain main elements must be accepted');
  assert.equal(found.grid, grid);
  assert.equal(found.nativeCards.length, 1, 'cards with real post links must be accepted without data-id attributes');
  assert.equal(PopularDOM.postContext(card).postId, '123');
  assert.match(PopularDOM.find.toString(), /main,\[role=/);
  assert.match(PopularDOM.nativeCardCandidates.toString(), /postAnchorCandidates/);

  const runner = fs.readFileSync(path.resolve(__dirname, '..', 'tools', 'Start-PawchiveMetadataRunner.ps1'), 'utf8');
  const runnerReadme = fs.readFileSync(path.resolve(__dirname, '..', 'tools', 'README.md'), 'utf8');
  assert.match(runner, /ValidateSet\('Auto', 'Chrome', 'Edge', 'Brave'\)/);
  assert.match(runner, /BraveSoftware\\Brave-Browser/);
  assert.match(runner, /Process = 'brave'/);
  assert.match(runner, /\[Convert\]::ToUInt32\('80000000', 16\)/);
  assert.doesNotMatch(runner, /\[uint32\]0x80000000/);
  assert.match(runnerReadme, /-Browser Brave/);

  console.log('Pawchive Media Filter v0.12.5 Popular bootstrap and Brave runner tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
