'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, context, stored, originalSource } = loadUserscript();
const {
  Config, Settings, CreatorDirectoryMode, CreatorStatusFilters,
  CreatorCardRightRail, CreatorGridGeometry, NativeArtistsVisibility,
  NativeArtistsProxy, CreatorCardReconstructor, CreatorIndexUI,
} = api;

assert.equal(Config.version, '0.12.2');
assert.match(originalSource, /\/\/ @version\s+0\.12\.2/);
assert.equal(CreatorDirectoryMode.load(), 'native');
assert.equal(CreatorDirectoryMode.normalize('bad-value'), 'native');
assert.equal(CreatorDirectoryMode.save('catalogue'), 'catalogue');
assert.equal(stored.get(Config.creatorDirectoryModeKey), 'catalogue');
assert.equal(CreatorDirectoryMode.save('invalid'), 'native');

const normalizedSettings = Settings.normalize({
  creatorStatusBadges: {
    enabled: true,
    types: { favorited: true, liked: true, hidden: true, scanned: true },
  },
});
assert.deepEqual(Object.keys(normalizedSettings.creatorStatusBadges.types).sort(), ['favorited', 'hidden', 'liked']);
assert.deepEqual([...CreatorStatusFilters.fields], ['favorite', 'liked', 'hidden']);
assert.deepEqual([...CreatorCardRightRail.order], ['favorited', 'liked', 'hidden']);

const style = () => {
  const values = new Map();
  return {
    setProperty(name, value, priority = '') { values.set(name, { value:String(value), priority:String(priority) }); },
    getPropertyValue(name) { return values.get(name)?.value || ''; },
    getPropertyPriority(name) { return values.get(name)?.priority || ''; },
    removeProperty(name) { values.delete(name); },
  };
};
const element = (tag = 'div') => ({
  tagName: tag.toUpperCase(), hidden:false, isConnected:true, dataset:{}, style:style(),
  attributes:[], children:[], classList:{ add(){}, remove(){}, toggle(){} },
  setAttribute(name, value) { this[name] = String(value); },
  getAttribute(name) { return this[name] ?? null; },
  removeAttribute(name) { delete this[name]; },
  append(...nodes) { this.children.push(...nodes); },
  replaceChildren(...nodes) { this.children = nodes; },
  querySelector() { return null; }, querySelectorAll() { return []; },
  addEventListener() {}, dispatchEvent() { this.dispatched = (this.dispatched || 0) + 1; return true; },
  click() { this.clicked = (this.clicked || 0) + 1; },
  matches() { return false; }, closest() { return null; }, contains() { return false; },
  remove() { this.removed = true; },
});

const nativeCards = Array.from({ length:8 }, (_, index) => ({
  card: {
    getBoundingClientRect: () => ({
      left:(index % 4) * 248, width:240, height:128,
    }),
  },
}));
const originalCreatorCards = api.ArtistsDOM.creatorCards;
api.ArtistsDOM.creatorCards = () => nativeCards;
context.getComputedStyle = () => ({ columnGap:'8px', rowGap:'10px' });
const measured = CreatorGridGeometry.measure({
  getBoundingClientRect: () => ({ width:984 }),
});
assert.equal(measured.columnCount, 4);
assert.equal(measured.cardWidth, 240);
assert.equal(measured.cardHeight, 128);
assert.equal(measured.columnGap, 8);
assert.equal(measured.rowGap, 10);
const localGrid = element();
CreatorGridGeometry.apply(localGrid, measured);
assert.equal(localGrid.style.gridTemplateColumns, 'repeat(4,minmax(0,1fr))');
assert.equal(localGrid.style.getPropertyValue('--pmf-native-creator-card-height'), '128px');
api.ArtistsDOM.creatorCards = originalCreatorCards;

