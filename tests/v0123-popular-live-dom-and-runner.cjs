'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadUserscript } = require('./test-helper.cjs');

(async () => {
  const { api, context, originalSource, makeElement } = loadUserscript();
  const { Config, PopularDOM, PopularPeriod, PostNormalizer, Route } = api;

  assert.equal(Config.version, '0.13.3');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.3/);

  const today = new Date().toISOString().slice(0, 10);
  assert.equal(
    PopularPeriod.dateFromHeading('Popular Posts For The Past 24 Hours'),
    today,
    'the current bare Popular route must resolve to a durable day key',
  );

  const main = makeElement('main');
  const grid = makeElement('section');
  const card = makeElement('div');
  const image = { src: 'https://cdn.example/thumb.jpg' };
  const anchor = makeElement('a');
  anchor.href = 'https://pawchive.pw/patreon/user/example/post/123';
  anchor.getAttribute = (name) => name === 'href' ? '/patreon/user/example/post/123' : null;
  anchor.matches = (selector) => selector === 'a[href]';
  anchor.closest = () => null;
  anchor.querySelectorAll = () => [];
  anchor.querySelector = () => null;
  anchor.textContent = 'Open post';

  card.textContent = 'Classless Popular card 2026-07-21 20:00:00 3 attachments 55 favorites';
  card.querySelectorAll = (selector) => selector === 'a[href]' ? [anchor] : [];
  card.querySelector = (selector) => {
    if (selector.includes('a[href*="/post/"]')) return anchor;
    if (selector.includes('img')) return image;
    if (selector.includes('footer')) return { textContent: card.textContent };
    if (selector.includes('header') || selector.includes('title')) return { textContent: 'Classless Popular card' };
    return null;
  };
  card.closest = (selector) => selector.includes('main') ? main : null;
  anchor.parentElement = card;
  card.parentElement = grid;
  grid.parentElement = main;
  grid.contains = (node) => node === card || node === anchor;
  grid.closest = (selector) => selector.includes('main') ? main : null;
  grid.querySelectorAll = (selector) => selector === 'a[href]' ? [anchor] : [];
  grid.querySelector = (selector) => selector.includes('a,button,li') ? anchor : null;
  main.querySelectorAll = (selector) => selector === 'a[href]' ? [anchor] : [];
  main.querySelector = () => null;

  const heading = makeElement('h1');
  heading.textContent = 'Popular Posts For The Past 24 Hours';
  heading.closest = (selector) => selector.includes('main') ? main : null;

  const dayLink = makeElement('a');
  dayLink.href = `https://pawchive.pw/posts/popular?date=${today}&period=day`;
  dayLink.textContent = 'Day';
  dayLink.getAttribute = (name) => name === 'href' ? `/posts/popular?date=${today}&period=day` : name === 'aria-current' ? 'page' : null;
  dayLink.closest = () => null;

  const paginator = makeElement('nav');
  paginator.textContent = 'Showing 1 - 50 of 500';
  paginator.querySelector = () => anchor;

  context.location.href = 'https://pawchive.pw/posts/popular';
  context.location.pathname = '/posts/popular';
  context.document.body.textContent = 'Showing 1 - 50 of 500';
  context.document.querySelectorAll = (selector) => {
    if (selector === 'h1,h2,h3') return [heading];
    if (selector === 'a[href]') return [anchor, dayLink];
    if (selector === 'article.post-card,.post-card,[data-id][data-service][data-user]') return [];
    if (selector === '.card-list__items,.card-list,[class*="card-list"],[data-post-grid],[data-posts]') return [];
    if (selector === '.paginator,[id^="paginator"],nav[aria-label*="page" i]') return [paginator];
    if (selector === 'a[href*="/posts/popular"][href*="o="]') return [];
    if (selector === 'a[href*="/posts/popular"]') return [dayLink];
    return [];
  };
  context.document.querySelector = (selector) => selector.includes('main') ? main : null;

  assert.equal(PopularDOM.cardForAnchor(anchor), card, 'post links must resolve to their visual card without CSS classes');
  const candidates = PopularDOM.nativeCardCandidates(context.document);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0], card);

  const page = Route.parsePage(context.location.href);
  const found = PopularDOM.find(page);
  assert.equal(found.grid, grid, 'the common card parent must become the native grid');
  assert.equal(found.nativeCards.length, 1);
  assert.equal(found.totalPosts, 500);
  const popularContext = PopularPeriod.fromPage(page, found);
  assert.equal(popularContext.date, today);
  assert.ok(popularContext.periodKey.endsWith(`|day|${today}`));

  const postContext = PopularDOM.postContext(card);
  assert.equal(postContext.postId, '123');
  const stub = PostNormalizer.fromNativeCard(card, postContext);
  assert.equal(stub.id, '123', 'native normalization must use the post URL when data-id is absent');
  assert.equal(stub.title, 'Classless Popular card');
  assert.equal(stub.attachmentCount, 3);

  const parsed = PopularDOM.parseDocument(context.document, popularContext, 0);
  assert.equal(parsed.cardCount, 1);
  assert.equal(parsed.items.length, 1, 'fetched Popular pages must use the generic post-link parser');
  assert.equal(parsed.items[0].entry.displayedFavoriteCount, 55);

  const runner = fs.readFileSync(path.resolve(__dirname, '..', 'tools', 'Start-PawchiveMetadataRunner.ps1'), 'utf8');
  assert.match(runner, /\$maintenanceProcesses\s*=\s*@\(Get-MaintenanceProcesses/);
  assert.match(runner, /return \$maintenanceProcesses\.Count -gt 0/);
  assert.doesNotMatch(runner, /return \(Get-MaintenanceProcesses[^\n]+\)\.Count/);
  assert.match(runner, /maintenance window opening briefly is expected/i);
  assert.match(runner, /--start-minimized/);

  console.log('Pawchive Media Filter v0.12.6 live Popular DOM and runner tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
