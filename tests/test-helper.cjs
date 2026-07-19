'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function makeClassList() {
  const values = new Set();
  return {
    add: (...items) => items.forEach((item) => values.add(item)),
    remove: (...items) => items.forEach((item) => values.delete(item)),
    contains: (item) => values.has(item),
    toggle: (item, force) => force === undefined
      ? (values.has(item) ? (values.delete(item), false) : (values.add(item), true))
      : (force ? (values.add(item), true) : (values.delete(item), false)),
  };
}

class TestDOMParser {
  parseFromString(html) {
    const anchors = [...String(html).matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]
      .map((match) => ({ getAttribute: () => match[1] }));
    return {
      querySelector(selector) { const match=selector==='p.post__missing-stats'&&String(html).match(/<p[^>]*class=["'][^"']*post__missing-stats[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);return match?{textContent:match[1].replace(/<[^>]+>/g,' ')}:null; },
      querySelectorAll: () => anchors,
      body: { textContent: String(html).replace(/<[^>]+>/g, ' ') },
    };
  }
}

function loadUserscript() {
  const userscriptPath = path.resolve(__dirname, '..', 'pawchive-pw-media-filter.user.js');
  const originalSource = fs.readFileSync(userscriptPath, 'utf8');
  const source = originalSource.replace(
    '  Lifecycle.start();',
    '  globalThis.__pmfTest = { Config, Util, SettingsEvents, Settings, Route, PawchiveData, MediaClassifier, ExternalLinkDetector, ProjectDetector, CatalogueMetadataPolicy, PostMissingStats, PostNormalizer, CatalogueOnlyMigration, Cache, CatalogueRequestScheduler, PostStatusEvents, PostStatus, FavoriteStateResolver, PostStatusFilters, FavoriteSyncCoordinator, PawchiveAPI, FilterEngine, PostSorter, FilterSummary, CatalogueModel, CreatorDirectory, CreatorState, CreatorStatusFilters, CreatorDirectoryMode, CreatorPresets, CreatorAggregateCondition, CreatorCustomRule, CreatorFilterEngine, CreatorSorter, CreatorCatalogueSummary, ArtistCatalogueAction, CreatorDisplayName, ArtistsDOM, CreatorArtworkFailureCache, CreatorCardReconstructor, CreatorGridGeometry, NativeArtistsVisibility, NativeArtistsProxy, AttachmentBadgeSizing, CreatorCardBadgeRenderer, CreatorCardRightRail, CatalogueRunner, CatalogueJobManager, Presets, OverlayManager, PawchiveDOM, BadgeRenderer, CompactGridScale, CompactThumbnailRatio, CompactLayoutEngine, CreatorSessionCache, PostStatusStateCoordinator, CardDimTreatment, SeenCardTreatment, HiddenCreatorTreatment, PostStatusBadgeRenderer, StatusBadgeRenderer, CardRenderer, Paginator, OperationIssues, MetadataDetailPool, MissingAttachmentMaintenance, Catalogue, BaseUI, UI, SettingsUI, CreatorQueuePanel, CreatorIndexUI, CreatorSettingsUI, CreatorFilterUI, CreatorSortUI, CreatorBulkSelection, NativeCreatorDirectorySource, CreatorProfileRepairManager, CreatorBulkUI, ArtistsPageController, App, NativeActionAlignment, PostPageController, CreatorActionController, CreatorPageController, isPmfOwnedNode, PmfDomMutationGuard, NativeStylesheetHealth, Lifecycle };',
  );
  const stored = new Map();
  let uuidCount = 0;
  const makeStyle = () => {
    const values = new Map();
    return {
      setProperty(name, value, priority = '') { values.set(name, { value:String(value), priority:String(priority) }); },
      getPropertyValue(name) { return values.get(name)?.value || ''; },
      getPropertyPriority(name) { return values.get(name)?.priority || ''; },
      removeProperty(name) { const value = values.get(name)?.value || ''; values.delete(name); return value; },
    };
  };
  const flattenChildren = (children) => children.flatMap((child) => child?.isDocumentFragment ? child.children : [child]);
  const makeElement = (tagName = 'div') => ({
    nodeType: 1,
    tagName: String(tagName).toUpperCase(),
    className: '',
    dataset: {},
    style: makeStyle(),
    classList: makeClassList(),
    children: [],
    hidden: false,
    isConnected: true,
    isDocumentFragment: String(tagName).toLowerCase() === 'fragment',
    clientWidth: 0,
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
    textContent: '',
    innerHTML: '',
    outerHTML: '',
    value: '',
    setAttribute(name, value) { this[name] = String(value); },
    getAttribute(name) { return this[name] ?? null; },
    removeAttribute(name) { delete this[name]; },
    append(...children) {
      const flattened = flattenChildren(children);
      flattened.forEach((child) => { if (child && typeof child === 'object') child.parentElement = this; });
      this.children.push(...flattened);
    },
    appendChild(child) {
      this.append(child);
      return child;
    },
    replaceChildren(...children) {
      const flattened = flattenChildren(children);
      flattened.forEach((child) => { if (child && typeof child === 'object') child.parentElement = this; });
      this.children = flattened;
    },
    insertAdjacentElement(position, child) { this.children.push(child); child.parentElement = this; return child; },
    insertAdjacentHTML() {},
    contains(child) { return this === child || this.children.includes(child); },
    matches() { return false; },
    closest() { return null; },
    getBoundingClientRect() { return { width:this.clientWidth, height:0, left:0, top:0, right:this.clientWidth, bottom:0 }; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    focus() {},
    remove() { this.isConnected = false; },
  });
  const context = {
    console, URL, Event, DOMException, AbortController, structuredClone, setTimeout, clearTimeout,
    queueMicrotask, setInterval, clearInterval,
    crypto: { randomUUID: () => `test-id-${++uuidCount}` },
    location: { href: 'https://pawchive.pw/artists', origin: 'https://pawchive.pw' },
    document: {
      addEventListener() {}, dispatchEvent() {}, activeElement: null,
      createElement: makeElement,
      createDocumentFragment() { return makeElement('fragment'); },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      documentElement: { classList: makeClassList() },
      head: makeElement('head'),
      styleSheets: [],
      visibilityState: 'visible',
      body: makeElement('body'),
    },
    window: { addEventListener() {}, scrollY: 0, scrollTo() {} },
    requestAnimationFrame: (callback) => { callback(); return 1; },
    DOMParser: TestDOMParser,
    GM_addStyle() {},
    GM_getValue: (key, fallback) => stored.has(key) ? stored.get(key) : fallback,
    GM_setValue: (key, value) => stored.set(key, value),
    GM_deleteValue: (key) => stored.delete(key),
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: userscriptPath });
  return { api: context.__pmfTest, context, stored, originalSource, makeClassList, makeElement };
}

module.exports = { loadUserscript, makeClassList };