const nativeGrid = element();
const service = element('select');
const sort = element('select');
const direction = element('button');
const paginator = element();
const searchInput = element('input');
searchInput.placeholder = 'search for creators...';
const found = { grid:nativeGrid, serviceControl:service, sortControl:sort, directionControl:direction, paginators:[paginator], searchInput, searchForm:element('form') };
const snapshot = NativeArtistsVisibility.capture(found);
NativeArtistsVisibility.apply(snapshot, 'native', { proxiesReady:false });
assert.equal(nativeGrid.hidden, false);
assert.equal(direction.hidden, false);
NativeArtistsVisibility.apply(snapshot, 'native', { proxiesReady:true });
assert.equal(nativeGrid.hidden, false);
assert.equal(service.hidden, true);
assert.equal(sort.hidden, true);
assert.equal(direction.hidden, true);
assert.equal(paginator.hidden, true);
NativeArtistsVisibility.apply(snapshot, 'catalogue', { proxiesReady:true });
assert.equal(nativeGrid.hidden, true);
NativeArtistsVisibility.restore(snapshot);
assert.equal(nativeGrid.hidden, false);
assert.equal(service.hidden, false);
assert.equal(paginator.hidden, false);
assert.equal(searchInput.placeholder, 'search for creators...');

const option = (value, text, selected = false) => ({ value, textContent:text, selected });
service.options = [option('', 'Service'), option('fanbox', 'Pixiv Fanbox', true)];
service.value = 'fanbox';
sort.options = [option('favorited', 'Popularity'), option('name', 'Alphabetical Order', true)];
sort.value = 'name';
direction.value = 'asc';
direction.getAttribute = (name) => name === 'aria-label' ? 'Toggle sort direction' : null;
const proxyServiceLabel = element('span');
const proxySortLabel = element('span');
const proxySortDirection = element('span');
const proxyService = element('button');
proxyService.querySelector = () => proxyServiceLabel;
const proxySort = element('button');
proxySort.querySelector = (selector) => selector.includes('direction') ? proxySortDirection : proxySortLabel;
const proxyHost = {
  querySelector(selector) {
    return selector.includes('native-service') ? proxyService
      : selector.includes('native-sort') ? proxySort : null;
  },
};
assert.equal(NativeArtistsProxy.sync(found, proxyHost), true);
assert.equal(proxyServiceLabel.textContent, 'Pixiv Fanbox');
assert.equal(proxySortLabel.textContent, 'Sort: Alphabetical Order');
assert.equal(proxySortDirection.textContent, '▲');
assert.equal(NativeArtistsProxy.activate(found, 'service', 'fanbox'), true);
assert.equal(service.dispatched, 2);
assert.equal(NativeArtistsProxy.nextSort('name', 'asc', 'name').direction, 'desc');
assert.equal(NativeArtistsProxy.nextSort('favorited', 'desc', 'name').direction, 'desc');

const pageLink = element('a');
pageLink.dataset.value = '50';
paginator.querySelectorAll = (selector) => selector === 'a[data-value],button[data-value],li' ? [pageLink] : [];
assert.equal(NativeArtistsProxy.activatePage(found, 0), true);
assert.equal(pageLink.clicked, 1);

const paginatorItem = (tag, label, { current = false, disabled = false } = {}) => {
  const item = element(tag);
  item.textContent = label;
  item.dataset.value = label;
  item.matches = (selector) => (
    (selector.includes('a[data-value]') && tag === 'a')
    || (selector.includes('pagination-button-current') && current)
    || (selector.includes('pagination-button-disabled') && disabled)
    || (selector === 'li,.pagination-button-disabled' && (tag === 'li' || disabled))
  );
  return item;
};
const duplicateOneWrapper = paginatorItem('li', '1');
const duplicateOneAnchor = paginatorItem('a', '1');
const nextWrapper = paginatorItem('li', '>');
const nextAnchor = paginatorItem('a', '>');
const lastWrapper = paginatorItem('li', '>>');
const lastAnchor = paginatorItem('a', '>>');
paginator.querySelector = () => null;
paginator.querySelectorAll = (selector) => selector === 'a[data-value],button[data-value],li'
  ? [duplicateOneWrapper, duplicateOneAnchor, nextWrapper, nextAnchor, lastWrapper, lastAnchor]
  : [];
const mirrorHost = element();
assert.equal(NativeArtistsProxy.paginator(found, mirrorHost), true);
assert.deepEqual(mirrorHost.children[0].children.map((button) => button.textContent), ['1', '>', '>>']);
assert.deepEqual(mirrorHost.children[0].children.map((button) => button.dataset.nativePaginatorIndex), ['1', '3', '5']);

const scanned = { directory:{ creatorKey:'a', creatorName:'A', service:'fanbox', creatorId:'1' }, scanned:true, state:{} };
const unscanned = { directory:{ creatorKey:'b', creatorName:'B', service:'fanbox', creatorId:'2' }, scanned:false, state:{} };
CreatorIndexUI.mode = 'native';
CreatorIndexUI.nativeRecords = [scanned, unscanned];
CreatorIndexUI.nativeScannedFilter = 'off';
assert.deepEqual(CreatorIndexUI.filteredRecords().map((record) => record.directory.creatorKey), ['a', 'b']);
CreatorIndexUI.nativeScannedFilter = 'no-match';
assert.deepEqual(CreatorIndexUI.filteredRecords().map((record) => record.directory.creatorKey), ['b']);
CreatorIndexUI.nativeScannedFilter = CreatorIndexUI.nativeScannedFilter === 'no-match' ? 'off' : 'no-match';
assert.equal(CreatorIndexUI.nativeScannedFilter, 'off');
CreatorIndexUI.setRecords([scanned, unscanned], [scanned, unscanned]);
assert.deepEqual(CreatorIndexUI.records.map((record) => record.directory.creatorKey), ['a']);
assert.equal(CreatorIndexUI.pageSize, 50);

const staleChild = { attributes:[
  { name:'id' }, { name:'data-owner' }, { name:'onclick' }, { name:'hx-get' },
], removeAttribute(name) { this.attributes = this.attributes.filter((attribute) => attribute.name !== name); } };
const cloneRoot = {
  attributes:[{ name:'id' }, { name:'data-controller' }, { name:'onmouseover' }],
  classList:{ remove() {} },
  removeAttribute(name) { this.attributes = this.attributes.filter((attribute) => attribute.name !== name); },
  querySelectorAll(selector) { return selector === '*' ? [staleChild] : []; },
};
CreatorCardReconstructor.sanitize(cloneRoot);
assert.deepEqual(cloneRoot.attributes, []);
assert.deepEqual(staleChild.attributes, []);

const mountGrid = element();
mountGrid.getBoundingClientRect = () => ({ width:984 });
mountGrid.insertAdjacentElement = function (_position, node) { this.inserted = node; node.isConnected = true; };
const mountForm = element('form');
mountForm.insertAdjacentElement = function (_position, node) { this.inserted = node; };
const mountSearch = element('input');
mountSearch.placeholder = 'search for creators...';
mountSearch.form = mountForm;
const mountedFound = { main:element('main'), grid:mountGrid, searchInput:mountSearch, searchForm:mountForm, serviceControl:service, sortControl:sort, directionControl:direction, paginators:[paginator] };
CreatorIndexUI.mode = 'native';
CreatorIndexUI.mount(mountedFound);
assert.equal(CreatorIndexUI.nativeGrid, mountGrid);
assert.equal(mountGrid.hidden, false);
assert.equal(CreatorIndexUI.searchController, null);
const ownedRoot = CreatorIndexUI.root;
CreatorIndexUI.setMode('catalogue');
assert.equal(CreatorIndexUI.mode, 'catalogue');
assert.equal(CreatorIndexUI.root, ownedRoot);
assert.equal(mountGrid.hidden, true);
assert.ok(CreatorIndexUI.searchController);
CreatorIndexUI.setMode('native');
assert.equal(CreatorIndexUI.root, ownedRoot);
assert.equal(mountGrid.hidden, false);
assert.equal(CreatorIndexUI.searchController, null);
CreatorIndexUI.cleanup();
assert.equal(mountGrid.hidden, false);
assert.equal(service.hidden, false);
assert.equal(direction.hidden, false);
assert.equal(paginator.hidden, false);
assert.equal(mountSearch.placeholder, 'search for creators...');
assert.doesNotMatch(originalSource, /pmf-native-creator-card-height,104px|\|\|104/);

console.log('Pawchive Media Filter v0.10.3 creator directory mode behavior tests passed.');
