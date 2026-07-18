// ==UserScript==
// @name         Pawchive.pw Media Filter
// @namespace    pawchive-pw-media-filter
// @version      0.10.4
// @description  Build a local creator catalogue and filter Pawchive posts by media type, metadata, date, and text.
// @homepageURL  https://github.com/juliekeygen-netizen/Pawchive.pw-Media-Filter
// @supportURL   https://github.com/juliekeygen-netizen/Pawchive.pw-Media-Filter/issues
// @downloadURL  https://raw.githubusercontent.com/juliekeygen-netizen/Pawchive.pw-Media-Filter/master/pawchive-pw-media-filter.user.js
// @updateURL    https://raw.githubusercontent.com/juliekeygen-netizen/Pawchive.pw-Media-Filter/master/pawchive-pw-media-filter.user.js
// @match        https://pawchive.pw/*
// @match        https://www.pawchive.pw/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @run-at       document-start
// ==/UserScript==
/* global globalThis */

(function () {
  'use strict';

  const INSTANCE_ID = globalThis.crypto?.randomUUID?.() || `pmf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const Config = Object.freeze({
    version: '0.10.4',
    schemaVersion: 2,
    pageSize: 50,
    filteredPageSize: 50,
    requestTimeoutMs: 20000,
    pageRequestSpacingMs: 250,
    retries: 3,
    retryDelays: [0, 2000, 5000],
    defaultRateLimitDelayMs: 15000,
    catalogueDetailConcurrency: 2,
    creatorListFields: ['id','user','service','title','shared_file','added','published','edited','file','attachments','tags','content'],
    settingsKey: 'pmf-settings-v5',
    settingsBackupKey: 'pmf-settings-backup-pre-schema-4',
    legacySettingsKey: 'pmf-settings-v4',
    oldestSettingsKey: 'pmf-settings-v3',
    ancientSettingsKey: 'pmf-settings-v2',
    presetsKey: 'pmf-presets-v1',
    presetSchemaVersion: 1,
    debugKey: 'pmf-debug-v1',
    catalogueOnlyMigrationKey: 'pmf-catalogue-only-migration-v1',
    databaseName: 'pawchive-media-filter',
    databaseVersion: 5,
    favoriteSyncKey: 'pmf-favorite-sync-v1',
    postStatusFiltersKey: 'pmf-post-status-filters-v1',
    creatorFilterStateKey: 'pmf-creator-filter-state-v1',
    creatorPresetsKey: 'pmf-creator-presets-v1',
    creatorStatusFiltersKey: 'pmf-creator-status-filters-v1',
    creatorDirectoryModeKey: 'pmf-creator-directory-mode-v1',
    creatorQueueSessionKey: 'pmf-creator-queue-session-v1',
    cardScaleMigrationKey: 'pmf-card-scale-v083-migrated',
    favoriteSnapshotFreshMs: 10 * 60 * 1000,
    allowedHosts: new Set(['pawchive.pw', 'www.pawchive.pw']),
    mediaCategories: [
      ['videos', 'Videos'], ['images', 'Images'], ['archives', 'Archives'],
      ['projectFiles', 'Project files'], ['externalLinks', 'External links'],
      ['customExtensions', 'Custom extensions'],
    ],
    baseExtensions: {
      video: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'mpg', 'mpeg', 'wmv', 'flv', 'ts', 'm2ts'],
      image: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp'],
      archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tar.gz', 'tar.bz2', 'tar.xz', 'tgz', 'tbz', 'tbz2', 'txz'],
      project: ['psd', 'psb', 'clip', 'sai', 'sai2', 'kra', 'xcf', 'procreate', 'afphoto', 'afdesign', 'ai', 'blend', 'max', 'ma', 'mb', 'c4d', 'ztl', 'zbp', 'sbs', 'sbsar', 'spp', 'fbx', 'obj', 'glb', 'gltf', 'dae', '3ds', 'aep', 'prproj', 'drp', 'veg'],
      audio: ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac', 'wma'],
    },
    likelyHosts: [
      'youtube.com', 'youtu.be', 'vimeo.com', 'mega.nz', 'drive.google.com',
      'dropbox.com', 'pixeldrain.com', 'pixeldrain.net', 'gofile.io',
      'mediafire.com', 'streamable.com', 'redgifs.com',
    ],
  });

  const ProjectKeywords = Object.freeze([
    'PSD', 'Photoshop', 'PSB', 'CLIP', 'Clip Studio', 'CSP', 'SAI', 'Krita',
    'source file', 'project file',
    'Blender', 'BLEND', 'Maya', 'C4D', 'Cinema 4D', 'ZBrush',
  ]);

  const DefaultSettings = Object.freeze({
    settingsSchemaVersion: 4,
    compactCardScale: 'big',
    compactThumbnailAspectRatio: '1-1',
    postAttachmentBadgeSize: 'small',
    creatorAttachmentBadgeSize: 'small',
    creatorCardBadgeCountMode: 'posts',
    excludePostsWithMissingAttachments: false,
    postStatusBadgeSize: 'small',
    confirmCreatorCardScan: true,
    catalogueConcurrentJobs: 1,
    concurrency: 5,
    retryFailed: true,
    videoExtensions: [...Config.baseExtensions.video],
    imageExtensions: [...Config.baseExtensions.image],
    archiveExtensions: [...Config.baseExtensions.archive],
    projectExtensions: [...Config.baseExtensions.project],
    projectKeywords: [...ProjectKeywords],
    projectEvidence: {
      attachmentFilenames: true, title: true, tags: true, content: true,
    },
    catalogueBadges: {
      alwaysShow: false,
      types: { videos: true, images: true, archives: true, projectFiles: true, externalLinks: true },
    },
    creatorCardBadges: {
      enabled: false,
      types: { videos: true, images: true, archives: false, projectFiles: false, externalLinks: false },
    },
    postStatusBadges: {
      enabled: true,
      types: { favorited: true, liked: true, seen: true },
    },
    seenCardTreatment: {
      enabled: false,
      strength: 'medium',
    },
    creatorStatusBadgeSize: 'small',
    creatorStatusBadges: {
      enabled: true,
      types: { favorited: true, liked: true, hidden: true },
    },
    hiddenCreatorTreatment: {
      enabled: false,
      strength: 'medium',
    },
    synchronizeNativeFavorites: true,
    knownHosts: [...Config.likelyHosts],
    externalLinkScope: 'media-download',
    legacyFilter: '',
  });

  const DefaultFilterState = Object.freeze({
    media: {
      enabled: { videos: true, images: false, archives: false, projectFiles: false, externalLinks: false, customExtensions: false },
      matchMode: 'all',
    },
    externalLinks: { scope: 'media-download' },
    customExtensions: { values: [] },
    customRules: { enabled: false, rows: [] },
    publishedDate: { enabled: false, mode: 'after', from: '', to: '', includeUnknown: false },
  });

  const Icons = Object.freeze({
    video: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>',
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m5 18 5-5 3 3 2-2 4 4"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>',
    archive: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6"/></svg>',
    project: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h9l5 5v13H5zM14 3v6h5M8 14h8M8 17h6"/></svg>',
    file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l5 5v13H6zM14 3v6h5"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2-4.5-4.4 6.3-.9Z"/></svg>',
    sync: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.1 8.2A7 7 0 0 1 18.7 7M17.9 15.8A7 7 0 0 1 5.3 17"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>',
  });

  const Util = {
    sleep(ms, signal) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        if (!signal) return;
        if (signal.aborted) {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      });
    },
    debounce(fn, delay = 200) {
      let timer;
      const wrapped = (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
      };
      wrapped.cancel = () => clearTimeout(timer);
      return wrapped;
    },
    clamp(value, min, max) { return Math.min(max, Math.max(min, value)); },
    relativeAnchorGeometry(triggerRect,rootRect,gap=4){return{left:Number(triggerRect?.left||0)-Number(rootRect?.left||0),top:Number(triggerRect?.bottom||0)-Number(rootRect?.top||0)+gap,width:Math.max(0,Number(triggerRect?.width)||0)};},
    escapeHtml(value) {
      return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
    },
    unique(values) { return [...new Set(values.filter(Boolean))]; },
    normalizeExtensions(input) {
      const source = Array.isArray(input) ? input : String(input ?? '').split(/[\s,]+/);
      const values = [];
      const invalid = [];
      for (const raw of source) {
        const value = String(raw ?? '').trim().replace(/^\.+/, '').toLowerCase();
        if (!value) continue;
        if (!/^[a-z0-9][a-z0-9.+_-]{0,31}$/i.test(value) || value.includes('..')) { invalid.push(String(raw).trim()); continue; }
        values.push(value);
      }
      return { values: Util.unique(values), invalid: Util.unique(invalid) };
    },
    clone(value) { return structuredClone(value); },
    plainText(html) {
      if (!html || typeof html !== 'string') return '';
      try { return new DOMParser().parseFromString(html, 'text/html').body?.textContent?.replace(/\s+/g, ' ').trim() || ''; }
      catch { return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
    },
    parseInteger(value, fallback) {
      const parsed = Number.parseInt(String(value), 10);
      return Number.isInteger(parsed) ? parsed : fallback;
    },
    formatDate(value) {
      if (!value) return '';
      const raw = String(value).replace('T', ' ');
      return raw.length >= 10 ? raw.slice(0, 10) : raw;
    },
    dispatch(name, detail) { document.dispatchEvent(new CustomEvent(`pmf:${name}`, { detail })); },
  };

  const Logger = {
    get debug() { return Boolean(GM_getValue(Config.debugKey, false)); },
    info(...args) { if (Logger.debug) console.info('[Pawchive Media Filter]', ...args); },
    warn(...args) { console.warn('[Pawchive Media Filter]', ...args); },
    error(...args) { console.error('[Pawchive Media Filter]', ...args); },
  };

  const SettingsEvents = {
    listeners:new Set(),
    subscribe(listener){SettingsEvents.listeners.add(listener);return()=>SettingsEvents.listeners.delete(listener);},
    emit(detail){SettingsEvents.listeners.forEach((listener)=>{try{listener(detail);}catch(error){Logger.warn('Settings subscriber failed.',error);}});},
  };

  const Settings = {
    value: Util.clone(DefaultSettings),
    initialized:false,
    schema:Object.freeze({
      version:4,
      sizeValues:Object.freeze(['small','medium','big']),
      legacySharedAttachmentSize:'attachmentBadgeSize',
      splitAttachmentSizes:Object.freeze(['postAttachmentBadgeSize','creatorAttachmentBadgeSize']),
    }),
    obsoleteKeys: new Set(['scanMode','range','customFrom','customTo','reuseCache','compactCardSize','displayMode','rememberFilters','rememberSearch','rememberFilteredPage']),
    migrate(raw) {
      const source=raw&&typeof raw==='object'?Util.clone(raw):{};
      const version=Number(source.settingsSchemaVersion)||1;
      if(version>=Settings.schema.version)return source;
      const next=Util.clone(source);
      if(version<2){
        const shared=Settings.schema.sizeValues.includes(source.attachmentBadgeSize)?source.attachmentBadgeSize:'small';
        if(!Settings.schema.sizeValues.includes(source.postAttachmentBadgeSize))next.postAttachmentBadgeSize=shared;
        if(!Settings.schema.sizeValues.includes(source.creatorAttachmentBadgeSize))next.creatorAttachmentBadgeSize=shared;
        delete next.attachmentBadgeSize;
        next.settingsSchemaVersion=2;
      }
      if(version<3){
        next.creatorStatusBadgeSize=Settings.schema.sizeValues.includes(source.creatorStatusBadgeSize)?source.creatorStatusBadgeSize:'small';
        next.creatorStatusBadges={
          ...DefaultSettings.creatorStatusBadges,
          ...(source.creatorStatusBadges||{}),
          types:{...DefaultSettings.creatorStatusBadges.types,...(source.creatorStatusBadges?.types||{})},
        };
        next.hiddenCreatorTreatment={
          enabled:source.hiddenCreatorTreatment?.enabled===true,
          strength:['low','medium','high'].includes(source.hiddenCreatorTreatment?.strength)?source.hiddenCreatorTreatment.strength:'medium',
        };
        next.settingsSchemaVersion=3;
      }
      if(version<4){
        next.creatorCardBadgeCountMode=['posts','attachments'].includes(source.creatorCardBadgeCountMode)
          ? source.creatorCardBadgeCountMode
          : 'posts';
        next.settingsSchemaVersion=4;
      }
      return next;
    },
    normalize(source = {}) {
      const safe = source && typeof source === 'object' ? source : {};
      const extensions = (value, fallback, allowEmpty = false) => {
        const result = Util.normalizeExtensions(value || fallback);
        return result.values.length || (allowEmpty && Array.isArray(value)) ? result.values : [...fallback];
      };
      const clean = Object.fromEntries(Object.entries(safe).filter(([key]) => !Settings.obsoleteKeys.has(key)));
      const output = {
        ...Util.clone(DefaultSettings),
        ...clean,
        videoExtensions: extensions(safe.videoExtensions, DefaultSettings.videoExtensions),
        imageExtensions: extensions(safe.imageExtensions, DefaultSettings.imageExtensions),
        archiveExtensions: extensions(safe.archiveExtensions, DefaultSettings.archiveExtensions),
        projectExtensions: extensions(safe.projectExtensions, DefaultSettings.projectExtensions, true),
        projectKeywords: Util.unique((safe.projectKeywords || DefaultSettings.projectKeywords).map((value) => String(value).trim()).filter(Boolean)),
        projectEvidence: {
          attachmentFilenames: safe.projectEvidence?.attachmentFilenames !== false,
          title: safe.projectEvidence?.title !== false,
          tags: safe.projectEvidence?.tags !== false,
          content: safe.projectEvidence?.content !== false,
        },
        catalogueBadges: {
          ...DefaultSettings.catalogueBadges,
          ...(safe.catalogueBadges || {}),
          types: { ...DefaultSettings.catalogueBadges.types, ...(safe.catalogueBadges?.types || {}) },
        },
        creatorCardBadges: {
          ...DefaultSettings.creatorCardBadges,
          ...(safe.creatorCardBadges || {}),
          types: { ...DefaultSettings.creatorCardBadges.types, ...(safe.creatorCardBadges?.types || {}) },
        },
        postStatusBadges: {
          ...DefaultSettings.postStatusBadges,
          ...(safe.postStatusBadges || {}),
          types: { ...DefaultSettings.postStatusBadges.types, ...(safe.postStatusBadges?.types || {}) },
        },
        seenCardTreatment: {
          ...DefaultSettings.seenCardTreatment,
          ...(safe.seenCardTreatment || {}),
        },
        creatorStatusBadges: {
          ...DefaultSettings.creatorStatusBadges,
          ...(safe.creatorStatusBadges || {}),
          types: { ...DefaultSettings.creatorStatusBadges.types, ...(safe.creatorStatusBadges?.types || {}) },
        },
        hiddenCreatorTreatment: {
          ...DefaultSettings.hiddenCreatorTreatment,
          ...(safe.hiddenCreatorTreatment || {}),
        },
        knownHosts: Util.unique((safe.knownHosts || DefaultSettings.knownHosts).map((value) => String(value).trim().toLowerCase()).filter(Boolean)),
      };
       const migratedScale={original:'big',small:'medium',compact:'small'}[safe.compactCardSize];
       const scaleMigrationComplete=Boolean(GM_getValue(Config.cardScaleMigrationKey,false));
       output.compactCardScale=scaleMigrationComplete
         ? (['big','medium','small'].includes(safe.compactCardScale)?safe.compactCardScale:migratedScale||'big')
         : 'big';
      output.compactThumbnailAspectRatio=safe.compactThumbnailAspectRatio==='native'
        ? '1-1'
        : ['16-9','4-3','1-1'].includes(safe.compactThumbnailAspectRatio)
          ? safe.compactThumbnailAspectRatio
          : '1-1';
      output.settingsSchemaVersion=Settings.schema.version;
      output.postAttachmentBadgeSize=Settings.schema.sizeValues.includes(safe.postAttachmentBadgeSize)
        ? safe.postAttachmentBadgeSize
        : 'small';
      output.creatorAttachmentBadgeSize=Settings.schema.sizeValues.includes(safe.creatorAttachmentBadgeSize)
        ? safe.creatorAttachmentBadgeSize
        : 'small';
      output.creatorCardBadgeCountMode=['posts','attachments'].includes(safe.creatorCardBadgeCountMode)
        ? safe.creatorCardBadgeCountMode
        : 'posts';
      output.excludePostsWithMissingAttachments=safe.excludePostsWithMissingAttachments===true;
      output.postStatusBadgeSize=['small','medium','big'].includes(safe.postStatusBadgeSize)
        ? safe.postStatusBadgeSize
        : 'small';
      output.creatorStatusBadgeSize=Settings.schema.sizeValues.includes(safe.creatorStatusBadgeSize)
        ? safe.creatorStatusBadgeSize
        : 'small';
      delete output.attachmentBadgeSize;
      output.seenCardTreatment={
        enabled:typeof output.seenCardTreatment?.enabled==='boolean'?output.seenCardTreatment.enabled:false,
        strength:['low','medium','high'].includes(output.seenCardTreatment?.strength)?output.seenCardTreatment.strength:'medium',
      };
      output.creatorStatusBadges={
        enabled:typeof output.creatorStatusBadges?.enabled==='boolean'?output.creatorStatusBadges.enabled:true,
        types:{...DefaultSettings.creatorStatusBadges.types,...(output.creatorStatusBadges?.types||{})},
      };
      delete output.creatorStatusBadges.types.scanned;
      output.hiddenCreatorTreatment={
        enabled:typeof output.hiddenCreatorTreatment?.enabled==='boolean'?output.hiddenCreatorTreatment.enabled:false,
        strength:['low','medium','high'].includes(output.hiddenCreatorTreatment?.strength)?output.hiddenCreatorTreatment.strength:'medium',
      };
      output.synchronizeNativeFavorites=typeof safe.synchronizeNativeFavorites==='boolean'
        ? safe.synchronizeNativeFavorites
        : true;
      output.confirmCreatorCardScan=typeof safe.confirmCreatorCardScan==='boolean' ? safe.confirmCreatorCardScan : true;
      output.catalogueConcurrentJobs=[1,2].includes(Number(safe.catalogueConcurrentJobs))?Number(safe.catalogueConcurrentJobs):1;
      output.concurrency=Util.clamp(Util.parseInteger(output.concurrency,5),1,10);
      Settings.obsoleteKeys.forEach((key)=>delete output[key]);
      return output;
    },
    load() {
      const current=GM_getValue(Config.settingsKey,null);
      const legacy=!current?GM_getValue(Config.legacySettingsKey,null):null;
      const oldest=!current&&!legacy?GM_getValue(Config.oldestSettingsKey,null):null;
      const ancient=!current&&!legacy&&!oldest?GM_getValue(Config.ancientSettingsKey,null):null;
      const prior=legacy||oldest||ancient;
      const raw=current&&typeof current==='object'
        ? current
        : prior&&typeof prior==='object'
          ? {...prior,legacyFilter:prior.filter||prior.legacyFilter||''}
          : {};
      let safe;
      try{
        if(raw&&typeof raw==='object'&&(Number(raw.settingsSchemaVersion)||1)<Settings.schema.version&&!GM_getValue(Config.settingsBackupKey,null))GM_setValue(Config.settingsBackupKey,Util.clone(raw));
        safe=Settings.migrate(raw);
        Settings.value=Settings.normalize(safe);
      }catch(error){
        Logger.error('Settings migration failed; the stored settings were left untouched.',error);
        Settings.value=Util.clone(DefaultSettings);
        Settings.initialized=true;
        return Settings.value;
      }
      if(!GM_getValue(Config.cardScaleMigrationKey,false))GM_setValue(Config.cardScaleMigrationKey,true);
      Settings.initialized=true;
      const serialized=JSON.stringify(Settings.value);
      if(!current||JSON.stringify(current)!==serialized)GM_setValue(Config.settingsKey,Settings.value);
      return Settings.value;
    },
    save(next) {
      const previous=Settings.value;
      Settings.value=Settings.normalize({
        ...Settings.value,
        ...next,
        projectEvidence:{...Settings.value.projectEvidence,...(next.projectEvidence||{})},
        catalogueBadges:{
          ...Settings.value.catalogueBadges,...(next.catalogueBadges||{}),
          types:{...Settings.value.catalogueBadges.types,...(next.catalogueBadges?.types||{})},
        },
        creatorCardBadges:{
          ...Settings.value.creatorCardBadges,...(next.creatorCardBadges||{}),
          types:{...Settings.value.creatorCardBadges.types,...(next.creatorCardBadges?.types||{})},
        },
        postStatusBadges:{
          ...Settings.value.postStatusBadges,...(next.postStatusBadges||{}),
          types:{...Settings.value.postStatusBadges.types,...(next.postStatusBadges?.types||{})},
        },
        seenCardTreatment:{...Settings.value.seenCardTreatment,...(next.seenCardTreatment||{})},
        creatorStatusBadges:{
          ...Settings.value.creatorStatusBadges,...(next.creatorStatusBadges||{}),
          types:{...Settings.value.creatorStatusBadges.types,...(next.creatorStatusBadges?.types||{})},
        },
        hiddenCreatorTreatment:{...Settings.value.hiddenCreatorTreatment,...(next.hiddenCreatorTreatment||{})},
      });
      GM_setValue(Config.settingsKey,Settings.value);
      if(typeof CatalogueJobManager!=='undefined')CatalogueJobManager.setConcurrency(Settings.value.catalogueConcurrentJobs);
      SettingsEvents.emit({previous,current:Settings.value,changed:Object.keys(Settings.value).filter((key)=>JSON.stringify(previous?.[key])!==JSON.stringify(Settings.value[key]))});
      return Settings.value;
    },
    reset() {
      Settings.value=Util.clone(DefaultSettings);
      if(typeof PostStatusFilters!=='undefined')PostStatusFilters.save({favorite:'off',liked:'off',seen:'off'});
      Settings.initialized=true;
      GM_setValue(Config.settingsKey,Settings.value);
      if(typeof CatalogueJobManager!=='undefined')CatalogueJobManager.setConcurrency(1);
      SettingsEvents.emit({previous:null,current:Settings.value,changed:Object.keys(Settings.value),reset:true});
      return Settings.value;
    },
  };

  const Route = {
    parseCreatorUrl(url = location.href) {
      let parsed;
      try { parsed = new URL(url, location.origin); } catch { return null; }
      if (!Config.allowedHosts.has(parsed.hostname.toLowerCase())) return null;
      const segments = parsed.pathname.split('/').filter(Boolean);
      const userIndex = segments.indexOf('user');
      if (userIndex !== 1 || segments.length !== 3 || !segments[userIndex + 1]) return null;
      const service = segments[0].toLowerCase();
      const creatorId = decodeURIComponent(segments[userIndex + 1]);
      if (!/^[a-z0-9_-]+$/i.test(service) || !/^[a-z0-9_-]+$/i.test(creatorId)) return null;
      const domain = parsed.hostname.toLowerCase();
      const creatorKey = `${domain}|${service}|${creatorId}`;
      return {
        domain,
        service,
        creatorId,
        creatorKey,
        creatorUrl: `${parsed.origin}/${encodeURIComponent(service)}/user/${encodeURIComponent(creatorId)}`,
      };
    },
    parsePage(url = location.href) {
      let parsed;
      try { parsed = new URL(url, location.origin); } catch { return { kind:'other' }; }
      if (!Config.allowedHosts.has(parsed.hostname.toLowerCase())) return { kind:'other' };
      const creator = Route.parseCreatorUrl(parsed.href);
      if (creator) {
        const offset = Math.max(0, Util.parseInteger(parsed.searchParams.get('o'), 0));
        const nativeQuery = parsed.searchParams.get('q') || '';
        const context = { ...creator, offset, nativeQuery, nativePageKey:`${creator.creatorKey}|${offset}|${nativeQuery}` };
        return { kind:'creator', context };
      }
      const segments=parsed.pathname.split('/').filter(Boolean);
      if(segments.length===5&&segments[1]==='user'&&segments[3]==='post'){
        const service=segments[0].toLowerCase();const creatorId=decodeURIComponent(segments[2]||'');const postId=decodeURIComponent(segments[4]||'');
        if(/^[a-z0-9_-]+$/i.test(service)&&/^[a-z0-9_-]+$/i.test(creatorId)&&postId){
          const domain=parsed.hostname.toLowerCase();const creatorKey=`${domain}|${service}|${creatorId}`;const postKey=`${creatorKey}|${postId}`;
          return {kind:'post',context:{domain,service,creatorId,creatorKey,postId,postKey,postUrl:parsed.href,creatorUrl:`${parsed.origin}/${encodeURIComponent(service)}/user/${encodeURIComponent(creatorId)}`}};
        }
      }
      if(segments.length===1&&segments[0].toLowerCase()==='artists'){
        const offset=Math.max(0,Util.parseInteger(parsed.searchParams.get('o'),0));const query=parsed.searchParams.get('q')||'';const service=parsed.searchParams.get('service')||'';const sort=parsed.searchParams.get('sort')||'';const order=parsed.searchParams.get('order')||'';
        const stable=[['o',String(offset)],['q',query],['service',service],['sort',sort],['order',order]].map(([key,value])=>`${key}=${encodeURIComponent(value)}`).join('&');
        return {kind:'artists',domain:parsed.hostname.toLowerCase(),offset,query,service,sort,order,pageKey:`${parsed.hostname.toLowerCase()}|artists|${stable}`};
      }
      return { kind:'other' };
    },
    parsePostUrl(url=location.href){const page=Route.parsePage(url);return page.kind==='post'?page.context:null;},
    parse(url = location.href) {
      const page=Route.parsePage(url);return page.kind==='creator'?page.context:null;
    },
  };

  const PawchiveData = {
    hasMeaningfulValue(value) {
      if (value == null) return false;
      if (typeof value === 'string') return Boolean(value.trim());
      if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
      if (typeof value === 'boolean') return value;
      if (Array.isArray(value)) return value.some(PawchiveData.hasMeaningfulValue);
      if (typeof value === 'object') return Object.values(value).some(PawchiveData.hasMeaningfulValue);
      return true;
    },
    fileNameFromPath(value) {
      const source = String(value || '').trim();
      if (!source) return '';
      try {
        const pathname = new URL(source, location.origin).pathname;
        return decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '');
      } catch {
        return source.split(/[?#]/, 1)[0].split(/[\\/]/).filter(Boolean).pop() || '';
      }
    },
    normalizeFileValue(value) {
      if (value == null) return { file:null, status:'absent', reason:'' };
      if (typeof value === 'string') {
        const path = value.trim();
        if (!path) return { file:null, status:'absent', reason:'' };
        return { file:{ path, name:PawchiveData.fileNameFromPath(path) }, status:'present', reason:'' };
      }
      if (typeof value !== 'object' || Array.isArray(value)) {
        return PawchiveData.hasMeaningfulValue(value)
          ? { file:null, status:'invalid', reason:'invalid-file-structure' }
          : { file:null, status:'absent', reason:'' };
      }
      const name = String(value.name ?? '').trim();
      const path = String(value.path ?? '').trim();
      const url = String(value.url ?? '').trim();
      const hasRecognizedField = ['name','path','url'].some((key) => Object.prototype.hasOwnProperty.call(value, key));
      if (name || path || url) {
        return {
          file: {
            ...value,
            ...(name ? { name } : (path || url ? { name:PawchiveData.fileNameFromPath(path || url) } : {})),
            ...(path ? { path } : {}),
            ...(url ? { url } : {}),
          },
          status:'present',
          reason:'',
        };
      }
      if (hasRecognizedField) return { file:null, status:'absent', reason:'' };
      return PawchiveData.hasMeaningfulValue(value)
        ? { file:null, status:'invalid', reason:'invalid-file-structure' }
        : { file:null, status:'absent', reason:'' };
    },
    normalizeAttachments(value, { provided = true } = {}) {
      if (!provided || value == null) return { files:[], status:'absent', reason:'', invalidCount:0 };
      if (!Array.isArray(value)) {
        return PawchiveData.hasMeaningfulValue(value)
          ? { files:[], status:'invalid', reason:'invalid-attachments-structure', invalidCount:1 }
          : { files:[], status:'absent', reason:'', invalidCount:0 };
      }
      const files = []; let invalidCount = 0;
      value.forEach((item) => {
        const normalized = PawchiveData.normalizeFileValue(item);
        if (normalized.status === 'present') files.push(normalized.file);
        else if (normalized.status === 'invalid') invalidCount += 1;
      });
      return {
        files,
        status: invalidCount ? 'invalid' : 'present',
        reason: invalidCount ? 'invalid-attachments-structure' : '',
        invalidCount,
      };
    },
    normalizeTags(value, { provided = true } = {}) {
      if (!provided || value == null) return { tags:[], status:'absent', reason:'' };
      if (Array.isArray(value)) {
        if (!value.length) return { tags:[], status:'present', reason:'' };
        const tags = []; let invalid = false;
        value.forEach((tag) => {
          const normalized = PawchiveData.normalizeTags(tag, { provided:true });
          tags.push(...normalized.tags);
          if (normalized.status === 'invalid') invalid = true;
        });
        return { tags:Util.unique(tags), status:invalid ? 'invalid' : 'present', reason:invalid ? 'invalid-tags-structure' : '' };
      }
      if (typeof value === 'string') {
        const tag = value.trim();
        return tag ? { tags:[tag], status:'present', reason:'' } : { tags:[], status:'absent', reason:'' };
      }
      if (typeof value === 'number' && Number.isFinite(value)) return { tags:[String(value)], status:'present', reason:'' };
      if (typeof value === 'object') {
        const tag = String(value.name ?? value.title ?? value.value ?? '').trim();
        if (tag) return { tags:[tag], status:'present', reason:'' };
        return PawchiveData.hasMeaningfulValue(value)
          ? { tags:[], status:'invalid', reason:'invalid-tags-structure' }
          : { tags:[], status:'absent', reason:'' };
      }
      return PawchiveData.hasMeaningfulValue(value)
        ? { tags:[], status:'invalid', reason:'invalid-tags-structure' }
        : { tags:[], status:'absent', reason:'' };
    },
    mergeDetailRaw(base, detail) {
      const prior=base&&typeof base==='object'?base:{};const incoming=detail&&typeof detail==='object'?detail:{};
      const merged={...prior,...incoming};
      const chooseFile=()=> {
        if(!Object.prototype.hasOwnProperty.call(incoming,'file'))return prior.file;
        const next=PawchiveData.normalizeFileValue(incoming.file);const old=PawchiveData.normalizeFileValue(prior.file);
        return next.status==='present'||old.status!=='present'?incoming.file:prior.file;
      };
      const chooseAttachments=()=> {
        if(!Object.prototype.hasOwnProperty.call(incoming,'attachments'))return prior.attachments;
        const next=PawchiveData.normalizeAttachments(incoming.attachments,{provided:true});const old=PawchiveData.normalizeAttachments(prior.attachments,{provided:Object.prototype.hasOwnProperty.call(prior,'attachments')});
        return next.status==='present'&&next.files.length>=old.files.length?incoming.attachments:old.status==='absent'?incoming.attachments:prior.attachments;
      };
      const chooseTags=()=> {
        if(!Object.prototype.hasOwnProperty.call(incoming,'tags'))return prior.tags;
        const next=PawchiveData.normalizeTags(incoming.tags,{provided:true});const old=PawchiveData.normalizeTags(prior.tags,{provided:Object.prototype.hasOwnProperty.call(prior,'tags')});
        return next.status==='present'&&next.tags.length>=old.tags.length?incoming.tags:old.status==='absent'?incoming.tags:prior.tags;
      };
      merged.file=chooseFile();merged.attachments=chooseAttachments();merged.tags=chooseTags();
      if(typeof prior.content==='string'&&prior.content.length>(typeof incoming.content==='string'?incoming.content.length:0))merged.content=prior.content;
      return merged;
    },
  };

  const MediaClassifier = {
    compoundExtensions: ['tar.gz', 'tar.bz2', 'tar.xz'],
    extension(file) {
      const candidates = [file?.name, file?.path, file?.url].filter(Boolean);
      for (const candidate of candidates) {
        let pathname = String(candidate).toLowerCase();
        try { pathname = new URL(pathname, location.origin).pathname.toLowerCase(); } catch { pathname = pathname.split(/[?#]/, 1)[0]; }
        const base = pathname.split('/').pop() || '';
        const compound = MediaClassifier.compoundExtensions.find((ext) => base.endsWith(`.${ext}`));
        if (compound) return compound;
        const match = base.match(/\.([a-z0-9]{1,8})$/i);
        if (match) return match[1].toLowerCase();
      }
      return '';
    },
    classify(file) {
      const ext = MediaClassifier.extension(file);
      if (!ext) return { ext, type: 'other' };
      if (Settings.value.videoExtensions.includes(ext)) return { ext, type: 'video' };
      if (Settings.value.imageExtensions.includes(ext)) return { ext, type: 'image' };
      if (Settings.value.archiveExtensions.includes(ext)) return { ext, type: 'archive' };
      if (Settings.value.projectExtensions.includes(ext)) return { ext, type: 'project' };
      if (Config.baseExtensions.audio.includes(ext)) return { ext, type: 'audio' };
      return { ext, type: 'other' };
    },
    key(file) {
      const path = String(file?.path || file?.url || '').trim().toLowerCase();
      const name = String(file?.name || '').trim().toLowerCase();
      return path || name || JSON.stringify(file || {});
    },
    dedupe(files) {
      const seen = new Set();
      return files.filter((file) => {
        if (!file || typeof file !== 'object') return false;
        const key = MediaClassifier.key(file);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  };

  const ExternalLinkDetector = {
    normalize(raw, baseUrl) {
      try {
        const url = new URL(String(raw).trim().replace(/[),.;!?]+$/, ''), baseUrl);
        if (!/^https?:$/.test(url.protocol)) return null;
        const host = url.hostname.toLowerCase().replace(/^www\./, '');
        if (host === 'pawchive.pw' || host.endsWith('.pawchive.pw')) return null;
        for (const key of [...url.searchParams.keys()]) {
          if (/^(utm_|fbclid$|gclid$|ref$|source$)/i.test(key)) url.searchParams.delete(key);
        }
        url.hash = '';
        return url.href;
      } catch { return null; }
    },
    detect(content, baseUrl) {
      if (!content || typeof content !== 'string') return { externalLinks: [], mediaDownloadLinks: [], likelyMediaLinks: [] };
      const raw = [];
      try {
        const doc = new DOMParser().parseFromString(content, 'text/html');
        doc.querySelectorAll('a[href]').forEach((a) => raw.push(a.getAttribute('href')));
        const text = doc.body?.textContent || content;
        raw.push(...(text.match(/https?:\/\/[^\s<>"']+/gi) || []));
      } catch {
        raw.push(...(content.match(/https?:\/\/[^\s<>"']+/gi) || []));
      }
      const externalLinks = Util.unique(raw.map((url) => ExternalLinkDetector.normalize(url, baseUrl)));
      const mediaDownloadExts = new Set([
        ...Settings.value.videoExtensions,
        ...Settings.value.archiveExtensions,
        ...Settings.value.projectExtensions,
        ...Config.baseExtensions.audio,
      ]);
      const mediaDownloadLinks = externalLinks.filter((href) => {
        let url;
        try { url = new URL(href); } catch { return false; }
        const host = url.hostname.toLowerCase().replace(/^www\./, '');
        const known = Settings.value.knownHosts.some((item) => host === item || host.endsWith(`.${item}`));
        const docsFile = host === 'docs.google.com' && /\/(document|spreadsheets|presentation|file)\//i.test(url.pathname);
        const direct = mediaDownloadExts.has(MediaClassifier.extension({ path: url.pathname }));
        return known || docsFile || direct;
      });
      return {
        externalLinks,
        mediaDownloadLinks,
        likelyMediaLinks: mediaDownloadLinks,
      };
    },
  };

  const ProjectDetector = {
    normalizeTags(raw) {
      return PawchiveData.normalizeTags(raw, { provided:raw !== undefined }).tags;
    },
    keywordRegex(keyword) {
      const escaped = String(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'iu');
    },
    matches(text, keywords = Settings.value.projectKeywords) {
      const value = String(text || '');
      if (!value) return [];
      return keywords.filter((keyword) => ProjectDetector.keywordRegex(keyword).test(value));
    },
    detect({ files, title, tags, contentText }) {
      const evidence = Settings.value.projectEvidence;
      const projectSet = new Set(Settings.value.projectExtensions);
      const projectFiles = files.filter((file) => projectSet.has(MediaClassifier.extension(file)));
      const keywordMatches = [];
      const sources = new Set();
      if (projectFiles.length) sources.add('attachment-extension');
      const collect = (source, texts) => {
        const matches = Util.unique(texts.flatMap((text) => ProjectDetector.matches(text)));
        if (matches.length) { keywordMatches.push(...matches); sources.add(source); }
      };
      if (evidence.attachmentFilenames) collect('attachment-filename', files.map((file) => file.name || ''));
      if (evidence.title) collect('post-title', [title]);
      if (evidence.tags) collect('tag', tags);
      if (evidence.content) collect('description-content', [contentText]);
      return {
        projectFileCount: projectFiles.length,
        projectExtensions: Util.unique(projectFiles.map((file) => MediaClassifier.extension(file))).sort(),
        projectKeywordMatches: Util.unique(keywordMatches),
        projectMatchSources: [...sources],
        hasProjectFiles: projectFiles.length > 0 || keywordMatches.length > 0,
      };
    },
  };

  const CatalogueMetadataPolicy = {
    fields: ['attachments','content','tags','file'],
    availability(raw) {
      const result = {};
      for (const field of CatalogueMetadataPolicy.fields) {
        const present = Object.prototype.hasOwnProperty.call(raw || {}, field);
        const value = raw?.[field];
        if (field === 'attachments') result[field] = PawchiveData.normalizeAttachments(value, { provided:present }).status;
        else if (field === 'tags') result[field] = PawchiveData.normalizeTags(value, { provided:present }).status;
        else if (field === 'file') result[field] = PawchiveData.normalizeFileValue(present ? value : undefined).status;
        else result[field] = present ? (typeof value === 'string' ? 'present' : value == null ? 'absent' : 'invalid') : 'absent';
      }
      return result;
    },
    evaluate(raw, normalized = null) {
      const source = raw && typeof raw === 'object' ? raw : {};
      const reasons = [];
      if (source.has_full === false) reasons.push('explicit-partial-record');
      if (source.partial === true || source.is_partial === true || source.truncated === true || source.is_truncated === true) reasons.push('explicit-partial-record');
      if (Object.prototype.hasOwnProperty.call(source, 'substring') && !Object.prototype.hasOwnProperty.call(source, 'content')) reasons.push('substring-without-content');
      const attachmentInfo = PawchiveData.normalizeAttachments(source.attachments, { provided:Object.prototype.hasOwnProperty.call(source, 'attachments') });
      const fileInfo = PawchiveData.normalizeFileValue(Object.prototype.hasOwnProperty.call(source, 'file') ? source.file : undefined);
      const tagInfo = PawchiveData.normalizeTags(source.tags, { provided:Object.prototype.hasOwnProperty.call(source, 'tags') });
      if (attachmentInfo.reason) reasons.push(attachmentInfo.reason);
      if (fileInfo.reason) reasons.push(fileInfo.reason);
      if (tagInfo.reason) reasons.push(tagInfo.reason);
      const suppliedFiles = MediaClassifier.dedupe([fileInfo.file, ...attachmentInfo.files].filter(Boolean)).length;
      const knownCount = [source.attachment_count, source.attachments_count, source.file_count].map(Number).find(Number.isFinite);
      if (Number.isFinite(knownCount) && knownCount > suppliedFiles) reasons.push('attachment-count-mismatch');
      return {
        retryable: reasons.length > 0,
        reasons: Util.unique(reasons),
        fieldAvailability: CatalogueMetadataPolicy.availability(source),
        normalized,
      };
    },
    emptyAvailability() {
      return Object.fromEntries(CatalogueMetadataPolicy.fields.map((field) => [field, { presentCount:0, absentCount:0, invalidCount:0, status:'not-provided' }]));
    },
    summarize(items = []) {
      const summary = CatalogueMetadataPolicy.emptyAvailability();
      for (const availability of items) {
        for (const field of CatalogueMetadataPolicy.fields) {
          const value = availability?.[field] || 'absent';
          if (value === 'present') summary[field].presentCount += 1;
          else if (value === 'invalid') summary[field].invalidCount += 1;
          else summary[field].absentCount += 1;
        }
      }
      for (const field of CatalogueMetadataPolicy.fields) {
        const item = summary[field];
        item.status = item.presentCount === 0 ? 'not-provided' : (item.absentCount || item.invalidCount) ? 'mixed' : 'available';
      }
      return summary;
    },
    mergeAvailability(manifests = {}) {
      const summary = CatalogueMetadataPolicy.emptyAvailability();
      for (const manifest of Object.values(manifests || {})) {
        for (const field of CatalogueMetadataPolicy.fields) {
          const source = manifest?.fieldAvailability?.[field];
          if (!source) continue;
          summary[field].presentCount += Number(source.presentCount) || 0;
          summary[field].absentCount += Number(source.absentCount) || 0;
          summary[field].invalidCount += Number(source.invalidCount) || 0;
        }
      }
      for (const field of CatalogueMetadataPolicy.fields) {
        const item = summary[field];
        item.status = item.presentCount === 0 ? 'not-provided' : (item.absentCount || item.invalidCount) ? 'mixed' : 'available';
      }
      return summary;
    },
    combineAvailability(...summaries) {
      return CatalogueMetadataPolicy.mergeAvailability(Object.fromEntries(
        summaries.filter(Boolean).map((fieldAvailability, index) => [String(index), { fieldAvailability }]),
      ));
    },
    legacyReasonRetryable(reason) {
      return ['explicit-partial-record','substring-without-content','invalid-attachments-structure','invalid-file-structure','invalid-tags-structure','attachment-count-mismatch','detail-request-failed'].includes(String(reason));
    },
  };

  // Pawchive does not consistently expose this on list responses.  Keep the
  // three-state distinction: unknown, checked/no missing attachments, checked/missing.
  const PostMissingStats = {
    parse(text='') {
      const raw=String(text||'').replace(/\s+/g,' ').trim();
      if(!raw)return{missingStatsKnown:false,hasMissingStats:false,missingStatsText:'',missingAttachmentCount:0,missingImageCount:0,missingVideoCount:0,missingAudioCount:0,missingFileCount:0,missingUnknownCount:0};
      const result={missingStatsKnown:true,hasMissingStats:true,missingStatsText:raw,missingAttachmentCount:0,missingImageCount:0,missingVideoCount:0,missingAudioCount:0,missingFileCount:0,missingUnknownCount:0};
      let matched=false;for(const match of raw.matchAll(/(\d+)\s+(?:full[- ]res\s+)?(photos?|images?|videos?|audio|files?|attachments?)/gi)){const count=Number(match[1])||0,type=match[2].toLowerCase();matched=true;result.missingAttachmentCount+=count;if(/photo|image/.test(type))result.missingImageCount+=count;else if(/video/.test(type))result.missingVideoCount+=count;else if(/audio/.test(type))result.missingAudioCount+=count;else result.missingFileCount+=count;}
      if(!matched)result.missingUnknownCount=1;return result;
    },
    fromRaw(raw={}) {
      const value=raw.missing_stats??raw.missingStats??raw.missing_attachments??raw.missingAttachments??raw.post_missing_stats;
      if(value==null)return{missingStatsKnown:Boolean(raw.missingStatsKnown),hasMissingStats:Boolean(raw.hasMissingStats),missingStatsText:String(raw.missingStatsText||''),missingAttachmentCount:Number(raw.missingAttachmentCount)||0,missingImageCount:Number(raw.missingImageCount)||0,missingVideoCount:Number(raw.missingVideoCount)||0,missingAudioCount:Number(raw.missingAudioCount)||0,missingFileCount:Number(raw.missingFileCount)||0,missingUnknownCount:Number(raw.missingUnknownCount)||0};
      if(value===false||value===0||String(value).trim()==='')return{missingStatsKnown:true,hasMissingStats:false,missingStatsText:'',missingAttachmentCount:0,missingImageCount:0,missingVideoCount:0,missingAudioCount:0,missingFileCount:0,missingUnknownCount:0};
      return PostMissingStats.parse(typeof value==='string'?value:raw.missingStatsText||String(value));
    },
  };

  const PostNormalizer = {
    mediaPath(path) {
      if (!path) return '';
      try { return new URL(path, location.origin).href; } catch { return ''; }
    },
    thumbnail(raw, files, nativeThumbnail = '') {
      const direct = raw?.thumbnail || raw?.thumbnail_url || raw?.preview || raw?.preview_url;
      if (direct) return PostNormalizer.mediaPath(direct);
      const image = files.find((file) => MediaClassifier.classify(file).type === 'image');
      if (image?.path) {
        if (/^https?:\/\//i.test(image.path)) return image.path;
        return `https://img.pawchive.pw/thumbnail/data${image.path.startsWith('/') ? '' : '/'}${image.path}`;
      }
      return nativeThumbnail || '';
    },
    normalize(raw, context, nativeThumbnail = '') {
      if (!raw || typeof raw !== 'object') return null;
      const id = String(raw.id ?? raw.post_id ?? '').trim();
      if (!id) return null;
      const mainFileInfo = PawchiveData.normalizeFileValue(raw.file);
      const attachmentInfo = PawchiveData.normalizeAttachments(raw.attachments, { provided:Object.prototype.hasOwnProperty.call(raw, 'attachments') });
      const mainFile = mainFileInfo.file;
      const attachmentArray = attachmentInfo.files;
      const files = MediaClassifier.dedupe([mainFile, ...attachmentArray].filter(Boolean));
      const buckets = { video: [], image: [], archive: [], project: [] };
      for (const file of files) {
        const classified = MediaClassifier.classify(file);
        if (buckets[classified.type]) buckets[classified.type].push({ file, ext: classified.ext });
      }
      const content = typeof raw.content === 'string' ? raw.content : '';
      const contentText = Util.plainText(content);
      const tagInfo = PawchiveData.normalizeTags(raw.tags, { provided:Object.prototype.hasOwnProperty.call(raw, 'tags') });
      const tags = tagInfo.tags;
      const title = String(raw.title || `Post ${id}`);
      const links = ExternalLinkDetector.detect(content, context.creatorUrl);
      const project = ProjectDetector.detect({ files, title, tags, contentText });
      const metadataPolicy = CatalogueMetadataPolicy.evaluate(raw);
      const completeness = metadataPolicy.retryable ? 'partial' : 'complete';
      const extensions = (name) => Util.unique(buckets[name].map((item) => item.ext)).sort();
      const service = String(raw.service || context.service);
      const creatorId = String(raw.user || raw.creator_id || context.creatorId);
      const postUrl = raw.post_url || `/${encodeURIComponent(service)}/user/${encodeURIComponent(creatorId)}/post/${encodeURIComponent(id)}`;
      const missing=PostMissingStats.fromRaw(raw);
      return {
        key: `${context.creatorKey}|${id}`,
        creatorKey: context.creatorKey,
        id,
        service,
        creatorId,
        title,
        postUrl,
        published: raw.published || '',
        publishedAt: raw.published || '',
        importedAt: raw.added || raw.imported || '',
        editedAt: raw.edited || '',
        thumbnailUrl: PostNormalizer.thumbnail(raw, files, nativeThumbnail),
        attachmentCount: files.length,
        mainFile,
        fileNormalizationStatus: mainFileInfo.status,
        invalidMainFileValue: mainFileInfo.status === 'invalid' ? raw.file : null,
        attachments: attachmentArray,
        attachmentNormalizationStatus: attachmentInfo.status,
        invalidAttachmentValue: attachmentInfo.status === 'invalid' ? raw.attachments : null,
        content,
        contentText,
        tags,
        tagNormalizationStatus: tagInfo.status,
        invalidTagsValue: tagInfo.status === 'invalid' ? raw.tags : null,
        mainFileName: String(mainFile?.name || ''),
        attachmentFilenames: files.map((file) => String(file.name || '')).filter(Boolean),
        fileExtensions: files.map((file) => MediaClassifier.extension(file)).filter(Boolean),
        rawExtensions: Util.unique(files.map((file) => MediaClassifier.extension(file)).filter(Boolean)).sort(),
        searchFields: { title, attachmentFilenames: files.map((file) => String(file.name || '')).filter(Boolean), tags, contentText },
        videoCount: buckets.video.length,
        mp4Count: buckets.video.filter((item) => item.ext === 'mp4').length,
        imageCount: buckets.image.length,
        archiveCount: buckets.archive.length,
        videoExtensions: extensions('video'),
        imageExtensions: extensions('image'),
        archiveExtensions: extensions('archive'),
        ...project,
        externalLinkCount: links.externalLinks.length,
        likelyMediaLinkCount: links.mediaDownloadLinks.length,
        mediaDownloadLinkCount: links.mediaDownloadLinks.length,
        externalLinks: links.externalLinks,
        likelyMediaLinks: links.mediaDownloadLinks,
        mediaDownloadLinks: links.mediaDownloadLinks,
        hasVideo: buckets.video.length > 0,
        hasMp4: buckets.video.some((item) => item.ext === 'mp4'),
        hasImages: buckets.image.length > 0,
        hasArchives: buckets.archive.length > 0,
        hasExternalLinks: links.externalLinks.length > 0,
        hasLikelyExternalMedia: links.likelyMediaLinks.length > 0,
        ...missing,
        missingStatsObservedAt:missing.missingStatsKnown?Date.now():0,
        missingStatsSource:missing.missingStatsKnown?'api':'' ,
        completeness,
        cacheSources: {
          scan: Boolean(raw.cacheSources?.scan),
          catalogue: Boolean(raw.cacheSources?.catalogue),
        },
        scannedAt: Date.now(),
        scanSchemaVersion: Config.schemaVersion,
      };
    },
    rawFromStored(post) {
      return {
        id: post.id,
        user: post.creatorId,
        service: post.service,
        title: post.title,
        published: post.publishedAt,
        added: post.importedAt,
        edited: post.editedAt,
        file: post.invalidMainFileValue ?? post.mainFile,
        attachments: post.invalidAttachmentValue ?? post.attachments,
        content: post.content,
        tags: post.invalidTagsValue ?? post.tags,
        thumbnail: post.thumbnailUrl,
        missingStatsKnown:post.missingStatsKnown,
        hasMissingStats:post.hasMissingStats,
        missingStatsText:post.missingStatsText,
        missingAttachmentCount:post.missingAttachmentCount,
        missingImageCount:post.missingImageCount,
        missingVideoCount:post.missingVideoCount,
        missingAudioCount:post.missingAudioCount,
        missingFileCount:post.missingFileCount,
        missingUnknownCount:post.missingUnknownCount,
        cacheSources: post.cacheSources,
      };
    },
    fromNativeCard(card, context) {
      const id = String(card?.dataset?.id || '');
      if (!id) return null;
      const title = card.querySelector('.post-card__header')?.textContent?.trim() || `Post ${id}`;
      const link = card.querySelector('a[href*="/post/"]')?.getAttribute('href') || `/${context.service}/user/${context.creatorId}/post/${id}`;
      const published = card.querySelector('time')?.getAttribute('datetime') || '';
      const thumbnailUrl = card.querySelector('.post-card__image')?.src || '';
      const attachmentText = card.querySelector('.post-card__footer')?.textContent || '';
      return {
        key: `${context.creatorKey}|${id}`, creatorKey: context.creatorKey, id,
        service: context.service, creatorId: context.creatorId, title, postUrl: link,
        published, publishedAt: published, importedAt: '', editedAt: '', thumbnailUrl,
        attachmentCount: Util.parseInteger(attachmentText.match(/(\d+)\s+attachments?/i)?.[1], 0),
        mainFile: null, attachments: [], content: '', contentText: '', tags: [], mainFileName: '', attachmentFilenames: [], fileExtensions: [], rawExtensions: [],
        searchFields: { title, attachmentFilenames: [], tags: [], contentText: '' }, videoCount: 0, imageCount: 0,
        mp4Count: 0,
        archiveCount: 0, videoExtensions: [], imageExtensions: [], archiveExtensions: [],
        projectFileCount: 0, projectExtensions: [], projectKeywordMatches: [], projectMatchSources: [], hasProjectFiles: false,
        externalLinkCount: 0, likelyMediaLinkCount: 0, externalLinks: [], likelyMediaLinks: [],
        mediaDownloadLinkCount: 0, mediaDownloadLinks: [],
        hasVideo: false, hasMp4: false, hasImages: false, hasArchives: false,
        hasExternalLinks: false, hasLikelyExternalMedia: false,
        missingStatsKnown:false,hasMissingStats:false,missingStatsText:'',missingAttachmentCount:0,missingImageCount:0,missingVideoCount:0,missingAudioCount:0,missingFileCount:0,missingUnknownCount:0,missingStatsObservedAt:0,missingStatsSource:'',
        completeness: 'unresolved', cacheSources:{scan:false,catalogue:false}, scannedAt: 0, scanSchemaVersion: Config.schemaVersion,
      };
    },
  };

  const CatalogueOnlyMigration = {
    hasCatalogueMeta(meta = {}) {
      const catalogue=meta.catalogue||{};
      return meta.storageMode==='catalogue'
        || Object.keys(catalogue.pageCoverage||{}).length>0
        || ['building','partial','complete','updating'].includes(catalogue.status)
        || Number(catalogue.storedPostCount)>0
        || Number(catalogue.totalExpectedPosts)>0;
    },
    shouldKeepPost(post, meta = {}) {
      if(post?.cacheSources?.catalogue===true)return true;
      if(post?.cacheSources?.scan===true)return false;
      return CatalogueOnlyMigration.hasCatalogueMeta(meta);
    },
    normalizePost(post) {
      return {...post,cacheSources:{scan:false,catalogue:true}};
    },
    normalizeMeta(meta = {}) {
      if(!CatalogueOnlyMigration.hasCatalogueMeta(meta))return null;
      const output={...meta,catalogue:CatalogueModel.normalize(meta,{restoreTransient:true}).catalogue};
      [
        'storageMode','previousNormalScanRange','scannedOffsets','unresolvedIds',
        'scannedAt','scanTotalPosts','scanTotalPages','restoredRange','cacheOwnershipVersion',
      ].forEach((key)=>delete output[key]);
      output.totalPosts=Math.max(0,Number(output.catalogue.totalExpectedPosts)||Number(output.totalPosts)||0);
      output.totalPages=Math.ceil(output.totalPosts/Config.pageSize)||0;
      return output;
    },
    normalizeUIState(state = {}) {
      const output={...state};
      ['storageMode','previousNormalScanRange','scanRange','scannedOffsetsOrRanges','catalogue'].forEach((key)=>delete output[key]);
      const sort=PostSorter.normalize(output.sortMode,output.sortDirection);
      output.sortMode=sort.mode;
      output.sortDirection=sort.direction;
      return output;
    },
  };

  const Cache = {
    dbPromise: null,
    memory: new Map(),
    metaMemory: new Map(),
    statusMemory: new Map(),
    favoriteSnapshotMemory:new Map(),
    creatorDirectoryMemory:new Map(),
    creatorStateMemory:new Map(),
    staleCreators: new Set(),
    open() {
      if (Cache.dbPromise) return Cache.dbPromise;
      Cache.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(Config.databaseName, Config.databaseVersion);
        request.onupgradeneeded = (event) => {
          const db = request.result;
          if (!db.objectStoreNames.contains('posts')) {
            const posts = db.createObjectStore('posts', { keyPath: 'key' });
            posts.createIndex('creatorKey', 'creatorKey', { unique: false });
          }
          if (!db.objectStoreNames.contains('creators')) db.createObjectStore('creators', { keyPath: 'creatorKey' });
          if (!db.objectStoreNames.contains('uiStates')) db.createObjectStore('uiStates', { keyPath: 'creatorKey' });
          if (!db.objectStoreNames.contains('postStatuses')) {
            const statuses=db.createObjectStore('postStatuses',{keyPath:'key'});
            statuses.createIndex('creatorKey','creatorKey',{unique:false});
          }
          if (!db.objectStoreNames.contains('favoriteSnapshotEntries')) {
            const entries=db.createObjectStore('favoriteSnapshotEntries',{keyPath:'key'});
            entries.createIndex('host','host',{unique:false});
            entries.createIndex('snapshotId','snapshotId',{unique:false});
            entries.createIndex('hostSnapshot','hostSnapshot',{unique:false});
          }
          if (!db.objectStoreNames.contains('favoriteSyncMeta')) db.createObjectStore('favoriteSyncMeta',{keyPath:'host'});
          if (!db.objectStoreNames.contains('creatorDirectory')) {
            const directory=db.createObjectStore('creatorDirectory',{keyPath:'creatorKey'});
            directory.createIndex('service','service',{unique:false});
            directory.createIndex('updatedAt','updatedAt',{unique:false});
          }
          if (!db.objectStoreNames.contains('creatorStates')) {
            const states=db.createObjectStore('creatorStates',{keyPath:'creatorKey'});
            states.createIndex('liked','liked',{unique:false});
            states.createIndex('hidden','hidden',{unique:false});
          }
          if(event.oldVersion<4&&db.objectStoreNames.contains('postStatuses')){
            const cursorRequest=request.transaction.objectStore('postStatuses').openCursor();
            cursorRequest.onsuccess=()=>{const cursor=cursorRequest.result;if(!cursor)return;cursor.update(PostStatus.normalize(cursor.value));cursor.continue();};
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }).catch((error) => {
        Logger.warn('IndexedDB unavailable; cache will be memory-only.', error);
        return null;
      });
      return Cache.dbPromise;
    },
    async getCreatorPosts(creatorKey) {
      const db = await Cache.open();
      if (!db) return [...Cache.memory.values()].filter((post) => post.creatorKey === creatorKey && post.cacheSources?.catalogue===true);
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('posts', 'readonly');
        const request = transaction.objectStore('posts').index('creatorKey').getAll(creatorKey);
        request.onsuccess = () => {
          const records = request.result || [];
          if (records.some((post) => post.scanSchemaVersion !== Config.schemaVersion)) Cache.staleCreators.add(creatorKey);
          resolve(records.filter((post) => post.scanSchemaVersion === Config.schemaVersion && post.cacheSources?.catalogue===true));
        };
        request.onerror = () => reject(request.error);
      }).catch((error) => { Logger.warn('Could not read creator cache.', error); return []; });
    },
    mergePost(existing, incoming) {
      const prior = existing && typeof existing === 'object' ? existing : {};
      const next = { ...prior, ...incoming };
      next.cacheSources = {scan:false,catalogue:true};
      return next;
    },
    async putPosts(posts) {
      if (!posts.length) return;
      const db = await Cache.open();
      if (!db) {
        posts.forEach((post) => Cache.memory.set(post.key, Cache.mergePost(Cache.memory.get(post.key), post)));
        return;
      }
      const written = [];
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('posts', 'readwrite');
        const store = transaction.objectStore('posts');
        posts.forEach((post) => {
          const request = store.get(post.key);
          request.onsuccess = () => {
            const merged = Cache.mergePost(request.result, post);
            written.push(merged); store.put(merged);
          };
        });
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      written.forEach((post) => Cache.memory.set(post.key, post));
    },
    async commitCataloguePage(creatorKey, posts, metaPatch) {
      const current = await Cache.getMeta(creatorKey) || { creatorKey };
      const next = { ...current, ...metaPatch, creatorKey, catalogue: { ...(current.catalogue || {}), ...(metaPatch.catalogue || {}) } };
      if ('retryableMetadataIds' in next.catalogue) { delete next.catalogue.unresolvedPostIds; delete next.catalogue.incompleteMetadataIds; delete next.catalogue.incompleteMetadataReasons; }
      const db = await Cache.open();
      if (!db) {
        posts.forEach((post) => Cache.memory.set(post.key, Cache.mergePost(Cache.memory.get(post.key), post)));
        Cache.metaMemory.set(creatorKey, Util.clone(next));
        return next;
      }
      const written = [];
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(['posts', 'creators'], 'readwrite');
        const postStore = transaction.objectStore('posts');
        posts.forEach((post) => {
          const request = postStore.get(post.key);
          request.onsuccess = () => {
            const merged = Cache.mergePost(request.result, post);
            written.push(merged); postStore.put(merged);
          };
        });
        transaction.objectStore('creators').put(next);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('Catalogue page transaction aborted'));
      });
      written.forEach((post) => Cache.memory.set(post.key, post));
      Cache.metaMemory.set(creatorKey, Util.clone(next));
      return next;
    },
    async migrateCatalogueOnly() {
      if(GM_getValue(Config.catalogueOnlyMigrationKey,false))return {performed:false};
      const db=await Cache.open();
      if(!db){
        const metas=new Map(Cache.metaMemory);
        for(const [key,post] of Cache.memory){
          const meta=metas.get(post.creatorKey)||{};
          if(CatalogueOnlyMigration.shouldKeepPost(post,meta))Cache.memory.set(key,CatalogueOnlyMigration.normalizePost(post));
          else Cache.memory.delete(key);
        }
        for(const [key,meta] of metas){
          const normalized=CatalogueOnlyMigration.normalizeMeta(meta);
          if(normalized)Cache.metaMemory.set(key,normalized);else Cache.metaMemory.delete(key);
        }
        GM_setValue(Config.catalogueOnlyMigrationKey,true);
        return {performed:true};
      }
      await new Promise((resolve,reject)=>{
        const transaction=db.transaction(['posts','creators','uiStates'],'readwrite');
        const postStore=transaction.objectStore('posts');
        const creatorStore=transaction.objectStore('creators');
        const uiStore=transaction.objectStore('uiStates');
        const requests={posts:postStore.getAll(),creators:creatorStore.getAll(),uiStates:uiStore.getAll()};
        const results={};let ready=0;
        const apply=()=>{
          if(++ready!==3)return;
          const metas=new Map((results.creators||[]).map((meta)=>[meta.creatorKey,meta]));
          for(const post of results.posts||[]){
            const meta=metas.get(post.creatorKey)||{};
            if(CatalogueOnlyMigration.shouldKeepPost(post,meta))postStore.put(CatalogueOnlyMigration.normalizePost(post));
            else postStore.delete(post.key);
          }
          for(const meta of results.creators||[]){
            const normalized=CatalogueOnlyMigration.normalizeMeta(meta);
            if(normalized)creatorStore.put(normalized);else creatorStore.delete(meta.creatorKey);
          }
          for(const state of results.uiStates||[])uiStore.put(CatalogueOnlyMigration.normalizeUIState(state));
        };
        Object.entries(requests).forEach(([key,request])=>{
          request.onsuccess=()=>{results[key]=request.result||[];apply();};
          request.onerror=()=>reject(request.error);
        });
        transaction.oncomplete=resolve;
        transaction.onerror=()=>reject(transaction.error);
        transaction.onabort=()=>reject(transaction.error||new Error('Catalogue-only migration aborted'));
      });
      Cache.memory.clear();Cache.metaMemory.clear();
      GM_setValue(Config.catalogueOnlyMigrationKey,true);
      Logger.info({operation:'catalogue-only-migration',status:'complete'});
      return {performed:true};
    },
    async getMeta(creatorKey) {
      const db = await Cache.open();
      if (!db) return Cache.metaMemory.get(creatorKey) || null;
      return new Promise((resolve, reject) => {
        const request = db.transaction('creators', 'readonly').objectStore('creators').get(creatorKey);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      }).catch(() => null);
    },
    async getCreatorMetas(creatorKeys = []) {
      const keys=new Set([...creatorKeys].map(String).filter(Boolean));const result=new Map();
      const db=await Cache.open();
      if(!db){for(const key of keys){const meta=Cache.metaMemory.get(key);if(meta)result.set(key,Util.clone(meta));}return result;}
      return new Promise((resolve,reject)=>{
        const request=db.transaction('creators','readonly').objectStore('creators').openCursor();
        request.onsuccess=()=>{const cursor=request.result;if(!cursor){resolve(result);return;}if(!keys.size||keys.has(String(cursor.key)))result.set(String(cursor.key),cursor.value);cursor.continue();};
        request.onerror=()=>reject(request.error);
      }).catch((error)=>{Logger.warn('Could not batch-read creator metadata.',error);return result;});
    },
    async getCreatorDirectory(creatorKeys = []) {
      const keys=new Set((creatorKeys||[]).map(String).filter(Boolean));const result=new Map();const db=await Cache.open();
      if(!db){for(const [key,value] of Cache.creatorDirectoryMemory){if(!keys.size||keys.has(key))result.set(key,Util.clone(value));}return result;}
      return new Promise((resolve,reject)=>{const request=db.transaction('creatorDirectory','readonly').objectStore('creatorDirectory').openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor){resolve(result);return;}if(!keys.size||keys.has(String(cursor.key)))result.set(String(cursor.key),cursor.value);cursor.continue();};request.onerror=()=>reject(request.error);}).catch((error)=>{Logger.warn('Could not read creator directory.',error);return result;});
    },
    async putCreatorDirectory(records=[]) {
      const normalized=(records||[]).map(CreatorDirectory.normalize).filter((record)=>record.creatorKey);normalized.forEach((record)=>Cache.creatorDirectoryMemory.set(record.creatorKey,Util.clone(record)));const db=await Cache.open();if(!db)return normalized;
      await new Promise((resolve,reject)=>{const transaction=db.transaction('creatorDirectory','readwrite');const store=transaction.objectStore('creatorDirectory');normalized.forEach((record)=>store.put(record));transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);});return normalized;
    },
    async getCreatorStates(creatorKeys=[]) {
      const keys=new Set((creatorKeys||[]).map(String).filter(Boolean));const result=new Map();const db=await Cache.open();
      if(!db){for(const [key,value] of Cache.creatorStateMemory){if(!keys.size||keys.has(key))result.set(key,Util.clone(value));}return result;}
      return new Promise((resolve,reject)=>{const request=db.transaction('creatorStates','readonly').objectStore('creatorStates').openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor){resolve(result);return;}if(!keys.size||keys.has(String(cursor.key)))result.set(String(cursor.key),CreatorState.normalize(cursor.value));cursor.continue();};request.onerror=()=>reject(request.error);}).catch((error)=>{Logger.warn('Could not read creator states.',error);return result;});
    },
    async getCreatorState(creatorKey) {
      return (await Cache.getCreatorStates([creatorKey])).get(String(creatorKey))||CreatorState.empty(creatorKey);
    },
    async putCreatorState(state) {
      const next=CreatorState.normalize(state);if(!next.creatorKey)return null;Cache.creatorStateMemory.set(next.creatorKey,Util.clone(next));const db=await Cache.open();if(!db)return next;
      await new Promise((resolve,reject)=>{const transaction=db.transaction('creatorStates','readwrite');transaction.objectStore('creatorStates').put(next);transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);});Util.dispatch('creator-state',{state:next});return next;
    },
    async putMeta(meta) {
      Cache.metaMemory.set(meta.creatorKey, Util.clone(meta));
      const db = await Cache.open();
      if (!db) return;
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('creators', 'readwrite');
        transaction.objectStore('creators').put(meta);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    },
    async patchMeta(creatorKey, patch) {
      const current = await Cache.getMeta(creatorKey) || { creatorKey };
      const next = { ...current, ...patch, creatorKey };
      if (patch.catalogue) {
        next.catalogue = { ...(current.catalogue || {}), ...patch.catalogue };
        if ('retryableMetadataIds' in patch.catalogue) { delete next.catalogue.unresolvedPostIds; delete next.catalogue.incompleteMetadataIds; delete next.catalogue.incompleteMetadataReasons; }
      }
      await Cache.putMeta(next); return next;
    },
    async getUIState(creatorKey) {
      const db = await Cache.open();
      if (!db) return null;
      return new Promise((resolve, reject) => {
        const request = db.transaction('uiStates', 'readonly').objectStore('uiStates').get(creatorKey);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      }).catch(() => null);
    },
    async putUIState(state) {
      const db = await Cache.open();
      if (!db) return;
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('uiStates', 'readwrite');
        transaction.objectStore('uiStates').put(state);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    },
    async getPostStatus(key) {
      const normalized=String(key||'');if(!normalized)return null;
      const db=await Cache.open();
      if(!db)return Cache.statusMemory.get(normalized)||null;
      return new Promise((resolve,reject)=>{
        const request=db.transaction('postStatuses','readonly').objectStore('postStatuses').get(normalized);
        request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error);
      }).catch((error)=>{Logger.warn('Could not read post status.',error);return null;});
    },
    async getCreatorStatuses(creatorKey) {
      const normalized=String(creatorKey||'');if(!normalized)return[];
      const db=await Cache.open();
      if(!db)return[...Cache.statusMemory.values()].filter((status)=>status.creatorKey===normalized);
      return new Promise((resolve,reject)=>{
        const request=db.transaction('postStatuses','readonly').objectStore('postStatuses').index('creatorKey').getAll(normalized);
        request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error);
      }).catch((error)=>{Logger.warn('Could not read creator post statuses.',error);return[];});
    },
    async getAllPostStatuses() {
      const db=await Cache.open();if(!db)return[...Cache.statusMemory.values()];
      return new Promise((resolve,reject)=>{
        const request=db.transaction('postStatuses','readonly').objectStore('postStatuses').getAll();
        request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error);
      }).catch((error)=>{Logger.warn('Could not read post statuses.',error);return[];});
    },
    async putPostStatus(status) {
      const next=PostStatus.normalize(status);if(!next.key)return null;
      Cache.statusMemory.set(next.key,Util.clone(next));const db=await Cache.open();if(!db)return next;
      await new Promise((resolve,reject)=>{
        const transaction=db.transaction('postStatuses','readwrite');transaction.objectStore('postStatuses').put(next);
        transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);
      });return next;
    },
    async putPostStatuses(statuses) {
      const records=(statuses||[]).map(PostStatus.normalize).filter((status)=>status.key);
      if(!records.length)return[];records.forEach((status)=>Cache.statusMemory.set(status.key,Util.clone(status)));
      const db=await Cache.open();if(!db)return records;
      await new Promise((resolve,reject)=>{
        const transaction=db.transaction('postStatuses','readwrite');const store=transaction.objectStore('postStatuses');
        records.forEach((status)=>store.put(status));transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);
      });return records;
    },
    async getFavoriteSyncMeta(host) {
      const db=await Cache.open();if(!db)return GM_getValue(Config.favoriteSyncKey,{})?.host===host?GM_getValue(Config.favoriteSyncKey,{}):null;
      return new Promise((resolve,reject)=>{const request=db.transaction('favoriteSyncMeta','readonly').objectStore('favoriteSyncMeta').get(host);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error);}).catch(()=>null);
    },
    async getFavoriteSnapshotKeys(host,snapshotId) {
      if(!snapshotId)return new Set();const db=await Cache.open();if(!db)return new Set(Cache.favoriteSnapshotMemory.get(`${host}|${snapshotId}`)||[]);
      return new Promise((resolve,reject)=>{const request=db.transaction('favoriteSnapshotEntries','readonly').objectStore('favoriteSnapshotEntries').index('hostSnapshot').getAll(`${host}|${snapshotId}`);request.onsuccess=()=>resolve(new Set((request.result||[]).map((item)=>item.postKey)));request.onerror=()=>reject(request.error);}).catch(()=>new Set());
    },
    async commitFavoriteSnapshot(host,snapshotId,postKeys,metaPatch={}) {
      const keys=[...new Set(postKeys||[])];const now=Date.now();const db=await Cache.open();
      const meta={host,activeSnapshotId:snapshotId,complete:true,completedAt:now,pagesScanned:Number(metaPatch.pagesScanned)||0,favoriteCount:keys.length,sourceUrl:String(metaPatch.sourceUrl||''),lastAttemptAt:now,lastAttemptStatus:'complete'};
      if(!db){Cache.favoriteSnapshotMemory.set(`${host}|${snapshotId}`,new Set(keys));GM_setValue(Config.favoriteSyncKey,meta);return meta;}
      await new Promise((resolve,reject)=>{const tx=db.transaction(['favoriteSnapshotEntries','favoriteSyncMeta'],'readwrite');const store=tx.objectStore('favoriteSnapshotEntries');keys.forEach((postKey)=>store.put({key:`${host}|${snapshotId}|${postKey}`,host,snapshotId,hostSnapshot:`${host}|${snapshotId}`,postKey}));tx.objectStore('favoriteSyncMeta').put(meta);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Favorite snapshot transaction aborted'));});
      GM_setValue(Config.favoriteSyncKey,meta);
      setTimeout(async()=>{try{const live=await Cache.open();if(!live)return;const old=await new Promise((resolve,reject)=>{const req=live.transaction('favoriteSnapshotEntries','readonly').objectStore('favoriteSnapshotEntries').index('host').getAllKeys(host);req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});const stale=old.filter((key)=>!String(key).startsWith(`${host}|${snapshotId}|`));if(stale.length)await new Promise((resolve,reject)=>{const tx=live.transaction('favoriteSnapshotEntries','readwrite');stale.forEach((key)=>tx.objectStore('favoriteSnapshotEntries').delete(key));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch(error){Logger.info('Inactive Favorite snapshot cleanup was skipped.',error);}},0);
      return meta;
    },
    async noteFavoriteSyncAttempt(host,status,patch={}) {
      const current=await Cache.getFavoriteSyncMeta(host)||{host};const next={...current,...patch,host,lastAttemptAt:Date.now(),lastAttemptStatus:status};const db=await Cache.open();if(db)await new Promise((resolve,reject)=>{const tx=db.transaction('favoriteSyncMeta','readwrite');tx.objectStore('favoriteSyncMeta').put(next);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});GM_setValue(Config.favoriteSyncKey,next);return next;
    },
    async clearCreatorCatalogue(creatorKey) {
      Cache.staleCreators.delete(creatorKey);
      Cache.metaMemory.delete(creatorKey);
      for (const [key, post] of Cache.memory) if (post.creatorKey === creatorKey) Cache.memory.delete(key);
      const db = await Cache.open();
      if (!db) return;
      const keys = await new Promise((resolve, reject) => {
        const request = db.transaction('posts', 'readonly').objectStore('posts').index('creatorKey').getAllKeys(creatorKey);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(['posts', 'creators'], 'readwrite');
        const posts = transaction.objectStore('posts');
        keys.forEach((key) => posts.delete(key));
        transaction.objectStore('creators').delete(creatorKey);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    },
    async clearAllCatalogues() {
      Cache.memory.clear();
      Cache.metaMemory.clear();
      Cache.staleCreators.clear();
      const db = await Cache.open();
      if (!db) return;
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(['posts', 'creators'], 'readwrite');
        transaction.objectStore('posts').clear();
        transaction.objectStore('creators').clear();
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    },
    async clearUIStates() {
      const db = await Cache.open(); if (!db) return;
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('uiStates', 'readwrite'); transaction.objectStore('uiStates').clear();
        transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error);
      });
    },
  };

  const CatalogueRequestScheduler = {
    nextAllowedAt:0,cooldownUntil:0,gate:Promise.resolve(),
    waitTurn({signal,operation='',creatorKey='',jobId='',requestKind='request'}={}) {
      const run=CatalogueRequestScheduler.gate.catch(()=>{}).then(async()=>{
        if(signal?.aborted)throw new DOMException('Aborted','AbortError');
        const readyAt=Math.max(CatalogueRequestScheduler.nextAllowedAt,CatalogueRequestScheduler.cooldownUntil);const wait=Math.max(0,readyAt-Date.now());
        if(Logger.debug)Logger.info({operation:'catalogue-request-turn',catalogueOperation:operation,creatorKey,jobId,requestKind,waitMs:wait});
        if(wait)await Util.sleep(wait,signal);
        if(signal?.aborted)throw new DOMException('Aborted','AbortError');
        CatalogueRequestScheduler.nextAllowedAt=Date.now()+Config.pageRequestSpacingMs;
      });
      CatalogueRequestScheduler.gate=run.catch(()=>{});return run;
    },
    applyRateLimit(waitMs,{creatorKey='',jobId='',requestKind='request'}={}) {
      const duration=Math.max(0,Number(waitMs)||Config.defaultRateLimitDelayMs);CatalogueRequestScheduler.cooldownUntil=Math.max(CatalogueRequestScheduler.cooldownUntil,Date.now()+duration);
      Logger.info({operation:'catalogue-rate-limit',creatorKey,jobId,requestKind,waitMs:duration,cooldownUntil:CatalogueRequestScheduler.cooldownUntil});return CatalogueRequestScheduler.cooldownUntil;
    },
    reset(){CatalogueRequestScheduler.nextAllowedAt=0;CatalogueRequestScheduler.cooldownUntil=0;CatalogueRequestScheduler.gate=Promise.resolve();},
  };

  const PostStatusEvents = {
    listeners:new Set(),
    subscribe(listener){PostStatusEvents.listeners.add(listener);return()=>PostStatusEvents.listeners.delete(listener);},
    emit(detail){PostStatusEvents.listeners.forEach((listener)=>{try{listener(detail);}catch(error){Logger.warn('Post-status subscriber failed.',error);}});},
  };

  const PostStatus = {
    empty(context={}) {
      return {key:String(context.postKey||''),domain:String(context.domain||''),service:String(context.service||''),creatorId:String(context.creatorId||''),creatorKey:String(context.creatorKey||''),postId:String(context.postId||''),liked:false,seen:false,likedAt:null,seenAt:null,favoriteDirectValue:null,favoriteDirectObservedAt:null,favoritePartialPositiveAt:null,createdAt:0,updatedAt:0,source:'local'};
    },
    normalize(value={}) {
      const context=value&&typeof value==='object'?value:{};const empty=PostStatus.empty(context);
      const creatorKey=String(context.creatorKey||empty.creatorKey);const postId=String(context.postId||empty.postId);
      const key=String(context.key||context.postKey||(creatorKey&&postId?`${creatorKey}|${postId}`:''));
      const directSources=new Set(['native-post-page','native-favorite-click','native-favorite-mutation']);
      let favoriteDirectValue=context.favoriteDirectValue===true||context.favoriteDirectValue===false?context.favoriteDirectValue:null;
      let favoriteDirectObservedAt=Math.max(0,Number(context.favoriteDirectObservedAt)||0)||null;
      let favoritePartialPositiveAt=Math.max(0,Number(context.favoritePartialPositiveAt)||0)||null;
      if(!Object.prototype.hasOwnProperty.call(context,'favoriteDirectValue')&&Object.prototype.hasOwnProperty.call(context,'favorite')){
        if(context.favorite===true&&directSources.has(String(context.source))) { favoriteDirectValue=true;favoriteDirectObservedAt=favoriteDirectObservedAt||Number(context.favoriteAt)||Number(context.updatedAt)||null; }
        else if(context.favorite===true) favoritePartialPositiveAt=favoritePartialPositiveAt||Number(context.favoriteAt)||Number(context.updatedAt)||null;
        else if(context.favorite===false&&directSources.has(String(context.source))) { favoriteDirectValue=false;favoriteDirectObservedAt=favoriteDirectObservedAt||Number(context.updatedAt)||null; }
      }
      const createdAt=Math.max(0,Number(context.createdAt)||Number(context.updatedAt)||0);
      const output={...empty,...context,key,creatorKey,postId,liked:Boolean(context.liked),seen:Boolean(context.seen),likedAt:context.likedAt||null,seenAt:context.seenAt||null,favoriteDirectValue,favoriteDirectObservedAt,favoritePartialPositiveAt,createdAt,updatedAt:Math.max(0,Number(context.updatedAt)||0),source:String(context.source||'local')};
      delete output.favorite;delete output.favoriteAt;return output;
    },
    async get(context){return PostStatus.normalize(await Cache.getPostStatus(context.postKey||context.key)||PostStatus.empty(context));},
    async set(context,patch={},source='local') {
      const current=await PostStatus.get(context);const now=Date.now();const next=PostStatus.normalize({...current,...context,...patch,createdAt:current.createdAt||now,updatedAt:now,source});
      for(const field of ['liked','seen']){
        if(Object.prototype.hasOwnProperty.call(patch,field))next[`${field}At`]=patch[field]?now:null;
      }
      if(Object.prototype.hasOwnProperty.call(patch,'favoriteDirectValue'))next.favoriteDirectObservedAt=now;
      if(patch.favoritePartialPositive===true)next.favoritePartialPositiveAt=now;
      delete next.favoritePartialPositive;
      await Cache.putPostStatus(next);PostStatusEvents.emit({type:'change',postKey:next.key,creatorKey:next.creatorKey,status:next,changed:Object.keys(patch),previousResolvedState:FavoriteStateResolver.resolve({postStatus:current}),currentResolvedState:FavoriteStateResolver.resolve({postStatus:next}),source});return next;
    },
    async toggle(context,field) {
      if(!['liked','seen'].includes(field))throw new Error(`Unsupported local status: ${field}`);
      const current=await PostStatus.get(context);return PostStatus.set(context,{[field]:!current[field]},'local');
    },
    icon(field){return field==='liked'?Icons.heart:field==='seen'?Icons.eye:Icons.star;},
    label(field){return field==='liked'?'Like':field==='seen'?'Seen':'Favorite';},
  };

  const FavoriteStateResolver = {
    resolve({postKey='',postStatus=null,snapshotMeta=null,snapshotMembership=null}={}) {
      const status=PostStatus.normalize(postStatus||{key:postKey});const directAt=Number(status.favoriteDirectObservedAt)||0;const partialAt=Number(status.favoritePartialPositiveAt)||0;const snapshotAt=snapshotMeta?.complete?Number(snapshotMeta.completedAt)||0:0;
      if(directAt&&directAt>snapshotAt)return status.favoriteDirectValue;
      if(partialAt&&partialAt>snapshotAt)return true;
      if(snapshotAt&&typeof snapshotMembership?.has==='function')return snapshotMembership.has(status.key||postKey);
      if(status.favoriteDirectValue===true||status.favoriteDirectValue===false)return status.favoriteDirectValue;
      if(partialAt)return true;
      return null;
    },
  };

  const PostStatusFilters = {
    states:new Set(['off','match','no-match']),value:{favorite:'off',liked:'off',seen:'off'},
    normalize(value={}){return Object.fromEntries(['favorite','liked','seen'].map((field)=>[field,PostStatusFilters.states.has(value?.[field])?value[field]:'off']));},
    load(){PostStatusFilters.value=PostStatusFilters.normalize(GM_getValue(Config.postStatusFiltersKey,null)||{});GM_setValue(Config.postStatusFiltersKey,PostStatusFilters.value);return PostStatusFilters.value;},
    save(value=PostStatusFilters.value){PostStatusFilters.value=PostStatusFilters.normalize(value);GM_setValue(Config.postStatusFiltersKey,PostStatusFilters.value);return PostStatusFilters.value;},
    cycle(field){const order=['off','match','no-match'];const current=PostStatusFilters.value[field]||'off';PostStatusFilters.value[field]=order[(order.indexOf(current)+1)%order.length];return PostStatusFilters.save();},
  };

  const FavoriteSyncCoordinator = {
    active:null,inflight:null,listeners:new Set(),
    subscribe(listener){FavoriteSyncCoordinator.listeners.add(listener);listener(FavoriteSyncCoordinator.snapshot());return()=>FavoriteSyncCoordinator.listeners.delete(listener);},
    snapshot(){const state=FavoriteSyncCoordinator.active?{running:true,...FavoriteSyncCoordinator.active}:{running:false,...(GM_getValue(Config.favoriteSyncKey,{})||{})};delete state.promise;delete state.controller;return state;},
    notify(){const snapshot=FavoriteSyncCoordinator.snapshot();FavoriteSyncCoordinator.listeners.forEach((listener)=>{try{listener(snapshot);}catch(error){Logger.warn('Favorite sync subscriber failed.',error);}});},
    discoverUrl(doc=document) {
      const account=[...doc.querySelectorAll?.('nav,aside,[class*="sidebar"],[class*="account"]')||[]].find((node)=>/\baccount\b/i.test(node.textContent||''))||doc;
      const anchor=[...account.querySelectorAll?.('a[href]')||[]].find((link)=>/^\s*(?:★\s*)?favorites?\s*$/i.test(String(link.textContent||'').trim()));
      if(anchor?.href)return new URL(anchor.href,location.origin).href;
      const href=anchor?.getAttribute?.('href');return href?new URL(href,location.origin).href:'';
    },
    retryDelay(response){const seconds=Number(response?.headers?.get?.('Retry-After'));return Number.isFinite(seconds)&&seconds>0?seconds*1000:Config.defaultRateLimitDelayMs;},
    pageLinks(doc,currentUrl) {
      const current=new URL(currentUrl,location.origin);const currentOffset=Math.max(0,Util.parseInteger(current.searchParams.get('o'),0));const candidates=[];
      for(const anchor of [...doc.querySelectorAll?.('a[href]')||[]]){
        let url;try{url=new URL(anchor.getAttribute?.('href')||anchor.href,current);}catch{continue;}
        if(url.origin!==current.origin||url.pathname!==current.pathname)continue;
        const offset=Math.max(0,Util.parseInteger(url.searchParams.get('o'),0));
        const text=String(anchor.textContent||anchor.getAttribute?.('aria-label')||'').trim();if(offset>currentOffset&&(/\bnext\b|^>$|^»$/i.test(text)||anchor.rel==='next'))candidates.push(url);
      }
      candidates.sort((a,b)=>Util.parseInteger(a.searchParams.get('o'),0)-Util.parseInteger(b.searchParams.get('o'),0));
      return candidates[0]?.href||'';
    },
    postContexts(doc) {
      const result=new Map();
      const cards=[...doc.querySelectorAll?.('article.post-card,[data-id][data-service][data-user]')||[]];
      for(const card of cards){
        const id=String(card.dataset?.id||'');const service=String(card.dataset?.service||'');const user=String(card.dataset?.user||card.dataset?.creatorId||'');
        if(id&&service&&user){const context=Route.parsePostUrl(`/${encodeURIComponent(service)}/user/${encodeURIComponent(user)}/post/${encodeURIComponent(id)}`);if(context)result.set(context.postKey,context);}
        for(const anchor of [...card.querySelectorAll?.('a[href]')||[]]){const context=Route.parsePostUrl(anchor.getAttribute?.('href')||anchor.href);if(context)result.set(context.postKey,context);}
      }
      return result;
    },
    async fetchPage(url,signal) {
      for(let attempt=0;attempt<2;attempt+=1){
        await CatalogueRequestScheduler.waitTurn({signal,operation:'favorite-sync',requestKind:'favorites-page'});
        const response=await fetch(url,{credentials:'same-origin',signal,headers:{Accept:'text/html'}});
        if(response.status===429){const wait=FavoriteSyncCoordinator.retryDelay(response);CatalogueRequestScheduler.applyRateLimit(wait,{requestKind:'favorites-page'});if(attempt===0)continue;}
        if(!response.ok)throw new Error(`Favorites page returned HTTP ${response.status}.`);
        return new DOMParser().parseFromString(await response.text(),'text/html');
      }
      throw new Error('Favorites page remained rate limited.');
    },
    verifyPage(doc,url) {
      const text=String(doc?.body?.textContent||'');const parsed=new URL(url,location.origin);
      if(/sign\s*in|log\s*in/i.test(text)&&!/favorites?/i.test(text))throw new Error('Pawchive returned a signed-out page.');
      if(/forbidden|permission denied|not authorized/i.test(text))throw new Error('Pawchive denied access to Favorites.');
      if(!/favorites?/i.test(text)&&!doc.querySelector?.('article.post-card,[data-id]'))throw new Error('The expected Pawchive Favorites page was not found.');
      return parsed;
    },
    async runInternal({url=FavoriteSyncCoordinator.discoverUrl(),manual=false,force=manual,reason=manual?'manual':'catalogue'}={}) {
      if(!url)throw new Error('The native Pawchive Favorites link was not found. Sign in and try again.');
      const host=new URL(url,location.origin).hostname.toLowerCase();const previousMeta=await Cache.getFavoriteSyncMeta(host);
      if(!force&&previousMeta?.complete&&Date.now()-(Number(previousMeta.completedAt)||0)<Config.favoriteSnapshotFreshMs)return previousMeta;
      const ownsMaintenanceSlot=!String(reason).startsWith('catalogue-');if(ownsMaintenanceSlot)await CatalogueJobManager.acquireMaintenanceSlot();
      const controller=new AbortController();const state={startedAt:Date.now(),page:0,found:0,manual,reason,status:'running',message:'Synchronizing native favorites…',controller,url,host};FavoriteSyncCoordinator.active=state;FavoriteSyncCoordinator.notify();
      const promise=(async()=>{
        const found=new Map();const visited=new Set();const signatures=new Set();let next=url;let complete=false;
        while(next){
          if(visited.has(next))throw new Error('Favorites pagination repeated before a verified end.');
          visited.add(next);state.page+=1;state.message=`Scanning Favorites page ${state.page}…`;FavoriteSyncCoordinator.notify();const doc=await FavoriteSyncCoordinator.fetchPage(next,controller.signal);FavoriteSyncCoordinator.verifyPage(doc,next);
          const pageFound=FavoriteSyncCoordinator.postContexts(doc);const signature=[...pageFound.keys()].sort().join('|');if(signatures.has(signature)&&pageFound.size)throw new Error('Favorites pagination repeated the same posts.');signatures.add(signature);
          pageFound.forEach((context,key)=>found.set(key,context));state.partialFound=[...found.values()];state.found=found.size;FavoriteSyncCoordinator.notify();const following=FavoriteSyncCoordinator.pageLinks(doc,next);
          if(!following){complete=true;break;}next=following;
        }
        if(!complete)throw new Error('Favorites crawl ended without verified completion.');
        const now=Date.now();const records=[];
        for(const context of found.values()){
          const prior=await Cache.getPostStatus(context.postKey);records.push(PostStatus.normalize({...PostStatus.empty(context),...(prior||{}),...context,favoritePartialPositiveAt:Math.max(Number(prior?.favoritePartialPositiveAt)||0,now),updatedAt:now,source:'native-favorites-sync'}));
        }
        if(records.length)await Cache.putPostStatuses(records);const snapshotId=`favorites-${now}-${Math.random().toString(36).slice(2)}`;const summary=await Cache.commitFavoriteSnapshot(host,snapshotId,found.keys(),{pagesScanned:state.page,sourceUrl:url});
        summary.count=found.size;summary.pages=state.page;summary.manual=manual;state.status='complete';state.message=`Synchronized ${found.size} native favorite${found.size===1?'':'s'}.`;PostStatusEvents.emit({type:'favorites-sync',postKey:null,creatorKey:null,statuses:records,changed:['favorite'],previousResolvedState:null,currentResolvedState:null,source:'native-favorites-sync',summary});return summary;
      })().catch(async(error)=>{const stopped=error?.name==='AbortError';const now=Date.now();const positives=[];for(const context of (state.partialFound||[])){const prior=await Cache.getPostStatus(context.postKey);positives.push(PostStatus.normalize({...PostStatus.empty(context),...(prior||{}),favoritePartialPositiveAt:now,updatedAt:now,source:'native-favorites-partial'}));}if(positives.length)await Cache.putPostStatuses(positives);await Cache.noteFavoriteSyncAttempt(host,stopped?'stopped':'failed',{lastError:stopped?'Synchronization stopped.':error.message});throw error;}).finally(()=>{FavoriteSyncCoordinator.active=null;if(ownsMaintenanceSlot)CatalogueJobManager.releaseMaintenanceSlot();FavoriteSyncCoordinator.notify();});
      state.promise=promise;return promise;
    },
    run(options={}){if(FavoriteSyncCoordinator.inflight)return FavoriteSyncCoordinator.inflight;const pending=FavoriteSyncCoordinator.runInternal(options);FavoriteSyncCoordinator.inflight=pending;const clear=()=>{if(FavoriteSyncCoordinator.inflight===pending)FavoriteSyncCoordinator.inflight=null;};pending.then(clear,clear);return pending;},
    ensureFresh(options={}){return FavoriteSyncCoordinator.run({...options,force:Boolean(options.force)});},
    start(options={}){return FavoriteSyncCoordinator.run(options);},
    status(){return FavoriteSyncCoordinator.snapshot();},
    stop(){FavoriteSyncCoordinator.active?.controller?.abort();},
  };

  const PawchiveAPI = {
    endpointTemplates(context, offset) {
      const base = `/${encodeURIComponent(context.service)}/user/${encodeURIComponent(context.creatorId)}`;
      const fields = encodeURIComponent(Config.creatorListFields.join(','));
      return [
        `/api/v1${base}/posts?o=${offset}&fields=${fields}`,
        `/api/v1${base}/posts?o=${offset}`,
        `/api/v1${base}?o=${offset}`,
        `/api${base}?o=${offset}`,
        `/api/v1${base}?offset=${offset}&limit=${Config.pageSize}`,
      ];
    },
    normalizeCreatorListPayload(payload) {
      const warnings = [];
      if (Array.isArray(payload)) return { posts: payload, rawShape: 'array', warnings };
      if (payload && typeof payload === 'object') {
        if (Array.isArray(payload.posts)) return { posts: payload.posts, rawShape: 'object.posts', warnings };
        if (Array.isArray(payload.data)) return { posts: payload.data, rawShape: 'object.data', warnings };
        if (payload.data && typeof payload.data === 'object' && Array.isArray(payload.data.posts)) return { posts: payload.data.posts, rawShape: 'object.data.posts', warnings };
        const nested = Object.entries(payload).find(([, value]) => Array.isArray(value));
        if (nested) {
          warnings.push(`Used unexpected array wrapper: ${nested[0]}`);
          return { posts: nested[1], rawShape: `object.${nested[0]}`, warnings };
        }
        throw new Error('Creator-list response contained no recognized post array.');
      }
      throw new Error(`Creator-list response was not an object or array (${payload === null ? 'null' : typeof payload}).`);
    },
    normalizeResponse(payload) { return PawchiveAPI.normalizeCreatorListPayload(payload); },
    plausiblePost(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value) && (value.id != null || value.post_id != null)); },
    parsePostDetailPayload(payload, expectedPostId = '') {
      const expected = String(expectedPostId || '');
      let candidates = []; let responseShape = 'invalid';
      if (Array.isArray(payload)) { candidates = payload.filter(PawchiveAPI.plausiblePost); responseShape = 'array'; }
      else if (PawchiveAPI.plausiblePost(payload?.data?.post)) { candidates = [payload.data.post]; responseShape = 'nested-data-post'; }
      else if (PawchiveAPI.plausiblePost(payload?.post)) { candidates = [payload.post]; responseShape = 'post-wrapper'; }
      else if (PawchiveAPI.plausiblePost(payload?.data)) { candidates = [payload.data]; responseShape = 'data-wrapper'; }
      else if (PawchiveAPI.plausiblePost(payload)) { candidates = [payload]; responseShape = 'plain-object'; }
      const matching = expected ? candidates.find((item) => String(item.id ?? item.post_id ?? '') === expected) : candidates[0];
      const post = matching || (!expected ? candidates[0] : null);
      return { post: post || null, responseShape: post ? responseShape : 'invalid' };
    },
    normalizePostDetailPayload(payload, expectedPostId = '') { return PawchiveAPI.parsePostDetailPayload(payload, expectedPostId).post; },
    detailMissingFields(raw, { verify = false } = {}) {
      const source = raw && typeof raw === 'object' ? raw : {};
      const missing = [];
      if (PawchiveData.normalizeAttachments(source.attachments, { provided:Object.prototype.hasOwnProperty.call(source, 'attachments') }).status === 'invalid') missing.push('attachments');
      if (Object.prototype.hasOwnProperty.call(source, 'content') && source.content != null && typeof source.content !== 'string') missing.push('content');
      const tagsNeeded = Settings.value.projectEvidence.tags || App.filterState.customRules.rows.some((rule) => rule.fields?.tags);
      if (tagsNeeded && PawchiveData.normalizeTags(source.tags, { provided:Object.prototype.hasOwnProperty.call(source, 'tags') }).status === 'invalid') missing.push('tags');
      if (PawchiveData.normalizeFileValue(Object.prototype.hasOwnProperty.call(source, 'file') ? source.file : undefined).status === 'invalid') missing.push('file');
      if (verify && !missing.length) missing.push('verify');
      return missing;
    },
    async fetchJson(url, outerSignal, onWait, request={}) {
      let lastError;
      const attempts = Settings.value.retryFailed ? Config.retries : 1;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (attempt > 0) {
          const delay = Config.retryDelays[attempt] || Config.retryDelays.at(-1);
          onWait?.(`Retrying in ${Math.ceil(delay / 1000)}s…`);
          await Util.sleep(delay, outerSignal);
        }
        await CatalogueRequestScheduler.waitTurn({...request,signal:outerSignal});
        const timeoutController = new AbortController();
        const timeout = setTimeout(() => timeoutController.abort(), Config.requestTimeoutMs);
        const abort = () => timeoutController.abort();
        outerSignal?.addEventListener('abort', abort, { once: true });
        try {
          const response = await fetch(url, {
            method: 'GET', credentials: 'same-origin', signal: timeoutController.signal,
            headers: { Accept: 'application/json, text/plain;q=0.9, */*;q=0.1' },
          });
          if (response.status === 429) {
            const retryHeader = response.headers.get('Retry-After');
            const seconds = Number(retryHeader);
            const dateDelay = Date.parse(retryHeader || '') - Date.now();
            const wait = Number.isFinite(seconds)&&seconds>0 ? seconds * 1000 : (dateDelay > 0 ? dateDelay : Config.defaultRateLimitDelayMs);
            onWait?.(`Rate limited; waiting ${Math.ceil(wait / 1000)}s…`);
            CatalogueRequestScheduler.applyRateLimit(wait,request);
            lastError = new Error('HTTP 429');
            continue;
          }
          if (!response.ok) { const httpError = new Error(`HTTP ${response.status}`); httpError.status = response.status; throw httpError; }
          const text = await response.text();
          if (!text.trim()) return null;
          try { return JSON.parse(text); } catch { throw new Error('Response was not valid JSON'); }
        } catch (error) {
          if (outerSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
          lastError = timeoutController.signal.aborted ? new Error('Request timed out') : error;
        } finally {
          clearTimeout(timeout);
          outerSignal?.removeEventListener('abort', abort);
        }
      }
      throw lastError || new Error('Request failed');
    },
    async fetchCreatorPage(context, offset, workingEndpoint, signal, onWait, { allowOutOfRange400 = false, operation='', jobId='' } = {}) {
      const candidates = PawchiveAPI.endpointTemplates(context, offset);
      if (workingEndpoint != null) {
        const index = Util.clamp(Util.parseInteger(workingEndpoint, 0), 0, candidates.length - 1);
        candidates.unshift(...candidates.splice(index, 1));
      }
      const errors = []; let allBadRequest = true;
      for (const candidate of candidates) {
        try {
          const payload = await PawchiveAPI.fetchJson(candidate, signal, onWait,{operation,creatorKey:context.creatorKey,jobId,requestKind:'creator-list'});
          const normalized = PawchiveAPI.normalizeCreatorListPayload(payload);
          return { ...normalized, endpointIndex: PawchiveAPI.endpointTemplates(context, offset).indexOf(candidate), url: candidate };
        } catch (error) {
          if (error.name === 'AbortError') throw error;
          if (error.status !== 400) allBadRequest = false;
          errors.push(`${candidate}: ${error.message}`);
        }
      }
      if (allowOutOfRange400 && offset > 0 && allBadRequest) return { posts: [], rawShape:'http-400-end', warnings:[], endpointIndex:workingEndpoint ?? 0, url:'', endReason:'http-400' };
      throw new Error(`All creator endpoints failed. ${errors.join(' | ')}`);
    },
    async fetchPostDetail(context, postId, signal, onWait, request={}) {
      const url = `/api/v1/${encodeURIComponent(context.service)}/user/${encodeURIComponent(context.creatorId)}/post/${encodeURIComponent(postId)}`;
      const payload = await PawchiveAPI.fetchJson(url, signal, onWait,{...request,creatorKey:context.creatorKey,requestKind:'post-detail'});
      const parsed = PawchiveAPI.parsePostDetailPayload(payload, postId);
      Logger.info('Post detail payload', { postId:String(postId), responseShape:parsed.responseShape });
      return parsed.post;
    },
  };

  const FilterEngine = {
    createDefaultState(legacyFilter = '') {
      const state = Util.clone(DefaultFilterState);
      if (!legacyFilter) return state;
      Object.keys(state.media.enabled).forEach((key) => { state.media.enabled[key] = false; });
      if (['video', 'any-video'].includes(legacyFilter)) state.media.enabled.videos = true;
      else if (legacyFilter === 'mp4') { state.media.enabled.customExtensions = true; state.customExtensions.values = ['mp4']; }
      else if (legacyFilter === 'images') state.media.enabled.images = true;
      else if (legacyFilter === 'archives') state.media.enabled.archives = true;
      else if (['likely-external', 'any-external'].includes(legacyFilter)) {
        state.media.enabled.externalLinks = true;
        state.externalLinks.scope = legacyFilter === 'any-external' ? 'any' : 'media-download';
      } else if (legacyFilter === 'video-or-external') {
        state.media.enabled.videos = true; state.media.enabled.externalLinks = true; state.media.matchMode = 'any';
      }
      return state;
    },
    normalizeState(input) {
      const state = Util.clone(DefaultFilterState);
      const source = input && typeof input === 'object' ? input : {};
      state.media.enabled = { ...state.media.enabled, ...(source.media?.enabled || {}) };
      state.media.matchMode = source.media?.matchMode === 'any' ? 'any' : 'all';
      state.externalLinks.scope = source.externalLinks?.scope === 'any' ? 'any' : 'media-download';
      state.customExtensions.values = Util.normalizeExtensions(source.customExtensions?.values || []).values;
      state.customRules.enabled = Boolean(source.customRules?.enabled);
      state.customRules.rows = Array.isArray(source.customRules?.rows) ? source.customRules.rows.map(FilterEngine.normalizeRule) : [];
      state.publishedDate = { ...state.publishedDate, ...(source.publishedDate || {}), enabled: Boolean(source.publishedDate?.enabled), includeUnknown: Boolean(source.publishedDate?.includeUnknown) };
      return state;
    },
    normalizeRule(rule = {}) {
      return {
        connector: rule.connector === 'or' ? 'or' : 'and',
        mode: rule.mode === 'no-match' ? 'no-match' : 'match',
        text: String(rule.text || ''),
        fields: {
          title: rule.fields?.title !== false,
          attachmentFilenames: rule.fields?.attachmentFilenames !== false,
          tags: rule.fields?.tags !== false,
          contentText: rule.fields?.contentText !== false,
        },
      };
    },
    enabledCategories(state) { return Config.mediaCategories.map(([key]) => key).filter((key) => state.media.enabled[key]); },
    customExtensionCount(post, state) {
      const wanted = new Set(state.customExtensions.values);
      return (post.fileExtensions || []).filter((ext) => wanted.has(ext)).length;
    },
    mediaPredicate(post, state) {
      const categories = FilterEngine.enabledCategories(state);
      if (!categories.length) return true;
      const results = categories.map((category) => ({
        videos: Boolean(post.hasVideo), images: Boolean(post.hasImages), archives: Boolean(post.hasArchives),
        projectFiles: Boolean(post.hasProjectFiles),
        externalLinks: state.externalLinks.scope === 'any' ? Boolean(post.hasExternalLinks) : Boolean(post.mediaDownloadLinkCount || post.hasLikelyExternalMedia),
        customExtensions: FilterEngine.customExtensionCount(post, state) > 0,
      })[category]);
      return state.media.matchMode === 'all' ? results.every(Boolean) : results.some(Boolean);
    },
    rulePredicate(post, rule) {
      const needle = rule.text.trim().toLocaleLowerCase();
      if (!needle) return null;
      const fields = post.searchFields || {};
      const selected = Object.entries(rule.fields).filter(([, enabled]) => enabled).map(([field]) => field);
      const found = selected.some((field) => {
        const value = Array.isArray(fields[field]) ? fields[field].join('\n') : String(fields[field] || '');
        return value.toLocaleLowerCase().includes(needle);
      });
      return rule.mode === 'no-match' ? !found : found;
    },
    customRulesPredicate(post, state) {
      if (!state.customRules.enabled) return true;
      const rows = state.customRules.rows.map((row) => ({ row, value: FilterEngine.rulePredicate(post, row) })).filter((item) => item.value !== null);
      if (!rows.length) return true;
      let result = rows[0].value;
      for (let index = 1; index < rows.length; index += 1) result = rows[index].row.connector === 'or' ? (result || rows[index].value) : (result && rows[index].value);
      return result;
    },
    validISODate(value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
      const date = new Date(`${value}T00:00:00Z`);
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    },
    dateValidation(filter) {
      if (!filter.enabled) return { valid: true, message: '' };
      if (!['after', 'before', 'between'].includes(filter.mode)) return { valid: false, message: 'Choose a valid date mode.' };
      if ((filter.mode === 'after' || filter.mode === 'between') && !FilterEngine.validISODate(filter.from)) return { valid: false, message: 'Enter a valid start date.' };
      if ((filter.mode === 'before' || filter.mode === 'between') && !FilterEngine.validISODate(filter.to)) return { valid: false, message: 'Enter a valid end date.' };
      if (filter.mode === 'between' && filter.from > filter.to) return { valid: false, message: 'Start date must not be after end date.' };
      return { valid: true, message: '' };
    },
    publishedDatePredicate(post, state) {
      const filter = state.publishedDate;
      if (!filter.enabled) return true;
      if (!FilterEngine.dateValidation(filter).valid) return false;
      const date = String(post.publishedAt || '').slice(0, 10);
      if (!FilterEngine.validISODate(date)) return Boolean(filter.includeUnknown);
      if (filter.mode === 'after') return date >= filter.from;
      if (filter.mode === 'before') return date <= filter.to;
      return date >= filter.from && date <= filter.to;
    },
    quickSearchPredicate(post, query) {
      const needle = String(query || '').trim().toLocaleLowerCase();
      if (!needle) return true;
      const fields = post.searchFields || {};
      return [fields.title, ...(fields.attachmentFilenames || []), ...(fields.tags || []), fields.contentText].some((value) => String(value || '').toLocaleLowerCase().includes(needle));
    },
    statusPredicate(status,filters=PostStatusFilters.value) {
      const normalized=PostStatus.normalize(status||{});const favorite=status?.resolvedFavorite??FavoriteStateResolver.resolve({postStatus:normalized});
      return ['favorite','liked','seen'].every((field)=>{
        const mode=filters?.[field]||'off';if(mode==='off')return true;
        const value=field==='favorite'?favorite:Boolean(normalized[field]);
        if(field==='favorite'&&value===null)return false;
        return mode==='match'?value===true:value===false;
      });
    },
    matches(post, state, query = '', status = null) {
      if (!post) return false;
      if(Settings.value.excludePostsWithMissingAttachments&&post.missingStatsKnown&&post.hasMissingStats)return false;
      return FilterEngine.mediaPredicate(post, state)
        && FilterEngine.customRulesPredicate(post, state)
        && FilterEngine.publishedDatePredicate(post, state)
        && FilterEngine.statusPredicate(status,PostStatusFilters.value)
        && FilterEngine.quickSearchPredicate(post, query);
    },
    categories(state) { return FilterEngine.enabledCategories(state); },
  };

  const PostSorter = {
    modes: new Set(['published','title']),
    directions: new Set(['default','reverse']),
    normalize(mode, direction) {
      return {
        mode: PostSorter.modes.has(mode) ? mode : 'published',
        direction: PostSorter.directions.has(direction) ? direction : 'default',
      };
    },
    timestamp(post) {
      const value=Date.parse(post?.publishedAt||'');
      return Number.isFinite(value)?value:null;
    },
    compareIds(a,b) {
      return String(a?.id||'').localeCompare(String(b?.id||''),undefined,{numeric:true,sensitivity:'base'});
    },
    stableFallback(a,b) {
      const aTime=PostSorter.timestamp(a.post);
      const bTime=PostSorter.timestamp(b.post);
      if(aTime!==null&&bTime!==null&&aTime!==bTime)return bTime-aTime;
      if(aTime!==null&&bTime===null)return -1;
      if(aTime===null&&bTime!==null)return 1;
      return PostSorter.compareIds(a.post,b.post)||a.index-b.index;
    },
    sort(posts, options = {}) {
      const {mode,direction}=PostSorter.normalize(options.mode,options.direction);
      const reverse=direction==='reverse';
      return [...posts].map((post,index)=>({post,index})).sort((a,b)=>{
        let primary=0;
        if(mode==='published'){
          const aTime=PostSorter.timestamp(a.post);
          const bTime=PostSorter.timestamp(b.post);
          if(aTime===null&&bTime!==null)return 1;
          if(aTime!==null&&bTime===null)return -1;
          if(aTime!==null&&bTime!==null&&aTime!==bTime)primary=reverse?aTime-bTime:bTime-aTime;
        }else{
          primary=String(a.post?.title||'').localeCompare(String(b.post?.title||''),undefined,{numeric:true,sensitivity:'base'});
          if(reverse)primary*=-1;
        }
        return primary||PostSorter.stableFallback(a,b);
      }).map(({post})=>post);
    },
    nextSelection(currentMode,currentDirection,selectedMode) {
      const current=PostSorter.normalize(currentMode,currentDirection);
      if(selectedMode!==current.mode)return PostSorter.normalize(selectedMode,'default');
      return {mode:current.mode,direction:current.direction==='default'?'reverse':'default'};
    },
    label(mode,direction) {
      const normalized=PostSorter.normalize(mode,direction);
      const title=normalized.mode==='published'?'Publish date':'Post title';
      const spoken=normalized.mode==='published'
        ? (normalized.direction==='default'?'newest to oldest':'oldest to newest')
        : (normalized.direction==='default'?'A to Z':'Z to A');
      return {title,spoken,arrow:normalized.direction==='default'?'▼':'▲'};
    },
  };

  const FilterSummary = {
    names(state) {
      const normalized = FilterEngine.normalizeState(state);
      const names = Object.fromEntries(Config.mediaCategories);
      const active = FilterEngine.enabledCategories(normalized).map((key) => names[key]);
      if (normalized.customRules.enabled) active.push('Custom search rules');
      if (normalized.publishedDate.enabled) active.push('Published date');
      return active;
    },
    label(state) {
      const active = FilterSummary.names(state);
      if (!active.length) return 'All posts';
      if (active.length <= 3) return active.join(' + ');
      return `${active.length} Filters`;
    },
  };

  const CatalogueModel = {
    empty() {
      return {
        catalogue: {
          status: 'none', totalExpectedPosts: 0, storedPostCount: 0,
          pageCoverage: {}, successfulOffsets: [], failedOffsets: [],
          retryableMetadataIds: [], retryableMetadataReasons: {},
          fieldAvailability: CatalogueMetadataPolicy.emptyAvailability(),
          malformedListRecords: [], paginationEndReached: false, endReason: '',
          fullBuildCoverageComplete: false, lastMetadataRetryAt: 0,
          lastFullBuildAt: 0, lastUpdateCheckAt: 0,
          metadataPolicyVersion: 0,
          persistentStorageRequested: false, persistentStorageGranted: null,
          creatorCardSummary: null,
        },
      };
    },
    normalize(source = {}, { restoreTransient = true } = {}) {
      const empty = CatalogueModel.empty(); const catalogue = source.catalogue || {};
      let status = ['none','building','partial','complete','updating'].includes(catalogue.status) ? catalogue.status : 'none';
      if (restoreTransient && status === 'building') status = 'partial';
      if (restoreTransient && status === 'updating') status = 'complete';
      const uniqueOffsets = (value) => [...new Set((Array.isArray(value) ? value : []).filter((item) => Number.isInteger(item) && item >= 0 && item % Config.pageSize === 0))].sort((a,b) => a-b);
      const legacySuccessfulOffsets = uniqueOffsets(catalogue.successfulOffsets);
      const rawCoverage = Array.isArray(catalogue.pageCoverage)
        ? Object.fromEntries(catalogue.pageCoverage.map((manifest) => [String(manifest?.offset), manifest]))
        : (catalogue.pageCoverage && typeof catalogue.pageCoverage === 'object' ? catalogue.pageCoverage : {});
      const pageCoverage = {};
      Object.entries(rawCoverage).forEach(([key, value]) => {
        const offset = Util.parseInteger(value?.offset ?? key, -1);
        if (offset < 0 || offset % Config.pageSize !== 0) return;
        pageCoverage[String(offset)] = {
          offset,
          rawCount: Number.isInteger(value?.rawCount) && value.rawCount >= 0 ? value.rawCount : null,
          usableCount: Number.isInteger(value?.usableCount) && value.usableCount >= 0 ? value.usableCount : null,
          postIds: Util.unique((Array.isArray(value?.postIds) ? value.postIds : []).map(String).filter(Boolean)),
          invalidRecordCount: Math.max(0, Util.parseInteger(value?.invalidRecordCount, 0)),
          fetchedAt: Number(value?.fetchedAt) || 0,
          endpointIndex: Number.isInteger(value?.endpointIndex) ? value.endpointIndex : null,
          finalPage: Boolean(value?.finalPage),
          endReason: String(value?.endReason || ''),
          legacy: Boolean(value?.legacy),
          fieldAvailability: value?.fieldAvailability || null,
        };
      });
      legacySuccessfulOffsets.forEach((offset) => {
        if (pageCoverage[String(offset)]) return;
        pageCoverage[String(offset)] = {
          offset, rawCount: null, usableCount: null, postIds: [], invalidRecordCount: 0,
          fetchedAt: Number(catalogue.lastFullBuildAt || catalogue.lastUpdateCheckAt) || 0,
          endpointIndex: null, finalPage: false, endReason: '', legacy: true,
        };
      });
      const successfulOffsets = Object.keys(pageCoverage).map(Number).filter(Number.isFinite).sort((a,b) => a-b);
      const successfulSet = new Set(successfulOffsets);
      const legacyIds = Util.unique((catalogue.retryableMetadataIds || catalogue.incompleteMetadataIds || catalogue.unresolvedPostIds || []).map(String));
      const reasonSource = catalogue.retryableMetadataReasons || catalogue.incompleteMetadataReasons || {};
      const retryableMetadataReasons = {};
      const retryableMetadataIds = legacyIds.filter((id) => {
        const reasons = Util.unique((Array.isArray(reasonSource[id]) ? reasonSource[id] : []).map(String).filter(CatalogueMetadataPolicy.legacyReasonRetryable));
        if (!reasons.length) return false;
        retryableMetadataReasons[id] = reasons;
        return true;
      });
      const malformedListRecords = (Array.isArray(catalogue.malformedListRecords) ? catalogue.malformedListRecords : []).map((item) => ({
        offset: Math.max(0, Util.parseInteger(item?.offset, 0)),
        index: Math.max(0, Util.parseInteger(item?.index, 0)),
        reason: String(item?.reason || 'Malformed creator-list record'),
      }));
      const normalized = {
        catalogue: {
          ...empty.catalogue, status,
          totalExpectedPosts: Math.max(0, Util.parseInteger(catalogue.totalExpectedPosts, 0)),
          storedPostCount: Math.max(0, Util.parseInteger(catalogue.storedPostCount, 0)),
          pageCoverage, successfulOffsets,
          failedOffsets: uniqueOffsets(catalogue.failedOffsets).filter((offset) => !successfulSet.has(offset)),
          retryableMetadataIds, retryableMetadataReasons,
          fieldAvailability: Object.keys(pageCoverage).length ? CatalogueMetadataPolicy.mergeAvailability(pageCoverage) : (catalogue.fieldAvailability || CatalogueMetadataPolicy.emptyAvailability()),
          malformedListRecords,
          paginationEndReached: Boolean(catalogue.paginationEndReached),
          endReason: String(catalogue.endReason || (catalogue.paginationEndReached ? 'legacy-pagination-end' : '')),
          fullBuildCoverageComplete: Boolean(catalogue.fullBuildCoverageComplete || catalogue.status === 'complete'),
          lastMetadataRetryAt: Number(catalogue.lastMetadataRetryAt) || 0,
          lastFullBuildAt: Number(catalogue.lastFullBuildAt) || 0,
          lastUpdateCheckAt: Number(catalogue.lastUpdateCheckAt) || 0,
          metadataPolicyVersion: Math.max(0, Util.parseInteger(catalogue.metadataPolicyVersion, 0)),
          persistentStorageRequested: Boolean(catalogue.persistentStorageRequested),
          persistentStorageGranted: typeof catalogue.persistentStorageGranted === 'boolean' ? catalogue.persistentStorageGranted : null,
          creatorCardSummary: catalogue.creatorCardSummary && typeof catalogue.creatorCardSummary === 'object' ? Util.clone(catalogue.creatorCardSummary) : null,
        },
      };
      const coverage = CatalogueModel.evaluateCoverage(normalized.catalogue);
      const legacyCatalogue=source.storageMode==='catalogue'||Object.keys(normalized.catalogue.pageCoverage).length>0||normalized.catalogue.totalExpectedPosts>0||normalized.catalogue.storedPostCount>0;
      if (legacyCatalogue && restoreTransient && status !== 'building' && status !== 'updating') normalized.catalogue.status = coverage.nextStatus;
      return normalized;
    },
    requiredOffsets(totalPosts) {
      const count = Math.max(0, Util.parseInteger(totalPosts, 0));
      return Array.from({ length: Math.ceil(count / Config.pageSize) }, (_, index) => index * Config.pageSize);
    },
    coveredOffsets(pageCoverage = {}) {
      return Object.keys(pageCoverage || {}).map(Number).filter((offset) => Number.isInteger(offset) && offset >= 0 && offset % Config.pageSize === 0).sort((a,b) => a-b);
    },
    missingOffsets(totalPosts, pageCoverage) {
      const covered = new Set(Array.isArray(pageCoverage) ? pageCoverage : CatalogueModel.coveredOffsets(pageCoverage));
      return CatalogueModel.requiredOffsets(totalPosts).filter((offset) => !covered.has(offset));
    },
    evaluateCoverage(catalogue = {}, { operation = '' } = {}) {
      const totalExpectedPosts = Math.max(0, Util.parseInteger(catalogue.totalExpectedPosts, 0));
      const storedPostCount = Math.max(0, Util.parseInteger(catalogue.storedPostCount, 0));
      const requiredOffsets = CatalogueModel.requiredOffsets(totalExpectedPosts);
      const coveredOffsets = CatalogueModel.coveredOffsets(catalogue.pageCoverage);
      const coveredSet = new Set(coveredOffsets);
      const failedOffsets = [...new Set(catalogue.failedOffsets || [])].filter((offset) => !coveredSet.has(offset)).sort((a,b) => a-b);
      const missingOffsets = requiredOffsets.filter((offset) => !coveredSet.has(offset));
      const endEstablished = Boolean(catalogue.endReason || catalogue.paginationEndReached || totalExpectedPosts > 0);
      const coverageComplete = Boolean(catalogue.fullBuildCoverageComplete) || (endEstablished && missingOffsets.length === 0 && failedOffsets.length === 0);
      const retryableMetadataCount = Util.unique((catalogue.retryableMetadataIds || []).map(String)).length;
      const malformedListRecordCount = (catalogue.malformedListRecords || []).length
        || Object.values(catalogue.pageCoverage || {}).reduce((total, manifest) => total + Math.max(0, Util.parseInteger(manifest?.invalidRecordCount, 0)), 0);
      const nextStatus = ['build','verification'].includes(operation) ? 'building' : operation === 'update' ? 'updating' : coverageComplete ? 'complete' : 'partial';
      return {
        totalExpectedPosts, storedPostCount, requiredOffsets, coveredOffsets,
        successfulOffsets: coveredOffsets, failedOffsets, missingOffsets,
        coverageComplete, retryableMetadataCount, incompleteMetadataCount: retryableMetadataCount, metadataIncompleteCount: retryableMetadataCount,
        malformedListRecordCount, endEstablished, nextStatus,
      };
    },
    healthSummary(catalogue = {}, { actualErrorCount = 0 } = {}) {
      const evaluation = CatalogueModel.evaluateCoverage(catalogue);
      const failedCount = evaluation.failedOffsets.length;
      const errors = Math.max(0, Number(actualErrorCount) || 0) + failedCount;
      const coverage = errors || failedCount ? 'error' : evaluation.coverageComplete ? 'complete' : 'incomplete';
      const postsReachExpected = !evaluation.totalExpectedPosts || evaluation.storedPostCount >= evaluation.totalExpectedPosts;
      const warningCount = evaluation.retryableMetadataCount + evaluation.malformedListRecordCount + (postsReachExpected ? 0 : 1);
      const severity = coverage === 'error' ? 'error' : coverage === 'incomplete' || warningCount ? 'warning' : 'success';
      return {
        coverage,
        pagesVerified: evaluation.coveredOffsets.length,
        pagesRequired: evaluation.requiredOffsets.length,
        postsStored: evaluation.storedPostCount,
        postsExpected: evaluation.totalExpectedPosts,
        retryableCount: evaluation.retryableMetadataCount,
        malformedCount: evaluation.malformedListRecordCount,
        actualErrorCount: errors,
        severity,
      };
    },
    updatePage(postIds, knownIds) {
      const known = knownIds instanceof Set ? knownIds : new Set(knownIds || []);
      const unseenIds = (postIds || []).map(String).filter((id) => id && !known.has(id));
      return { unseenIds, stopAfterPage: unseenIds.length === 0 };
    },
    button(state, { hasPosts = false, operation = '' } = {}) {
      const normalized = CatalogueModel.normalize(state, { restoreTransient: false });
      if (operation === 'build' || operation === 'verification' || operation === 'resume') return { label: 'Stop scan', tooltip: 'Stop the full catalogue scan safely.' };
      if (operation === 'update') return { label: 'Stop update', tooltip: 'Stop checking for new posts safely.' };
      if (operation === 'metadata-retry') return { label: 'Stop retry', tooltip: 'Stop retrying optional post details.' };
      const coverage = CatalogueModel.evaluateCoverage(normalized.catalogue);
      if (!hasPosts && normalized.catalogue.status === 'none' && !Object.keys(normalized.catalogue.pageCoverage||{}).length) return { label: 'Scan', tooltip: 'Scan every creator page and store its available metadata locally.' };
      if (!coverage.coverageComplete) return { label: 'Resume scan', tooltip: 'Resume missing or failed creator pages.' };
      return { label: 'Update', tooltip: 'Check the creator’s newest pages for new posts.' };
    },
  };

  const CreatorDirectory = {
    normalize(record={}) {
      const context=record.context||Route.parseCreatorUrl(record.creatorUrl||'')||{};
      const creatorKey=String(record.creatorKey||context.creatorKey||'');
      const [domain='',service='',creatorId='']=creatorKey.split('|');
      const now=Date.now();const nullableNumber=(value)=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
      return {
        creatorKey,
        domain:String(record.domain||context.domain||domain||location.hostname),
        service:String(record.service||context.service||service),
        serviceLabel:String(record.serviceLabel||CreatorDisplayName?.serviceLabel?.(record.service||context.service||service)||''),
        creatorId:String(record.creatorId||context.creatorId||creatorId),
        creatorName:String(record.creatorName||record.displayName||record.creatorId||context.creatorId||'Creator').trim(),
        creatorUrl:String(record.creatorUrl||context.creatorUrl||''),
        thumbnailUrl:String(record.thumbnailUrl||record.avatarUrl||''),
        avatarUrl:String(record.avatarUrl||record.thumbnailUrl||''),
        bannerUrl:String(record.bannerUrl||''),
        publicFavoriteCount:nullableNumber(record.publicFavoriteCount),
        indexedAt:nullableNumber(record.indexedAt),
        updatedAt:nullableNumber(record.updatedAt),
        firstSeenAt:nullableNumber(record.firstSeenAt)??now,
        lastSeenInDirectoryAt:nullableNumber(record.lastSeenInDirectoryAt)??now,
      };
    },
    merge(prior={},incoming={}) {
      const old=CreatorDirectory.normalize(prior);const next=CreatorDirectory.normalize({...old,...incoming});
      const earliest=(a,b)=>a==null?b:b==null?a:Math.min(a,b);const latest=(a,b)=>a==null?b:b==null?a:Math.max(a,b);
      next.indexedAt=earliest(old.indexedAt,next.indexedAt);next.updatedAt=latest(old.updatedAt,next.updatedAt);
      next.firstSeenAt=earliest(old.firstSeenAt,next.firstSeenAt);next.lastSeenInDirectoryAt=latest(old.lastSeenInDirectoryAt,next.lastSeenInDirectoryAt);
      const weakName=(value,id)=>!String(value||'').trim()||String(value).trim()===String(id||'').trim()||/^\d+$/.test(String(value||'').trim());
      if(weakName(incoming.creatorName,next.creatorId)&&!weakName(old.creatorName,old.creatorId))next.creatorName=old.creatorName;
      if(incoming.publicFavoriteCount==null||!Number.isFinite(Number(incoming.publicFavoriteCount)))next.publicFavoriteCount=old.publicFavoriteCount;
      if(!String(incoming.avatarUrl||incoming.thumbnailUrl||'').trim()){next.avatarUrl=old.avatarUrl;next.thumbnailUrl=old.thumbnailUrl;}
      if(!String(incoming.bannerUrl||'').trim())next.bannerUrl=old.bannerUrl;
      if(!String(incoming.serviceLabel||'').trim()&&String(old.serviceLabel||'').trim())next.serviceLabel=old.serviceLabel;
      if(!String(incoming.creatorUrl||'').trim()&&String(old.creatorUrl||'').trim())next.creatorUrl=old.creatorUrl;
      return next;
    },
    fromCard(info) {
      const image=info.card?.querySelector?.('img');const favorites=String(info.card?.textContent||'').match(/([\d,]+)\s+favorites?/i);const background=[info.card,...info.card?.querySelectorAll?.('[style*="background"]')||[]].map((node)=>node?.style?.backgroundImage||globalThis.getComputedStyle?.(node)?.backgroundImage||'').find((value)=>value&&value!=='none')||'';const banner=background.match(/url\(["']?([^"')]+)["']?\)/)?.[1]||'';
      return CreatorDirectory.normalize({
        ...info.context,creatorName:info.creatorName,creatorUrl:info.link?.href||'',
        serviceLabel:info.serviceLabel,thumbnailUrl:image?.currentSrc||image?.src||'',avatarUrl:image?.currentSrc||image?.src||'',bannerUrl:banner,
        publicFavoriteCount:favorites?Number(String(favorites[1]).replace(/,/g,'')):null,lastSeenInDirectoryAt:Date.now(),
      });
    },
  };

  const CreatorState = {
    empty(creatorKey=''){const now=Date.now();return{creatorKey:String(creatorKey),liked:false,likedAt:0,hidden:false,hiddenAt:0,favoriteDirectValue:null,favoriteDirectObservedAt:0,createdAt:now,updatedAt:now,source:'local'};},
    normalize(state={}) {
      const base=CreatorState.empty(state.creatorKey);return{...base,...state,creatorKey:String(state.creatorKey||''),liked:state.liked===true,likedAt:Math.max(0,Number(state.likedAt)||0),hidden:state.hidden===true,hiddenAt:Math.max(0,Number(state.hiddenAt)||0),favoriteDirectValue:typeof state.favoriteDirectValue==='boolean'?state.favoriteDirectValue:null,favoriteDirectObservedAt:Math.max(0,Number(state.favoriteDirectObservedAt)||0),createdAt:Number(state.createdAt)||base.createdAt,updatedAt:Number(state.updatedAt)||base.updatedAt,source:String(state.source||'local')};
    },
    async set(creatorKey,patch,source='local') {
      const current=await Cache.getCreatorState(creatorKey);const now=Date.now();const next=CreatorState.normalize({...current,...patch,creatorKey,source,updatedAt:now});
      if('liked'in patch)next.likedAt=patch.liked?now:0;if('hidden'in patch)next.hiddenAt=patch.hidden?now:0;if('favoriteDirectValue'in patch)next.favoriteDirectObservedAt=now;
      return Cache.putCreatorState(next);
    },
    async toggle(creatorKey,field) {const current=await Cache.getCreatorState(creatorKey);return CreatorState.set(creatorKey,{[field]:!current[field]},'creator-action');},
  };

  const CreatorStatusFilters = {
    fields:['favorite','liked','hidden'],values:['off','match','no-match'],
    normalize(value={}){return Object.fromEntries(CreatorStatusFilters.fields.map((field)=>[field,CreatorStatusFilters.values.includes(value?.[field])?value[field]:'off']));},
    load(){return CreatorStatusFilters.normalize(GM_getValue(Config.creatorStatusFiltersKey,{}));},
    save(value){const next=CreatorStatusFilters.normalize(value);GM_setValue(Config.creatorStatusFiltersKey,next);return next;},
    cycle(value){return{off:'match',match:'no-match','no-match':'off'}[value]||'match';},
    matches(record,filters=CreatorStatusFilters.load()) {
      const tests={favorite:record.favorite,liked:Boolean(record.state?.liked),hidden:Boolean(record.state?.hidden)};
      return CreatorStatusFilters.fields.every((field)=>{const mode=filters[field];if(mode==='off')return true;const value=tests[field];if(value==null)return false;return mode==='match'?value===true:value===false;});
    },
  };

  const CreatorDirectoryMode = {
    values:['native','catalogue'],
    normalize(value){return CreatorDirectoryMode.values.includes(value)?value:'native';},
    load(){return CreatorDirectoryMode.normalize(GM_getValue(Config.creatorDirectoryModeKey,'native'));},
    save(value){const next=CreatorDirectoryMode.normalize(value);GM_setValue(Config.creatorDirectoryModeKey,next);return next;},
  };

  const CreatorPresets = {
    normalize(record={}){return{version:1,activeId:String(record.activeId||'default'),presets:Array.isArray(record.presets)&&record.presets.length?record.presets.map((preset,index)=>({id:String(preset.id||`creator-preset-${index}`),name:String(preset.name||`Preset ${index+1}`),state:CreatorFilterEngine.normalizeState(preset.state||{})})):[{id:'default',name:'Default',state:CreatorFilterEngine.normalizeState({})}]};},
    load(){return CreatorPresets.normalize(GM_getValue(Config.creatorPresetsKey,{}));},
    save(record){const next=CreatorPresets.normalize(record);GM_setValue(Config.creatorPresetsKey,next);return next;},
    create(record,name,state){const next=CreatorPresets.normalize(record);const id=`creator-preset-${Date.now()}-${Math.random().toString(36).slice(2)}`;next.presets.push({id,name:String(name||'Creator preset').trim().slice(0,80),state:CreatorFilterEngine.normalizeState(state)});next.activeId=id;return CreatorPresets.save(next);},
    update(record,id,state){const next=CreatorPresets.normalize(record);const preset=next.presets.find((item)=>item.id===id);if(!preset)return next;preset.state=CreatorFilterEngine.normalizeState(state);next.activeId=id;return CreatorPresets.save(next);},
    rename(record,id,name){const next=CreatorPresets.normalize(record);const preset=next.presets.find((item)=>item.id===id);const clean=String(name||'').trim().slice(0,80);if(!preset||!clean||next.presets.some((item)=>item.id!==id&&item.name.toLocaleLowerCase()===clean.toLocaleLowerCase()))return next;preset.name=clean;return CreatorPresets.save(next);},
    remove(record,id){const next=CreatorPresets.normalize(record);if(id==='default')return next;next.presets=next.presets.filter((item)=>item.id!==id);if(next.activeId===id)next.activeId='default';return CreatorPresets.save(next);},
    resetDefault(record){const next=CreatorPresets.normalize(record);const preset=next.presets.find((item)=>item.id==='default');if(preset)preset.state=CreatorFilterEngine.normalizeState({});next.activeId='default';return CreatorPresets.save(next);},
    apply(record,id){const next=CreatorPresets.normalize(record);const preset=next.presets.find((item)=>item.id===id);if(!preset)return null;next.activeId=id;CreatorPresets.save(next);return CreatorFilterEngine.normalizeState(preset.state);},
  };

  const CreatorAggregateCondition = {
    operators:['at-least','at-most','exactly','between'],
    normalize(rule={},percentage=false) {
      const limit=percentage?100:Number.MAX_SAFE_INTEGER;const round=(value)=>percentage?Math.round(Util.clamp(Number(value)||0,0,limit)*10)/10:Math.max(0,Math.floor(Number(value)||0));
      const operator=CreatorAggregateCondition.operators.includes(rule.operator)?rule.operator:'at-least';const from=round(rule.from??rule.value);const to=round(rule.to??from);
      return{operator,from,to:Math.max(from,to)};
    },
    validateRaw(rule={},percentage=false){const rawFrom=rule.from??rule.value,rawTo=rule.to??rawFrom;const from=Number(rawFrom),to=Number(rawTo);if(!CreatorAggregateCondition.operators.includes(rule.operator))return{valid:false,message:'Choose a valid condition.'};if(rawFrom==null||String(rawFrom).trim()===''||!Number.isFinite(from)||from<0||percentage&&from>100)return{valid:false,message:`Enter a value between 0 and ${percentage?100:'the supported maximum'}.`};if(rule.operator==='between'&&(rawTo==null||String(rawTo).trim()===''||!Number.isFinite(to)||to<from||percentage&&to>100))return{valid:false,message:'The upper value must be greater than or equal to the lower value.'};return{valid:true,value:{operator:rule.operator,from,to:rule.operator==='between'?to:from}};},
    valid(rule={},percentage=false){return CreatorAggregateCondition.validateRaw(rule,percentage).valid;},
    safeForPartial(rule={},percentageEnabled=false){return !percentageEnabled&&rule.operator==='at-least';},
    test(actual,rule={}) {
      if(actual==null||!Number.isFinite(Number(actual)))return false;const value=CreatorAggregateCondition.normalize(rule,Boolean(rule.percentage));const number=Number(actual);
      return value.operator==='at-most'?number<=value.from:value.operator==='exactly'?number===value.from:value.operator==='between'?number>=value.from&&number<=value.to:number>=value.from;
    },
    percentage(posts,total){return total>0?Math.round((Math.max(0,Number(posts)||0)/total)*1000)/10:0;},
  };

  const CreatorCustomRule = {
    fields:['title','attachmentFilename','tags','content','service','creator'],
    matches:['contains','equals','starts-with','ends-with'],
    normalize(rule={}){return{id:String(rule.id||`creator-rule-${Date.now()}-${Math.random().toString(36).slice(2)}`),enabled:rule.enabled!==false,field:CreatorCustomRule.fields.includes(rule.field)?rule.field:'title',match:CreatorCustomRule.matches.includes(rule.match)?rule.match:'contains',value:String(rule.value||'').trim(),count:CreatorAggregateCondition.normalize(rule.count||{})};},
    valid(rule={}){const value=CreatorCustomRule.normalize(rule);return Boolean(value.value)&&CreatorAggregateCondition.valid(value.count);},
  };

  const DefaultCreatorFilterState = Object.freeze({
    service:'all',catalogueState:'any',includePartialLowerBounds:false,publicFavorites:null,dateIndexedFrom:'',dateIndexedTo:'',dateUpdatedFrom:'',dateUpdatedTo:'',
    totalPosts:null,lastCatalogueUpdateFrom:'',lastCatalogueUpdateTo:'',earliestPublishedFrom:'',latestPublishedTo:'',publishedWithinFrom:'',publishedWithinTo:'',
    media:{},postStatuses:{},customRules:[],
  });

  const CreatorFilterEngine = {
    normalizeState(value={}) {
      const safe=value&&typeof value==='object'?value:{};const media={};
      ['videos','images','archives','projectFiles','externalLinks','customExtensions'].forEach((type)=>{const source=safe.media?.[type]||{};media[type]={enabled:source.enabled===true,measure:String(source.measure||'posts'),count:CreatorAggregateCondition.normalize(source.count||source),percentageEnabled:source.percentageEnabled===true,percentage:CreatorAggregateCondition.normalize(source.percentage||{},true),extensions:type==='customExtensions'?Util.normalizeExtensions(source.extensions||source.values||[]).values:[]};});
      const postStatuses={};['liked','seen','favorited'].forEach((type)=>{const source=safe.postStatuses?.[type]||{};postStatuses[type]={enabled:source.enabled===true,count:CreatorAggregateCondition.normalize(source.count||source),percentageEnabled:source.percentageEnabled===true,percentage:CreatorAggregateCondition.normalize(source.percentage||{},true)};});
      return{...Util.clone(DefaultCreatorFilterState),...safe,service:String(safe.service||'all'),catalogueState:['any','complete','partial','unscanned'].includes(safe.catalogueState)?safe.catalogueState:'any',includePartialLowerBounds:safe.includePartialLowerBounds===true,publicFavorites:safe.publicFavorites?CreatorAggregateCondition.normalize(safe.publicFavorites):null,totalPosts:safe.totalPosts?CreatorAggregateCondition.normalize(safe.totalPosts):null,media,postStatuses,customRules:Array.isArray(safe.customRules)?safe.customRules.slice(0,50).map(CreatorCustomRule.normalize):[]};
    },
    requiresCatalogue(state){const value=CreatorFilterEngine.normalizeState(state);return value.catalogueState!=='any'||Object.values(value.media).some((rule)=>rule.enabled)||Object.values(value.postStatuses||{}).some((rule)=>rule?.enabled)||value.customRules.some((rule)=>rule.enabled);},
    mediaMetric(record,type,rule){const media=record.summary?.media?.[type]||{};return rule.measure==='attachments'||rule.measure==='links'?Number(media.attachments??media.links??0):Number(media.posts||0);},
    matches(record,state) {
      const value=CreatorFilterEngine.normalizeState(state);if(value.service!=='all'&&record.directory?.service!==value.service)return false;
      if(value.publicFavorites&&!CreatorAggregateCondition.test(record.directory?.publicFavoriteCount,value.publicFavorites))return false;const inDate=(stamp,from,to)=>{const number=Number(stamp)||0;return(!from||number>=Date.parse(from))&&(!to||number<=Date.parse(to)+86400000-1);};if(!inDate(record.directory?.indexedAt,value.dateIndexedFrom,value.dateIndexedTo)||!inDate(record.directory?.updatedAt,value.dateUpdatedFrom,value.dateUpdatedTo))return false;
      const completeness=record.summary?.completeness||record.catalogueState||'unscanned';if(value.catalogueState!=='any'&&completeness!==value.catalogueState)return false;
      if(value.totalPosts&&!CreatorAggregateCondition.test(record.summary?.sourcePostCount,value.totalPosts))return false;
      if(record.summary){if(!inDate(record.summary.lastCatalogueUpdateAt,value.lastCatalogueUpdateFrom,value.lastCatalogueUpdateTo))return false;if(value.earliestPublishedFrom&&(record.summary.earliestPublishedAt==null||Number(record.summary.earliestPublishedAt)<Date.parse(value.earliestPublishedFrom)))return false;if(value.latestPublishedTo&&(record.summary.latestPublishedAt==null||Number(record.summary.latestPublishedAt)>Date.parse(value.latestPublishedTo)+86400000-1))return false;if((value.publishedWithinFrom||value.publishedWithinTo)&&!(CreatorCatalogueSummary.publishedWithin(record.summary,value.publishedWithinFrom,value.publishedWithinTo)>0))return false;}
      for(const [type,rule] of Object.entries(value.media)){if(!rule.enabled)continue;if(!record.summary)return false;if(completeness!=='complete'&&(!value.includePartialLowerBounds||!CreatorAggregateCondition.safeForPartial(rule.count,rule.percentageEnabled)))return false;let media=record.summary.media?.[type]||{posts:0};if(type==='customExtensions'){const aggregate=record.summary.customExtensionAggregates?.[CreatorCatalogueSummary.extensionFingerprint(rule.extensions)];if(!aggregate)return false;media={posts:aggregate.posts,attachments:aggregate.files};}if(!CreatorAggregateCondition.test(rule.measure==='attachments'||rule.measure==='links'?Number(media.attachments??media.links??0):Number(media.posts||0),rule.count))return false;if(rule.percentageEnabled&&!CreatorAggregateCondition.test(CreatorAggregateCondition.percentage(media.posts,record.summary.sourcePostCount),{...rule.percentage,percentage:true}))return false;}
      for(const [type,rule] of Object.entries(value.postStatuses)){if(!rule.enabled)continue;if(!record.summary||completeness!=='complete'&&(!value.includePartialLowerBounds||!CreatorAggregateCondition.safeForPartial(rule.count,rule.percentageEnabled)))return false;const statuses=record.summary.statuses||{};if(type==='favorited'&&Number(statuses.favoriteKnown)<Number(record.summary.sourcePostCount))return false;const count=Number(statuses[type]||0);if(!CreatorAggregateCondition.test(count,rule.count))return false;if(rule.percentageEnabled&&!CreatorAggregateCondition.test(CreatorAggregateCondition.percentage(count,record.summary.sourcePostCount),{...rule.percentage,percentage:true}))return false;}
      for(const rule of value.customRules.filter((item)=>item.enabled)){if(!record.summary||completeness!=='complete'&&(!value.includePartialLowerBounds||!CreatorAggregateCondition.safeForPartial(rule.count,false)))return false;const aggregate=record.summary.customRuleAggregates?.[CreatorCatalogueSummary.ruleFingerprint(rule)];if(!aggregate||!CreatorAggregateCondition.test(aggregate.posts,rule.count))return false;}
      return true;
    },
  };

  const CreatorSorter = {
    normalize(mode='popularity',direction='desc'){return{mode:String(mode||'popularity'),direction:direction==='asc'?'asc':'desc'};},
    value(record,mode) {
      const directory=record.directory||{};const summary=record.summary||{};const values={popularity:directory.publicFavoriteCount,indexed:directory.indexedAt,updated:directory.updatedAt,alphabetical:String(directory.creatorName||'').toLocaleLowerCase(),service:String(directory.service||''),posts:summary.sourcePostCount,latest:summary.latestPublishedAt,earliest:summary.earliestPublishedAt,catalogueUpdated:summary.lastCatalogueUpdateAt,liked:summary.statuses?.liked,seen:summary.statuses?.seen,favorited:summary.statuses?.favoriteKnown===summary.sourcePostCount?summary.statuses?.favorited:null};
      if(mode in values)return values[mode];const [type,metric='posts']=mode.split(':');const media=summary.media?.[type];return media?(metric==='percentage'?CreatorAggregateCondition.percentage(media.posts,summary.sourcePostCount):media[metric]??media.posts):null;
    },
    sort(records,options={}) {
      const {mode,direction}=CreatorSorter.normalize(options.mode,options.direction);const sign=direction==='asc'?1:-1;
      return records.map((record,index)=>({record,index,value:CreatorSorter.value(record,mode)})).sort((a,b)=>{const aUnknown=a.value==null||a.value==='',bUnknown=b.value==null||b.value==='';if(aUnknown!==bUnknown)return aUnknown?1:-1;if(aUnknown)return a.index-b.index;const compared=typeof a.value==='string'?a.value.localeCompare(b.value):Number(a.value)-Number(b.value);return compared?compared*sign:a.index-b.index;}).map((item)=>item.record);
    },
  };

  const CreatorCatalogueSummary = {
    version:3,
    fingerprint(settings=Settings.value) {
      const normalized=(values)=>Util.normalizeExtensions(values||[]).values.sort();
      return JSON.stringify({
        version:CreatorCatalogueSummary.version,
        schemaVersion:Config.schemaVersion,
        videoExtensions:normalized(settings.videoExtensions),
        imageExtensions:normalized(settings.imageExtensions),
        archiveExtensions:normalized(settings.archiveExtensions),
        projectExtensions:normalized(settings.projectExtensions),
        projectKeywords:Util.unique((settings.projectKeywords||[]).map((value)=>String(value).trim().toLocaleLowerCase())).sort(),
        projectEvidence:{...settings.projectEvidence},
        externalLinkScope:settings.externalLinkScope,
        knownHosts:Util.unique((settings.knownHosts||[]).map((value)=>String(value).trim().toLocaleLowerCase())).sort(),
        mediaLinkLogicVersion:2,
      });
    },
    cataloguePosts(posts,{displayEligible=false}={}) {
      return (posts||[]).filter((post)=>post?.cacheSources?.catalogue===true&&post.scanSchemaVersion===Config.schemaVersion&&(!displayEligible||!Settings.value.excludePostsWithMissingAttachments||!post.missingStatsKnown||!post.hasMissingStats));
    },
    extensionFingerprint(values){return Util.normalizeExtensions(values||[]).values.sort().join('|');},
    customExtensionAggregate(posts,values) {
      const extensions=Util.normalizeExtensions(values||[]).values;const wanted=new Set(extensions);let matchingPosts=0,matchingFiles=0;
      CreatorCatalogueSummary.cataloguePosts(posts).forEach((post)=>{const count=(post.fileExtensions||post.rawExtensions||[]).filter((extension)=>wanted.has(String(extension).toLocaleLowerCase())).length;if(count){matchingPosts+=1;matchingFiles+=count;}});
      return{fingerprint:CreatorCatalogueSummary.extensionFingerprint(extensions),extensions,posts:matchingPosts,files:matchingFiles};
    },
    ruleFingerprint(rule={}) {
      const normalized={field:String(rule.field||'title'),match:String(rule.match||'contains'),value:String(rule.value||'').trim().toLocaleLowerCase()};
      return JSON.stringify(normalized);
    },
    customRuleAggregate(posts,rule={}) {
      const fingerprint=CreatorCatalogueSummary.ruleFingerprint(rule);const value=String(rule.value||'').trim().toLocaleLowerCase();let matchingPosts=0;
      if(!value)return{fingerprint,posts:0};
      const match=(text)=>{const source=String(text||'').toLocaleLowerCase();return rule.match==='equals'?source===value:rule.match==='starts-with'?source.startsWith(value):rule.match==='ends-with'?source.endsWith(value):source.includes(value);};
      CreatorCatalogueSummary.cataloguePosts(posts).forEach((post)=>{const fields={title:[post.title],attachmentFilename:post.attachmentFilenames||[],tags:post.tags||[],content:[post.contentText],service:[post.service],creator:[post.creatorId]};if((fields[rule.field]||fields.title).some(match))matchingPosts+=1;});
      return{fingerprint,posts:matchingPosts};
    },
    publishedWithin(summary,from='',to='') {
      const start=from?Date.parse(from):Number.NEGATIVE_INFINITY;const end=to?Date.parse(to)+86400000-1:Number.POSITIVE_INFINITY;
      if((from&&!Number.isFinite(start))||(to&&!Number.isFinite(end)))return null;
      return(summary?.publishedTimestamps||[]).filter((stamp)=>stamp>=start&&stamp<=end).length;
    },
    statusTotals(posts,statusRecords=[],snapshotMeta=null,snapshotMembership=null) {
      const statuses=new Map((statusRecords||[]).map((status)=>{const normalized=PostStatus.normalize(status);return[String(normalized.postId||normalized.key?.split('|').at(-1)||''),normalized];}));
      return CreatorCatalogueSummary.cataloguePosts(posts).reduce((total,post)=>{const status=statuses.get(String(post.id))||PostStatus.empty({creatorKey:post.creatorKey,postId:String(post.id),postKey:post.key});if(status.liked)total.liked+=1;if(status.seen)total.seen+=1;const favorite=FavoriteStateResolver.resolve({postKey:post.key,postStatus:status,snapshotMeta,snapshotMembership});if(typeof favorite==='boolean'){total.favoriteKnown+=1;if(favorite)total.favorited+=1;}return total;},{liked:0,seen:0,favorited:0,favoriteKnown:0});
    },
    compute(posts,catalogueState={},now=Date.now(),options={}) {
      const usable=CreatorCatalogueSummary.cataloguePosts(posts,{displayEligible:true});const safe=(value)=>Math.max(0,Number(value)||0);const media={videos:{posts:0,attachments:0},images:{posts:0,attachments:0},archives:{posts:0,attachments:0},projectFiles:{posts:0,attachments:0},externalLinks:{posts:0,links:0}};
      let earliestPublishedAt=null,latestPublishedAt=null;const publishedTimestamps=[];usable.forEach((post)=>{[['videos','videoCount'],['images','imageCount'],['archives','archiveCount']].forEach(([type,key])=>{const count=safe(post[key]);media[type].attachments+=count;if(count>0)media[type].posts+=1;});const projectAttachments=safe(post.projectFileCount);media.projectFiles.attachments+=projectAttachments;if(projectAttachments>0||post.hasProjectFiles===true)media.projectFiles.posts+=1;const links=safe(post.externalLinkCount);media.externalLinks.links+=links;if(links>0)media.externalLinks.posts+=1;const stamp=Date.parse(post.published||post.publishedAt||'');if(Number.isFinite(stamp)){publishedTimestamps.push(stamp);earliestPublishedAt=earliestPublishedAt==null?stamp:Math.min(earliestPublishedAt,stamp);latestPublishedAt=latestPublishedAt==null?stamp:Math.max(latestPublishedAt,stamp);}});
      const evaluation=CatalogueModel.evaluateCoverage(catalogueState);const counts=Object.fromEntries(Object.entries(media).map(([key,value])=>[key,value.attachments??value.links??0]));
      const dynamic=CreatorFilterEngine.normalizeState(options.filterState||{});const customExtensionAggregates={};const extensionValues=dynamic.media.customExtensions?.extensions||[];if(extensionValues.length){const aggregate=CreatorCatalogueSummary.customExtensionAggregate(usable,extensionValues);customExtensionAggregates[aggregate.fingerprint]=aggregate;}
      const customRuleAggregates={};dynamic.customRules.filter((rule)=>rule.enabled).forEach((rule)=>{const aggregate=CreatorCatalogueSummary.customRuleAggregate(usable,rule);customRuleAggregates[aggregate.fingerprint]=aggregate;});
      return {version:CreatorCatalogueSummary.version,computedAt:now,sourcePostCount:usable.length,classificationFingerprint:CreatorCatalogueSummary.fingerprint(),media,counts,earliestPublishedAt,latestPublishedAt,publishedTimestamps:publishedTimestamps.sort((a,b)=>a-b),lastCatalogueUpdateAt:Number(catalogueState.lastUpdateCheckAt||catalogueState.lastFullBuildAt||catalogueState.completedAt)||null,statuses:CreatorCatalogueSummary.statusTotals(usable,options.statuses,options.snapshotMeta,options.snapshotMembership),customExtensionAggregates,customRuleAggregates,retryableMetadataCount:Util.unique((catalogueState.retryableMetadataIds||[]).map(String)).length,malformedRecordCount:evaluation.malformedListRecordCount,completeness:evaluation.coverageComplete?'complete':usable.length?'partial':'unscanned'};
    },
    valid(summary,catalogueState,sourcePostCount=null) {
      const coverage=CatalogueModel.evaluateCoverage(catalogueState||{});const count=sourcePostCount==null?Math.max(0,Number(catalogueState?.storedPostCount)||0):Math.max(0,Number(sourcePostCount)||0);
      return Boolean(summary&&summary.version===CreatorCatalogueSummary.version&&summary.classificationFingerprint===CreatorCatalogueSummary.fingerprint()&&Math.max(0,Number(summary.sourcePostCount)||0)===count&&summary.media&&summary.completeness);
    },
    async computeAuthoritative(context,posts,catalogueState) {
      const statuses=await Cache.getCreatorStatuses(context.creatorKey);const host=context.domain||String(context.creatorKey).split('|')[0]||location.hostname;const snapshotMeta=await Cache.getFavoriteSyncMeta(host);const snapshotMembership=await Cache.getFavoriteSnapshotKeys(host,snapshotMeta?.activeSnapshotId);const filterState=CreatorFilterEngine.normalizeState(GM_getValue(Config.creatorFilterStateKey,{}));
      return CreatorCatalogueSummary.compute(posts,catalogueState,Date.now(),{statuses,snapshotMeta,snapshotMembership,filterState});
    },
    async recomputeAndPersist(context,catalogueState=null) {
      const posts=await Cache.getCreatorPosts(context.creatorKey);const meta=await Cache.getMeta(context.creatorKey)||{creatorKey:context.creatorKey};const state=catalogueState||CatalogueModel.normalize(meta,{restoreTransient:false}).catalogue;const summary=await CreatorCatalogueSummary.computeAuthoritative(context,posts,state);
      await Cache.patchMeta(context.creatorKey,{catalogue:{...state,storedPostCount:summary.sourcePostCount,creatorCardSummary:summary}});
      return summary;
    },
    statusRefreshTimers:new Map(),
    scheduleStatusRefresh(creatorKey) {
      clearTimeout(CreatorCatalogueSummary.statusRefreshTimers.get(creatorKey));CreatorCatalogueSummary.statusRefreshTimers.set(creatorKey,setTimeout(async()=>{CreatorCatalogueSummary.statusRefreshTimers.delete(creatorKey);const [domain,service,creatorId]=String(creatorKey).split('|');await CreatorCatalogueSummary.recomputeAndPersist({creatorKey,domain,service,creatorId,creatorUrl:`https://${domain}/${service}/user/${creatorId}`});},250));
    },
  };

  const ArtistCatalogueAction = {
    forState(meta,activeJob=null,{loadError=false}={}) {
      if(loadError)return'unavailable';
      if(activeJob&&(!activeJob.status||activeJob.status==='running')&&activeJob.creatorKey===meta?.creatorKey)return'stop';
      const normalized=CatalogueModel.normalize(meta||{},{restoreTransient:false});
      if(normalized.catalogue.status==='none'&&!Object.keys(normalized.catalogue.pageCoverage||{}).length&&!normalized.catalogue.storedPostCount)return'build';
      return CatalogueModel.evaluateCoverage(normalized.catalogue).coverageComplete?'update':'resume';
    },
  };

  const CreatorDisplayName = {
    serviceLabel(service = '') {
      const key=String(service).trim().toLowerCase().replace(/[\s_-]+/g,'');
      if(['fanbox','pixivfanbox'].includes(key))return'Pixiv Fanbox';
      if(key==='patreon')return'Patreon';
      return String(service||'Creator').replace(/[_-]+/g,' ').replace(/\b\w/g,(value)=>value.toUpperCase());
    },
    cleanText(text, context = {}) {
      const service=CreatorDisplayName.serviceLabel(context.service);
      let value=String(text||'').replace(/\s+/g,' ').trim();
      value=value.replace(new RegExp(`^${service.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s+`,'i'),'');
      value=value.replace(/\b[\d,]+\s+favorites?\b/gi,' ');
      value=value.replace(new RegExp(`(?:^|\\s)${String(context.creatorId||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=\\s|$)`,'g'),' ');
      value=value.replace(/\s+\d[\d,]*\s*$/,'').replace(/\s+/g,' ').trim();
      return value||String(context.creatorId||'Creator');
    },
    format({creatorName,service,serviceLabel}={}) {
      const name=String(creatorName||'Creator').trim()||'Creator';
      return `${name} (${serviceLabel||CreatorDisplayName.serviceLabel(service)})`;
    },
    fromCard(card, link, context) {
      const selectors='[data-creator-name],[data-artist-name],[class*="creator-name"],[class*="artist-name"],h2,h3,h4';
      const candidates=[...card?.querySelectorAll?.(selectors)||[]]
        .map((node)=>CreatorDisplayName.cleanText(node.textContent,context))
        .filter((value)=>value&&!/favorites?/i.test(value)&&value!==CreatorDisplayName.serviceLabel(context.service));
      const creatorName=candidates[0]||CreatorDisplayName.cleanText(link?.textContent||'',context);
      const serviceLabel=CreatorDisplayName.serviceLabel(context.service);
      return {creatorName,serviceLabel,displayName:CreatorDisplayName.format({creatorName,serviceLabel})};
    },
  };

  const ArtistsDOM = {
    isOwned(node){const selector='[data-pmf-owned="true"],#pmf-artists-root';if(node?.matches?.(selector))return true;const owner=node?.closest?.(selector);return Boolean(owner?.matches?.(selector));},
    creatorLinks(root,{nativeOnly=false}={}) {
      return [...root?.querySelectorAll?.('a[href]')||[]].filter((link)=>!nativeOnly||!ArtistsDOM.isOwned(link)).map((link)=>({link,context:Route.parseCreatorUrl(link.getAttribute?.('href')||link.href)})).filter((item)=>item.context);
    },
    find() {
      const main=document.querySelector('main#main, main.main, #main, main');if(!main)return null;
      const links=ArtistsDOM.creatorLinks(main,{nativeOnly:true});if(!links.length)return null;
      const explicit=[...main.querySelectorAll('.card-list__items,[class*="artist-grid"],[class*="creator-grid"],[class*="card-list"]')].filter((node)=>!ArtistsDOM.isOwned(node)).find((node)=>ArtistsDOM.creatorLinks(node,{nativeOnly:true}).length>=2);
      const decorate=(grid)=>{const searchInput=main.querySelector('#q,input[name="q"],input[type="search"],input[placeholder*="creator" i],input[placeholder*="artist" i]');const searchForm=searchInput?.form||main.querySelector('form.search-form,#search-form');return{main,grid,searchInput,searchForm,serviceControl:searchForm?.querySelector('#service,select[name="service"]')||null,sortControl:searchForm?.querySelector('#sort_by,select[name="sort_by"]')||null,directionControl:searchForm?.querySelector('#order,[name="order"]')||null,paginators:[...main.querySelectorAll('.paginator')].filter((node)=>!ArtistsDOM.isOwned(node))};};
      if(explicit)return decorate(explicit);
      const scores=new Map();
      links.forEach(({link,context})=>{let node=link.parentElement;let depth=0;while(node&&node!==main&&depth++<5){if(!scores.has(node))scores.set(node,new Set());scores.get(node).add(context.creatorKey);node=node.parentElement;}});
      const candidates=[...scores].filter(([,keys])=>keys.size>=2).sort((a,b)=>b[1].size-a[1].size||a[0].querySelectorAll('a[href]').length-b[0].querySelectorAll('a[href]').length);
      return candidates[0]?decorate(candidates[0][0]):null;
    },
    visualCard(link,grid) {
      const candidates=['article','li','[class*="creator-card"]','[class*="artist-card"]','[class*="card"]'];
      for(const selector of candidates){const card=link.closest?.(selector);if(card&&grid.contains(card)&&card!==grid)return card;}
      let node=link;while(node?.parentElement&&node.parentElement!==grid)node=node.parentElement;return node&&node!==link?node:link;
    },
    creatorCards(found=ArtistsDOM.find(),{nativeOnly=true}={}) {
      if(!found?.grid)return[];const seenCards=new Set();const seenKeys=new Set();const results=[];
      ArtistsDOM.creatorLinks(found.grid,{nativeOnly}).forEach(({link,context})=>{const card=ArtistsDOM.visualCard(link,found.grid);if(!card||nativeOnly&&ArtistsDOM.isOwned(card)||seenCards.has(card)||seenKeys.has(context.creatorKey))return;seenCards.add(card);seenKeys.add(context.creatorKey);const identity=CreatorDisplayName.fromCard(card,link,context);results.push({card,link,...identity,context});});
      return results;
    },
  };

  const CreatorCardReconstructor = {
    safeUrl(value){try{const url=new URL(String(value||''),location.href);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return'';}},
    template:null,
    capture(info){if(info?.card)CreatorCardReconstructor.template=info.card.cloneNode(true);},
    sanitize(root){
      [root,...root.querySelectorAll('*')].forEach((node)=>{[...node.attributes||[]].forEach((attribute)=>{const name=attribute.name.toLowerCase();if(name==='id'||name==='title'||name==='aria-label'||name==='aria-labelledby'||name==='aria-describedby'||name.startsWith('data-')||name.startsWith('on')||name.startsWith('hx-')||name.startsWith('x-')||name.startsWith('turbo')||name.includes('controller')||name.includes('action'))node.removeAttribute(attribute.name);});if(typeof node.className==='string')node.className=node.className.split(/\s+/).filter((name)=>name&&!/(?:^|[-_])(?:active|selected|loading|disabled|favorited)(?:$|[-_])/i.test(name)).join(' ');});
      root.classList.remove('pmf-hidden-creator-dimmed','pmf-creator-card-job-active','pmf-creator-card-has-rail','pmf-creator-card-has-badges');root.querySelectorAll('[data-pmf-owned="true"],.pmf-creator-card-right-rail,.pmf-creator-card-job-status').forEach((node)=>node.remove());return root;
    },
    buildFromTemplate(record){
      if(!CreatorCardReconstructor.template)return null;const directory=record.directory||{};const card=CreatorCardReconstructor.sanitize(CreatorCardReconstructor.template.cloneNode(true));card.dataset.pmfOwned='true';card.classList.add('pmf-catalogue-creator-card');const link=card.matches('a[href]')?card:card.querySelector('a[href]');if(!link)return null;link.href=CreatorCardReconstructor.safeUrl(directory.creatorUrl)||'#';
      card.querySelectorAll('a[href]').forEach((node)=>{node.href=link.href;node.setAttribute('aria-label',`Open ${directory.creatorName||directory.creatorId||'creator'}`);});const image=card.querySelector('img');const avatar=CreatorCardReconstructor.safeUrl(directory.avatarUrl||directory.thumbnailUrl);if(image){image.alt=`${directory.creatorName||directory.creatorId||'Creator'} avatar`;if(avatar){image.src=avatar;image.srcset=avatar;}else{image.removeAttribute('src');image.removeAttribute('srcset');}}
      const banner=CreatorCardReconstructor.safeUrl(directory.bannerUrl);const visual=[card,...card.querySelectorAll('[style*="background-image"]')].find((node)=>node.style?.backgroundImage);if(visual)visual.style.backgroundImage=banner?`linear-gradient(rgba(0,0,0,.5),rgba(0,0,0,.8)),url("${banner.replace(/"/g,'%22')}")`:'none';
      const service=card.querySelector('.user-card__service,[class*="service"]');if(service)service.textContent=directory.serviceLabel||CreatorDisplayName.serviceLabel(directory.service);const name=card.querySelector('.user-card__name,[class*="name"]');if(name)name.textContent=directory.creatorName||directory.creatorId||'Creator';const count=card.querySelector('.user-card__count,[class*="count"]');if(count)count.innerHTML=directory.publicFavoriteCount==null?'':`<b>${Number(directory.publicFavoriteCount).toLocaleString()}</b> favorites`;const content=card.querySelector('.user-card__info,[class*="info"]');content?.setAttribute('data-pmf-creator-content','true');return{card,link};
    },
    build(record){
      const templated=CreatorCardReconstructor.buildFromTemplate(record);if(templated)return templated;
      const directory=record.directory||{};const card=document.createElement('article');card.className='pmf-reconstructed-creator-card';card.dataset.pmfOwned='true';
      const link=document.createElement('a');link.className='pmf-reconstructed-creator-link';link.href=CreatorCardReconstructor.safeUrl(directory.creatorUrl)||'#';
      const visual=document.createElement('span');visual.className='pmf-reconstructed-creator-visual';const banner=CreatorCardReconstructor.safeUrl(directory.bannerUrl);if(banner)visual.style.backgroundImage=`linear-gradient(#0007,#0007),url("${banner.replace(/"/g,'%22')}")`;
      const avatar=CreatorCardReconstructor.safeUrl(directory.avatarUrl||directory.thumbnailUrl);if(avatar){const image=document.createElement('img');image.src=avatar;image.alt='';image.loading='lazy';visual.append(image);}else{const placeholder=document.createElement('span');placeholder.className='pmf-reconstructed-avatar-placeholder';placeholder.textContent=String(directory.creatorName||directory.creatorId||'?').trim().slice(0,1).toUpperCase()||'?';visual.append(placeholder);}
      const content=document.createElement('span');content.className='pmf-reconstructed-creator-content';content.dataset.pmfCreatorContent='true';const service=document.createElement('small');service.textContent=directory.serviceLabel||CreatorDisplayName.serviceLabel(directory.service);const name=document.createElement('strong');name.textContent=directory.creatorName||directory.creatorId||'Creator';content.append(service,name);
      if(directory.publicFavoriteCount!=null){const favorites=document.createElement('small');favorites.textContent=`${Number(directory.publicFavoriteCount).toLocaleString()} favorites`;content.append(favorites);}
      link.append(visual,content);card.append(link);return{card,link};
    },
  };

  const CreatorGridGeometry = {
    median(values=[]){const sorted=values.filter((value)=>Number.isFinite(value)&&value>0).sort((a,b)=>a-b);if(!sorted.length)return 310;const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:Math.round((sorted[middle-1]+sorted[middle])/2);},
    measure(grid) {
      const rects=ArtistsDOM.creatorCards({grid},{nativeOnly:true}).map((info)=>info.card.getBoundingClientRect?.()).filter((rect)=>rect?.width>=120);const x=[...new Set(rects.map((rect)=>Math.round(rect.left)))];const style=globalThis.getComputedStyle?.(grid);return{gridWidth:Math.round(grid.getBoundingClientRect?.().width||0),columnCount:Math.max(1,x.length),cardWidth:Util.clamp(CreatorGridGeometry.median(rects.map((rect)=>Math.round(rect.width))),180,720),cardHeight:Util.clamp(CreatorGridGeometry.median(rects.map((rect)=>Math.round(rect.height))),60,400),columnGap:Util.clamp(parseFloat(style?.columnGap)||8,0,40),rowGap:Util.clamp(parseFloat(style?.rowGap)||8,0,40)};
    },
    apply(grid,geometry={}){if(!grid)return;const columns=Math.max(1,Math.floor(Number(geometry.columnCount)||1));grid.style.setProperty('--pmf-native-creator-card-width',`${Util.clamp(Number(geometry.cardWidth)||310,180,720)}px`);grid.style.setProperty('--pmf-native-creator-card-height',`${Util.clamp(Number(geometry.cardHeight)||100,60,400)}px`);grid.style.gridTemplateColumns=`repeat(${columns},minmax(0,1fr))`;grid.style.columnGap=`${Util.clamp(Number(geometry.columnGap)||8,0,40)}px`;grid.style.rowGap=`${Util.clamp(Number(geometry.rowGap)||8,0,40)}px`;},
  };

  const NativeArtistsVisibility = {
    duplicateElements(found,searchInput=null) {
      const main=found?.main,grid=found?.grid;if(!main||!grid)return[];
      const duplicates=new Set([...main.querySelectorAll('select')].filter((node)=>!ArtistsDOM.isOwned(node)));
      [...main.querySelectorAll('nav,[class*="pagin" i],[aria-label*="pagin" i]')].forEach((node)=>{if(!ArtistsDOM.isOwned(node)&&!node.contains(searchInput)&&!node.contains(grid))duplicates.add(node);});
      [grid.previousElementSibling,grid.nextElementSibling].forEach((node)=>{if(!node||ArtistsDOM.isOwned(node)||node.contains(searchInput)||node.contains(grid))return;const labels=[...node.querySelectorAll('a,button')].map((item)=>String(item.textContent||'').trim());if(labels.filter((label)=>/^(?:\d+|[<>«»‹›]+)$/.test(label)).length>=2)duplicates.add(node);});
      return [...duplicates];
    },
    capture(found,searchInput=found?.searchInput){const controls=[found?.serviceControl,found?.sortControl,found?.directionControl,...(found?.paginators||[])].filter(Boolean);const elements=[found?.grid,...controls].filter(Boolean);return{grid:found?.grid||null,controls,searchForm:found?.searchForm||null,elements:elements.map((element)=>({element,hidden:Boolean(element.hidden),display:element.style.getPropertyValue('display'),displayPriority:element.style.getPropertyPriority('display'),ariaHidden:element.getAttribute('aria-hidden')})),searchInput,searchPlaceholder:searchInput?.placeholder||''};},
    setHidden(entries,hidden){entries?.forEach(({element})=>{if(!element?.isConnected)return;if(hidden){element.hidden=true;element.style.setProperty('display','none','important');element.setAttribute('aria-hidden','true');element.dataset.pmfNativeHidden='true';}else{element.hidden=false;element.style.removeProperty('display');element.removeAttribute('aria-hidden');delete element.dataset.pmfNativeHidden;}});},
    apply(snapshot,mode,{proxiesReady=false}={}){if(!snapshot)return;const gridEntry=snapshot.elements.find((item)=>item.element===snapshot.grid);const controlEntries=snapshot.elements.filter((item)=>item.element!==snapshot.grid);NativeArtistsVisibility.setHidden(gridEntry?[gridEntry]:[],mode==='catalogue');NativeArtistsVisibility.setHidden(controlEntries,mode==='catalogue'||proxiesReady);},
    hide(snapshot){NativeArtistsVisibility.setHidden(snapshot?.elements,true);},
    restore(snapshot){snapshot?.elements?.forEach(({element,hidden,display,displayPriority,ariaHidden})=>{if(!element?.isConnected)return;element.hidden=hidden;if(display)element.style.setProperty('display',display,displayPriority);else element.style.removeProperty('display');if(ariaHidden==null)element.removeAttribute('aria-hidden');else element.setAttribute('aria-hidden',ariaHidden);delete element.dataset.pmfNativeHidden;});if(snapshot?.searchInput?.isConnected)snapshot.searchInput.placeholder=snapshot.searchPlaceholder;},
  };

  const NativeArtistsProxy = {
    options(source,{service=false}={}){return[...source?.options||[]].map((option)=>({value:option.value,label:service&&option.value===''?'Any service':String(option.textContent||option.value).trim()}));},
    label(source,{service=false}={}){const option=[...source?.options||[]].find((item)=>item.value===source.value);return service&&source?.value===''?'Any service':String(option?.textContent||source?.value||'').trim();},
    defaultDirection(mode){return['name','service'].includes(String(mode))?'asc':'desc';},
    nextSort(currentMode,currentDirection,selectedMode){const same=String(currentMode)===String(selectedMode);return{mode:String(selectedMode),direction:same?(String(currentDirection)==='asc'?'desc':'asc'):NativeArtistsProxy.defaultDirection(selectedMode)};},
    sync(found,host){
      if(!found||!host||!found.serviceControl||!found.sortControl||!found.directionControl)return false;const service=host.querySelector('[data-creator-index-action="native-service"]'),sort=host.querySelector('[data-creator-index-action="native-sort"]');if(!service||!sort)return false;service.querySelector('[data-proxy-label]').textContent=NativeArtistsProxy.label(found.serviceControl,{service:true});sort.querySelector('[data-proxy-label]').textContent=`Sort: ${NativeArtistsProxy.label(found.sortControl)}`;sort.querySelector('[data-proxy-direction]').textContent=(found.directionControl.value||'desc')==='asc'?'▲':'▼';return true;
    },
    activate(found,type,value){
      const source=type==='service'?found?.serviceControl:found?.sortControl;if(!source)return false;if(type==='sort'){const next=NativeArtistsProxy.nextSort(source.value,found?.directionControl?.value,value);if(found?.directionControl)found.directionControl.value=next.direction;source.value=next.mode;}else source.value=value;source.dispatchEvent(new Event('input',{bubbles:true}));source.dispatchEvent(new Event('change',{bubbles:true}));return true;
    },
    paginator(found,host){
      host.replaceChildren();const native=found?.paginators?.[0];if(!native)return false;const small=native.querySelector('small');const candidates=[...native.querySelectorAll('a[data-value],li')].map((item,index)=>{const label=String(item.textContent||'').trim();const role=label==='<<'?'first':label==='<'?'previous':label==='>'?'next':label==='>>'?'last':/^\d+$/.test(label)?`page:${label}`:`other:${index}`;return{item,index,label,role,anchor:item.matches('a[data-value]'),disabled:item.matches('li,.pagination-button-disabled'),current:item.matches('.pagination-button-current,[aria-current="page"]')};});const chosen=new Map();candidates.forEach((candidate)=>{const prior=chosen.get(candidate.role);if(!prior||candidate.current&&!prior.current||candidate.anchor&&!prior.anchor&&!prior.current||!candidate.disabled&&prior.disabled&&!prior.current)chosen.set(candidate.role,candidate);});const ordered=[...chosen.values()].sort((a,b)=>a.index-b.index);const menu=document.createElement('div');menu.className='pmf-page-controls';ordered.forEach(({index,label,disabled,current})=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.nativePaginatorIndex=String(index);button.disabled=disabled;if(current)button.setAttribute('aria-current','page');menu.append(button);});if(small){const count=small.cloneNode(true);count.classList.add('pmf-filtered-count');host.append(count);}host.append(menu);return true;
    },
    activatePage(found,index){const source=[...found?.paginators?.[0]?.querySelectorAll?.('a[data-value],li')||[]][Number(index)];if(!source||source.matches('li,.pagination-button-disabled'))return false;source.click();return true;},
  };

  const AttachmentBadgeSizing = {
    previewSizes:{post:null,creator:null},
    metrics:Object.freeze({
      small:{post:{height:20,minWidth:21,icon:13,font:10,padding:3,gap:2,spacing:3,footer:26,manyHeight:19,manyMinWidth:19,manyPadding:2,manyFooter:38,tightWidth:210},creator:{height:21,minWidth:34,icon:13,font:10,padding:4,gap:3,spacing:4,columnGap:4}},
      medium:{post:{height:25,minWidth:26,icon:16,font:12,padding:4,gap:3,spacing:4,footer:31,manyHeight:24,manyMinWidth:24,manyPadding:3,manyFooter:48,tightWidth:250},creator:{height:26,minWidth:42,icon:16,font:12,padding:5,gap:4,spacing:5,columnGap:5}},
      big:{post:{height:30,minWidth:31,icon:19,font:14,padding:5,gap:4,spacing:5,footer:36,manyHeight:29,manyMinWidth:29,manyPadding:4,manyFooter:58,tightWidth:290},creator:{height:31,minWidth:50,icon:19,font:14,padding:6,gap:5,spacing:6,columnGap:6}},
    }),
    normalize(value){return ['small','medium','big'].includes(value)?value:'small';},
    current(scope='post'){
      const key=scope==='creator'?'creatorAttachmentBadgeSize':'postAttachmentBadgeSize';
      return AttachmentBadgeSizing.normalize(AttachmentBadgeSizing.previewSizes[scope]??Settings.value[key]);
    },
    metric(size=AttachmentBadgeSizing.current()){return AttachmentBadgeSizing.metrics[AttachmentBadgeSizing.normalize(size)];},
    applyScope(scope,size,{preview=false,reason='apply'}={}){
      const normalized=AttachmentBadgeSizing.normalize(size);const prefix=scope==='creator'?'pmf-creator-attachment-size':'pmf-post-attachment-size';
      AttachmentBadgeSizing.previewSizes[scope]=preview?normalized:null;
      document.documentElement.classList.remove(`${prefix}-small`,`${prefix}-medium`,`${prefix}-big`);
      document.documentElement.classList.add(`${prefix}-${normalized}`);
      BadgeRenderer.refreshGeometry?.();
      CreatorCardBadgeRenderer.refreshReservations?.(document,`badge-size-${reason}`);
      const metric=AttachmentBadgeSizing.metric(normalized);
      Logger.info({operation:'attachment-badge-size',scope,size:normalized,badgeHeight:metric[scope].height,reason});
      return normalized;
    },
    applyAll({reason='apply'}={}){
      AttachmentBadgeSizing.applyScope('post',Settings.value.postAttachmentBadgeSize,{reason});
      AttachmentBadgeSizing.applyScope('creator',Settings.value.creatorAttachmentBadgeSize,{reason});
    },
    preview(scope,size){return AttachmentBadgeSizing.applyScope(scope,size,{preview:true,reason:'settings-preview'});},
    restorePreview(){AttachmentBadgeSizing.previewSizes={post:null,creator:null};return AttachmentBadgeSizing.applyAll({reason:'preview-cancel'});},
    commit(){AttachmentBadgeSizing.previewSizes={post:null,creator:null};return AttachmentBadgeSizing.applyAll({reason:'settings-save'});},
    remove(){
      AttachmentBadgeSizing.previewSizes={post:null,creator:null};
      document.documentElement.classList.remove('pmf-post-attachment-size-small','pmf-post-attachment-size-medium','pmf-post-attachment-size-big','pmf-creator-attachment-size-small','pmf-creator-attachment-size-medium','pmf-creator-attachment-size-big');
    },
  };

  const CreatorCardBadgeRenderer = {
    order:['videos','images','archives','projectFiles','externalLinks'],
    labels:{videos:['video attachment',Icons.video],images:['image attachment',Icons.image],archives:['archive attachment',Icons.archive],projectFiles:['project-file attachment',Icons.project],externalLinks:['external link',Icons.link]},
    formatCount(value) { const count=Math.max(0,Math.floor(Number(value)||0));if(count<1000)return String(count);if(count<10000)return`${(count/1000).toFixed(count%1000?1:0)}k`;return`${Math.floor(count/1000)}k`; },
    enabledTypes(settings=Settings.value.creatorCardBadges) { return CreatorCardBadgeRenderer.order.filter((key)=>settings?.types?.[key]); },
    columns(types) { const columns=[];for(let index=0;index<types.length;index+=2)columns.push(types.slice(index,index+2));return columns; },
    decorateIdentity(info) {
      const {card,context}=info;card.classList.add('pmf-creator-card');card.dataset.pmfCreatorKey=context.creatorKey;card.dataset.pmfCreatorService=context.service;card.dataset.pmfCreatorId=context.creatorId;if(!card.hasAttribute?.('tabindex')){card.setAttribute?.('tabindex','0');card.dataset.pmfAddedTabindex='true';}
    },
    reserveTarget(info) {
      const {card,link}=info;const selector='[class*="content"],[class*="info"],[class*="detail"],[class*="text"],[class*="body"]';let target=link.closest?.(selector);if(!target||target===card||!card.contains(target))target=link.parentElement&&link.parentElement!==card?link.parentElement:link;return target;
    },
    cleanupBadges(card) {
      const rail=card?.querySelector?.('.pmf-creator-card-badges');rail?.querySelectorAll?.('.pmf-creator-badge-column').forEach((column)=>column.style.removeProperty('--pmf-creator-column-badge-width'));rail?.remove();
      card?.querySelectorAll?.('[data-pmf-creator-content]').forEach((node)=>node.removeAttribute('data-pmf-creator-content'));card?.classList?.remove('pmf-creator-card-has-badges');card?.style?.removeProperty?.('--pmf-creator-badge-width');
    },
    cleanup(card) {
      CreatorCardBadgeRenderer.cleanupBadges(card);card?.querySelector?.('.pmf-creator-card-job-status')?.remove();card?.classList?.remove('pmf-creator-card','pmf-creator-card-job-active');card?.removeAttribute?.('data-pmf-creator-key');card?.removeAttribute?.('data-pmf-creator-service');card?.removeAttribute?.('data-pmf-creator-id');if(card?.dataset?.pmfAddedTabindex==='true'){card.removeAttribute('tabindex');delete card.dataset.pmfAddedTabindex;}
    },
    reserve(card,rail) {
      const measured=Math.ceil(Number(rail?.getBoundingClientRect?.().width)||0);const width=measured?measured+12:0;
      if(width)card?.style?.setProperty('--pmf-creator-badge-width',`${width}px`);else card?.style?.removeProperty?.('--pmf-creator-badge-width');return width;
    },
    layout(card,reason='layout') {
      const rail=card?.querySelector?.('.pmf-creator-card-badges');if(!rail?.isConnected)return 0;
      const columns=[...rail.querySelectorAll('.pmf-creator-badge-column')];columns.forEach((column)=>{column.style.removeProperty('--pmf-creator-column-badge-width');[...column.querySelectorAll('.pmf-creator-badge')].forEach((badge)=>badge.style.removeProperty('width'));});
      const columnWidths=columns.map((column)=>Math.ceil(Math.max(0,...[...column.querySelectorAll('.pmf-creator-badge')].map((badge)=>Math.max(Number(badge.getBoundingClientRect?.().width)||0,Number(badge.scrollWidth)||0)))));
      columns.forEach((column,index)=>{if(columnWidths[index])column.style.setProperty('--pmf-creator-column-badge-width',`${columnWidths[index]}px`);});
      const railWidth=Math.ceil(Number(rail.getBoundingClientRect?.().width)||0);const logical=columns.map((column,index)=>({index:Number(column.dataset?.pmfColumnIndex??index),types:String(column.dataset?.pmfBadgeTypes||'').split(',').filter(Boolean),width:columnWidths[index]})).sort((a,b)=>a.index-b.index);const groups=logical.map((entry)=>entry.types);const enabledTypes=groups.flat();const logicalWidths=logical.map((entry)=>entry.width);const reserved=CreatorCardBadgeRenderer.reserve(card,rail);if(Logger.debug)Logger.info({operation:'creator-badge-layout',creatorKey:card.dataset.pmfCreatorKey,reason,enabledTypes,columns:groups,columnWidths:logicalWidths,railWidth,reservedWidth:reserved});return reserved;
    },
    refreshReservations(root=document,reason='refresh') { root?.querySelectorAll?.('.pmf-creator-card-has-badges').forEach((card)=>CreatorCardBadgeRenderer.layout(card,reason)); },
    render(info,meta) {
      const {card,context}=info;CreatorCardBadgeRenderer.decorateIdentity(info);CreatorCardBadgeRenderer.cleanupBadges(card);
      if(!Settings.value.creatorCardBadges.enabled)return null;const normalized=CatalogueModel.normalize(meta||{},{restoreTransient:false});const summary=normalized.catalogue.creatorCardSummary;if(!CreatorCatalogueSummary.valid(summary,normalized.catalogue))return null;
      const types=CreatorCardBadgeRenderer.enabledTypes();if(!types.length)return null;const rail=document.createElement('span');rail.className='pmf-creator-card-badges';rail.dataset.pmfOwned='true';rail.setAttribute('aria-label',`Complete local Catalogue attachment totals for ${info.creatorName}`);
      const warning=summary.retryableMetadataCount||summary.malformedRecordCount;const countMode=Settings.value.creatorCardBadgeCountMode;const logicalColumns=CreatorCardBadgeRenderer.columns(types);[...logicalColumns].reverse().forEach((typesInColumn,reverseIndex)=>{const logicalIndex=logicalColumns.length-1-reverseIndex;const column=document.createElement('span');column.className='pmf-creator-badge-column';column.dataset.pmfOwned='true';column.dataset.pmfColumnIndex=String(logicalIndex);column.dataset.pmfBadgeTypes=typesInColumn.join(',');typesInColumn.forEach((type)=>{const media=summary.media?.[type]||{};const count=Math.max(0,Number(countMode==='posts'?media.posts:(media.attachments??media.links))||0);const [noun,icon]=CreatorCardBadgeRenderer.labels[type];const exact=count.toLocaleString();const posts=summary.sourcePostCount.toLocaleString();const unit=countMode==='posts'?'matching post':'attachment/link';const pending=warning?` Known local total. ${warning} post${warning===1?' has':'s have'} optional metadata pending, so this number may be incomplete.`:'';const badge=document.createElement('span');badge.className=`pmf-creator-badge pmf-creator-badge--${type}`;badge.dataset.pmfOwned='true';badge.title=`${exact} ${count===1?unit:`${unit}s`} across ${posts} Catalogue posts.${pending}`;badge.setAttribute('aria-label',`${exact} ${count===1?unit:`${unit}s`} for ${noun} in this creator's complete local Catalogue.${pending}`);badge.innerHTML=`${icon}<span>${CreatorCardBadgeRenderer.formatCount(count)}</span>`;column.append(badge);});rail.append(column);});
      card.append(rail);CreatorCardBadgeRenderer.reserveTarget(info)?.setAttribute?.('data-pmf-creator-content','true');card.classList.add('pmf-creator-card-has-badges');CreatorCardBadgeRenderer.layout(card,'render');globalThis.requestAnimationFrame?.(()=>CreatorCardBadgeRenderer.layout(card,'animation-frame'));
      if(Logger.debug)Logger.info({operation:'creator-card-badges',creatorKey:context.creatorKey,enabledTypes:types,columnGroups:logicalColumns,counts:summary.counts});return rail;
    },
  };

  const CreatorCardRightRail = {
    order:['favorited','liked','hidden'],
    icon(type){return type==='favorited'?Icons.star:type==='liked'?Icons.heart:Icons.eye;},
    label(type){return{favorited:'Favorited by me',liked:'Liked by me',hidden:'Hidden'}[type];},
    active(type,state){if(type==='favorited')return state?.favoriteDirectValue===true;if(type==='liked')return state?.liked===true;return state?.hidden===true;},
    render(info,meta,state) {
      const card=info.card;card.querySelector('.pmf-creator-card-right-rail')?.remove();CreatorCardBadgeRenderer.render(info,meta);const attachment=card.querySelector('.pmf-creator-card-badges');const settings=Settings.value.creatorStatusBadges;const active=CreatorCardRightRail.order.filter((type)=>settings.enabled&&settings.types?.[type]&&CreatorCardRightRail.active(type,state,meta));
      if(!attachment&&!active.length){card.style.removeProperty('--pmf-creator-rail-width');HiddenCreatorTreatment.apply(card,state);return null;}
      const rail=document.createElement('span');rail.className='pmf-creator-card-right-rail';rail.dataset.pmfOwned='true';const top=document.createElement('span');top.className='pmf-creator-status-group pmf-creator-status-top';const middle=document.createElement('span');middle.className='pmf-creator-status-group pmf-creator-status-middle';const bottom=document.createElement('span');bottom.className='pmf-creator-status-group pmf-creator-status-bottom';
      active.forEach((type)=>{const badge=document.createElement('span');badge.className=`pmf-creator-status-badge pmf-creator-status-${type} pmf-creator-status-size-${Settings.value.creatorStatusBadgeSize}`;badge.dataset.pmfOwned='true';badge.innerHTML=CreatorCardRightRail.icon(type);badge.title=CreatorCardRightRail.label(type,meta);badge.setAttribute('aria-label',badge.title);(type==='favorited'||type==='liked'?top:bottom).append(badge);});
      if(attachment)middle.append(attachment);rail.append(top,middle,bottom);card.append(rail);card.classList.add('pmf-creator-card-has-rail');HiddenCreatorTreatment.apply(card,state);
      requestAnimationFrame(()=>{if(!rail.isConnected)return;const width=Math.ceil(rail.getBoundingClientRect().width||rail.scrollWidth||0);card.style.setProperty('--pmf-creator-rail-width',`${width+12}px`);card.style.setProperty('--pmf-creator-badge-width',`${width+12}px`);});return rail;
    },
    cleanup(card){card?.querySelector?.('.pmf-creator-card-right-rail')?.remove();card?.classList?.remove('pmf-creator-card-has-rail');card?.style?.removeProperty('--pmf-creator-rail-width');HiddenCreatorTreatment.cleanup(card);CreatorCardBadgeRenderer.cleanup(card);},
  };

  const GlobalUI = {
    ensureHost() {
      let host=document.querySelector('#pmf-global-host');if(host)return host;host=document.createElement('div');host.id='pmf-global-host';host.dataset.pmfOwned='true';host.dataset.pmfInstance=INSTANCE_ID;document.body?.append(host);return host;
    },
    flash(message,duration=2800) {
      const host=GlobalUI.ensureHost();host.querySelector('.pmf-global-flash')?.remove();const node=document.createElement('div');node.className='pmf-global-flash pmf-surface';node.setAttribute('role','status');node.textContent=message;host.append(node);setTimeout(()=>node.remove(),duration);
    },
  };

  const CatalogueRunner = {
    async loadRuntime(context) {
      const meta=await Cache.getMeta(context.creatorKey)||{creatorKey:context.creatorKey};const posts=await Cache.getCreatorPosts(context.creatorKey);const model=CatalogueModel.normalize(meta,{restoreTransient:false});
      return {context,creatorMeta:meta,model,catalogueState:model.catalogue,postsById:new Map(posts.map((post)=>[String(post.id),post])),workingEndpoint:Number.isInteger(meta.workingEndpoint)?meta.workingEndpoint:null,totalPosts:Math.max(0,Number(meta.totalPosts)||model.catalogue.totalExpectedPosts||posts.length),totalPages:Math.max(0,Number(meta.totalPages)||Math.ceil((Number(meta.totalPosts)||posts.length)/Config.pageSize))};
    },
    metaPatch(runtime) {
      const state=runtime.catalogueState;const total=state.totalExpectedPosts||runtime.totalPosts||state.storedPostCount||0;
      return {catalogue:state,totalPosts:total,totalPages:Math.ceil(total/Config.pageSize)||0,workingEndpoint:runtime.workingEndpoint,scanSchemaVersion:Config.schemaVersion};
    },
    async persist(runtime) {
      runtime.creatorMeta=await Cache.patchMeta(runtime.context.creatorKey,CatalogueRunner.metaPatch(runtime));return runtime.creatorMeta;
    },
    prepareListPage(rawPosts,runtime,offset=0) {
      const entries=[];const malformed=[];(rawPosts||[]).forEach((raw,index)=>{const id=String(raw?.id??raw?.post_id??'');if(!id){malformed.push({offset,index,reason:'Missing post ID'});return;}const post=PostNormalizer.normalize(raw,runtime.context,'');if(!post){malformed.push({offset,index,reason:'Creator-list record could not be normalized'});return;}entries.push({id,raw,post,metadataPolicy:CatalogueMetadataPolicy.evaluate(raw,post)});});
      if(rawPosts?.length&&!entries.length)throw new Error(`Creator-list page at offset ${offset} contained ${rawPosts.length} record(s) but zero usable post IDs.`);
      return{entries,posts:entries.map((entry)=>entry.post),malformed};
    },
    async requestPersistentStorage(runtime) {
      const state=runtime.catalogueState;if(state.persistentStorageRequested)return state.persistentStorageGranted;state.persistentStorageRequested=true;await CatalogueRunner.persist(runtime);
      try{const storage=globalThis.navigator?.storage;if(!storage?.persisted){state.persistentStorageGranted=null;return null;}const already=await storage.persisted();state.persistentStorageGranted=already||(storage.persist?Boolean(await storage.persist()):false);}catch(error){state.persistentStorageGranted=false;Logger.info('Persistent storage request was unavailable or denied.',error);}await CatalogueRunner.persist(runtime);return state.persistentStorageGranted;
    },
    async commitBuildPage(runtime,response,offset,kind) {
      const prepared=CatalogueRunner.prepareListPage(response.posts,runtime,offset);const state=runtime.catalogueState;state.creatorCardSummary=null;state.malformedListRecords=(state.malformedListRecords||[]).filter((item)=>item.offset!==offset).concat(prepared.malformed);
      const finalPage=Boolean(response.endReason)||response.posts.length<Config.pageSize;const endReason=response.endReason||(response.posts.length===0?'empty-page':finalPage?'short-page':'');
      state.pageCoverage[String(offset)]={offset,rawCount:response.posts.length,usableCount:prepared.posts.length,postIds:prepared.posts.map((post)=>String(post.id)),invalidRecordCount:prepared.malformed.length,fetchedAt:Date.now(),endpointIndex:Number.isInteger(response.endpointIndex)?response.endpointIndex:null,finalPage,endReason,legacy:false,fieldAvailability:CatalogueMetadataPolicy.summarize(prepared.entries.map((entry)=>entry.metadataPolicy.fieldAvailability))};
      const retryable=new Set(state.retryableMetadataIds||[]);const reasons={...(state.retryableMetadataReasons||{})};prepared.entries.forEach((entry)=>{if(entry.metadataPolicy.retryable){retryable.add(entry.id);reasons[entry.id]=entry.metadataPolicy.reasons;}else{retryable.delete(entry.id);delete reasons[entry.id];}});
      state.retryableMetadataIds=[...retryable];state.retryableMetadataReasons=reasons;state.metadataPolicyVersion=2;state.fieldAvailability=CatalogueMetadataPolicy.mergeAvailability(state.pageCoverage);state.successfulOffsets=CatalogueModel.coveredOffsets(state.pageCoverage);state.failedOffsets=(state.failedOffsets||[]).filter((item)=>item!==offset);
      prepared.posts.forEach((post)=>runtime.postsById.set(String(post.id),Cache.mergePost(runtime.postsById.get(String(post.id)),post)));state.storedPostCount=CreatorCatalogueSummary.cataloguePosts([...runtime.postsById.values()]).length;
      if(finalPage){state.totalExpectedPosts=offset+response.posts.length;state.paginationEndReached=true;state.endReason=endReason;}runtime.totalPosts=state.totalExpectedPosts||runtime.totalPosts;runtime.workingEndpoint=response.endpointIndex;
      const evaluation=CatalogueModel.evaluateCoverage(state,{operation:kind});if(evaluation.coverageComplete){state.fullBuildCoverageComplete=true;state.lastFullBuildAt||=Date.now();state.status='complete';}else state.status=evaluation.nextStatus;
      runtime.creatorMeta=await Cache.commitCataloguePage(runtime.context.creatorKey,prepared.posts,CatalogueRunner.metaPatch(runtime));return{prepared,evaluation:CatalogueModel.evaluateCoverage(state),finalPage};
    },
    async completeSummary(runtime) {
      const summary=await CreatorCatalogueSummary.computeAuthoritative(runtime.context,[...runtime.postsById.values()],runtime.catalogueState);runtime.catalogueState.storedPostCount=summary.sourcePostCount;runtime.catalogueState.creatorCardSummary=summary;await CatalogueRunner.persist(runtime);return summary;
    },
    async runBuild(runtime,{kind='build',signal,onProgress=()=>{}}={}) {
      const state=runtime.catalogueState;state.status='building';state.totalExpectedPosts||=runtime.totalPosts;state.metadataPolicyVersion=2;await CatalogueRunner.persist(runtime);await CatalogueRunner.requestPersistentStorage(runtime);
      const attempted=new Set();let sequentialOffset=0;let consecutiveFailures=0;
      while(!signal?.aborted){
        const evaluation=CatalogueModel.evaluateCoverage(state,{operation:kind});const covered=new Set(evaluation.coveredOffsets);let offset;
        if(state.totalExpectedPosts>0)offset=evaluation.missingOffsets.find((item)=>!attempted.has(item));else{while(covered.has(sequentialOffset)||attempted.has(sequentialOffset))sequentialOffset+=Config.pageSize;offset=sequentialOffset;}
        if(offset==null)break;attempted.add(offset);const page=offset/Config.pageSize+1;onProgress({kind,page,totalPages:state.totalExpectedPosts?Math.ceil(state.totalExpectedPosts/Config.pageSize):0,stored:state.storedPostCount,total:state.totalExpectedPosts,offset});
        try{const hasPrior=evaluation.coveredOffsets.some((value)=>value<offset);const response=await PawchiveAPI.fetchCreatorPage(runtime.context,offset,runtime.workingEndpoint,signal,()=>{}, {allowOutOfRange400:offset>0&&hasPrior,operation:kind,jobId:runtime.jobId||''});const committed=await CatalogueRunner.commitBuildPage(runtime,response,offset,kind);consecutiveFailures=0;onProgress({kind,page,totalPages:state.totalExpectedPosts?Math.ceil(state.totalExpectedPosts/Config.pageSize):0,stored:state.storedPostCount,total:state.totalExpectedPosts,offset,rawCount:response.posts.length,usableCount:committed.prepared.posts.length,coverageComplete:committed.evaluation.coverageComplete});if(committed.finalPage||committed.evaluation.coverageComplete)break;}catch(error){if(error.name==='AbortError')throw error;consecutiveFailures+=1;if(!state.pageCoverage[String(offset)])state.failedOffsets=Util.unique([...(state.failedOffsets||[]),offset]).sort((a,b)=>a-b);await CatalogueRunner.persist(runtime);if(!state.totalExpectedPosts||consecutiveFailures>=3)throw error;}
      }
      if(signal?.aborted)throw new DOMException('Aborted','AbortError');const evaluation=CatalogueModel.evaluateCoverage(state);state.status=evaluation.coverageComplete?'complete':evaluation.nextStatus;if(evaluation.coverageComplete){state.fullBuildCoverageComplete=true;state.lastFullBuildAt||=Date.now();await CatalogueRunner.completeSummary(runtime);}else await CatalogueRunner.persist(runtime);return{runtime,evaluation:CatalogueModel.evaluateCoverage(state),newCount:0};
    },
    async runUpdate(runtime,{signal,onProgress=()=>{}}={}) {
      const state=runtime.catalogueState;if(!CatalogueModel.evaluateCoverage(state).coverageComplete)throw new Error('Catalogue coverage is incomplete. Resume it before updating.');
      state.status='updating';await CatalogueRunner.persist(runtime);const known=new Set(CreatorCatalogueSummary.cataloguePosts([...runtime.postsById.values()]).map((post)=>String(post.id)));let offset=0;let newCount=0;
      while(!signal?.aborted){const page=offset/Config.pageSize+1;onProgress({kind:'update',page,newCount,offset});const response=await PawchiveAPI.fetchCreatorPage(runtime.context,offset,runtime.workingEndpoint,signal,()=>{}, {allowOutOfRange400:offset>0,operation:'update',jobId:runtime.jobId||''});runtime.workingEndpoint=response.endpointIndex;const prepared=CatalogueRunner.prepareListPage(response.posts,runtime,offset);if(prepared.malformed.length)state.malformedListRecords=(state.malformedListRecords||[]).filter((item)=>item.offset!==offset).concat(prepared.malformed);
        const decision=CatalogueModel.updatePage(prepared.entries.map((entry)=>entry.id),known);const unseen=new Set(decision.unseenIds);const unseenEntries=prepared.entries.filter((entry)=>unseen.has(entry.id));
        if(unseenEntries.length){const posts=unseenEntries.map((entry)=>entry.post);await Cache.putPosts(posts);posts.forEach((post)=>{runtime.postsById.set(String(post.id),Cache.mergePost(runtime.postsById.get(String(post.id)),post));known.add(String(post.id));});newCount+=posts.length;state.creatorCardSummary=null;const retryable=new Set(state.retryableMetadataIds||[]);const reasons={...(state.retryableMetadataReasons||{})};unseenEntries.forEach((entry)=>{if(entry.metadataPolicy.retryable){retryable.add(entry.id);reasons[entry.id]=entry.metadataPolicy.reasons;}});state.retryableMetadataIds=[...retryable];state.retryableMetadataReasons=reasons;state.storedPostCount=CreatorCatalogueSummary.cataloguePosts([...runtime.postsById.values()]).length;await CatalogueRunner.persist(runtime);}
        onProgress({kind:'update',page,newCount,offset,rawCount:response.posts.length,usableCount:prepared.posts.length,coverageComplete:true});if(decision.stopAfterPage||response.posts.length<Config.pageSize||response.endReason)break;offset+=Config.pageSize;
      }
      if(signal?.aborted)throw new DOMException('Aborted','AbortError');state.lastUpdateCheckAt=Date.now();state.storedPostCount=CreatorCatalogueSummary.cataloguePosts([...runtime.postsById.values()]).length;state.totalExpectedPosts=Math.max(state.totalExpectedPosts,state.storedPostCount);state.fullBuildCoverageComplete=true;state.status='complete';await CatalogueRunner.completeSummary(runtime);return{runtime,evaluation:CatalogueModel.evaluateCoverage(state),newCount};
    },
    async runMetadataRetry(runtime,{signal,onProgress=()=>{}}={}) {
      const state=runtime.catalogueState;const ids=[...(state.retryableMetadataIds||[])].map(String);if(!ids.length)return{runtime,repaired:0,remaining:0};
      const raw=ids.map((id)=>{const post=runtime.postsById.get(id);return post?{...PostNormalizer.rawFromStored(post),id}:{id,service:runtime.context.service,user:runtime.context.creatorId};});onProgress({kind:'metadata-retry',total:ids.length,completed:0});
      const detailResult=await MetadataDetailPool.fetch(raw,{context:runtime.context,signal,concurrency:Settings.value.concurrency,operation:'metadata-retry',jobId:runtime.jobId||'',onWait:(message)=>onProgress({kind:'metadata-retry',message})});
      const improved=new Set();const reasons={...(state.retryableMetadataReasons||{})};const posts=[];for(const [id,item] of detailResult.results){const existing=runtime.postsById.get(id);const merged=PawchiveData.mergeDetailRaw(existing?PostNormalizer.rawFromStored(existing):{},item);const post=PostNormalizer.normalize(merged,runtime.context,existing?.thumbnailUrl||'');if(post){posts.push(post);runtime.postsById.set(id,Cache.mergePost(existing,post));}if(post&&!CatalogueMetadataPolicy.evaluate(merged,post).retryable){improved.add(id);delete reasons[id];}}
      if(posts.length)await Cache.putPosts(posts);state.retryableMetadataIds=ids.filter((id)=>!improved.has(id));state.retryableMetadataReasons=reasons;state.lastMetadataRetryAt=Date.now();state.status=CatalogueModel.evaluateCoverage(state).nextStatus;state.creatorCardSummary=null;if(CatalogueModel.evaluateCoverage(state).coverageComplete)await CatalogueRunner.completeSummary(runtime);else await CatalogueRunner.persist(runtime);onProgress({kind:'metadata-retry',total:ids.length,completed:ids.length,remaining:state.retryableMetadataIds.length});return{runtime,repaired:improved.size,remaining:state.retryableMetadataIds.length,errors:detailResult.errors};
    },
    async run({runtime,kind,signal,onProgress=()=>{}}) { if(kind==='metadata-retry')return CatalogueRunner.runMetadataRetry(runtime,{signal,onProgress});return kind==='update'?CatalogueRunner.runUpdate(runtime,{signal,onProgress}):CatalogueRunner.runBuild(runtime,{kind:kind==='resume'?'build':kind,signal,onProgress}); },
  };

  const CatalogueJobManager = {
    pendingJobs:[],activeJobs:new Map(),recentJobs:new Map(),queuedByCreator:new Map(),batches:new Map(),listeners:new Set(),concurrency:1,sequence:0,queueOrder:0,batchSequence:0,sessionRestored:false,suspendedDescriptors:[],suspendedSettlement:Promise.resolve(),maintenanceActive:false,maintenanceWaiters:[],
    activeForCreator(creatorKey){return CatalogueJobManager.activeJobs.get(creatorKey)||null;},
    queuedForCreator(creatorKey){return CatalogueJobManager.queuedByCreator.get(creatorKey)||null;},
    recentForCreator(creatorKey){return CatalogueJobManager.recentJobs.get(creatorKey)||null;},
    jobForCreator(creatorKey){return CatalogueJobManager.activeForCreator(creatorKey)||CatalogueJobManager.queuedForCreator(creatorKey)||CatalogueJobManager.recentForCreator(creatorKey);},
    queuePosition(creatorKey){const index=CatalogueJobManager.pendingJobs.findIndex((job)=>job.creatorKey===creatorKey);return index<0?0:index+1;},
    snapshot(){return{pending:[...CatalogueJobManager.pendingJobs],active:[...CatalogueJobManager.activeJobs.values()],recent:[...CatalogueJobManager.recentJobs.values()],issues:[...CatalogueJobManager.recentJobs.values()].filter((job)=>['failed','stopped','interrupted'].includes(job.status)),batches:[...CatalogueJobManager.batches.values()].map((batch)=>({...batch})),concurrency:CatalogueJobManager.concurrency};},
    subscribe(listener){CatalogueJobManager.listeners.add(listener);listener(CatalogueJobManager.snapshot());return()=>CatalogueJobManager.listeners.delete(listener);},
    notify(){const snapshot=CatalogueJobManager.snapshot();CatalogueJobManager.listeners.forEach((listener)=>{try{listener(snapshot);}catch(error){Logger.warn('Catalogue job subscriber failed.',error);}});},
    setConcurrency(value){CatalogueJobManager.concurrency=[1,2].includes(Number(value))?Number(value):1;CatalogueJobManager.notify();CatalogueJobManager.pump();return CatalogueJobManager.concurrency;},
    acquireMaintenanceSlot(){if(!CatalogueJobManager.maintenanceActive&&CatalogueJobManager.activeJobs.size<CatalogueJobManager.concurrency){CatalogueJobManager.maintenanceActive=true;CatalogueJobManager.notify();return Promise.resolve();}return new Promise((resolve)=>CatalogueJobManager.maintenanceWaiters.push(resolve));},
    releaseMaintenanceSlot(){CatalogueJobManager.maintenanceActive=false;CatalogueJobManager.notify();CatalogueJobManager.pump();},
    grantMaintenance(){if(CatalogueJobManager.maintenanceActive||!CatalogueJobManager.maintenanceWaiters.length||CatalogueJobManager.activeJobs.size>=CatalogueJobManager.concurrency)return false;CatalogueJobManager.maintenanceActive=true;CatalogueJobManager.maintenanceWaiters.shift()?.();CatalogueJobManager.notify();return true;},
    createBatch({id=`creator-batch-${Date.now()}-${++CatalogueJobManager.batchSequence}`,label='Creator batch',total=0}={}){const batch={id:String(id),label:String(label),total:Math.max(0,Number(total)||0),waiting:0,active:0,completed:0,complete:0,failed:0,stopped:0,removed:0,terminalJobs:{},createdAt:Date.now(),updatedAt:Date.now()};CatalogueJobManager.batches.set(batch.id,batch);CatalogueJobManager.persistSession();return batch;},
    normalizeBatch(batch={}){const terminalJobs=batch.terminalJobs&&typeof batch.terminalJobs==='object'?{...batch.terminalJobs}:{};const completed=Math.max(0,Number(batch.completed??batch.complete)||0);return{...batch,total:Math.max(0,Number(batch.total)||0),waiting:Math.max(0,Number(batch.waiting)||0),active:Math.max(0,Number(batch.active)||0),completed,complete:completed,failed:Math.max(0,Number(batch.failed)||0),stopped:Math.max(0,Number(batch.stopped)||0),removed:Math.max(0,Number(batch.removed)||0),terminalJobs};},
    recordTerminal(job,status=job?.status){if(!job?.batchId||!['complete','failed','stopped','interrupted','removed'].includes(status))return false;const current=CatalogueJobManager.batches.get(job.batchId)||CatalogueJobManager.createBatch({id:job.batchId,label:job.batchLabel});Object.assign(current,CatalogueJobManager.normalizeBatch(current));CatalogueJobManager.batches.set(current.id,current);if(current.terminalJobs[job.id])return false;const field=status==='complete'?'completed':status==='failed'?'failed':status==='removed'?'removed':'stopped';current.terminalJobs[job.id]=field;current[field]+=1;current.complete=current.completed;current.total=Math.max(current.total,current.completed+current.failed+current.stopped+current.removed);current.updatedAt=Date.now();return true;},
    updateBatch(batchId){if(!batchId)return null;const original=CatalogueJobManager.batches.get(batchId)||CatalogueJobManager.createBatch({id:batchId});const batch=CatalogueJobManager.normalizeBatch(original);CatalogueJobManager.batches.set(batchId,batch);const live=[...CatalogueJobManager.pendingJobs,...CatalogueJobManager.activeJobs.values()].filter((job)=>job.batchId===batchId);[...CatalogueJobManager.recentJobs.values()].filter((job)=>job.batchId===batchId).forEach((job)=>CatalogueJobManager.recordTerminal(job));batch.waiting=live.filter((job)=>job.status==='queued').length;batch.active=live.filter((job)=>job.status==='running').length;batch.complete=batch.completed;const finished=batch.completed+batch.failed+batch.stopped+batch.removed;batch.total=Math.max(batch.total,finished+batch.active+batch.waiting);batch.updatedAt=Date.now();return batch;},
    enqueue(context,requestedAction,{creatorName=context.creatorId,front=false,batchId='',batchLabel='',batchSequence=0,directorySnapshot=null}={}) {
      const existing=CatalogueJobManager.activeForCreator(context.creatorKey)||CatalogueJobManager.queuedForCreator(context.creatorKey);if(existing)return{accepted:false,state:existing.status==='queued'?'already-queued':'already-active',job:existing,position:CatalogueJobManager.queuePosition(context.creatorKey)};
      const snapshot=CreatorDirectory.normalize(directorySnapshot||{...context,creatorName,creatorUrl:context.creatorUrl});Cache.getCreatorDirectory([context.creatorKey]).then((known)=>Cache.putCreatorDirectory([CreatorDirectory.merge(known.get(context.creatorKey)||{},snapshot)])).catch((error)=>Logger.warn('Could not save queued creator directory snapshot.',error));
      const job={id:`catalogue-job-${Date.now()}-${++CatalogueJobManager.sequence}`,creatorKey:context.creatorKey,creatorName,context:{...context},requestedAction,kind:requestedAction,status:'queued',queuedAt:Date.now(),queueOrder:front?--CatalogueJobManager.queueOrder:++CatalogueJobManager.queueOrder,batchId:String(batchId||''),batchLabel:String(batchLabel||''),batchSequence:Number(batchSequence)||0,progress:{kind:requestedAction},controller:null,result:null,error:null};if(job.batchId&&!CatalogueJobManager.batches.has(job.batchId))CatalogueJobManager.createBatch({id:job.batchId,label:job.batchLabel,total:0});if(front)CatalogueJobManager.pendingJobs.unshift(job);else CatalogueJobManager.pendingJobs.push(job);CatalogueJobManager.queuedByCreator.set(job.creatorKey,job);CatalogueJobManager.updateBatch(job.batchId);CatalogueJobManager.persistSession();Logger.info({operation:'catalogue-job-enqueued',creatorKey:job.creatorKey,requestedAction,queuePosition:CatalogueJobManager.queuePosition(job.creatorKey),queueLength:CatalogueJobManager.pendingJobs.length,activeCount:CatalogueJobManager.activeJobs.size,concurrency:CatalogueJobManager.concurrency});CatalogueJobManager.notify();CatalogueJobManager.pump();return{accepted:true,state:job.status==='running'?'started':'queued',job,position:CatalogueJobManager.queuePosition(job.creatorKey)};
    },
    async reevaluate(job){if(job.requestedAction==='metadata-retry')return'metadata-retry';const meta=await Cache.getMeta(job.creatorKey);const action=ArtistCatalogueAction.forState(meta,null);return action==='build'?'build':action==='resume'?'resume':'update';},
    pump(){Logger.info({operation:'catalogue-queue-pump',activeCount:CatalogueJobManager.activeJobs.size,queueLength:CatalogueJobManager.pendingJobs.length,concurrency:CatalogueJobManager.concurrency});if(CatalogueJobManager.grantMaintenance())return;while(CatalogueJobManager.activeJobs.size+(CatalogueJobManager.maintenanceActive?1:0)<CatalogueJobManager.concurrency&&CatalogueJobManager.pendingJobs.length){const job=CatalogueJobManager.pendingJobs.shift();CatalogueJobManager.queuedByCreator.delete(job.creatorKey);job.done=CatalogueJobManager.startJob(job);}CatalogueJobManager.persistSession();},
    async startJob(job) {
      job.status='running';job.startedAt=Date.now();job.controller=new AbortController();CatalogueJobManager.activeJobs.set(job.creatorKey,job);CatalogueJobManager.updateBatch(job.batchId);CatalogueJobManager.persistSession();CatalogueJobManager.notify();
      try{job.kind=await CatalogueJobManager.reevaluate(job);Logger.info({operation:'catalogue-job-started',creatorKey:job.creatorKey,requestedAction:job.requestedAction,resolvedAction:job.kind,activeCount:CatalogueJobManager.activeJobs.size,queueLength:CatalogueJobManager.pendingJobs.length,concurrency:CatalogueJobManager.concurrency});if(job.controller.signal.aborted)throw new DOMException('Aborted','AbortError');const runtime=await CatalogueRunner.loadRuntime(job.context);runtime.jobId=job.id;job.runtime=runtime;job.result=await CatalogueRunner.run({runtime,kind:job.kind,signal:job.controller.signal,onProgress:(progress)=>{job.progress={...job.progress,...progress};CatalogueJobManager.notify();if(Logger.debug)Logger.info({operation:`catalogue-${job.kind}`,creatorKey:job.creatorKey,jobId:job.id,...progress});}});job.status='complete';job.progress={...job.progress,message:job.kind==='metadata-retry'?`${job.result.repaired} optional detail${job.result.repaired===1?'':'s'} repaired`:job.kind==='update'?(job.result.newCount?`${job.result.newCount} new post${job.result.newCount===1?'':'s'} added`:'Catalogue already up to date'):'Scan complete'};}
      catch(error){job.error=error;job.status=error.name==='AbortError'?'stopped':'failed';job.progress={...job.progress,message:error.name==='AbortError'?'Operation stopped':error.message};if(job.runtime){try{const state=job.runtime.catalogueState;const coverage=CatalogueModel.evaluateCoverage(state);state.status=coverage.nextStatus;await CatalogueRunner.persist(job.runtime);}catch(persistError){Logger.warn('Could not persist stopped Catalogue state.',persistError);}}if(error.name!=='AbortError')Logger.error('Catalogue queue job failed.',error);}
      finally{if(job.status==='complete'&&job.kind!=='metadata-retry'&&Settings.value.synchronizeNativeFavorites){try{await FavoriteSyncCoordinator.ensureFresh({reason:`catalogue-${job.kind}`,force:false});}catch(error){Logger.warn('Catalogue completed, but native Favorite synchronization was unavailable.',error);}}if(CatalogueJobManager.activeJobs.get(job.creatorKey)===job)CatalogueJobManager.activeJobs.delete(job.creatorKey);job.finishedAt=Date.now();if(!job.suspended&&!job.shutdown){CatalogueJobManager.recordTerminal(job);CatalogueJobManager.recentJobs.set(job.creatorKey,job);}if(!job.shutdown){CatalogueJobManager.updateBatch(job.batchId);CatalogueJobManager.persistSession();}Logger.info({operation:'catalogue-job-finished',creatorKey:job.creatorKey,resolvedAction:job.kind,status:job.status,newCount:job.result?.newCount||0,elapsedMs:job.finishedAt-job.startedAt,activeCount:CatalogueJobManager.activeJobs.size,queueLength:CatalogueJobManager.pendingJobs.length});if(!job.suspended&&!job.shutdown){CatalogueJobManager.notify();CatalogueJobManager.pump();if(job.status==='complete')setTimeout(()=>{if(CatalogueJobManager.recentJobs.get(job.creatorKey)===job){CatalogueJobManager.recentJobs.delete(job.creatorKey);CatalogueJobManager.persistSession();CatalogueJobManager.notify();}},8000);}}
      return job;
    },
    stop(creatorKey){const job=CatalogueJobManager.activeForCreator(creatorKey);if(!job)return false;job.controller?.abort();return true;},
    removeQueued(creatorKey){const job=CatalogueJobManager.queuedForCreator(creatorKey);if(!job)return false;CatalogueJobManager.pendingJobs=CatalogueJobManager.pendingJobs.filter((item)=>item!==job);CatalogueJobManager.queuedByCreator.delete(creatorKey);job.status='removed';CatalogueJobManager.updateBatch(job.batchId);CatalogueJobManager.recordTerminal(job,'removed');CatalogueJobManager.updateBatch(job.batchId);CatalogueJobManager.persistSession();CatalogueJobManager.notify();return true;},
    moveToTop(creatorKey){const index=CatalogueJobManager.pendingJobs.findIndex((job)=>job.creatorKey===creatorKey);if(index<=0)return index===0;const [job]=CatalogueJobManager.pendingJobs.splice(index,1);job.queueOrder=Math.min(0,...CatalogueJobManager.pendingJobs.map((item)=>Number(item.queueOrder)||0))-1;CatalogueJobManager.pendingJobs.unshift(job);CatalogueJobManager.persistSession();CatalogueJobManager.notify();return true;},
    batchCounts(batchId){const batch=CatalogueJobManager.updateBatch(batchId);if(!batch)return{total:0,active:0,waiting:0,completed:0,complete:0,failed:0,stopped:0,removed:0,finished:0,remaining:0};const finished=batch.completed+batch.failed+batch.stopped+batch.removed;return{...batch,finished,remaining:batch.active+batch.waiting};},
    aggregate(snapshot=CatalogueJobManager.snapshot()){const batches=snapshot.batches||[];if(batches.length){const counts=batches.map((batch)=>CatalogueJobManager.batchCounts(batch.id));return counts.reduce((sum,item)=>({total:sum.total+item.total,active:sum.active+item.active,waiting:sum.waiting+item.waiting,completed:sum.completed+item.completed,failed:sum.failed+item.failed,stopped:sum.stopped+item.stopped,removed:sum.removed+item.removed,finished:sum.finished+item.finished,remaining:sum.remaining+item.remaining}),{total:0,active:0,waiting:0,completed:0,failed:0,stopped:0,removed:0,finished:0,remaining:0});}const recent=snapshot.recent||[],completed=recent.filter((job)=>job.status==='complete').length,failed=recent.filter((job)=>job.status==='failed').length,stopped=recent.filter((job)=>['stopped','interrupted'].includes(job.status)).length,active=(snapshot.active||[]).length,waiting=(snapshot.pending||[]).length,finished=completed+failed+stopped;return{total:finished+active+waiting,active,waiting,completed,failed,stopped,removed:0,finished,remaining:active+waiting};},
    cancelBatch(batchId){const keys=CatalogueJobManager.pendingJobs.filter((job)=>job.batchId===batchId).map((job)=>job.creatorKey);keys.forEach((key)=>CatalogueJobManager.removeQueued(key));return keys.length;},
    clearCompleted(){for(const [key,job] of CatalogueJobManager.recentJobs){if(job.status==='complete')CatalogueJobManager.recentJobs.delete(key);}CatalogueJobManager.notify();},
    dismiss(creatorKey){const job=CatalogueJobManager.recentJobs.get(creatorKey);if(!job||!['failed','stopped','interrupted'].includes(job.status))return false;CatalogueJobManager.recentJobs.delete(creatorKey);CatalogueJobManager.notify();return true;},
    retry(creatorKey){const job=CatalogueJobManager.recentJobs.get(creatorKey);if(!job||!['failed','stopped','interrupted'].includes(job.status))return{accepted:false,state:'not-retryable'};const batch=CatalogueJobManager.batches.get(job.batchId),field=batch?.terminalJobs?.[job.id];if(field){batch[field]=Math.max(0,(Number(batch[field])||0)-1);if(field==='completed')batch.complete=batch.completed;delete batch.terminalJobs[job.id];}CatalogueJobManager.recentJobs.delete(creatorKey);const result=CatalogueJobManager.enqueue(job.context,job.requestedAction,{creatorName:job.creatorName,batchId:job.batchId,batchLabel:job.batchLabel,batchSequence:job.batchSequence});if(result.accepted){result.job.id=job.id;CatalogueJobManager.updateBatch(job.batchId);CatalogueJobManager.persistSession();CatalogueJobManager.notify();return result;}CatalogueJobManager.recentJobs.set(creatorKey,job);CatalogueJobManager.recordTerminal(job);CatalogueJobManager.updateBatch(job.batchId);return result;},
    persistSession(){const storage=globalThis.sessionStorage;if(!storage)return false;try{const serializable=(job)=>({id:job.id,context:job.context,requestedAction:job.requestedAction,creatorName:job.creatorName,batchId:job.batchId,batchLabel:job.batchLabel,batchSequence:job.batchSequence,queueOrder:job.queueOrder,queuedAt:job.queuedAt,progress:job.progress,status:job.status,errorMessage:job.error?.message||job.errorMessage||''});const waiting=CatalogueJobManager.pendingJobs.map(serializable);const active=[...CatalogueJobManager.activeJobs.values()].map(serializable);const recent=[...CatalogueJobManager.recentJobs.values()].map(serializable);storage.setItem(Config.creatorQueueSessionKey,JSON.stringify({version:3,waiting,active,recent,batches:[...CatalogueJobManager.batches.values()],queueOrder:CatalogueJobManager.queueOrder,updatedAt:Date.now()}));return true;}catch(error){Logger.warn('Could not persist creator queue.',error);return false;}},
    restoreSession(){if(CatalogueJobManager.sessionRestored)return false;CatalogueJobManager.sessionRestored=true;const storage=globalThis.sessionStorage;if(!storage)return false;let saved=null;try{saved=JSON.parse(storage.getItem(Config.creatorQueueSessionKey)||'null');}catch(error){Logger.warn('Could not restore creator queue.',error);}if(![1,2,3].includes(saved?.version))return false;CatalogueJobManager.queueOrder=Number(saved.queueOrder)||0;(saved.batches||[]).forEach((batch)=>{const migrated=saved.version<3?{...batch,completed:0,complete:0,failed:0,stopped:0,terminalJobs:{}}:batch;CatalogueJobManager.batches.set(batch.id,CatalogueJobManager.normalizeBatch(migrated));});[...(saved.recent||[]),...(saved.active||[]).map((job)=>({...job,status:'interrupted',progress:{...(job.progress||{}),message:'Interrupted by reload'},errorMessage:job.errorMessage||'Interrupted by reload'}))].forEach((descriptor)=>{const creatorKey=descriptor.context?.creatorKey||descriptor.creatorKey;const job={...descriptor,id:descriptor.id||`restored-${creatorKey}-${descriptor.queuedAt||Date.now()}`,creatorKey,error:new Error(descriptor.errorMessage||'Interrupted by reload')};CatalogueJobManager.recentJobs.set(creatorKey,job);CatalogueJobManager.recordTerminal(job);});(saved.waiting||[]).sort((a,b)=>(a.queueOrder??a.batchSequence??0)-(b.queueOrder??b.batchSequence??0)).forEach((descriptor)=>{const result=CatalogueJobManager.enqueue(descriptor.context,descriptor.requestedAction,{...descriptor});if(result.job){result.job.id=descriptor.id||result.job.id;result.job.queueOrder=Number(descriptor.queueOrder)||result.job.queueOrder;result.job.queuedAt=Number(descriptor.queuedAt)||result.job.queuedAt;}});CatalogueJobManager.batches.forEach((_,id)=>CatalogueJobManager.updateBatch(id));CatalogueJobManager.persistSession();CatalogueJobManager.notify();return true;},
    suspendForBfcache(){const active=[...CatalogueJobManager.activeJobs.values()],descriptor=(job)=>({id:job.id,context:job.context,requestedAction:job.requestedAction,creatorName:job.creatorName,batchId:job.batchId,batchLabel:job.batchLabel,batchSequence:job.batchSequence,queueOrder:job.queueOrder,queuedAt:job.queuedAt});CatalogueJobManager.suspendedDescriptors=[...active.map(descriptor),...CatalogueJobManager.pendingJobs.map(descriptor)];active.forEach((job)=>{job.suspended=true;job.controller?.abort();});CatalogueJobManager.suspendedSettlement=Promise.allSettled(active.map((job)=>job.done).filter(Boolean));CatalogueJobManager.activeJobs.clear();CatalogueJobManager.pendingJobs=[];CatalogueJobManager.queuedByCreator.clear();CatalogueJobManager.notify();},
    async resumeFromBfcache(){const descriptors=CatalogueJobManager.suspendedDescriptors.splice(0);await CatalogueJobManager.suspendedSettlement;descriptors.reverse().forEach((item)=>{const result=CatalogueJobManager.enqueue(item.context,item.requestedAction,{...item,front:true});if(result.job){result.job.id=item.id||result.job.id;result.job.queueOrder=Number(item.queueOrder)||result.job.queueOrder;result.job.queuedAt=Number(item.queuedAt)||result.job.queuedAt;}});CatalogueJobManager.persistSession();},
    shutdown(){CatalogueJobManager.activeJobs.forEach((job)=>{job.shutdown=true;job.controller?.abort();});CatalogueJobManager.pendingJobs=[];CatalogueJobManager.activeJobs.clear();CatalogueJobManager.queuedByCreator.clear();CatalogueJobManager.recentJobs.clear();CatalogueJobManager.batches.clear();CatalogueJobManager.suspendedDescriptors=[];CatalogueJobManager.suspendedSettlement=Promise.resolve();CatalogueJobManager.notify();},
  };

  const catalogueEnqueueBase=CatalogueJobManager.enqueue.bind(CatalogueJobManager);
  CatalogueJobManager.enqueue=function enqueueWithDirectorySnapshot(context,requestedAction,options={}){const snapshot=CreatorDirectory.normalize(options.directorySnapshot||{...context,creatorName:options.creatorName||context.creatorId,creatorUrl:context.creatorUrl});const result=catalogueEnqueueBase(context,requestedAction,options);if(result.job){result.job.directorySnapshot=snapshot;Cache.getCreatorDirectory([snapshot.creatorKey]).then((known)=>Cache.putCreatorDirectory([CreatorDirectory.merge(known.get(snapshot.creatorKey)||{},snapshot)])).catch((error)=>Logger.warn('Could not persist creator directory snapshot.',error));CatalogueJobManager.persistSession();}return result;};
  const cataloguePersistBase=CatalogueJobManager.persistSession.bind(CatalogueJobManager);
  CatalogueJobManager.persistSession=function persistSessionWithDirectorySnapshot(){const saved=cataloguePersistBase();try{const storage=globalThis.sessionStorage,data=JSON.parse(storage?.getItem(Config.creatorQueueSessionKey)||'{}');const snapshots=new Map([...CatalogueJobManager.pendingJobs,...CatalogueJobManager.activeJobs.values(),...CatalogueJobManager.recentJobs.values()].map((job)=>[job.id,job.directorySnapshot]).filter(([,snapshot])=>snapshot));['waiting','active','recent'].forEach((key)=>{(data[key]||[]).forEach((job)=>{if(snapshots.has(job.id))job.directorySnapshot=snapshots.get(job.id);});});storage?.setItem(Config.creatorQueueSessionKey,JSON.stringify(data));}catch(error){Logger.warn('Could not add creator snapshots to queue session.',error);}return saved;};
  const catalogueClearCompletedBase=CatalogueJobManager.clearCompleted.bind(CatalogueJobManager);
  CatalogueJobManager.clearCompleted=function clearCompletedDurably(){catalogueClearCompletedBase();for(const [id,batch] of CatalogueJobManager.batches){const state=CatalogueJobManager.normalizeBatch(batch);if(!state.active&&!state.waiting&&!state.failed&&!state.stopped)CatalogueJobManager.batches.delete(id);}CatalogueJobManager.persistSession();CatalogueJobManager.notify();};

  const Presets = {
    record: null,
    id() { return globalThis.crypto?.randomUUID?.() || `preset-${Date.now()}-${Math.random().toString(36).slice(2)}`; },
    snapshot(filterState) {
      const state = FilterEngine.normalizeState(filterState);
      return {
        media: { enabled: { ...state.media.enabled }, matchMode: state.media.matchMode },
        customExtensions: { values: [...state.customExtensions.values] },
        customRules: { enabled: state.customRules.enabled, rows: state.customRules.rows.map(FilterEngine.normalizeRule) },
        publishedDate: { ...state.publishedDate },
      };
    },
    apply(snapshot, currentState = FilterEngine.createDefaultState()) {
      const preservedScope = FilterEngine.normalizeState(currentState).externalLinks.scope;
      const next = FilterEngine.normalizeState({ ...snapshot, externalLinks: { scope: preservedScope } });
      next.externalLinks.scope = preservedScope;
      return next;
    },
    normalizePreset(preset, fallbackName = 'Default') {
      const now = Date.now();
      return {
        id: String(preset?.id || Presets.id()),
        name: String(preset?.name || fallbackName).trim().slice(0, 80) || fallbackName,
        snapshot: Presets.snapshot(Presets.apply(preset?.snapshot || FilterEngine.createDefaultState())),
        createdAt: Number(preset?.createdAt) || now,
        updatedAt: Number(preset?.updatedAt) || now,
      };
    },
    load(migrationState) {
      const stored = GM_getValue(Config.presetsKey, null);
      const list = stored?.schemaVersion === Config.presetSchemaVersion && Array.isArray(stored.presets)
        ? stored.presets.map((preset, index) => Presets.normalizePreset(preset, index ? `Preset ${index + 1}` : 'Default'))
        : [];
      if (!list.length) list.push(Presets.normalizePreset({ name: 'Default', snapshot: Presets.snapshot(migrationState || FilterEngine.createDefaultState()) }));
      const seen = new Set();
      list.forEach((preset) => {
        const base = preset.name; let suffix = 2;
        while (seen.has(preset.name.toLocaleLowerCase())) preset.name = `${base} ${suffix++}`;
        seen.add(preset.name.toLocaleLowerCase());
      });
      Presets.record = { schemaVersion: Config.presetSchemaVersion, presets: list, updatedAt: Number(stored?.updatedAt) || Date.now() };
      Presets.save();
      return Presets.record;
    },
    save() {
      if (!Presets.record) return;
      Presets.record.updatedAt = Date.now();
      GM_setValue(Config.presetsKey, Presets.record);
    },
    all() { return Presets.record?.presets || []; },
    get(id) { return Presets.all().find((preset) => preset.id === id) || null; },
    default() { return Presets.all()[0] || null; },
    uniqueName(raw, exceptId = '') {
      const name = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 80);
      if (!name) return { valid: false, message: 'Enter a preset name.' };
      const duplicate = Presets.all().some((preset) => preset.id !== exceptId && preset.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      return duplicate ? { valid: false, message: 'Preset names must be unique.' } : { valid: true, name };
    },
    create(name, snapshot) {
      const validation = Presets.uniqueName(name); if (!validation.valid) return validation;
      const preset = Presets.normalizePreset({ name: validation.name, snapshot }); Presets.all().push(preset); Presets.save();
      return { valid: true, preset };
    },
    rename(id, name) {
      const preset = Presets.get(id); if (!preset) return { valid: false, message: 'Preset not found.' };
      const validation = Presets.uniqueName(name, id); if (!validation.valid) return validation;
      preset.name = validation.name; preset.updatedAt = Date.now(); Presets.save(); return { valid: true, preset };
    },
    duplicate(id) {
      const source = Presets.get(id); if (!source) return { valid: false, message: 'Preset not found.' };
      let suffix = ' copy'; let index = 2;
      while (!Presets.uniqueName(`${source.name}${suffix}`).valid) suffix = ` copy ${index++}`;
      return Presets.create(`${source.name}${suffix}`, source.snapshot);
    },
    remove(id) {
      if (Presets.all().length <= 1) return { valid: false, message: 'At least one preset is required.' };
      const index = Presets.all().findIndex((preset) => preset.id === id); if (index < 0) return { valid: false, message: 'Preset not found.' };
      const [preset] = Presets.all().splice(index, 1); Presets.save(); return { valid: true, preset };
    },
    updateSnapshot(id, state) {
      const preset = Presets.get(id); if (!preset) return false;
      preset.snapshot = Presets.snapshot(state); preset.updatedAt = Date.now(); Presets.save(); return true;
    },
  };

  const OverlayManager = {
    stack: [],
    scrollY: 0,

    scrollLock: {
        active: false,
    },
    top() { return OverlayManager.stack.at(-1) || null; },
    open({ id = Presets.id(), owner = '', node, root = node, opener = document.activeElement, modal = false, dismissible = true, onClose = null }) {
      // Anchored menus share one owner.  This avoids the detached-shadow and
      // duplicate outside-listener symptom caused by rapidly reopening controls.
      if(!modal){
        const matching=owner&&OverlayManager.stack.find((entry)=>!entry.modal&&entry.owner===owner);
        if(matching&&matching.opener===opener){OverlayManager.close(matching.id,'toggle');return null;}
        [...OverlayManager.stack].filter((entry)=>!entry.modal).reverse().forEach((entry)=>OverlayManager.close(entry.id,'another-popup'));
      }
      const entry = { id, owner, node, root, opener, modal, dismissible, onClose };
      OverlayManager.stack.push(entry); OverlayManager.sync();
      opener?.setAttribute?.('aria-expanded','true');
      queueMicrotask(() => node?.querySelector?.('[autofocus], input, button, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus?.());
      return id;
    },
    close(id = OverlayManager.top()?.id, reason = 'programmatic') {
      const index = OverlayManager.stack.findIndex((entry) => entry.id === id); if (index < 0) return false;
      const [entry] = OverlayManager.stack.splice(index, 1); entry.root?.remove?.(); entry.opener?.setAttribute?.('aria-expanded','false'); entry.onClose?.(reason); OverlayManager.sync();
      if (entry.opener?.isConnected) entry.opener.focus?.();
      return true;
    },
    closeTop(reason = 'dismiss') { const top = OverlayManager.top(); return Boolean(top?.dismissible && OverlayManager.close(top.id, reason)); },
    closeAll(reason = 'cleanup') { [...OverlayManager.stack].reverse().forEach((entry) => OverlayManager.close(entry.id, reason)); },
sync() {
    const modal =
        OverlayManager.stack.some(
            (entry) => entry.modal
        );

    const lock =
        OverlayManager.scrollLock;

    if (modal && !lock.active) {
        OverlayManager.scrollY =
            window.scrollY;

        lock.active =
            true;
    } else if (!modal && lock.active) {
        lock.active =
            false;

        window.scrollTo?.(
            0,
            OverlayManager.scrollY
        );
    }

    OverlayManager.stack.forEach(
        (entry, index) => {
            entry.root?.classList?.toggle(
                'pmf-overlay-inactive',
                index !==
                    OverlayManager.stack.length -
                        1
            );
        }
    );
},
    install(signal) {
      document.addEventListener('pointerdown', (event) => {
        const top = OverlayManager.top(); if (!top?.dismissible) return;
        if (!top.node?.contains?.(event.target) && !top.opener?.contains?.(event.target)) OverlayManager.closeTop('outside');
      }, { capture: true, signal });
      document.addEventListener('keydown', (event) => {
        const top = OverlayManager.top(); if (!top) return;
        if (event.key === 'Escape' && top.dismissible) { event.preventDefault(); event.stopPropagation(); OverlayManager.closeTop('escape'); return; }
        if (event.key !== 'Tab' || !top.modal) return;
        const focusable = [...top.node.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter((node) => !node.hidden);
        if (!focusable.length) return;
        const first = focusable[0]; const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }, { capture: true, signal });
    },
  };

  const PawchiveDOM = {
    find(context) {
      const main = document.querySelector('main#main, main.main, #main');
      const topPaginator = [...document.querySelectorAll('#paginator-top, .paginator')].find((node) => !node.closest('[data-pmf-owned="true"]') && node.querySelector('.tabs'));
      const searchInput = topPaginator?.querySelector('input.search-input[name="q"], input#q[placeholder*="posts" i]') || document.querySelector('input.search-input[placeholder*="posts" i]');
      const searchForm = searchInput?.closest('form');
      const grid = [...document.querySelectorAll('.card-list__items')].find((node) => !node.closest('[data-pmf-owned="true"]')) || document.querySelector('article.post-card:not([data-pmf-owned="true"])')?.parentElement;
      const nativeCards = grid ? [...grid.querySelectorAll(`article.post-card[data-user="${CSS.escape(context.creatorId)}"], article.post-card[data-id]`)] : [];
      const bottomPaginator = [...document.querySelectorAll('.paginator')].find((node) => !node.closest('[data-pmf-owned="true"]') && node !== topPaginator && !node.querySelector('.tabs')) || null;
      if (!main || !topPaginator || !searchInput || !searchForm || !grid) return null;
      const countNodes = [...document.querySelectorAll('.paginator > small')].filter((node) => !node.closest('[data-pmf-owned="true"]'));
      const menuNodes = [...document.querySelectorAll('.paginator > menu')].filter((node) => !node.closest('[data-pmf-owned="true"]'));
      const totalMatch = countNodes.map((node) => node.textContent).join(' ').match(/of\s+([\d,]+)/i);
      return {
        main, topPaginator, bottomPaginator, searchInput, searchForm, grid, nativeCards,
        template: nativeCards[0], countNodes, menuNodes,
        totalPosts: totalMatch ? Util.parseInteger(totalMatch[1].replace(/,/g, ''), 0) : 0,
        tabs: topPaginator.querySelector('.tabs'),
      };
    },
    signature(dom) {
      const cards=dom?.nativeCards||[];const current=[...dom?.topPaginator?.querySelectorAll?.('a,button')||[]].find((node)=>node.classList.contains('current')||node.getAttribute('aria-current')==='page');
      return {grid:dom?.grid||null,cardCount:cards.length,firstCardId:String(cards[0]?.dataset?.id||''),lastCardId:String(cards.at(-1)?.dataset?.id||''),currentPaginatorPage:String(current?.textContent||'').trim()};
    },
    signatureKey(signature={}){return [signature.cardCount,signature.firstCardId,signature.lastCardId,signature.currentPaginatorPage].join('|');},
  };

  const BadgeRenderer = {
    getVisibleCategories() {
      const active = FilterEngine.categories(App.filterState);
      const visible = new Set(active);
      if (Settings.value.catalogueBadges.alwaysShow) {
        Object.entries(Settings.value.catalogueBadges.types).forEach(([category, enabled]) => { if (enabled) visible.add(category); });
      }
      return [...visible];
    },
    details(post, category) {
      if (category === 'videos') return { present: post.videoCount > 0, count: post.videoCount, icon: Icons.video, noun: 'video attachment', extensions: post.videoExtensions };
      if (category === 'images') return { present: post.imageCount > 0, count: post.imageCount, icon: Icons.image, noun: 'image attachment', extensions: post.imageExtensions };
      if (category === 'archives') return { present: post.archiveCount > 0, count: post.archiveCount, icon: Icons.archive, noun: 'archive attachment', extensions: post.archiveExtensions };
      if (category === 'projectFiles') {
        const evidence = [];
        post.projectKeywordMatches?.forEach((keyword) => evidence.push(`Matched keyword: ${keyword}`));
        post.projectMatchSources?.forEach((source) => evidence.push(`Source: ${source.replaceAll('-', ' ')}`));
        return { present: post.hasProjectFiles, count: post.projectFileCount, icon: Icons.project, noun: 'project-file attachment', extensions: post.projectExtensions, evidence };
      }
      if (category === 'customExtensions') {
        const count = FilterEngine.customExtensionCount(post, App.filterState);
        const extensions = (post.fileExtensions || []).filter((ext) => App.filterState.customExtensions.values.includes(ext));
        return { present: count > 0, count, icon: Icons.file, noun: 'custom-extension attachment', extensions: Util.unique(extensions) };
      }
      const count = App.filterState.externalLinks.scope === 'any' ? post.externalLinkCount : post.mediaDownloadLinkCount;
      return { present: count > 0, count, icon: Icons.link, noun: App.filterState.externalLinks.scope === 'any' ? 'external link' : 'media/download link', extensions: [] };
    },
    create(post, category, { allowKeywordProject = true } = {}) {
      const info = BadgeRenderer.details(post, category);
      if (category === 'projectFiles' && !allowKeywordProject && !(post.projectFileCount > 0)) return null;
      if (!info.present) return null;
      const badge = document.createElement('span');
      badge.className = `pmf-badge pmf-badge--${category}`;
      const plural = info.count === 1 ? info.noun : `${info.noun}s`;
      const detail = info.extensions.length ? `\nExtensions: ${info.extensions.map((x) => x.toUpperCase()).join(', ')}` : '';
      const evidence = info.evidence?.length ? `\n${info.evidence.join('\n')}` : '';
      badge.title = info.count ? `${info.count} ${plural}${detail}${evidence}` : `Project-file signal found${evidence}`;
      badge.setAttribute('aria-label', badge.title.replace('\n', '. '));
      badge.innerHTML = `${info.icon}${info.count > 1 ? `<span>${info.count}</span>` : ''}`;
      return badge;
    },
    updateGeometry(card) {
      const container=card.querySelector('.pmf-badges');const time=card.querySelector('.pmf-card-date');if(!container||!time)return;
      const count=container.childElementCount;const width=Number(card.getBoundingClientRect?.().width)||0;const tight=count===3&&width>0&&width<AttachmentBadgeSizing.metric(AttachmentBadgeSizing.current('post')).post.tightWidth;
      card.classList.toggle('pmf-tight-badges',tight);
      if(tight){
        if(!time.dataset.pmfOriginalText)time.dataset.pmfOriginalText=time.textContent||'';
        if(!('pmfOriginalTitle' in time.dataset))time.dataset.pmfOriginalTitle=time.getAttribute('title')||'';
        if(!('pmfOriginalAria' in time.dataset))time.dataset.pmfOriginalAria=time.getAttribute('aria-label')||'';
        const full=time.dataset.pmfOriginalText;time.textContent=Util.formatDate(time.dateTime||full);time.title=full;time.setAttribute('aria-label',full);
      }else BadgeRenderer.restoreDate(time);
    },
    restoreDate(time) {
      if(!time?.dataset?.pmfOriginalText)return;
      time.textContent=time.dataset.pmfOriginalText;
      const title=time.dataset.pmfOriginalTitle||'';const aria=time.dataset.pmfOriginalAria||'';
      if(title)time.setAttribute('title',title);else time.removeAttribute('title');
      if(aria)time.setAttribute('aria-label',aria);else time.removeAttribute('aria-label');
      delete time.dataset.pmfOriginalText;delete time.dataset.pmfOriginalTitle;delete time.dataset.pmfOriginalAria;
    },
    refreshGeometry() {
      App.dom?.grid?.querySelectorAll('.pmf-card-has-badges').forEach(BadgeRenderer.updateGeometry);
      App.ui?.grid?.querySelectorAll('.pmf-card-has-badges').forEach(BadgeRenderer.updateGeometry);
    },
    apply(card, post) {
      card.querySelector('.pmf-badges')?.remove();
      card.classList.remove('pmf-card-has-badges','pmf-many-badges','pmf-tight-badges');
      card.removeAttribute('data-pmf-badge-count');
      card.querySelectorAll('.pmf-attachment-count-hidden').forEach((node)=>node.classList.remove('pmf-attachment-count-hidden'));
      card.querySelectorAll('.pmf-card-date').forEach((node)=>{BadgeRenderer.restoreDate(node);node.classList.remove('pmf-card-date');});
      const categories = BadgeRenderer.getVisibleCategories();
      if (!categories.length || !post) return;
      const active = new Set(FilterEngine.categories(App.filterState));
      const container = document.createElement('span');
      container.className = 'pmf-badges';
      categories.forEach((category) => {
        const badge = BadgeRenderer.create(post, category, { allowKeywordProject:active.has(category) });
        if (badge) container.append(badge);
      });
      if (!container.childElementCount) return;
      const footer = card.querySelector('.post-card__footer') || card;
      const footerRow = footer.querySelector(':scope > div') || footer;
      const attachmentNode = [...footer.querySelectorAll('div')].find((node)=>/attachments?/i.test(node.textContent||'')&&!node.querySelector('div'));
      const time = footer.querySelector('time');
      attachmentNode?.classList.add('pmf-attachment-count-hidden');
      time?.classList.add('pmf-card-date');
      card.classList.add('pmf-card-has-badges');
      card.dataset.pmfBadgeCount=String(container.childElementCount);
      if(container.childElementCount>=4)card.classList.add('pmf-many-badges');
      footerRow.append(container);
      BadgeRenderer.updateGeometry(card);
    },
    cleanup(card) {
      card.querySelector('.pmf-badges')?.remove();
      card.classList.remove('pmf-card-has-badges','pmf-many-badges','pmf-tight-badges');
      card.removeAttribute('data-pmf-badge-count');
      card.querySelectorAll('.pmf-attachment-count-hidden').forEach((node)=>node.classList.remove('pmf-attachment-count-hidden'));
      card.querySelectorAll('.pmf-card-date').forEach((node)=>{BadgeRenderer.restoreDate(node);node.classList.remove('pmf-card-date');});
    },
  };

  const LegacyCompactGridScale = {
    measurement:null,
    creatorKey:'',
    observer:null,
    resizeHandler:null,
    generation:0,
    previewScale:null,
    lastApplied:null,
    lastVerified:null,
    verifyGeneration:0,
    pendingReason:'',
    normalizeScale(value) {
      return ['big','medium','small'].includes(value)?value:'big';
    },
    median(values=[]) {
      const sorted=values.map(Number).filter((value)=>Number.isFinite(value)&&value>0).sort((a,b)=>a-b);
      if(!sorted.length)return 0;const middle=Math.floor(sorted.length/2);
      return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
    },
    resetForCreator(creatorKey='') {
      if(CompactGridScale.creatorKey===creatorKey)return;
      CompactGridScale.creatorKey=creatorKey;CompactGridScale.measurement=null;CompactGridScale.lastApplied=null;CompactGridScale.lastVerified=null;
    },
    commitMeasurement(candidate) {
      if(!candidate||candidate.creatorKey!==CompactGridScale.creatorKey)return CompactGridScale.measurement;
      if(!(candidate.gridWidth>0&&candidate.cardWidth>0&&candidate.columnCount>0&&candidate.nativeVisibleCardRatio>0&&candidate.nativeThumbnailRatio>0))return CompactGridScale.measurement;
      CompactGridScale.measurement={...candidate};
      return CompactGridScale.measurement;
    },
    renderedColumnCount(cards=[]) {
      const lefts=cards.map((card)=>Number(card.getBoundingClientRect?.().left)).filter(Number.isFinite);
      return new Set(lefts.map((left)=>Math.round(left))).size;
    },
    captureNativeGeometry() {
      if(!App.context||!App.dom?.grid)return CompactGridScale.measurement;
      CompactGridScale.resetForCreator(App.context.creatorKey);
      const grid=App.dom.grid;if(grid.isConnected===false||grid.hidden)return CompactGridScale.measurement;
      const gridRect=grid.getBoundingClientRect?.();const gridWidth=Number(gridRect?.width)||Number(grid.clientWidth)||0;
      const parent=grid.parentElement;const containerWidth=Number(parent?.getBoundingClientRect?.().width)||Number(parent?.clientWidth)||gridWidth;
      const cards=(App.dom.nativeCards||[]).filter((card)=>card?.isConnected!==false);
      const cardRects=cards.map((card)=>card.getBoundingClientRect?.()).filter((rect)=>rect?.width>0&&rect?.height>0);
      const cardWidths=cardRects.map((rect)=>rect.width);
      const cardWidth=CompactGridScale.median(cardWidths);
      if(!(gridWidth>0&&cardWidth>0))return CompactGridScale.measurement;
      const style=globalThis.getComputedStyle?.(grid);const columnGap=Math.max(0,parseFloat(style?.columnGap)||0);const rowGap=Math.max(0,parseFloat(style?.rowGap)||columnGap);
      const visibleColumns=CompactGridScale.renderedColumnCount(cards.filter((card)=>Number(card.getBoundingClientRect?.().width)>0));
      const columnCount=Math.max(1,visibleColumns||Math.round((gridWidth+columnGap)/(cardWidth+columnGap)));
      const nativeCardHeight=CompactGridScale.median(cardRects.map((rect)=>rect.height));
      const nativeVisibleCardRatio=CompactGridScale.median(cardRects.map((rect)=>rect.width/rect.height))||16/9;
      const thumbnailRects=cards.map((card)=>card.querySelector?.('.post-card__image-container')?.getBoundingClientRect?.()).filter((rect)=>rect?.width>0&&rect?.height>0);
      const nativeThumbnailWidth=CompactGridScale.median(thumbnailRects.map((rect)=>rect.width));
      const nativeThumbnailHeight=CompactGridScale.median(thumbnailRects.map((rect)=>rect.height));
      const nativeThumbnailRatio=CompactGridScale.median(thumbnailRects.map((rect)=>rect.width/rect.height))||16/9;
      return CompactGridScale.commitMeasurement({
        creatorKey:App.context.creatorKey,containerWidth,gridWidth,cardWidth,columnCount,columnGap,rowGap,
        nativeCardHeight,nativeVisibleCardRatio,nativeThumbnailWidth,nativeThumbnailHeight,nativeThumbnailRatio,measuredAt:Date.now(),
      });
    },
    availableWidth(grid=App.ui?.grid,parent=grid?.parentElement,fallback=CompactGridScale.measurement?.gridWidth||1) {
      if(grid&&!grid.hidden&&grid.isConnected!==false){const width=Number(grid.getBoundingClientRect?.().width)||Number(grid.clientWidth)||0;if(width>0)return width;}
      const parentWidth=Number(parent?.getBoundingClientRect?.().width)||Number(parent?.clientWidth)||0;
      return parentWidth>0?parentWidth:Math.max(1,Number(fallback)||1);
    },
    pageSizeForColumns(columns,maximum=Config.filteredPageSize) {
      const safeColumns=Math.max(1,Math.min(maximum,Math.floor(Number(columns)||1)));
      const rows=Math.max(1,Math.floor(maximum/safeColumns));
      return Math.min(maximum,rows*safeColumns);
    },
    calculateLayout({availableWidth,containerWidth,nativeCardHeight=0,cardWidth=180,nativeVisibleCardRatio=16/9,columnGap=0,scale='big',ratio=nativeVisibleCardRatio}) {
      const width=Math.max(1,Number(availableWidth??containerWidth)||1);const gap=Math.max(0,Number(columnGap)||0);const normalizedScale=CompactGridScale.normalizeScale(scale);
      const nativeHeight=Math.max(72,Number(nativeCardHeight)||Math.max(72,Number(cardWidth||180)/Math.max(.1,Number(nativeVisibleCardRatio)||16/9)));
      const legacySmall=Math.max(110,Math.round(nativeHeight*1.26));
      const newBig=Math.max(1,Math.round(legacySmall/1.25));
      const newMedium=Math.max(1,Math.round(newBig/1.5));
      const newSmall=Math.max(1,Math.round(newBig/2));
      const thumbnailHeight=normalizedScale==='big'?newBig:normalizedScale==='medium'?newMedium:newSmall;const requestedRatio=Math.max(.1,Number(ratio)||16/9);const baseWidth16x9=Math.round(thumbnailHeight*(16/9));
      const renderedCardWidth=Math.max(1,Math.round(thumbnailHeight*requestedRatio));
      const columns=Math.max(1,Math.floor((width+gap)/(renderedCardWidth+gap)));const pageSize=CompactGridScale.pageSizeForColumns(columns,Config.filteredPageSize);
      const layoutKey=`${normalizedScale}|${CompactThumbnailRatio.normalizeAspectRatio(Settings.value.compactThumbnailAspectRatio)}|${renderedCardWidth}|${thumbnailHeight}|${columns}|${pageSize}`;
      return {scale:normalizedScale,columns,cardWidth:renderedCardWidth,cardHeight:thumbnailHeight,thumbnailHeight,legacySmall,newBig,newMedium,newSmall,baseWidth16x9,targetWidth:renderedCardWidth,targetHeight:thumbnailHeight,ratio:requestedRatio,pageSize,layoutKey,availableWidth:width,columnGap:gap};
    },
    calculate(options) { return CompactGridScale.calculateLayout(options); },
    currentScale() { return CompactGridScale.normalizeScale(CompactGridScale.previewScale??Settings.value.compactCardScale); },
    setOwnedGridStyles(grid,layout,base) {
      grid.classList.remove('pmf-card-scale-big','pmf-card-scale-medium','pmf-card-scale-small');
      grid.classList.add(`pmf-card-scale-${layout.scale}`);
      grid.style.setProperty('display','flex','important');
      grid.style.setProperty('flex-wrap','wrap','important');
      grid.style.setProperty('justify-content','center','important');
      grid.style.setProperty('align-items','flex-start','important');
      grid.style.setProperty('align-content','flex-start','important');
      grid.style.setProperty('width','100%','important');
      grid.style.setProperty('max-width','none','important');
      grid.style.setProperty('box-sizing','border-box','important');
      grid.style.setProperty('column-gap',`${base.columnGap}px`,'important');
      grid.style.setProperty('row-gap',`${base.rowGap}px`,'important');
      grid.style.setProperty('--pmf-card-width',`${layout.cardWidth}px`);grid.style.setProperty('--pmf-card-height',`${layout.cardHeight}px`);grid.style.setProperty('--pmf-thumbnail-height',`${layout.thumbnailHeight}px`);grid.style.setProperty('--pmf-column-gap',`${base.columnGap}px`);grid.style.setProperty('--pmf-row-gap',`${base.rowGap}px`);
      grid.dataset.pmfCardScale=layout.scale;grid.dataset.pmfColumns=String(layout.columns);grid.dataset.pmfPageSize=String(layout.pageSize);
    },
    applyScale(scale=CompactGridScale.currentScale(),{reason='render',corrective=false,ratioOverride=null}={}) {
      if(!App.ui?.grid)return null;
      const base=CompactGridScale.measurement||CompactGridScale.captureNativeGeometry();
      if(!base)return null;
      const grid=App.ui.grid;grid.style.setProperty('display','grid','important');grid.style.setProperty('width','100%','important');grid.style.setProperty('max-width','none','important');grid.style.setProperty('box-sizing','border-box','important');const width=CompactGridScale.availableWidth(grid,grid.parentElement,base.gridWidth);
      const ratioSetting=ratioOverride==null?CompactThumbnailRatio.currentAspectRatio():CompactThumbnailRatio.normalizeAspectRatio(ratioOverride);const ratio=CompactThumbnailRatio.numericRatio(ratioSetting,base.nativeVisibleCardRatio);
      const layout=CompactGridScale.calculateLayout({...base,availableWidth:width,scale,ratio});
      CompactGridScale.setOwnedGridStyles(grid,layout,base);
      CompactGridScale.lastApplied={layout,base,reason,sessionToken:App.sessionToken,creatorKey:App.context?.creatorKey,corrective};
      CompactThumbnailRatio.directCards(grid).forEach((card)=>{card.style.setProperty('width',`${layout.cardWidth}px`,'important');card.style.setProperty('min-width',`${layout.cardWidth}px`,'important');card.style.setProperty('max-width',`${layout.cardWidth}px`,'important');card.style.setProperty('inline-size',`${layout.cardWidth}px`,'important');card.style.setProperty('height',`${layout.thumbnailHeight}px`,'important');card.style.setProperty('block-size',`${layout.thumbnailHeight}px`,'important');card.style.setProperty('flex',`0 0 ${layout.cardWidth}px`,'important');card.style.removeProperty?.('aspect-ratio');});
      const event={layout,base,reason,sessionToken:App.sessionToken,creatorKey:App.context?.creatorKey,corrective};
      CompactGridScale.lastApplied=event;CompactGridScale.scheduleVerification(event);
      return layout;
    },
    apply() { return CompactGridScale.applyScale(); },
    pageSize(){return Math.max(1,Number(App.ui?.grid?.dataset?.pmfPageSize)||Number(CompactGridScale.lastApplied?.layout?.pageSize)||Config.filteredPageSize);},
    scheduleVerification(event) {
      const token=++CompactGridScale.verifyGeneration;const frame=globalThis.requestAnimationFrame||((callback)=>setTimeout(callback,0));
      frame(()=>{if(token!==CompactGridScale.verifyGeneration)return;CompactGridScale.verifyRenderedGeometry(event);});
    },
    computedColumnCount(template='') {
      const text=String(template).trim();if(!text||text==='none')return 0;
      const repeat=text.match(/^repeat\(\s*(\d+)/i);if(repeat)return Number(repeat[1]);
      return text.split(/\s+/).filter(Boolean).length;
    },
    verifyRenderedGeometry(event) {
      if(!event||event.sessionToken!==App.sessionToken||event.creatorKey!==App.context?.creatorKey)return null;
      const grid=App.ui?.grid;if(!grid||grid.hidden)return null;
      const style=globalThis.getComputedStyle?.(grid);const cards=[...grid.querySelectorAll?.(':scope > .post-card')||[]];
      const cardRects=cards.map((card)=>card.getBoundingClientRect?.()).filter((rect)=>rect?.width>0&&rect?.height>0);
      const cardWidth=CompactGridScale.median(cardRects.map((rect)=>rect.width));const cardHeight=CompactGridScale.median(cardRects.map((rect)=>rect.height));
      const renderedVisibleCardRatio=CompactGridScale.median(cardRects.map((rect)=>rect.width/rect.height));
      const imageContainerRatios=cards.map((card)=>{const rect=card.querySelector?.('.post-card__image-container')?.getBoundingClientRect?.();return rect?.width>0&&rect?.height>0?rect.width/rect.height:0;});
      const renderedImageContainerRatio=CompactGridScale.median(imageContainerRatios);
      const computedTemplate=style?.gridTemplateColumns||grid.style.getPropertyValue?.('grid-template-columns')||'';
      const computedColumns=CompactGridScale.computedColumnCount(computedTemplate);const ratioSetting=CompactThumbnailRatio.currentAspectRatio();const requestedVisibleCardRatio=CompactThumbnailRatio.numericRatio(ratioSetting,event.base.nativeVisibleCardRatio);
      const result={
        operation:'compact-layout',creatorKey:event.creatorKey,scale:event.layout.scale,ratio:ratioSetting,availableWidth:event.layout.availableWidth,baseWidth16x9:event.layout.baseWidth16x9,thumbnailHeight:event.layout.thumbnailHeight,cardWidth:event.layout.cardWidth,columns:event.layout.columns,pageSize:event.layout.pageSize,filteredPage:App.filteredPage,firstResultIndex:App.filteredFirstResultIndex,totalMatches:App.matchingPosts?.().length||0,renderedCount:cards.length,layoutKey:event.layout.layoutKey,cardScale:event.layout.scale,thumbnailRatioSetting:ratioSetting,requestedColumns:event.layout.columns,
        inlineGridTemplate:grid.style.getPropertyValue?.('grid-template-columns')||grid.style.gridTemplateColumns||'',
        computedDisplay:style?.display||'',computedGridTemplateColumns:computedTemplate,computedColumns,
        gridWidth:CompactGridScale.availableWidth(grid,grid.parentElement,event.base.gridWidth),renderedCardWidth:cardWidth,renderedCardHeight:cardHeight,renderedColumns:CompactGridScale.renderedColumnCount(cards),
        nativeCardWidth:event.base.cardWidth,nativeVisibleCardRatio:event.base.nativeVisibleCardRatio,nativeColumns:event.base.columnCount,
        requestedVisibleCardRatio,renderedVisibleCardRatio,renderedImageContainerRatio,scaleClass:`pmf-card-scale-${event.layout.scale}`,ratioClass:`pmf-thumb-ratio-${ratioSetting}`,
      };
      const previous=CompactGridScale.lastVerified;const unchangedAcrossScale=previous&&previous.cardScale!==result.cardScale&&previous.requestedColumns!==result.requestedColumns&&
        ((result.computedColumns&&result.computedColumns===previous.computedColumns)||(result.renderedCardWidth&&Math.abs(result.renderedCardWidth-previous.renderedCardWidth)<1));
      const scaleChangedByRatio=previous&&previous.thumbnailRatioSetting!==result.thumbnailRatioSetting&&
        (previous.computedColumns!==result.computedColumns||Math.abs((previous.renderedCardWidth||0)-(result.renderedCardWidth||0))>=1);
      const ratioChangedByScale=previous&&previous.cardScale!==result.cardScale&&previous.thumbnailRatioSetting===result.thumbnailRatioSetting&&
        previous.renderedVisibleCardRatio&&result.renderedVisibleCardRatio&&Math.abs(previous.renderedVisibleCardRatio-result.renderedVisibleCardRatio)>.03;
      const overridden=(result.computedDisplay&&result.computedDisplay!=='flex')||unchangedAcrossScale;
      if(Logger.debug&&['creator-rebind','scale-preview','settings-preview','settings-save','resize'].includes(event.reason))Logger.info(result);
      if(Logger.debug&&scaleChangedByRatio)Logger.warn('Thumbnail aspect ratio unexpectedly changed Compact grid scale.');
      if(Logger.debug&&ratioChangedByScale)Logger.warn('Compact card scale unexpectedly changed the thumbnail aspect ratio.');
      CompactGridScale.lastVerified=result;
      if(overridden&&!event.corrective){
        if(Logger.debug)Logger.warn('Compact grid sizing was overridden by page CSS.');
        CompactGridScale.applyScale(event.layout.scale,{reason:event.reason,corrective:true});
      }
      BadgeRenderer.refreshGeometry();
      return result;
    },
    preview(scale) {
      CompactGridScale.previewScale=CompactGridScale.normalizeScale(scale);
      return CompactLayoutEngine.apply({scale:CompactGridScale.previewScale,reason:'scale-preview'});
    },
    restorePreview({apply=true,reason='settings-cancel'}={}) {
      CompactGridScale.previewScale=null;
      if(apply)return CompactLayoutEngine.apply({reason});
      return null;
    },
    connect() {
      CompactGridScale.disconnect();CompactGridScale.resetForCreator(App.context?.creatorKey||'');CompactGridScale.captureNativeGeometry();CompactGridScale.pendingReason='creator-rebind';const generation=++CompactGridScale.generation;const sessionToken=App.sessionToken;const creatorKey=App.context?.creatorKey;const target=App.dom?.grid?.parentElement;if(!target)return;
      let lastWidth=CompactGridScale.availableWidth(null,target,CompactGridScale.measurement?.gridWidth||1);
      const schedule=Util.debounce(()=>{if(generation!==CompactGridScale.generation||sessionToken!==App.sessionToken||creatorKey!==App.context?.creatorKey||!App.ui)return;const width=CompactGridScale.availableWidth(App.ui.grid,target,lastWidth);if(Math.abs(width-lastWidth)<2)return;lastWidth=width;if(!App.dom.grid.hidden)CompactGridScale.captureNativeGeometry();const priorSize=App.filteredPageSize();const matches=App.matchingPosts();App.filteredFirstResultIndex=Math.max(0,(App.filteredPage-1)*priorSize);App.filteredAnchorId=matches[App.filteredFirstResultIndex]?.id||App.filteredAnchorId;CompactLayoutEngine.apply({reason:'resize'});const nextSize=App.filteredPageSize();if(nextSize!==priorSize){App.restoreFirstResultPage(matches.length);App.render();}},120);
      if(typeof ResizeObserver==='function'){CompactGridScale.observer=new ResizeObserver(()=>schedule());CompactGridScale.observer.observe(target);}
      CompactGridScale.resizeHandler=schedule;window.addEventListener('resize',schedule,{signal:App.pageController.signal});
      App.pageController.signal.addEventListener('abort',()=>schedule.cancel(),{once:true});
    },
    disconnect() {
      CompactGridScale.generation+=1;CompactGridScale.verifyGeneration+=1;CompactGridScale.observer?.disconnect();CompactGridScale.observer=null;CompactGridScale.resizeHandler?.cancel?.();CompactGridScale.resizeHandler=null;CompactGridScale.measurement=null;CompactGridScale.creatorKey='';CompactGridScale.previewScale=null;CompactGridScale.lastApplied=null;CompactGridScale.lastVerified=null;CompactGridScale.pendingReason='';CompactThumbnailRatio.clear();CardRenderer.clearCropDebug();
    },
  };

  const LegacyCompactThumbnailRatio = {
    previewRatio:null,
    verifyGeneration:0,
    lastVerified:null,
    lastLogKey:'',
    normalizeAspectRatio(value) { return value==='native'?'1-1':['16-9','4-3','1-1'].includes(value)?value:'1-1'; },
    currentAspectRatio() { return CompactThumbnailRatio.normalizeAspectRatio(CompactThumbnailRatio.previewRatio??Settings.value.compactThumbnailAspectRatio); },
    numericRatio(value,nativeRatio=CompactGridScale.measurement?.nativeVisibleCardRatio||16/9) {
      const normalized=CompactThumbnailRatio.normalizeAspectRatio(value);
      return normalized==='16-9'?16/9:normalized==='4-3'?4/3:1;
    },
    directCards(grid=App.ui?.grid) { return [...grid?.querySelectorAll?.(':scope > .post-card')||[]]; },
    expectedHeight(width,ratio) { return Math.max(0,Number(width)||0)/Math.max(.1,Number(ratio)||16/9); },
    correctionFor(width,height,ratio) {
      const expectedHeight=CompactThumbnailRatio.expectedHeight(width,ratio);const difference=Math.abs((Number(height)||0)-expectedHeight);const tolerance=Math.max(2,expectedHeight*.025);
      return {expectedHeight,difference,tolerance,needsCorrection:Boolean(expectedHeight&&difference>tolerance)};
    },
    clearCorrectiveCardHeights(grid=App.ui?.grid) {
      CompactThumbnailRatio.directCards(grid).forEach((card)=>{card.style.removeProperty?.('height');card.style.removeProperty?.('block-size');delete card.dataset.pmfRatioCorrected;});
    },
    applyAspectRatio(value=CompactThumbnailRatio.currentAspectRatio(),{reason='render',verify=true}={}) {
      if(!App.ui?.grid)return null;
      const ratio=CompactThumbnailRatio.normalizeAspectRatio(value);const grid=App.ui.grid;const nativeRatio=CompactGridScale.measurement?.nativeVisibleCardRatio||16/9;const numericRatio=CompactThumbnailRatio.numericRatio(ratio,nativeRatio);
      grid.classList.remove('pmf-thumb-ratio-native','pmf-thumb-ratio-16-9','pmf-thumb-ratio-4-3','pmf-thumb-ratio-1-1');
      grid.classList.add(`pmf-thumb-ratio-${ratio}`);grid.dataset.pmfThumbnailRatio=ratio;
      grid.style.setProperty('--pmf-card-aspect-ratio',String(numericRatio));grid.style.setProperty('--pmf-native-visible-card-ratio',String(nativeRatio));
      const layout=CompactGridScale.applyScale(undefined,{reason,ratioOverride:ratio});
      CardRenderer.normalizeGridThumbnails(grid,{reason});
      if(verify)CompactThumbnailRatio.scheduleVerification({reason,ratioSetting:ratio,numericRatio,sessionToken:App.sessionToken,creatorKey:App.context?.creatorKey,corrected:false,correctiveHeightApplied:false});
      return {ratio,numericRatio,layout};
    },
    scheduleVerification(event) {
      const token=++CompactThumbnailRatio.verifyGeneration;const frame=globalThis.requestAnimationFrame||((callback)=>setTimeout(callback,0));
      frame(()=>{if(token!==CompactThumbnailRatio.verifyGeneration)return;CompactThumbnailRatio.verifyVisibleCardRatio(event);});
    },
    measureVisibleCard(card) {
      const ratioOf=(node)=>{const rect=node?.getBoundingClientRect?.();return rect?.width>0&&rect?.height>0?{width:rect.width,height:rect.height,ratio:rect.width/rect.height}:{width:0,height:0,ratio:0};};
      return {card:ratioOf(card),link:ratioOf(card.querySelector?.(':scope > .image-link')),imageContainer:ratioOf(card.querySelector?.('.post-card__image-container'))};
    },
    verifyVisibleCardRatio(event) {
      if(!event||event.sessionToken!==App.sessionToken||event.creatorKey!==App.context?.creatorKey)return null;
      const grid=App.ui?.grid;if(!grid||grid.hidden)return null;const cards=CompactThumbnailRatio.directCards(grid);const measurements=cards.map((card)=>({cardNode:card,...CompactThumbnailRatio.measureVisibleCard(card)})).filter((item)=>item.card.width>0&&item.card.height>0);
      if(!measurements.length)return null;const corrections=measurements.map((item)=>({card:item.cardNode,...CompactThumbnailRatio.correctionFor(item.card.width,item.card.height,event.numericRatio)})).filter((item)=>item.needsCorrection);
      const result={
        operation:'compact-visible-card-ratio',cardScale:CompactGridScale.currentScale(),ratioSetting:event.ratioSetting,requestedRatio:event.numericRatio,
        renderedColumns:Number(grid.dataset.pmfColumns)||CompactGridScale.renderedColumnCount(cards),
        cardWidth:CompactGridScale.median(measurements.map((item)=>item.card.width)),cardHeight:CompactGridScale.median(measurements.map((item)=>item.card.height)),
        visibleCardRatio:CompactGridScale.median(measurements.map((item)=>item.card.ratio)),
        linkWidth:CompactGridScale.median(measurements.map((item)=>item.link.width)),linkHeight:CompactGridScale.median(measurements.map((item)=>item.link.height)),
        renderedLinkRatio:CompactGridScale.median(measurements.map((item)=>item.link.ratio)),imageContainerWidth:CompactGridScale.median(measurements.map((item)=>item.imageContainer.width)),
        imageContainerHeight:CompactGridScale.median(measurements.map((item)=>item.imageContainer.height)),imageContainerRatio:CompactGridScale.median(measurements.map((item)=>item.imageContainer.ratio)),
        correctiveHeightApplied:Boolean(event.correctiveHeightApplied),withinTolerance:corrections.length===0,
      };
      if(corrections.length&&Logger.debug)Logger.warn('Compact visible card ratio differs from requested ratio; CompactGridScale remains the only geometry owner.');
      const loggable=['render','creator-rebind','ratio-preview','scale-preview','settings-preview','settings-save','resize'].includes(event.reason);
      const logKey=`${event.reason}|${event.creatorKey}|${App.filteredPage}|${result.cardScale}|${event.ratioSetting}|${Math.round(result.cardWidth)}|${result.renderedColumns}|${result.correctiveHeightApplied}`;
      if(Logger.debug&&loggable&&logKey!==CompactThumbnailRatio.lastLogKey){Logger.info(result);CompactThumbnailRatio.lastLogKey=logKey;}
      CompactThumbnailRatio.lastVerified=result;BadgeRenderer.refreshGeometry();return result;
    },
    preview(value) {
      CompactThumbnailRatio.previewRatio=CompactThumbnailRatio.normalizeAspectRatio(value);
      return CompactLayoutEngine.apply({ratio:CompactThumbnailRatio.previewRatio,reason:'ratio-preview'});
    },
    restorePreview({apply=true}={}) {
      CompactThumbnailRatio.previewRatio=null;
      if(apply)return CompactLayoutEngine.apply({reason:'settings-cancel'});
      return null;
    },
    clearOwnedStyles({resetPreview=false}={}) {
      CompactThumbnailRatio.verifyGeneration+=1;if(resetPreview)CompactThumbnailRatio.previewRatio=null;const grid=App.ui?.grid;if(!grid)return;
      grid.classList.remove('pmf-thumb-ratio-native','pmf-thumb-ratio-16-9','pmf-thumb-ratio-4-3','pmf-thumb-ratio-1-1');
      CompactThumbnailRatio.directCards(grid).forEach((card)=>{['aspect-ratio','width','min-width','max-width','inline-size','height','block-size','flex'].forEach((property)=>card.style.removeProperty?.(property));delete card.dataset.pmfRatioCorrected;});
      grid.removeAttribute?.('data-pmf-thumbnail-ratio');grid.style.removeProperty?.('--pmf-card-aspect-ratio');grid.style.removeProperty?.('--pmf-native-visible-card-ratio');grid.style.removeProperty?.('--pmf-card-width');grid.style.removeProperty?.('--pmf-card-height');grid.style.removeProperty?.('--pmf-thumbnail-height');delete grid.dataset.pmfPageSize;
    },
    clear() { CompactThumbnailRatio.clearOwnedStyles({resetPreview:true});CompactThumbnailRatio.lastVerified=null;CompactThumbnailRatio.lastLogKey=''; },
  };

  /*
   * The v0.8.3 geometry authority.  CompactGridScale and
   * CompactThumbnailRatio remain compatibility facades for older tests and
   * saved integrations; application code enters through this owner.
   */
  const CompactLayoutEngine = {
    get measurement(){return LegacyCompactGridScale.measurement;},
    get previewScale(){return LegacyCompactGridScale.previewScale;},
    set previewScale(value){LegacyCompactGridScale.previewScale=value;},
    get previewRatio(){return LegacyCompactThumbnailRatio.previewRatio;},
    set previewRatio(value){LegacyCompactThumbnailRatio.previewRatio=value;},
    normalizeScale:LegacyCompactGridScale.normalizeScale,
    normalizeAspectRatio:LegacyCompactThumbnailRatio.normalizeAspectRatio,
    numericRatio:LegacyCompactThumbnailRatio.numericRatio,
    pageSizeForColumns:LegacyCompactGridScale.pageSizeForColumns,
    calculateLayout:LegacyCompactGridScale.calculateLayout,
    captureNativeGeometry:LegacyCompactGridScale.captureNativeGeometry,
    currentScale:LegacyCompactGridScale.currentScale,
    currentAspectRatio:LegacyCompactThumbnailRatio.currentAspectRatio,
    apply({scale,ratio,reason='render',verify=true}={}) {
      if(scale!=null)LegacyCompactGridScale.previewScale=LegacyCompactGridScale.normalizeScale(scale);
      if(ratio!=null)LegacyCompactThumbnailRatio.previewRatio=LegacyCompactThumbnailRatio.normalizeAspectRatio(ratio);
      if(!App.ui?.grid)return null;
      const selectedRatio=LegacyCompactThumbnailRatio.currentAspectRatio();
      const result=LegacyCompactGridScale.applyScale(undefined,{reason,ratioOverride:selectedRatio});
      if(result){
        const grid=App.ui.grid;
        grid.classList.remove('pmf-thumb-ratio-native','pmf-thumb-ratio-16-9','pmf-thumb-ratio-4-3','pmf-thumb-ratio-1-1');
        grid.classList.add(`pmf-thumb-ratio-${selectedRatio}`);
        grid.dataset.pmfThumbnailRatio=selectedRatio;
        grid.style.setProperty('--pmf-card-aspect-ratio',String(LegacyCompactThumbnailRatio.numericRatio(selectedRatio)));
        CardRenderer.normalizeGridThumbnails(grid,{reason});
        if(verify)LegacyCompactThumbnailRatio.scheduleVerification({reason,ratioSetting:selectedRatio,numericRatio:LegacyCompactThumbnailRatio.numericRatio(selectedRatio),sessionToken:App.sessionToken,creatorKey:App.context?.creatorKey,corrected:false,correctiveHeightApplied:false});
      }
      return result;
    },
    preview({scale,ratio}={}){return CompactLayoutEngine.apply({scale,ratio,reason:'settings-preview'});},
    restorePreview({apply=true,reason='settings-cancel'}={}) {
      LegacyCompactGridScale.previewScale=null;LegacyCompactThumbnailRatio.previewRatio=null;
      return apply?CompactLayoutEngine.apply({reason}):null;
    },
    pageSize(){return LegacyCompactGridScale.pageSize();},
    connect(){return LegacyCompactGridScale.connect();},
    verify(event){return LegacyCompactGridScale.verifyRenderedGeometry(event);},
    cleanup(){return LegacyCompactGridScale.disconnect();},
  };

  const layoutFacade=(legacy,kind)=>new Proxy(Object.create(null),{
    get(_target,key){
      if(key==='preview')return(value)=>CompactLayoutEngine.preview(kind==='scale'?{scale:value}:{ratio:value});
      if(key==='restorePreview')return({apply=true,reason='settings-cancel'}={})=>{if(kind==='scale')LegacyCompactGridScale.previewScale=null;else LegacyCompactThumbnailRatio.previewRatio=null;return apply?CompactLayoutEngine.apply({reason}):null;};
      const ownerValue=Reflect.get(CompactLayoutEngine,key,CompactLayoutEngine);const value=ownerValue===undefined?Reflect.get(legacy,key,legacy):ownerValue;return typeof value==='function'?value.bind(ownerValue===undefined?legacy:CompactLayoutEngine):value;
    },
    set(_target,key,value){const descriptor=Object.getOwnPropertyDescriptor(CompactLayoutEngine,key);if(descriptor?.set||descriptor?.writable)return Reflect.set(CompactLayoutEngine,key,value,CompactLayoutEngine);return Reflect.set(legacy,key,value,legacy);},
    has(_target,key){return Reflect.has(CompactLayoutEngine,key)||Reflect.has(legacy,key);},
  });
  const CompactGridScale=layoutFacade(LegacyCompactGridScale,'scale');
  const CompactThumbnailRatio=layoutFacade(LegacyCompactThumbnailRatio,'ratio');

  const CreatorSessionCache = {
    capacity:5,
    sessions:new Map(),
    activeKey:'',
    create(context={}) {
      return {
        creatorKey:context.creatorKey||'',context:{...context},creatorMeta:null,totalPosts:0,totalPages:0,catalogue:new Map(),catalogueMeta:null,statuses:new Map(),
        favoriteSnapshotMeta:null,favoriteSnapshotMembership:new Set(),filterState:null,query:'',sortMode:'published',sortDirection:'default',
        activePresetId:'',globalStatusRevision:0,statusRevision:0,dirtyStatusKeys:new Set(),filteredPage:1,filteredAnchorId:'',
        filteredFirstResultIndex:0,layout:null,renderState:null,scrollY:0,lastUsed:Date.now(),
      };
    },
    get(key,{touch=true}={}){const session=CreatorSessionCache.sessions.get(key)||null;if(session&&touch){session.lastUsed=Date.now();CreatorSessionCache.sessions.delete(key);CreatorSessionCache.sessions.set(key,session);}return session;},
    put(session){if(!session?.creatorKey)return null;session.lastUsed=Date.now();CreatorSessionCache.sessions.delete(session.creatorKey);CreatorSessionCache.sessions.set(session.creatorKey,session);CreatorSessionCache.evict();return session;},
    activate(key){CreatorSessionCache.activeKey=key;return CreatorSessionCache.get(key);},
    captureFromApp() {
      if(!App.context?.creatorKey)return null;
      const session=CreatorSessionCache.get(App.context.creatorKey)||CreatorSessionCache.create(App.context);
      Object.assign(session,{context:{...App.context},creatorMeta:App.creatorMeta,totalPosts:App.totalPosts,totalPages:App.totalPages,catalogue:App.catalog,catalogueMeta:App.catalogueState,statuses:App.statuses,
        favoriteSnapshotMeta:App.favoriteSnapshotMeta,favoriteSnapshotMembership:App.favoriteSnapshotMembership,
        filterState:Util.clone(App.filterState),query:App.query,sortMode:App.sortMode,sortDirection:App.sortDirection,activePresetId:App.activePresetId,
        filteredPage:App.filteredPage,filteredAnchorId:App.filteredAnchorId,filteredFirstResultIndex:App.filteredFirstResultIndex,
        layout:CompactGridScale.lastApplied?.layout||null,scrollY:globalThis.scrollY||0});
      return CreatorSessionCache.put(session);
    },
    restoreToApp(session) {
      if(!session)return false;App.context={...session.context};App.creatorMeta=session.creatorMeta;App.totalPosts=session.totalPosts;App.totalPages=session.totalPages;App.catalog=session.catalogue;App.catalogueState=session.catalogueMeta||CatalogueModel.empty();
      App.statuses=session.statuses;App.favoriteSnapshotMeta=session.favoriteSnapshotMeta;App.favoriteSnapshotMembership=session.favoriteSnapshotMembership;
      if(session.filterState)App.filterState=Util.clone(session.filterState);App.query=session.query;App.sortMode=session.sortMode;App.sortDirection=session.sortDirection;
      App.activePresetId=session.activePresetId;App.filteredPage=session.filteredPage;App.filteredAnchorId=session.filteredAnchorId;App.filteredFirstResultIndex=session.filteredFirstResultIndex;
      CreatorSessionCache.activate(session.creatorKey);return true;
    },
    markStatus(status) {
      const session=CreatorSessionCache.get(status?.creatorKey,{touch:false});if(!session)return;
      session.statuses.set(String(status.postId),PostStatus.normalize(status));session.statusRevision+=1;session.globalStatusRevision=PostStatusStateCoordinator.revision;
      session.dirtyStatusKeys.add(status.key);
    },
    evict(){while(CreatorSessionCache.sessions.size>CreatorSessionCache.capacity){const victim=[...CreatorSessionCache.sessions.entries()].find(([key])=>key!==CreatorSessionCache.activeKey);if(!victim)break;CreatorSessionCache.sessions.delete(victim[0]);}},
    clear(){CreatorSessionCache.sessions.clear();CreatorSessionCache.activeKey='';},
  };

  const PostStatusStateCoordinator = {
    unsubscribe:null,revision:0,currentPost:null,
    start() {
      if(PostStatusStateCoordinator.unsubscribe)return;
      PostStatusStateCoordinator.unsubscribe=PostStatusEvents.subscribe((event)=>PostStatusStateCoordinator.handle(event));
    },
    handle(event={}) {
      PostStatusStateCoordinator.revision+=1;
      const statuses=(event.statuses||[event.status]).filter(Boolean).map(PostStatus.normalize);
      statuses.forEach((status)=>{CreatorSessionCache.markStatus(status);if(App.context?.creatorKey===status.creatorKey)App.statuses.set(String(status.postId),status);if(PostPageController.context?.postKey===status.key){PostPageController.status=status;PostPageController.render();}});
      new Set(statuses.map((status)=>status.creatorKey).filter(Boolean)).forEach((creatorKey)=>CreatorCatalogueSummary.scheduleStatusRefresh(creatorKey));
      if(event.type==='favorites-sync'&&App.context&&!event.summary?.manual)App.loadStatuses(App.context.creatorKey).then(()=>App.render());
      else if(statuses.some((status)=>status.creatorKey===App.context?.creatorKey)){App.restoreAnchorPage();App.render();}
    },
    shutdown(){PostStatusStateCoordinator.unsubscribe?.();PostStatusStateCoordinator.unsubscribe=null;PostStatusStateCoordinator.currentPost=null;},
  };

  const CardDimTreatment = {
    strengths:Object.freeze({
      low:{saturate:.72,brightness:.86,opacity:.84},
      medium:{saturate:.52,brightness:.74,opacity:.74},
      high:{saturate:.25,brightness:.56,opacity:.58},
    }),
    normalizeStrength(value){return value in CardDimTreatment.strengths?value:'medium';},
    apply({card,active,enabled,strength='medium',scope='card'}={}) {
      if(!card)return false;const normalized=CardDimTreatment.normalizeStrength(strength);const prefix=scope==='creator'?'pmf-hidden-creator':'pmf-seen';
      card.classList.remove(`${prefix}-dimmed`,`${prefix}-dim-low`,`${prefix}-dim-medium`,`${prefix}-dim-high`);
      if(enabled&&active)card.classList.add(`${prefix}-dimmed`,`${prefix}-dim-${normalized}`);
      return Boolean(enabled&&active);
    },
    cleanup(card,scope='card'){const prefix=scope==='creator'?'pmf-hidden-creator':'pmf-seen';card?.classList?.remove(`${prefix}-dimmed`,`${prefix}-dim-low`,`${prefix}-dim-medium`,`${prefix}-dim-high`);},
  };

  const SeenCardTreatment = {
    normalizeStrength(value){return ['low','medium','high'].includes(value)?value:'medium';},
    currentSettings(){
      const dialog=App.ui?.settings;
      return {
        enabled:dialog?.querySelector?.('[name="seenCardTreatmentEnabled"]')?.checked ?? Settings.value.seenCardTreatment.enabled,
        strength:SeenCardTreatment.normalizeStrength(dialog?.querySelector?.('[name="seenCardTreatmentStrength"]')?.value || Settings.value.seenCardTreatment.strength),
      };
    },
    apply(card,post,status=App.statuses?.get?.(String(post?.id))||null) {
      if(!card)return;
      if(!post)return;
      const settings=SeenCardTreatment.currentSettings();
      const normalized=PostStatus.normalize(status||App.statusFor(post));
      const active=CardDimTreatment.apply({card,active:Boolean(normalized.seen),enabled:settings.enabled,strength:settings.strength,scope:'post'});
      if(Logger.debug)Logger.info({operation:'seen-card-treatment',creatorKey:App.context?.creatorKey,enabled:settings.enabled,strength:settings.strength,visibleSeenCards:active?1:0,patchedCards:1});
    },
    cleanup(card){CardDimTreatment.cleanup(card,'post');},
  };

  const HiddenCreatorTreatment = {
    apply(card,state,settings=Settings.value.hiddenCreatorTreatment){return CardDimTreatment.apply({card,active:Boolean(state?.hidden),enabled:Boolean(settings?.enabled),strength:settings?.strength,scope:'creator'});},
    cleanup(card){CardDimTreatment.cleanup(card,'creator');},
  };

  const PostStatusBadgeRenderer = {
    pending:new WeakSet(),
    apply(card,post,status=App.statuses?.get?.(String(post?.id))||null) {
      card.querySelector?.('.pmf-card-statuses')?.remove();if(!post)return;
      if(!card.isConnected&&!PostStatusBadgeRenderer.pending.has(card)){PostStatusBadgeRenderer.pending.add(card);requestAnimationFrame(()=>{PostStatusBadgeRenderer.pending.delete(card);if(card.isConnected)PostStatusBadgeRenderer.apply(card,post,status);});}
      const settings={...Settings.value.postStatusBadges,enabled:App.ui?.settings?.querySelector?.('[name="postStatusBadgesEnabled"]')?.checked??Settings.value.postStatusBadges.enabled,types:App.ui?.settingsStatusBadgeTypes||Settings.value.postStatusBadges.types};if(!settings?.enabled)return;const resolved=App.statusFor(post);const normalized=PostStatus.normalize(status||resolved);const active=[resolved.resolvedFavorite===true&&settings.types.favorited?'favorite':'',normalized.liked&&settings.types.liked?'liked':'',normalized.seen&&settings.types.seen?'seen':''].filter(Boolean);if(!active.length)return;
      const header=card.querySelector?.('.post-card__header');const height=Math.max(0,Math.ceil(header?.getBoundingClientRect?.().height||header?.offsetHeight||0));card.style?.setProperty?.('--pmf-status-header-height',`${height}px`);
      const container=document.createElement('span');container.className=`pmf-card-statuses pmf-card-statuses-${App.ui?.previewStatusBadgeSize||Settings.value.postStatusBadgeSize}`;container.dataset.pmfOwned='true';container.dataset.pmfInstance=INSTANCE_ID;container.setAttribute('aria-label',active.map((field)=>field==='favorite'?'Favorited':PostStatus.label(field)).join(', '));
      active.forEach((field)=>{const badge=document.createElement('span');badge.className=`pmf-card-status pmf-card-status-${field}`;badge.title=field==='favorite'?'Favorited':PostStatus.label(field);badge.innerHTML=PostStatus.icon(field);container.append(badge);});
      card.append(container);
    },
    cleanup(card){card.querySelector?.('.pmf-card-statuses')?.remove();SeenCardTreatment.cleanup(card);},
  };
  const StatusBadgeRenderer = PostStatusBadgeRenderer;

  const CardRenderer = {
    cropVerifyGeneration:0,
    lastCropVerified:null,
    lastCropLogKey:'',
    thumbnailLoadListeners:new WeakSet(),
    cropGeometryProperties:[
      'object-fit','object-position','transform','transform-origin','translate','scale','rotate',
      'top','right','bottom','left','inset','width','height','min-width','min-height','max-width','max-height','margin','padding',
    ],
    clearCropGeometry(node) {
      if(!node?.style)return;
      CardRenderer.cropGeometryProperties.forEach((property)=>node.style.removeProperty?.(property));
    },
    setImportantStyles(node,properties) {
      if(!node?.style)return;
      Object.entries(properties).forEach(([property,value])=>node.style.setProperty(property,value,'important'));
    },
    normalizeThumbnailGeometry(card,{bindLoad=true}={}) {
      if(!card?.classList?.contains?.('pmf-filter-card'))return null;
      const link=card.querySelector?.('a.image-link, .image-link');const container=card.querySelector?.('.post-card__image-container');const image=card.querySelector?.('.post-card__image');
      if(link){
        CardRenderer.clearCropGeometry(link);
        CardRenderer.setImportantStyles(link,{position:'absolute',inset:'0',display:'block',width:'100%',height:'100%','min-width':'0','min-height':'0','max-width':'none','max-height':'none','object-fit':'fill','object-position':'50% 50%',transform:'none','transform-origin':'50% 50%',translate:'none',scale:'none',rotate:'none',margin:'0',padding:'0',overflow:'hidden'});
      }
      if(container){
        CardRenderer.clearCropGeometry(container);
        CardRenderer.setImportantStyles(container,{position:'absolute',inset:'0',display:'block',width:'100%',height:'100%','min-width':'0','min-height':'0','max-width':'none','max-height':'none',transform:'none','transform-origin':'50% 50%',translate:'none',scale:'none',rotate:'none',margin:'0',padding:'0',overflow:'hidden'});
      }
      if(image){
        CardRenderer.clearCropGeometry(image);
        CardRenderer.setImportantStyles(image,{position:'absolute',inset:'0',top:'0',left:'0',display:'block',width:'100%',height:'100%','min-width':'100%','min-height':'100%','max-width':'none','max-height':'none','object-fit':'cover','object-position':'50% 50%',transform:'none','transform-origin':'50% 50%',translate:'none',scale:'none',rotate:'none',margin:'0',padding:'0'});
        if(bindLoad&&!image.complete&&!CardRenderer.thumbnailLoadListeners.has(image)){
          CardRenderer.thumbnailLoadListeners.add(image);
          const onLoad=()=>{if(image.closest?.('.pmf-filter-grid'))CardRenderer.normalizeThumbnailGeometry(image.closest('.post-card'),{bindLoad:false});};
          const options={once:true};if(App.pageController?.signal)options.signal=App.pageController.signal;
          image.addEventListener?.('load',onLoad,options);
        }
      }
      return {link,container,image};
    },
    normalizeGridThumbnails(grid=App.ui?.grid,{reason='render',verify=true}={}) {
      if(!grid)return [];
      const cards=[...grid.querySelectorAll?.(':scope > .post-card')||[]];
      const normalized=cards.map((card)=>CardRenderer.normalizeThumbnailGeometry(card)).filter(Boolean);
      if(verify&&normalized.some((item)=>item.image))CardRenderer.scheduleCropVerification({reason,sessionToken:App.sessionToken,creatorKey:App.context?.creatorKey,corrected:false});
      return normalized;
    },
    scheduleCropVerification(event) {
      const token=++CardRenderer.cropVerifyGeneration;const frame=globalThis.requestAnimationFrame||((callback)=>setTimeout(callback,0));
      frame(()=>{if(token!==CardRenderer.cropVerifyGeneration)return;CardRenderer.verifyThumbnailCrop(event);});
    },
    verifyThumbnailCrop(event) {
      if(!event||event.sessionToken!==App.sessionToken||event.creatorKey!==App.context?.creatorKey)return null;
      const grid=App.ui?.grid;if(!grid||grid.hidden||typeof getComputedStyle!=='function')return null;
      const image=grid.querySelector?.(':scope > .post-card .post-card__image');if(!image)return null;const card=image.closest?.('.post-card');const container=image.closest?.('.post-card__image-container');const style=getComputedStyle(image);
      const imageRect=image.getBoundingClientRect?.()||{};const containerRect=container?.getBoundingClientRect?.()||{};const normalizedPosition=String(style.objectPosition||'').trim().replace(/\s+/g,' ');
      const healthy=style.objectFit==='cover'&&normalizedPosition==='50% 50%'&&(style.transform==='none'||!style.transform);
      const result={operation:'compact-thumbnail-crop',ratioSetting:CompactThumbnailRatio.currentAspectRatio(),cardScale:CompactGridScale.currentScale(),objectFit:style.objectFit,objectPosition:style.objectPosition,transform:style.transform,transformOrigin:style.transformOrigin,imageWidth:Number(imageRect.width)||0,imageHeight:Number(imageRect.height)||0,containerWidth:Number(containerRect.width)||0,containerHeight:Number(containerRect.height)||0,naturalWidth:Number(image.naturalWidth)||0,naturalHeight:Number(image.naturalHeight)||0,centered:healthy,reapplied:Boolean(event.corrected),sourcePreviewLimitation:healthy?'If the subject remains biased, the Pawchive preview may already be cropped.':''};
      if(!healthy&&!event.corrected){
        if(Logger.debug)Logger.warn('PMF thumbnail crop was overridden; reapplying centered crop.');
        CardRenderer.normalizeThumbnailGeometry(card,{bindLoad:false});CardRenderer.scheduleCropVerification({...event,corrected:true});return {...result,reapplicationScheduled:true};
      }
      if(!healthy&&event.corrected&&Logger.debug)Logger.warn('PMF thumbnail crop remains overridden after one centered-crop reapplication.');
      const loggable=['render','creator-rebind','ratio-preview','scale-preview','settings-preview','settings-save','resize'].includes(event.reason);const logKey=`${event.reason}|${event.creatorKey}|${App.filteredPage}|${result.cardScale}|${result.ratioSetting}|${result.objectFit}|${result.objectPosition}|${result.transform}|${result.reapplied}`;
      if(Logger.debug&&loggable&&logKey!==CardRenderer.lastCropLogKey){Logger.info(result);CardRenderer.lastCropLogKey=logKey;}
      CardRenderer.lastCropVerified=result;return result;
    },
    clearCropDebug() {
      CardRenderer.cropVerifyGeneration+=1;CardRenderer.lastCropVerified=null;CardRenderer.lastCropLogKey='';App.ui?.grid?.querySelectorAll?.('[data-pmf-crop-debug]')?.forEach?.((node)=>node.removeAttribute('data-pmf-crop-debug'));
    },
    cleanClone(node) {
      const clone = node.cloneNode(true);
      clone.querySelectorAll('[id]').forEach((item) => item.removeAttribute('id'));
      clone.querySelectorAll('[aria-describedby], [aria-labelledby]').forEach((item) => {
        item.removeAttribute('aria-describedby'); item.removeAttribute('aria-labelledby');
      });
      clone.classList.remove('pmf-dimmed', 'pmf-hidden-card');
      return clone;
    },
    clone(post) {
      const card = CardRenderer.cleanClone(App.dom.template);
      card.dataset.id = post.id;
      card.dataset.service = post.service;
      card.dataset.user = post.creatorId;
      card.classList.add('pmf-filter-card');
      const link = card.querySelector('a.image-link, a[href*="/post/"]');
      if (link) {
        link.href = post.postUrl;
        link.removeAttribute('data-turbo-frame');
      }
      const header = card.querySelector('.post-card__header');
      if (header) header.textContent = post.title;
      let image = card.querySelector('.post-card__image');
      const imageContainer = card.querySelector('.post-card__image-container');
      if (post.thumbnailUrl) {
        if (!image && imageContainer) {
          image = document.createElement('img'); image.className = 'post-card__image'; imageContainer.append(image);
        }
        if (image) { image.src = post.thumbnailUrl; image.alt = ''; image.loading = 'lazy'; }
      } else if (image) {
        image.remove();
        imageContainer?.classList.add('pmf-fallback-thumb');
      }
      const time = card.querySelector('time');
      if (time) { time.dateTime = post.publishedAt; time.textContent = Util.formatDate(post.publishedAt); }
      const footer = card.querySelector('.post-card__footer');
      if (footer) {
        const textNodes = [...footer.querySelectorAll('div')].filter((item) => /attachments?/i.test(item.textContent || '') && !item.querySelector('div'));
        const label = post.attachmentCount === 0 ? 'No attachments' : `${post.attachmentCount} attachment${post.attachmentCount === 1 ? '' : 's'}`;
        if (textNodes[0]) textNodes[0].textContent = label;
      }
      CardRenderer.normalizeThumbnailGeometry(card);
      BadgeRenderer.apply(card, post);
      StatusBadgeRenderer.apply(card,post);
      SeenCardTreatment.apply(card,post);
      return card;
    },
    fallback(post) {
      const card = document.createElement('article');
      card.className = 'post-card post-card--preview pmf-filter-card pmf-fallback-card';
      card.dataset.id = post.id;
      card.innerHTML = `<a class="image-link" href="${Util.escapeHtml(post.postUrl)}"><header class="post-card__header">${Util.escapeHtml(post.title)}</header><div class="post-card__image-container ${post.thumbnailUrl ? '' : 'pmf-fallback-thumb'}">${post.thumbnailUrl ? `<img class="post-card__image" loading="lazy" alt="" src="${Util.escapeHtml(post.thumbnailUrl)}">` : ''}</div><footer class="post-card__footer"><div><time datetime="${Util.escapeHtml(post.publishedAt)}">${Util.escapeHtml(Util.formatDate(post.publishedAt))}</time><div>${post.attachmentCount ? `${post.attachmentCount} attachment${post.attachmentCount === 1 ? '' : 's'}` : 'No attachments'}</div></div></footer></a>`;
      CardRenderer.normalizeThumbnailGeometry(card);
      BadgeRenderer.apply(card, post);
      StatusBadgeRenderer.apply(card,post);
      SeenCardTreatment.apply(card,post);
      return card;
    },
  };

  const Paginator = {
    windowSize(width=Number(App.ui?.paginator?.clientWidth)||Number(App.ui?.paginator?.getBoundingClientRect?.().width)||800){return width>0&&width<430?3:5;},
    pageButtons(current,total,size=5) {
      const count=Math.min(Math.max(1,Number(size)||5),Math.max(1,total));const page=Util.clamp(Number(current)||1,1,Math.max(1,total));
      let start=page-Math.floor(count/2);start=Math.max(1,Math.min(start,total-count+1));
      return Array.from({length:count},(_,index)=>start+index);
    },
    targetForAction(action,page,current,totalPages) {
      if(action==='first')return 1;if(action==='previous')return current-1;if(action==='next')return current+1;if(action==='last')return totalPages;
      return Number(page)||current;
    },
    goToPage(page,{source='page',totalPages=Math.max(1,Math.ceil(App.matchingPosts().length/App.filteredPageSize()))}={}){
      const previousPage=App.filteredPage;
      const nextPage=Util.clamp(Util.parseInteger(page,previousPage),1,totalPages);
      if(nextPage===previousPage)return false;
      const pageSize=App.filteredPageSize();const matches=App.matchingPosts();App.filteredPage=nextPage;App.filteredFirstResultIndex=Math.max(0,(nextPage-1)*pageSize);App.filteredAnchorId=matches[App.filteredFirstResultIndex]?.id||'';App.persistUIState();App.render();
      Logger.info({operation:'filtered-page-change',source,previousPage,nextPage,totalPages});
      return true;
    },
    activate(action,page) {
      const totalPages=Math.max(1,Math.ceil(App.matchingPosts().length/App.filteredPageSize()));
      return Paginator.goToPage(Paginator.targetForAction(action,page,App.filteredPage,totalPages),{source:action,totalPages});
    },
    render(count) {
      const pageSize=App.filteredPageSize();const totalPages = Math.max(1, Math.ceil(count / pageSize));
      const rememberedPage = App.filteredPage;
      App.filteredPage = Util.clamp(App.filteredPage, 1, totalPages);
      App.filteredFirstResultIndex=Math.max(0,(App.filteredPage-1)*pageSize);
      if (rememberedPage !== App.filteredPage) App.persistUIState();
      const start = count ? (App.filteredPage - 1) * pageSize + 1 : 0;
      const end = Math.min(count, App.filteredPage * pageSize);
      App.ui.filteredCount.textContent = count ? `Showing ${start}–${end} of ${count}` : 'Showing 0 of 0';
      const controls = App.ui.filteredControls;
      controls.replaceChildren();
      const add = (label, action, page, disabled, aria) => {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = label; button.disabled = disabled;
        button.setAttribute('aria-label', aria);button.dataset.pmfPageAction=action;
        if(action==='page')button.dataset.pmfPage=String(page);
        controls.append(button);
      };
      add('«','first',1,App.filteredPage===1,'First filtered page');
      add('‹','previous',0,App.filteredPage===1,'Previous filtered page');
      for (const page of Paginator.pageButtons(App.filteredPage,totalPages,Paginator.windowSize())) {
        add(String(page),'page',page,page===App.filteredPage,`Filtered page ${page}`);
        controls.lastElementChild.classList.toggle('pmf-current-page', page === App.filteredPage);
      }
      add('›','next',0,App.filteredPage===totalPages,'Next filtered page');
      add('»','last',totalPages,App.filteredPage===totalPages,'Last filtered page');
    },
  };

  const OperationIssues = {
    errors:[],
    clear(){OperationIssues.errors=[];},
    add(message){const value=String(message||'').trim();if(value)OperationIssues.errors.push(value);},
  };

  const MetadataDetailPool = {
    async fetch(items,{context,signal,concurrency=Config.catalogueDetailConcurrency,onWait=()=>{},operation='metadata-retry',jobId=''}={}) {
      const results=new Map();const unresolved=new Set();const errors=[];let cursor=0;
      const workers=Array.from({length:Math.min(Math.max(1,concurrency),items.length)},async()=>{
        while(cursor<items.length&&!signal?.aborted){
          const raw=items[cursor++];const id=String(raw?.id||raw?.post_id||'');if(!id)continue;
          try{
            const detail=await PawchiveAPI.fetchPostDetail(context,id,signal,onWait,{operation,jobId});
            if(detail)results.set(id,{...raw,...detail,__pmfDetailFields:Object.keys(detail)});
            else unresolved.add(id);
          }catch(error){
            if(error.name==='AbortError')throw error;
            unresolved.add(id);errors.push(`Post ${id}: ${error.message}`);
          }
        }
      });
      await Promise.all(workers);
      return {results,unresolved,errors};
    },
  };

  const Catalogue = {
    state() { return App.catalogueState.catalogue; },
    storedCount() { return App.cataloguePostCount(); },
    logCoverage(reason, catalogue = Catalogue.state()) {
      const evaluation = CatalogueModel.evaluateCoverage(catalogue);
      Logger.info(`Catalogue coverage: ${reason}`, {
        totalExpectedPosts: evaluation.totalExpectedPosts,
        storedPostCount: evaluation.storedPostCount,
        requiredOffsets: evaluation.requiredOffsets,
        coveredOffsets: evaluation.coveredOffsets,
        failedOffsets: evaluation.failedOffsets,
        missingOffsets: evaluation.missingOffsets,
        incompleteMetadataCount: evaluation.incompleteMetadataCount,
        malformedListRecordCount: evaluation.malformedListRecordCount,
        coverageComplete: evaluation.coverageComplete,
        nextStatus: evaluation.nextStatus,
      });
      return evaluation;
    },
    metaPatch(catalogue = Catalogue.state(), model = App.catalogueState) {
      const normalized = CatalogueModel.normalize({ ...model, catalogue }, { restoreTransient: false });
      const total = normalized.catalogue.totalExpectedPosts || App.totalPosts || 0;
      return {
        catalogue: normalized.catalogue,
        totalPosts: total,
        totalPages: Math.ceil(total / Config.pageSize) || 0,
        scanSchemaVersion: Config.schemaVersion,
      };
    },
    async persist(creatorKey = App.context?.creatorKey, model = App.catalogueState) {
      if (!creatorKey) return;
      if(App.context?.creatorKey===creatorKey&&CatalogueModel.evaluateCoverage(model.catalogue).coverageComplete)model.catalogue.creatorCardSummary=await CreatorCatalogueSummary.computeAuthoritative(App.context,[...App.catalog.values()],model.catalogue);
      const next = await Cache.patchMeta(creatorKey, Catalogue.metaPatch(model.catalogue, model));
      if (App.context?.creatorKey === creatorKey) App.creatorMeta = next;
    },
    reconcileReason(reason, post) {
      if (reason === 'invalid-file-structure') return PawchiveData.normalizeFileValue(post?.invalidMainFileValue ?? post?.mainFile).status === 'invalid';
      if (reason === 'invalid-attachments-structure') {
        const value=post?.invalidAttachmentValue ?? post?.attachments;
        return PawchiveData.normalizeAttachments(value,{provided:value!==undefined}).status === 'invalid';
      }
      if (reason === 'invalid-tags-structure') return PawchiveData.normalizeTags(post?.invalidTagsValue ?? post?.tags, { provided:(post?.invalidTagsValue ?? post?.tags) !== undefined }).status === 'invalid';
      return CatalogueMetadataPolicy.legacyReasonRetryable(reason);
    },
    async reconcileMetadataPolicy() {
      if (!App.context) return false;
      const state = Catalogue.state();
      if (state.metadataPolicyVersion >= 2) return false;
      const oldReasons = state.retryableMetadataReasons || {};
      const retryableMetadataReasons = {};
      const retryableMetadataIds = [];
      const reclassified = [];
      for (const post of App.cataloguePosts()) {
        if (post.completeness === 'unresolved' || post.scanSchemaVersion !== Config.schemaVersion) continue;
        const id = String(post.id);
        const remaining = Util.unique((oldReasons[id] || []).filter((reason) => Catalogue.reconcileReason(reason, post)));
        if (remaining.length) {
          retryableMetadataIds.push(id);
          retryableMetadataReasons[id] = remaining;
        }
        const next = PostNormalizer.normalize(PostNormalizer.rawFromStored(post), App.context, post.thumbnailUrl);
        if (!next) continue;
        next.completeness = remaining.length ? 'partial' : 'complete';
        reclassified.push(next);
      }
      if (reclassified.length) {
        await Cache.putPosts(reclassified);
        reclassified.forEach((post) => App.catalog.set(String(post.id), Cache.mergePost(App.catalog.get(String(post.id)), post)));
      }
      for (const manifest of Object.values(state.pageCoverage || {})) {
        if (!Array.isArray(manifest.postIds) || !manifest.postIds.length) continue;
        const posts = manifest.postIds.map((id) => App.catalog.get(String(id))).filter(Boolean);
        if (!posts.length) continue;
        const fileAvailability = CatalogueMetadataPolicy.summarize(posts.map((post) => ({
          file:PawchiveData.normalizeFileValue(post.invalidMainFileValue ?? post.mainFile).status,
        }))).file;
        const tagDataCount = posts.filter((post) => Array.isArray(post.tags) && post.tags.length).length;
        const prior = manifest.fieldAvailability || CatalogueMetadataPolicy.emptyAvailability();
        manifest.fieldAvailability = {
          ...prior,
          file:fileAvailability,
          tags:{
            presentCount:tagDataCount,
            absentCount:Math.max(0, posts.length - tagDataCount),
            invalidCount:0,
            status:tagDataCount === 0 ? 'not-provided' : tagDataCount === posts.length ? 'available' : 'mixed',
          },
        };
      }
      state.retryableMetadataIds = retryableMetadataIds;
      state.retryableMetadataReasons = retryableMetadataReasons;
      state.fieldAvailability = CatalogueMetadataPolicy.mergeAvailability(state.pageCoverage);
      state.metadataPolicyVersion = 2;
      state.storedPostCount = Catalogue.storedCount();
      await Catalogue.persist(App.context.creatorKey);
      UI.refreshDetails?.();
      return true;
    },
    async reconcileRestoredState() {
      if (!App.context) return;
      await Catalogue.reconcileMetadataPolicy();
      const state = Catalogue.state();
      const usableIds = new Set(App.cataloguePosts().filter((post) => post.completeness !== 'unresolved').map((post) => String(post.id)));
      state.retryableMetadataIds = Util.unique((state.retryableMetadataIds || []).map(String)).filter((id) => usableIds.has(id));
      state.storedPostCount = usableIds.size;
      const normalized = CatalogueModel.normalize(App.catalogueState, { restoreTransient: false });
      const restored = normalized.catalogue;
      Object.keys(state).forEach((key) => delete state[key]); Object.assign(state, restored);
      const evaluation = CatalogueModel.evaluateCoverage(state);
      state.status = evaluation.nextStatus;
      Catalogue.logCoverage('restored state reconciliation', state);
      await Catalogue.persist(App.context.creatorKey);
      return evaluation;
    },
    async requestPersistentStorage(creatorKey=App.context?.creatorKey,model=App.catalogueState) {
      const state = model.catalogue; if (state.persistentStorageRequested) return state.persistentStorageGranted;
      state.persistentStorageRequested = true; await Catalogue.persist(creatorKey,model);
      try {
        const storage = globalThis.navigator?.storage;
        if (!storage?.persisted) { state.persistentStorageGranted = null; return null; }
        const already = await storage.persisted(); state.persistentStorageGranted = already || (storage.persist ? Boolean(await storage.persist()) : false);
      } catch (error) { state.persistentStorageGranted = false; Logger.info('Persistent storage request was unavailable or denied.', error); }
      await Catalogue.persist(creatorKey,model); return state.persistentStorageGranted;
    },
    async clearCurrent() {
      if (!App.context) return;
      const creatorKey = App.context.creatorKey;
      CatalogueJobManager.stop(creatorKey);CatalogueJobManager.removeQueued(creatorKey);
      await Cache.clearCreatorCatalogue(creatorKey);
      App.catalogueState = CatalogueModel.empty();App.creatorMeta=null;App.catalog=new Map();OperationIssues.clear();
      App.addNativeStubs();App.persistUIState();App.render();UI.flash('Full catalogue scan cleared.');
    },
    operation() { const job=App.context&&CatalogueJobManager.activeForCreator(App.context.creatorKey);return job?.kind||''; },
    async retryIncompleteMetadata() { if(!App.context)return;const result=CatalogueJobManager.enqueue(App.context,'metadata-retry',{creatorName:App.context.creatorId});if(!result.accepted)GlobalUI.flash(result.state==='already-queued'?`Already queued · Position ${result.position}`:'A Catalogue operation is already active for this creator.');App.render(); },
    async build() { if(App.context)return CatalogueJobManager.enqueue(App.context,'build',{creatorName:App.context.creatorId}); },
    async update() { if(App.context)return CatalogueJobManager.enqueue(App.context,'update',{creatorName:App.context.creatorId}); },
    async stop() { return App.context?CatalogueJobManager.stop(App.context.creatorKey):false; },
    abortMetadataRetry() { const job=App.context&&CatalogueJobManager.activeForCreator(App.context.creatorKey);if(job?.kind==='metadata-retry')CatalogueJobManager.stop(App.context.creatorKey);else if(App.context)CatalogueJobManager.removeQueued(App.context.creatorKey); },
    async primaryAction() {
      if(!App.context)return;const key=App.context.creatorKey;const active=CatalogueJobManager.activeForCreator(key);if(active){CatalogueJobManager.stop(key);return;}const queued=CatalogueJobManager.queuedForCreator(key);if(queued){CatalogueJobManager.removeQueued(key);GlobalUI.flash('Queued Catalogue operation removed.');App.render();return;}
      const evaluation=CatalogueModel.evaluateCoverage(Catalogue.state());const requestedAction=evaluation.coverageComplete?'update':evaluation.storedPostCount||evaluation.coveredOffsets.length?'resume':'build';CatalogueJobManager.enqueue(App.context,requestedAction,{creatorName:App.context.creatorId});App.render();
    },
  };


  const BaseUI = {
    own(node){node.dataset.pmfOwned='true';node.dataset.pmfInstance=INSTANCE_ID;return node;},
    createOptionSelect(className,label,options,selected){const select=document.createElement('select');select.className=className;select.setAttribute('aria-label',label);options.forEach(([value,text])=>select.add(new Option(text,value,false,value===selected)));return select;},
    filterLabel(){return FilterSummary.label(App.filterState);},
    mount(){
      const existing=document.querySelector(`#pmf-root[data-pmf-instance="${CSS.escape(INSTANCE_ID)}"]`);if(existing?.isConnected)return;
      const root=UI.own(document.createElement('div'));root.id='pmf-root';const toolbar=document.createElement('section');toolbar.id='pmf-toolbar';toolbar.className='pmf-toolbar';toolbar.setAttribute('aria-label','Pawchive Media Filter');
      const controls=document.createElement('div');controls.className='pmf-controls';const filterButton=document.createElement('button');filterButton.type='button';filterButton.className='pmf-filter-button';filterButton.setAttribute('aria-haspopup','dialog');filterButton.setAttribute('aria-expanded','false');
      const sortButton=document.createElement('button');sortButton.type='button';sortButton.className='pmf-sort-button';sortButton.setAttribute('aria-haspopup','menu');sortButton.setAttribute('aria-expanded','false');const scanButton=document.createElement('button');scanButton.type='button';scanButton.className='pmf-scan-button';const settingsButton=document.createElement('button');settingsButton.type='button';settingsButton.className='pmf-icon-button';settingsButton.setAttribute('aria-label','Media Filter settings');settingsButton.setAttribute('aria-haspopup','dialog');settingsButton.innerHTML=Icons.gear;controls.append(filterButton,sortButton,scanButton,settingsButton);
      const status=document.createElement('div');status.className='pmf-status';status.setAttribute('aria-live','polite');const statusLeft=document.createElement('div');statusLeft.className='pmf-status-left';const statusActions=document.createElement('div');statusActions.className='pmf-status-actions';const statusRight=document.createElement('div');statusRight.className='pmf-status-right';status.append(statusLeft,statusActions,statusRight);
      const progress=document.createElement('div');progress.className='pmf-progress';progress.hidden=true;const progressBar=document.createElement('span');progress.append(progressBar);const details=document.createElement('section');details.className='pmf-catalogue-details';details.hidden=true;details.setAttribute('aria-label','Catalogue details');toolbar.append(controls,status,progress,details);root.append(toolbar);App.dom.searchForm.insertAdjacentElement('afterend',root);
      const paginator=UI.own(document.createElement('div'));paginator.className='pmf-filtered-paginator';paginator.hidden=true;const filteredCount=document.createElement('small');filteredCount.className='pmf-filtered-count';
      const statusFilters=document.createElement('div');statusFilters.className='pmf-quick-status-filters';statusFilters.setAttribute('aria-label','Post status filters');
      for(const field of ['favorite','liked','seen']){const button=document.createElement('button');button.type='button';button.dataset.pmfQuickStatus=field;button.setAttribute('aria-pressed','false');button.innerHTML=`<span class="pmf-quick-status-main">${PostStatus.icon(field)}</span><span class="pmf-quick-status-negate">${Icons.x}</span>`;statusFilters.append(button);}
      const filteredControls=document.createElement('div');filteredControls.className='pmf-page-controls';paginator.append(statusFilters,filteredCount,filteredControls);App.dom.grid.insertAdjacentElement('beforebegin',paginator);
      const grid=UI.own(document.createElement('div'));grid.className=`${App.dom.grid.className} pmf-filter-grid`;grid.hidden=true;App.dom.grid.insertAdjacentElement('afterend',grid);
      App.ui={root,toolbar,controls,filterButton,sortButton,scanButton,settingsButton,statusLeft,statusActions,statusRight,progress,progressBar,details,paginator,filteredCount,statusFilters,filteredControls,grid,filterPopover:null,editor:null,settings:null,sortMenu:null};UI.bind();UI.updateFilterButton();UI.updateSortButton();UI.updateQuickStatusFilters();
    },
    updateFilterButton(){if(!App.ui)return;App.ui.filterButton.textContent=UI.filterLabel();App.ui.filterButton.setAttribute('aria-label',`Media filters: ${UI.filterLabel()}`);},
    selectSettingsTab(name){App.ui.settings.querySelectorAll('[data-pmf-settings-tab]').forEach(button=>button.classList.toggle('pmf-active',button.dataset.pmfSettingsTab===name));App.ui.settings.querySelectorAll('[data-pmf-settings-panel]').forEach(panel=>{panel.hidden=panel.dataset.pmfSettingsPanel!==name;});queueMicrotask(()=>App.ui?.settings?.querySelectorAll(`[data-pmf-settings-panel="${name}"] textarea`).forEach(UI.autoSizeTextarea));},
    updateSortButton(){if(!App.ui)return;const label=PostSorter.label(App.sortMode,App.sortDirection);App.ui.sortButton.innerHTML=`<span class="pmf-sort-label">Sort: ${label.title}</span><span class="pmf-sort-direction" aria-hidden="true">${label.arrow}</span>`;App.ui.sortButton.setAttribute('aria-label',`Sort: ${label.title}, ${label.spoken}`);},
    updateQuickStatusFilters(){App.ui?.statusFilters?.querySelectorAll?.('[data-pmf-quick-status]')?.forEach((button)=>{const field=button.dataset.pmfQuickStatus;const mode=PostStatusFilters.value[field]||'off';const noun=field==='favorite'?'favorited':field;const label=mode==='off'?`Do not filter by ${noun} status`:mode==='match'?`Show only ${noun} posts`:`Show only posts not marked ${noun}`;button.classList.toggle('pmf-match',mode==='match');button.classList.toggle('pmf-no-match',mode==='no-match');button.dataset.state=mode;button.setAttribute('aria-pressed',mode==='off'?'false':mode==='match'?'true':'mixed');button.setAttribute('aria-label',label);button.title=label;});},
    setScanning(){if(!App.ui)return;const key=App.context?.creatorKey;const active=key&&CatalogueJobManager.activeForCreator(key);const queued=key&&CatalogueJobManager.queuedForCreator(key);const operation=active?.kind||'';const model=CatalogueModel.button(App.catalogueState,{hasPosts:App.cataloguePostCount()>0,operation});App.ui.scanButton.textContent=queued?`Queued · ${CatalogueJobManager.queuePosition(key)}`:model.label;App.ui.scanButton.title=queued?'Remove this queued Catalogue operation':model.tooltip;App.ui.scanButton.classList.toggle('pmf-stop-button',Boolean(active||queued));App.ui.progress.hidden=!active;if(!active)App.ui.progressBar.style.width='0%';},
    updateProgress({page,totalPages,scanned,failed=false}){if(!App.ui||App.sessionToken!==App.activeToken)return;App.ui.statusLeft.innerHTML=`<strong>${failed?'Page failed; continuing':`Scanning page ${page}${totalPages?` / ${totalPages}`:''}`}</strong><span>${App.matchingPosts().length} matches so far</span>`;App.ui.statusRight.textContent=`Scanned ${scanned}${App.totalPosts?` / ${App.totalPosts}`:''}`;if(totalPages)App.ui.progressBar.style.width=`${Math.min(100,page/totalPages*100)}%`;},
    setWaiting(message,token){if(token===App.sessionToken&&App.context&&CatalogueJobManager.activeForCreator(App.context.creatorKey)&&App.ui)App.ui.statusRight.textContent=message;},
    flash(message){if(!App.ui)return;App.ui.statusLeft.innerHTML=`<strong>${Util.escapeHtml(message)}</strong>`;setTimeout(()=>App.renderStatus(),1800);},
    catalogueDetailsModel(){
      const state=App.catalogueState.catalogue;const evaluation=CatalogueModel.evaluateCoverage(state);const coverageErrors=evaluation.coverageComplete?0:OperationIssues.errors.length;
      const health=CatalogueModel.healthSummary(state,{actualErrorCount:coverageErrors});const retryIds=state.retryableMetadataIds||[];const reasons=state.retryableMetadataReasons||{};
      const posts=App.cataloguePosts();
      const tagDataCount=posts.filter((post)=>Array.isArray(post.tags)&&post.tags.length).length;
      const mainFiles=posts.map((post)=>PawchiveData.normalizeFileValue(post.invalidMainFileValue ?? post.mainFile));
      return {state,evaluation,health,retryIds,reasons,posts,tagDataCount,mainFilePresent:mainFiles.filter((item)=>item.status==='present').length,mainFileInvalid:mainFiles.filter((item)=>item.status==='invalid').length};
    },
    reasonLabel(reason){
      return ({'explicit-partial-record':'The API marked this post as partial.','invalid-file-structure':'The main-file value could not be normalized.','invalid-attachments-structure':'The attachment list had an unsupported structure.','invalid-tags-structure':'The tag value had an unsupported structure.','substring-without-content':'Only a shortened content preview was provided.','attachment-count-mismatch':'The reported file count did not match the supplied file records.','detail-request-failed':'The optional detail request did not complete.'})[reason]||String(reason).replaceAll('-',' ');
    },
    endEvidenceLabel(reason,total){
      return ({'short-page':'Final short page received','empty-page':'Empty page confirmed the end','http-400':'Out-of-range response confirmed the end','legacy-pagination-end':'Pagination end was recorded previously'})[reason]||(total?'Creator total established the final page':'Final page evidence is not yet available');
    },
    availabilityHtml(label,item,total){
      const present=Number(item?.presentCount)||0;const absent=Number(item?.absentCount)||0;const invalid=Number(item?.invalidCount)||0;
      if(total&&present===total&&!absent&&!invalid)return `<p class="pmf-availability-row"><strong>${label}:</strong> <span>Available for all ${total} posts</span></p>`;
      return `<p class="pmf-availability-row"><strong>${label}:</strong> <span>${present} usable${absent?` · ${absent} not supplied`:''}${invalid?` · <em class="pmf-details-warning-text">${invalid} malformed</em>`:''}</span></p>`;
    },
    buildCatalogueDetailsHtml(){
      const {state,evaluation,health,retryIds,reasons,posts,tagDataCount,mainFilePresent,mainFileInvalid}=UI.catalogueDetailsModel();
      const page=(offset)=>offset/Config.pageSize+1;const total=health.postsExpected||posts.length;const required=health.pagesRequired;const verified=health.pagesVerified;
      const summaryTitle=health.coverage==='error'?'Catalogue error':health.coverage==='complete'?'✓ Catalogue complete':'Catalogue incomplete';
      const summaryText=health.coverage==='complete'
        ? `${required===2?'Both':`All ${required}`} creator page${required===1?' was':'s were'} verified and ${health.postsStored} posts are stored locally.`
        : health.coverage==='error'
          ? `${evaluation.failedOffsets.length} creator page${evaluation.failedOffsets.length===1?'':'s'} failed after retries.`
          : `${evaluation.missingOffsets.length} creator page${evaluation.missingOffsets.length===1?' has':'s have'} not been verified.`;
      const warningText=retryIds.length?`${retryIds.length} post${retryIds.length===1?' may':'s may'} benefit from an optional detail retry. This does not affect Catalogue coverage or current filtering.`:health.coverage==='complete'?'No metadata issues were detected.':'';
      const offsets=evaluation.coveredOffsets.length?`${evaluation.coveredOffsets[0]}–${evaluation.coveredOffsets.at(-1)} in steps of ${Config.pageSize}`:'None verified yet';
      const missing=evaluation.missingOffsets.map((offset)=>`Page ${page(offset)}, offset ${offset}`).join('; ');
      const failed=evaluation.failedOffsets.map((offset)=>`Page ${page(offset)}, offset ${offset} — failed after retries`).join('; ');
      const retryList=retryIds.map((id)=>`<li><code>${Util.escapeHtml(id)}</code><span>${(reasons[id]||[]).map(UI.reasonLabel).map(Util.escapeHtml).join(' ')}</span></li>`).join('');
      const availability=state.fieldAvailability||CatalogueMetadataPolicy.emptyAvailability();const tagNoData=Math.max(0,posts.length-tagDataCount);const noMain=Math.max(0,posts.length-mainFilePresent-mainFileInvalid);
      const malformed=(state.malformedListRecords||[]).map((item)=>`<li>Page ${page(item.offset)}, item ${item.index+1}: ${Util.escapeHtml(item.reason)}</li>`).join('');
      const errors=[...evaluation.failedOffsets.map((offset)=>`Page ${page(offset)}, offset ${offset} failed after retries.`),...OperationIssues.errors].map((error)=>`<li>${Util.escapeHtml(error)}</li>`).join('');
      const summarySeverity=health.coverage==='error'?'error':health.coverage==='complete'?'success':'warning';
      const retryJob=App.context&&CatalogueJobManager.jobForCreator(App.context.creatorKey);const retryBusy=retryJob?.kind==='metadata-retry'&&retryJob.status==='running';const retryDisabled=Boolean(retryJob);const retryLabel=`Retry optional details for ${retryIds.length} post${retryIds.length===1?'':'s'}`;
      const retryAction=retryIds.length?`<div class="pmf-details-summary-actions"><button type="button" data-pmf-retry-incomplete title="${retryLabel}" aria-label="${retryLabel}" aria-busy="${retryBusy}" ${retryDisabled?'disabled':''}>${retryBusy?'Retrying…':'Retry incomplete'}</button></div>`:'';
      return `<div class="pmf-details-summary pmf-details-${summarySeverity}" ${summarySeverity==='error'?'role="alert"':'role="status"'}><h3>${summaryTitle}</h3><p>${summaryText}</p>${warningText?`<p>${warningText}</p>`:''}${retryAction}</div>
      <section class="pmf-details-section"><h3>Creator-page coverage</h3><p><strong>${verified} of ${required} pages verified</strong></p><p class="pmf-muted">Offsets ${offsets}</p><p class="pmf-muted">${UI.endEvidenceLabel(state.endReason,total)}</p>${missing?`<p class="pmf-details-warning-text">Unverified: ${Util.escapeHtml(missing)}</p>`:''}${failed?`<p class="pmf-details-error-text">Failed: ${Util.escapeHtml(failed)}</p>`:''}${evaluation.coveredOffsets.length?`<details><summary>Show verified offsets</summary><code>${evaluation.coveredOffsets.join(', ')}</code></details>`:''}</section>
      <section class="pmf-details-section"><h3>Stored posts</h3><p>${health.postsStored}${health.postsExpected?` of ${health.postsExpected} expected`:''} posts are available locally.</p><details><summary>Advanced storage information</summary><p>Record schema: ${Config.schemaVersion}<br>Storage: IndexedDB<br>Ownership: Catalogue</p></details></section>
      <section class="pmf-details-section ${retryIds.length?'pmf-details-warning':''}"><h3>Optional metadata</h3><p>${retryIds.length?`${retryIds.length} post${retryIds.length===1?' has':'s have'} explicit signals that more metadata may be available.`:'No optional detail retries are needed.'}</p>${retryIds.length?'<p class="pmf-muted">This does not affect page coverage or current filtering.</p>':''}${retryIds.length?`<details><summary>Show retryable posts and reasons</summary><ul class="pmf-details-id-list">${retryList}</ul></details>`:''}</section>
      <section class="pmf-details-section pmf-field-availability"><h3>Field availability</h3>${UI.availabilityHtml('Attachments',availability.attachments,total)}${UI.availabilityHtml('Content',availability.content,total)}<p class="pmf-availability-row"><strong>Tags:</strong> <span>${tagDataCount} posts include tag data${tagNoData?` · ${tagNoData} contain no tag data`:''}</span></p><p class="pmf-availability-row"><strong>Main file:</strong> <span>${mainFilePresent} posts have a separate main-file record${noMain?` · ${noMain} do not use one`:''}${mainFileInvalid?` · <em class="pmf-details-warning-text">${mainFileInvalid} malformed</em>`:''}</span></p><small class="pmf-availability-note">Attachments may still exist when no separate main file is used.</small></section>
      <section class="pmf-details-section"><h3>Malformed list records</h3>${health.malformedCount?`<p class="pmf-details-warning-text">${health.malformedCount} malformed creator-list record${health.malformedCount===1?'':'s'}.</p><details><summary>Show records</summary><ul>${malformed}</ul></details>`:'<p>No malformed creator-list records were stored.</p>'}</section>
      ${errors?`<section class="pmf-details-section pmf-details-error"><h3>Errors</h3><ul>${errors}</ul></section>`:''}
      <section class="pmf-details-section"><h3>Actions</h3><p>${evaluation.coverageComplete?'Update checks creator-list pages for new posts.':'Resume scan requests only missing or failed creator-list pages.'}</p><p>${retryIds.length?'Optional metadata can be retried using the button above. Retry incomplete requests only the listed individual post details.':'No optional retry action is currently needed.'}</p></section>`;
    },
    buildCatalogueDetailsText(){
      const {health,retryIds}=UI.catalogueDetailsModel();
      return `${health.coverage==='complete'?'Catalogue complete':health.coverage==='error'?'Catalogue error':'Catalogue incomplete'}\n${health.pagesVerified} of ${health.pagesRequired} pages verified\n${health.postsStored} of ${health.postsExpected||health.postsStored} posts stored\n${retryIds.length} optional retries`;
    },
    refreshDetails(){
      if(!App.ui?.details)return;const details=App.ui.details;
      details.className='pmf-catalogue-details';if(details.hidden)return;
      const priorTop=Number(details.scrollTop)||0;const priorHeight=Number(details.scrollHeight)||0;const clientHeight=Number(details.clientHeight)||0;const nearBottom=Boolean(details.innerHTML)&&priorHeight-clientHeight-priorTop<24;
      details.innerHTML=UI.buildCatalogueDetailsHtml();
      const restore=()=>{const max=Math.max(0,(Number(details.scrollHeight)||0)-(Number(details.clientHeight)||0));details.scrollTop=nearBottom?max:Math.min(priorTop,max);};
      (globalThis.requestAnimationFrame||queueMicrotask)(restore);
    },
    renderErrors(){
      if(!App.ui)return;
      App.ui.statusActions.replaceChildren();
      const catalogueState=App.catalogueState.catalogue;
      const evaluation=CatalogueModel.evaluateCoverage(catalogueState);
      const hasCatalogueDetails=App.cataloguePostCount()>0||catalogueState.status!=='none'||Object.keys(catalogueState.pageCoverage||{}).length>0;
      if(OperationIssues.errors.length||hasCatalogueDetails){
        const view=document.createElement('button');view.type='button';view.textContent='Details';view.setAttribute('aria-expanded',String(!App.ui.details.hidden));
        view.addEventListener('click',()=>{
          const opening=App.ui.details.hidden;App.ui.details.hidden=!opening;if(opening)App.ui.details.scrollTop=0;
          view.setAttribute('aria-expanded',String(!App.ui.details.hidden));
          UI.refreshDetails();
        });
        App.ui.statusActions.append(view);
      }
      UI.refreshDetails();
    },
  };

  const UI = {
    ...BaseUI,
    bind() {
      const signal = App.pageController.signal;
      App.ui.filterButton.addEventListener('click', () => UI.toggleFilterPopover(), { signal });
      App.ui.sortButton.addEventListener('click', () => UI.toggleSortMenu(), { signal });
      App.ui.sortButton.addEventListener('keydown',(event)=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();UI.toggleSortMenu(true,event.key==='ArrowUp'?'last':'first');}}, {signal});
      App.ui.scanButton.addEventListener('click', () => Catalogue.primaryAction(), { signal });
      App.ui.settingsButton.addEventListener('click', () => UI.openSettings(), { signal });
      App.ui.details.addEventListener('click',(event)=>{const retry=event.target.closest('[data-pmf-retry-incomplete]');if(!retry||retry.disabled)return;Catalogue.retryIncompleteMetadata();},{signal});
      App.ui.filteredControls.addEventListener('click', (event) => {
        const button=event.target.closest('button[data-pmf-page-action]');if(!button||button.disabled)return;
        Paginator.activate(button.dataset.pmfPageAction,button.dataset.pmfPage);
      }, { signal });
      App.ui.statusFilters.addEventListener('click',(event)=>{
        const button=event.target.closest('[data-pmf-quick-status]');if(!button)return;const field=button.dataset.pmfQuickStatus;
        PostStatusFilters.cycle(field);App.filteredPage=1;App.filteredFirstResultIndex=0;App.filteredAnchorId='';App.render();UI.updateQuickStatusFilters();
      },{signal});
      App.ui.grid.addEventListener('click',(event)=>{const card=event.target.closest?.('article.post-card[data-id]');if(!card)return;App.filteredAnchorId=String(card.dataset.id||'');App.persistUIState();},{capture:true,signal});
    },
    toggleSortMenu(force,initialFocus='') {
      if(!App.ui)return;
      const open=typeof force==='boolean'?force:!App.ui.sortMenu;
      if(!open){if(App.ui.sortOverlayId)OverlayManager.close(App.ui.sortOverlayId);return;}
      UI.toggleSortMenu(false);
      const menu=document.createElement('div');menu.className='pmf-floating-menu pmf-sort-menu pmf-surface';menu.setAttribute('role','menu');
      [['published','Publish date'],['title','Post title']].forEach(([mode,label])=>{
        const button=document.createElement('button');button.type='button';button.dataset.pmfSortMode=mode;button.setAttribute('role','menuitemradio');button.setAttribute('aria-checked',String(App.sortMode===mode));button.textContent=label;menu.append(button);
      });
      const choose=(mode)=>{UI.toggleSortMenu(false);App.setSort(mode);};
      menu.addEventListener('click',(event)=>{const button=event.target.closest('[data-pmf-sort-mode]');if(button)choose(button.dataset.pmfSortMode);});
      menu.addEventListener('keydown',(event)=>{const buttons=[...menu.querySelectorAll('button')];const index=buttons.indexOf(document.activeElement);if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}else if((event.key==='Enter'||event.key===' ')&&index>=0){event.preventDefault();choose(buttons[index].dataset.pmfSortMode);}});
      App.ui.root.append(menu);const rect=App.ui.sortButton.getBoundingClientRect();menu.style.left=`${rect.left}px`;menu.style.top=`${rect.bottom+4}px`;menu.style.width=`${rect.width}px`;App.ui.sortMenu=menu;App.ui.sortButton.setAttribute('aria-expanded','true');
      App.ui.sortOverlayId=OverlayManager.open({node:menu,opener:App.ui.sortButton,onClose:()=>{if(!App.ui)return;App.ui.sortMenu=null;App.ui.sortOverlayId=null;App.ui.sortButton?.setAttribute('aria-expanded','false');}});
      if(initialFocus){const buttons=[...menu.querySelectorAll('button')];(initialFocus==='last'?buttons.at(-1):buttons[0])?.focus();}
    },
    filterChanged({ closePicker = false } = {}) {
      App.filteredPage = 1;App.filteredFirstResultIndex=0;App.filteredAnchorId=''; App.persistUIState(); App.savePresetDebounced(); UI.updateFilterButton();UI.updateQuickStatusFilters(); App.render();
      if (closePicker) UI.toggleFilterPopover(false);
    },
    refreshFilterPopover() { const popover=App.ui?.filterPopover;if(!popover)return;const preset=Presets.get(App.activePresetId)||Presets.default();const label=popover.querySelector('[data-pmf-presets] span');if(label)label.textContent=`Preset: ${preset?.name||'Default'}`;popover.querySelectorAll('[data-pmf-filter]').forEach((input)=>{const key=input.dataset.pmfFilter;input.checked=key==='customRules'?App.filterState.customRules.enabled:key==='publishedDate'?App.filterState.publishedDate.enabled:key.startsWith('status-')?Boolean(App.filterState.status[key.slice(7)]):Boolean(App.filterState.media.enabled[key]);});const match=popover.querySelector('[data-pmf-match-mode]');if(match)match.value=App.filterState.media.matchMode; },
    refreshPresetLabel() { UI.refreshFilterPopover(); },
    toggleFilterPopover(force) {
      if (!App.ui) return;
      const open = typeof force === 'boolean' ? force : !App.ui.filterPopover;
      if (!open) { if (App.ui.filterOverlayId) OverlayManager.close(App.ui.filterOverlayId); return; }
      UI.toggleFilterPopover(false);
      const popover = document.createElement('div'); popover.className = 'pmf-filter-popover pmf-surface'; popover.setAttribute('role', 'dialog'); popover.setAttribute('aria-label', 'Post filters');
      const enabled = App.filterState.media.enabled;
      const row = (key, label, advanced = false) => {
        const checked = key === 'customRules' ? App.filterState.customRules.enabled : key === 'publishedDate' ? App.filterState.publishedDate.enabled : enabled[key];
        return `<div class="pmf-filter-row"><label><input type="checkbox" data-pmf-filter="${key}" ${checked ? 'checked' : ''}><span>${label}</span></label>${advanced ? `<button type="button" class="pmf-row-chevron" data-pmf-editor="${key}" aria-haspopup="dialog" aria-label="Configure ${label}">›</button>` : '<span class="pmf-row-spacer"></span>'}</div>`;
      };
      const preset = Presets.get(App.activePresetId) || Presets.default();
      popover.innerHTML = `<div class="pmf-popover-title">Post filters</div><label class="pmf-match-mode"><span>Match selected filters</span><select data-pmf-match-mode aria-label="Match selected filters"><option value="all" ${App.filterState.media.matchMode === 'all' ? 'selected' : ''}>All</option><option value="any" ${App.filterState.media.matchMode === 'any' ? 'selected' : ''}>Any</option></select></label><button type="button" class="pmf-preset-selector" data-pmf-presets aria-haspopup="dialog" aria-expanded="false"><span>Preset: ${Util.escapeHtml(preset?.name || 'Default')}</span><b>›</b></button><div class="pmf-popover-section">General</div>${row('videos', 'Videos')}${row('images', 'Images')}${row('archives', 'Archives')}${row('projectFiles', 'Project files')}${row('externalLinks', 'External links')}<div class="pmf-popover-section">Advanced</div>${row('customExtensions', 'Custom extensions', true)}${row('customRules', 'Custom search rules', true)}${row('publishedDate', 'Published date', true)}<div class="pmf-preset-saved" aria-live="polite">${App.presetSavedVisible ? 'Preset saved' : ''}</div>`;
      popover.addEventListener('change', (event) => {
        const key = event.target.dataset.pmfFilter;
        if (key === 'customRules') App.filterState.customRules.enabled = event.target.checked;
        else if (key === 'publishedDate') App.filterState.publishedDate.enabled = event.target.checked;
        else if (key) App.filterState.media.enabled[key] = event.target.checked;
        if (event.target.matches('[data-pmf-match-mode]')) App.filterState.media.matchMode = event.target.value;
        UI.filterChanged();
      });
      popover.addEventListener('click', (event) => {
        const editor = event.target.closest('[data-pmf-editor]'); if (editor) { UI.openFilterEditor(editor.dataset.pmfEditor); return; }
        if (event.target.closest('[data-pmf-presets]')) UI.openPresetManager();
      });
      App.ui.root.append(popover);const geometry=Util.relativeAnchorGeometry(App.ui.filterButton.getBoundingClientRect(),App.ui.root.getBoundingClientRect());popover.style.left=`${geometry.left}px`;popover.style.top=`${geometry.top}px`;popover.style.width=`${geometry.width}px`;popover.style.transform='none'; App.ui.filterPopover = popover; App.ui.filterButton.setAttribute('aria-expanded', 'true');
      App.ui.filterOverlayId = OverlayManager.open({ node: popover, opener: App.ui.filterButton, onClose: () => { if (!App.ui) return; App.ui.filterPopover = null; App.ui.filterOverlayId = null; App.ui.filterButton?.setAttribute('aria-expanded', 'false'); } });
    },
    editorShell(title, body, type) {
      UI.closeEditor();
      const backdrop = document.createElement('div'); backdrop.className = 'pmf-modal-backdrop';
      backdrop.innerHTML = `<section class="pmf-dialog pmf-filter-editor pmf-surface" role="dialog" aria-modal="true" aria-labelledby="pmf-editor-title"><header><strong id="pmf-editor-title">${Util.escapeHtml(title)}</strong><button type="button" class="pmf-icon-close" data-pmf-editor-close aria-label="Close">×</button></header><div class="pmf-editor-body">${body}</div><div class="pmf-editor-error" aria-live="polite"></div><footer><button type="button" data-pmf-editor-close>Discard</button><button type="button" class="pmf-primary" data-pmf-editor-apply="${type}">Apply</button></footer></section>`;
      const dialog = backdrop.firstElementChild;
      backdrop.addEventListener('click', (event) => {
        if (event.target.closest('[data-pmf-editor-close]')) UI.closeEditor();
        const apply = event.target.closest('[data-pmf-editor-apply]'); if (apply) UI.applyFilterEditor(apply.dataset.pmfEditorApply);
      });
      App.ui.root.append(backdrop); App.ui.editor = backdrop;
      App.ui.editorOverlayId = OverlayManager.open({ node: dialog, root: backdrop, modal: true, onClose: () => { if (!App.ui) return; App.ui.editor = null; App.ui.editorOverlayId = null; } });
      return backdrop;
    },
    openFilterEditor(type) {
      if (!['customExtensions', 'customRules', 'publishedDate'].includes(type)) return;
      if (type === 'customExtensions') {
        const values = App.filterState.customExtensions.values.length ? App.filterState.customExtensions.values : [''];
        const editor = UI.editorShell('Custom extension filter', `<p class="pmf-help">Match custom attachment file extensions without a leading dot.</p><div class="pmf-list-editor" data-pmf-extension-list>${values.map((value, index) => UI.extensionRow(value, index)).join('')}<button type="button" class="pmf-add-row" data-pmf-add-extension>＋ Add extension</button></div>`, type);
        editor.addEventListener('click', (event) => {
          const remove = event.target.closest('[data-pmf-delete-row]');
          if (remove) { const list = editor.querySelector('[data-pmf-extension-list]'); const rows = list.querySelectorAll('.pmf-extension-row'); if (rows.length === 1) rows[0].querySelector('input').value = ''; else remove.closest('.pmf-extension-row').remove(); UI.renumberExtensions(editor); }
          if (event.target.closest('[data-pmf-add-extension]')) { const list = editor.querySelector('[data-pmf-extension-list]'); const add = list.querySelector('[data-pmf-add-extension]'); add.insertAdjacentHTML('beforebegin', UI.extensionRow('', list.querySelectorAll('.pmf-extension-row').length)); add.previousElementSibling.querySelector('input').focus(); }
        });
      } else if (type === 'customRules') {
        const rows = App.filterState.customRules.rows.length ? App.filterState.customRules.rows : [FilterEngine.normalizeRule()];
        const editor = UI.editorShell('Custom search rules', `<div class="pmf-expression-preview" data-pmf-expression></div><div class="pmf-list-editor pmf-rule-list" data-pmf-rule-list>${rows.map((rule, index) => UI.ruleRow(rule, index)).join('')}<button type="button" class="pmf-add-row" data-pmf-add-rule>＋ Add rule</button></div>`, type);
        editor.addEventListener('click', (event) => UI.handleRuleEditorClick(event, editor));
        editor.addEventListener('input', () => UI.updateExpressionPreview(editor)); UI.updateExpressionPreview(editor);
      } else {
        const date = App.filterState.publishedDate; const labels = { after: 'On or after', before: 'On or before', between: 'Between' };
        const editor = UI.editorShell('Published date', `<div class="pmf-date-editor"><label class="pmf-date-condition">Condition<button type="button" class="pmf-choice" data-pmf-date-mode data-value="${date.mode}" aria-haspopup="menu" aria-expanded="false">${labels[date.mode] || labels.after}<b>▾</b></button></label><div class="pmf-date-fields"><label data-pmf-from><span data-pmf-date-from-label>Date</span><input type="date" name="dateFrom" value="${Util.escapeHtml(date.from)}"></label><label data-pmf-to><span data-pmf-date-to-label>Date</span><input type="date" name="dateTo" value="${Util.escapeHtml(date.to)}"></label></div><label class="pmf-check pmf-date-unknown"><input type="checkbox" name="includeUnknown" ${date.includeUnknown ? 'checked' : ''}> <span>Include posts with unknown published date</span></label></div>`, type);
        const update = () => { const mode = editor.querySelector('[data-pmf-date-mode]').dataset.value; editor.querySelector('[data-pmf-from]').hidden = mode === 'before'; editor.querySelector('[data-pmf-to]').hidden = mode === 'after'; editor.querySelector('[data-pmf-date-from-label]').textContent = mode === 'between' ? 'Start date' : 'Date'; editor.querySelector('[data-pmf-date-to-label]').textContent = mode === 'between' ? 'End date' : 'Date'; editor.querySelector('.pmf-date-fields').classList.toggle('pmf-between', mode === 'between'); };
        editor.querySelector('[data-pmf-date-mode]').addEventListener('click', (event) => { const trigger=event.currentTarget;UI.openChoiceMenu(trigger,[['after','On or after'],['before','On or before'],['between','Between']],(value,label)=>{trigger.dataset.value=value;trigger.firstChild.textContent=label;update();}); }); update();
      }
    },
    extensionRow(value, index) { return `<div class="pmf-extension-row"><input value="${Util.escapeHtml(value)}" aria-label="Extension ${index + 1}"><button type="button" class="pmf-delete-row" data-pmf-delete-row aria-label="Delete extension">×</button></div>`; },
    renumberExtensions(editor) { editor.querySelectorAll('.pmf-extension-row input').forEach((input, index) => input.setAttribute('aria-label', `Extension ${index + 1}`)); },
    ruleRow(rule, index) {
      const normalized = FilterEngine.normalizeRule(rule); const fields = normalized.fields; const count = Object.values(fields).filter(Boolean).length;
      const encoded = Util.escapeHtml(JSON.stringify(fields));
      return `<div class="pmf-rule-row">${index ? `<button type="button" class="pmf-choice" data-pmf-rule-choice="connector" data-value="${normalized.connector}" aria-haspopup="menu" aria-expanded="false">${normalized.connector.toUpperCase()}<b>▾</b></button>` : '<span class="pmf-rule-first">IF</span>'}<button type="button" class="pmf-choice" data-pmf-rule-choice="mode" data-value="${normalized.mode}" aria-haspopup="menu" aria-expanded="false">${normalized.mode === 'no-match' ? 'No match' : 'Match'}<b>▾</b></button><input type="text" data-pmf-rule-text value="${Util.escapeHtml(normalized.text)}" aria-label="Rule text"><button type="button" class="pmf-choice pmf-field-choice" data-pmf-rule-choice="fields" data-fields="${encoded}" aria-haspopup="menu" aria-expanded="false">${count} fields<b>▾</b></button><button type="button" class="pmf-delete-row" data-pmf-delete-rule aria-label="Delete rule">×</button></div>`;
    },
    collectRules(editor, keepEmpty = false) {
      const rows = [...editor.querySelectorAll('.pmf-rule-row')].map((row, index) => FilterEngine.normalizeRule({ connector: index ? row.querySelector('[data-pmf-rule-choice="connector"]')?.dataset.value : 'and', mode: row.querySelector('[data-pmf-rule-choice="mode"]').dataset.value, text: row.querySelector('[data-pmf-rule-text]').value.trim(), fields: JSON.parse(row.querySelector('[data-pmf-rule-choice="fields"]').dataset.fields || '{}') }));
      return keepEmpty ? rows : rows.filter((rule) => rule.text);
    },
    handleRuleEditorClick(event, editor) {
      const remove = event.target.closest('[data-pmf-delete-rule]');
      if (remove) { const list = editor.querySelector('[data-pmf-rule-list]'); const rows = list.querySelectorAll('.pmf-rule-row'); if (rows.length === 1) list.querySelector('[data-pmf-rule-text]').value = ''; else remove.closest('.pmf-rule-row').remove(); UI.rebuildRules(editor); return; }
      if (event.target.closest('[data-pmf-add-rule]')) { const list = editor.querySelector('[data-pmf-rule-list]'); const add = list.querySelector('[data-pmf-add-rule]'); add.insertAdjacentHTML('beforebegin', UI.ruleRow(FilterEngine.normalizeRule(), list.querySelectorAll('.pmf-rule-row').length)); add.previousElementSibling.querySelector('[data-pmf-rule-text]').focus(); UI.updateExpressionPreview(editor); return; }
      const trigger = event.target.closest('[data-pmf-rule-choice]'); if (!trigger) return;
      if (trigger.dataset.pmfRuleChoice === 'connector') UI.openChoiceMenu(trigger, [['and','AND'],['or','OR']], (value, label) => { trigger.dataset.value = value; trigger.firstChild.textContent = label; UI.updateExpressionPreview(editor); });
      else if (trigger.dataset.pmfRuleChoice === 'mode') UI.openChoiceMenu(trigger, [['match','Match'],['no-match','No match']], (value, label) => { trigger.dataset.value = value; trigger.firstChild.textContent = label; UI.updateExpressionPreview(editor); });
      else UI.openFieldMenu(trigger, editor);
    },
    rebuildRules(editor) { const list = editor.querySelector('[data-pmf-rule-list]'); const add = list.querySelector('[data-pmf-add-rule]'); const rows = UI.collectRules(editor, true); list.querySelectorAll('.pmf-rule-row').forEach((row) => row.remove()); rows.forEach((rule, index) => add.insertAdjacentHTML('beforebegin', UI.ruleRow(rule, index))); UI.updateExpressionPreview(editor); },
    updateExpressionPreview(editor) { const rows = UI.collectRules(editor); let expression = ''; rows.forEach((rule, index) => { const term = `${rule.mode === 'no-match' ? 'NOT ' : ''}"${rule.text}"`; expression = index ? `(${expression} ${rule.connector.toUpperCase()} ${term})` : term; }); editor.querySelector('[data-pmf-expression]').textContent = expression; },
    openChoiceMenu(trigger, options, choose) {
      const menu = document.createElement('div'); menu.className = 'pmf-floating-menu pmf-surface'; menu.setAttribute('role', 'menu');
      menu.id = `pmf-menu-${Presets.id()}`; trigger.setAttribute('aria-controls', menu.id); trigger.setAttribute('aria-expanded', 'true');
      menu.innerHTML = options.map(([value, label]) => `<button type="button" role="menuitem" data-value="${value}" ${trigger.dataset.value === value ? 'aria-current="true"' : ''}>${label}</button>`).join('');
      UI.positionFloating(menu, trigger); menu.addEventListener('click', (event) => { const item = event.target.closest('[data-value]'); if (!item) return; choose(item.dataset.value, item.textContent); OverlayManager.close(id); });
      menu.addEventListener('keydown', (event) => UI.menuKeys(event, menu)); const id = OverlayManager.open({ node: menu, opener: trigger, onClose: () => { trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-controls'); } });
    },
    openFieldMenu(trigger, editor) {
      const labels = { title: 'Post title', attachmentFilenames: 'Attachment filenames', tags: 'Tags', contentText: 'Description' }; const fields = JSON.parse(trigger.dataset.fields || '{}');
      const menu = document.createElement('div'); menu.className = 'pmf-floating-menu pmf-field-menu pmf-surface'; menu.setAttribute('role', 'menu');
      menu.id = `pmf-menu-${Presets.id()}`; trigger.setAttribute('aria-controls', menu.id); trigger.setAttribute('aria-expanded', 'true');
      menu.innerHTML = Object.entries(labels).map(([key, label]) => `<button type="button" role="menuitemcheckbox" aria-checked="${fields[key] !== false}" data-field="${key}"><span>${fields[key] !== false ? '✓' : ''}</span>${label}</button>`).join('');
      UI.positionFloating(menu, trigger); menu.addEventListener('click', (event) => { const item = event.target.closest('[data-field]'); if (!item) return; fields[item.dataset.field] = item.getAttribute('aria-checked') !== 'true'; item.setAttribute('aria-checked', String(fields[item.dataset.field])); item.querySelector('span').textContent = fields[item.dataset.field] ? '✓' : ''; trigger.dataset.fields = JSON.stringify(fields); trigger.firstChild.textContent = `${Object.values(fields).filter(Boolean).length} fields`; UI.updateExpressionPreview(editor); });
      menu.addEventListener('keydown', (event) => UI.menuKeys(event, menu)); OverlayManager.open({ node: menu, opener: trigger, onClose: () => { trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-controls'); } });
    },
    positionFloating(menu, trigger) { document.body.append(menu); UI.own(menu); const rect = trigger.getBoundingClientRect(); menu.style.left = `${Math.min(rect.left, innerWidth - Math.max(190, menu.offsetWidth) - 8)}px`; menu.style.top = `${Math.min(rect.bottom + 4, innerHeight - menu.offsetHeight - 8)}px`; },
    menuKeys(event, menu) { const items = [...menu.querySelectorAll('[role^="menuitem"]')]; const index = Math.max(0, items.indexOf(document.activeElement)); if (event.key === 'ArrowDown') { event.preventDefault(); items[(index + 1) % items.length]?.focus(); } if (event.key === 'ArrowUp') { event.preventDefault(); items[(index - 1 + items.length) % items.length]?.focus(); } if (event.key === 'Home') { event.preventDefault(); items[0]?.focus(); } if (event.key === 'End') { event.preventDefault(); items.at(-1)?.focus(); } },
    async applyFilterEditor(type) {
      const editor = App.ui.editor; const error = editor.querySelector('.pmf-editor-error');
      if (type === 'customExtensions') { const result = Util.normalizeExtensions([...editor.querySelectorAll('.pmf-extension-row input')].map((input) => input.value)); if (result.invalid.length) { error.textContent = `Invalid: ${result.invalid.join(', ')}`; return; } App.filterState.customExtensions.values = result.values; }
      if (type === 'customRules') App.filterState.customRules.rows = UI.collectRules(editor);
      if (type === 'publishedDate') { const mode = editor.querySelector('[data-pmf-date-mode]').dataset.value; const next = { ...App.filterState.publishedDate, mode, from: editor.querySelector('[name="dateFrom"]').value, to: editor.querySelector('[name="dateTo"]').value, includeUnknown: editor.querySelector('[name="includeUnknown"]').checked }; const validation = FilterEngine.dateValidation({ ...next, enabled: true }); if (!validation.valid) { error.textContent = validation.message; return; } App.filterState.publishedDate = next; }
      UI.closeEditor(); UI.filterChanged();
    },
    closeEditor() { if (App.ui?.editorOverlayId) OverlayManager.close(App.ui.editorOverlayId); },
    openPresetManager() {
      if (App.ui?.presetManager) return;
      App.ui?.filterPopover?.querySelector('[data-pmf-presets]')?.setAttribute('aria-expanded', 'true');
      const backdrop = document.createElement('div'); backdrop.className = 'pmf-modal-backdrop'; const dialog = document.createElement('section'); dialog.className = 'pmf-dialog pmf-preset-dialog pmf-surface'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'pmf-preset-title'); backdrop.append(dialog);
      const render = () => { dialog.innerHTML = `<header><strong id="pmf-preset-title">Filter presets</strong><button type="button" class="pmf-icon-close" data-pmf-presets-close aria-label="Close">×</button></header><div class="pmf-preset-list" role="radiogroup">${Presets.all().map((preset) => `<div class="pmf-preset-row"><button type="button" role="radio" aria-checked="${preset.id === App.activePresetId}" data-pmf-activate-preset="${preset.id}"><span class="pmf-radio-dot"></span><span>${Util.escapeHtml(preset.name)}</span></button><button type="button" class="pmf-more" data-pmf-preset-menu="${preset.id}" aria-haspopup="menu" aria-label="More actions for ${Util.escapeHtml(preset.name)}">⋯</button></div>`).join('')}</div><footer><button type="button" class="pmf-add-row" data-pmf-create-preset>＋ Create preset</button></footer>`; };
      render(); backdrop.addEventListener('click', (event) => {
        if (event.target.closest('[data-pmf-presets-close]')) UI.closePresetManager();
        const activate = event.target.closest('[data-pmf-activate-preset]'); if (activate && App.activatePreset(activate.dataset.pmfActivatePreset)) { UI.closePresetManager(); UI.refreshFilterPopover(); }
        const menu = event.target.closest('[data-pmf-preset-menu]'); if (menu) UI.openPresetMenu(menu, menu.dataset.pmfPresetMenu, render);
        if (event.target.closest('[data-pmf-create-preset]')) UI.openPresetNameDialog('Create preset', '', (name) => { App.savePresetDebounced.cancel();App.saveActivePreset();const result = Presets.create(name, Presets.snapshot(App.filterState)); if (result.valid) { App.activePresetId = result.preset.id; App.persistUIState(); render();UI.refreshFilterPopover(); } return result; });
      });
      App.ui.root.append(backdrop); App.ui.presetManager = backdrop; App.ui.presetManagerOverlayId = OverlayManager.open({ node: dialog, root: backdrop, modal: true, onClose: () => { if (!App.ui) return; App.ui.presetManager = null; App.ui.presetManagerOverlayId = null; App.ui.filterPopover?.querySelector('[data-pmf-presets]')?.setAttribute('aria-expanded', 'false'); UI.refreshPresetLabel(); } });
    },
    closePresetManager() { if (App.ui?.presetManagerOverlayId) OverlayManager.close(App.ui.presetManagerOverlayId); },
    openPresetMenu(trigger, presetId, rerender) {
      const menu = document.createElement('div'); menu.className = 'pmf-floating-menu pmf-surface'; menu.setAttribute('role', 'menu'); menu.id = `pmf-menu-${Presets.id()}`; trigger.setAttribute('aria-controls', menu.id); trigger.setAttribute('aria-expanded', 'true'); menu.innerHTML = '<button type="button" role="menuitem" data-action="rename">Rename</button><button type="button" role="menuitem" data-action="duplicate">Duplicate</button><button type="button" role="menuitem" data-action="delete">Delete</button>';
      UI.positionFloating(menu, trigger); menu.addEventListener('click', (event) => { const action = event.target.closest('[data-action]')?.dataset.action; if (!action) return; OverlayManager.close(id); const preset = Presets.get(presetId); if (action === 'rename') UI.openPresetNameDialog('Rename preset', preset.name, (name) => { const result = Presets.rename(presetId, name); if (result.valid) rerender(); return result; }); if (action === 'duplicate') { const result = Presets.duplicate(presetId); if (result.valid) { App.activatePreset(result.preset.id); rerender(); } } if (action === 'delete') UI.openPresetDeleteDialog(presetId, rerender); });
      menu.addEventListener('keydown', (event) => UI.menuKeys(event, menu)); const id = OverlayManager.open({ node: menu, opener: trigger, onClose: () => { trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-controls'); } });
    },
    openPresetNameDialog(title, value, submit) {
      const backdrop = document.createElement('div'); backdrop.className = 'pmf-modal-backdrop'; backdrop.innerHTML = `<section class="pmf-dialog pmf-small-dialog pmf-surface" role="dialog" aria-modal="true"><header><strong>${Util.escapeHtml(title)}</strong><button type="button" class="pmf-icon-close" data-close aria-label="Close">×</button></header><div class="pmf-editor-body"><label class="pmf-block-label">Name<input type="text" maxlength="80" value="${Util.escapeHtml(value)}" autofocus></label><div class="pmf-editor-error" aria-live="polite"></div></div><footer><button type="button" data-close>Cancel</button><button type="button" class="pmf-primary" data-save>Save</button></footer></section>`;
      const dialog = backdrop.firstElementChild; const id = OverlayManager.open({ node: dialog, root: backdrop, modal: true }); document.body.append(backdrop); UI.own(backdrop);
      backdrop.addEventListener('click', (event) => { if (event.target.closest('[data-close]')) OverlayManager.close(id); if (event.target.closest('[data-save]')) { const result = submit(dialog.querySelector('input').value); if (result.valid) OverlayManager.close(id); else dialog.querySelector('.pmf-editor-error').textContent = result.message; } });
      dialog.querySelector('input').addEventListener('keydown', (event) => { if (event.key === 'Enter') dialog.querySelector('[data-save]').click(); });
    },
    openPresetDeleteDialog(presetId, rerender) {
      const preset = Presets.get(presetId); const backdrop = document.createElement('div'); backdrop.className = 'pmf-modal-backdrop'; backdrop.innerHTML = `<section class="pmf-dialog pmf-small-dialog pmf-surface" role="alertdialog" aria-modal="true"><header><strong>Delete preset?</strong></header><div class="pmf-editor-body"><p>Delete <b>${Util.escapeHtml(preset?.name || '')}</b>? This cannot be undone.</p><div class="pmf-editor-error" aria-live="polite"></div></div><footer><button type="button" data-close>Cancel</button><button type="button" class="pmf-danger" data-delete>Delete</button></footer></section>`; const dialog = backdrop.firstElementChild; document.body.append(backdrop); UI.own(backdrop); const id = OverlayManager.open({ node: dialog, root: backdrop, modal: true });
      backdrop.addEventListener('click', (event) => { if (event.target.closest('[data-close]')) OverlayManager.close(id); if (event.target.closest('[data-delete]')) { const result = Presets.remove(presetId); if (!result.valid) { dialog.querySelector('.pmf-editor-error').textContent = result.message; return; } if (App.activePresetId === presetId) App.activatePreset(Presets.default().id); App.persistUIState(); OverlayManager.close(id); rerender(); } });
    },
    confirmDialog({ title, paragraphs = [], confirmLabel, danger = false, onConfirm, opener = document.activeElement }) {
      const backdrop=document.createElement('div');backdrop.className='pmf-modal-backdrop';backdrop.innerHTML=`<section class="pmf-dialog pmf-confirm-dialog pmf-surface" role="alertdialog" aria-modal="true" aria-labelledby="pmf-confirm-title"><header><strong id="pmf-confirm-title">${Util.escapeHtml(title)}</strong><button type="button" class="pmf-icon-close" data-close aria-label="Close">×</button></header><div class="pmf-confirm-body">${paragraphs.map((paragraph)=>`<p>${Util.escapeHtml(paragraph)}</p>`).join('')}</div><footer><button type="button" data-close>Cancel</button><button type="button" class="${danger?'pmf-danger':'pmf-primary'}" data-confirm>${Util.escapeHtml(confirmLabel)}</button></footer></section>`;
      const dialog=backdrop.firstElementChild;GlobalUI.ensureHost().append(backdrop);UI.own(backdrop);const id=OverlayManager.open({node:dialog,root:backdrop,modal:true,opener});
      backdrop.addEventListener('click',async(event)=>{if(event.target.closest('[data-close]'))OverlayManager.close(id);if(event.target.closest('[data-confirm]')){OverlayManager.close(id);await onConfirm?.();}});return id;
    },
    handleCatalogueSettingsAction(action) {
      if(action==='delete'){UI.confirmClear('catalogue-creator');return;}
      UI.closeSettings();Catalogue.primaryAction();
    },
    updateCatalogueProgress({kind,page=0,totalPages=0,stored=0,total=0,newCount=0}) {
      if(!App.ui)return;
      if(kind==='build'||kind==='verification'){
        App.ui.statusLeft.innerHTML=`<strong>Scanning page ${page}${totalPages?` / ${totalPages}`:''}</strong>`;
        App.ui.statusRight.textContent=`${stored}${total?` / ${total}`:''} posts stored`;
        if(totalPages)App.ui.progressBar.style.width=`${Math.min(100,page/totalPages*100)}%`;
      }else if(kind==='metadata-retry'){App.ui.statusLeft.innerHTML='<strong>Retrying optional details…</strong>';App.ui.statusRight.textContent='Catalogue metadata retry in progress';}
      else{App.ui.statusLeft.innerHTML='<strong>Checking for new posts…</strong>';App.ui.statusRight.textContent=`${newCount} new post${newCount===1?'':'s'} found`;}
      UI.refreshDetails?.();
    },
    async reloadCurrentCreatorData() {
      if(!App.context)return;const meta=await Cache.getMeta(App.context.creatorKey);const posts=await Cache.getCreatorPosts(App.context.creatorKey);
      App.creatorMeta=meta;App.catalogueState=CatalogueModel.normalize(meta||{});App.catalog=new Map(posts.map((post)=>[String(post.id),post]));App.totalPosts=Math.max(0,Number(meta?.totalPosts)||posts.length);App.totalPages=Math.max(0,Number(meta?.totalPages)||Math.ceil(App.totalPosts/Config.pageSize));App.addNativeStubs();App.persistUIState();App.render();
    },
    confirmClear(kind) {
      const configs={'catalogue-creator':{title:"Clear this creator's full catalogue scan?",paragraphs:["This deletes this creator's locally stored posts, page coverage, summary, retry state, and update timestamps. Presets and other creators are not affected."],label:'Clear creator scan',creator:true},'catalogue-all':{title:'Clear all full catalogue scans?',paragraphs:['This deletes every locally stored creator catalogue. Presets and global settings are not affected.'],label:'Clear all scans',creator:false}};const config=configs[kind];if(!config)return;
      UI.confirmDialog({title:config.title,paragraphs:config.paragraphs,confirmLabel:config.label,danger:true,onConfirm:async()=>{if(config.creator){const key=App.context?.creatorKey;CatalogueJobManager.stop(key);CatalogueJobManager.removeQueued(key);await Cache.clearCreatorCatalogue(key);}else{CatalogueJobManager.shutdown();await Cache.clearAllCatalogues();}UI.closeSettings();await UI.reloadCurrentCreatorData();UI.flash(config.creator?'Creator scan cleared':'All full catalogue scans cleared');}});
    },
    openBadgeSettings(trigger,kind='posts') {
      const creator=kind==='creators';const status=kind==='status';const storageKey=status?'settingsStatusBadgeTypes':creator?'settingsCreatorBadgeTypes':'settingsBadgeTypes';const initial=status?Settings.value.postStatusBadges.types:creator?Settings.value.creatorCardBadges.types:Settings.value.catalogueBadges.types;const types=App.ui[storageKey]||Util.clone(initial);App.ui[storageKey]=types;const backdrop=document.createElement('div');backdrop.className='pmf-modal-backdrop';const checked=(value)=>value?'checked':'';const choices=status?[['favorited','Favorited'],['liked','Liked'],['seen','Seen']]:[['videos','Videos'],['images','Images'],['archives','Archives'],['projectFiles','Project files'],['externalLinks','External links']];
      backdrop.innerHTML=`<section class="pmf-dialog pmf-small-dialog pmf-surface" role="dialog" aria-modal="true" aria-labelledby="pmf-badges-title"><header><strong id="pmf-badges-title">${status?'Post status badges':creator?'Creator card attachment badges':'Attachment badges'}</strong><button type="button" class="pmf-icon-close" data-close aria-label="Close">×</button></header><div class="pmf-editor-body">${choices.map(([key,label])=>`<label class="pmf-check"><input type="checkbox" data-badge-type="${key}" ${checked(types[key])}> ${label}</label>`).join('')}</div><footer><button type="button" data-close>Close</button></footer></section>`;
      const dialog=backdrop.firstElementChild;document.body.append(backdrop);UI.own(backdrop);trigger.setAttribute('aria-expanded','true');const id=OverlayManager.open({node:dialog,root:backdrop,modal:true,opener:trigger,onClose:()=>trigger.setAttribute('aria-expanded','false')});backdrop.addEventListener('change',(event)=>{const key=event.target.dataset.badgeType;if(key){types[key]=event.target.checked;if(status)App.render();}});backdrop.addEventListener('click',(event)=>{if(event.target.closest('[data-close]'))OverlayManager.close(id);});
    },
    openSettings() {
UI.closeSettings('reopen');const checked=(value)=>value?'checked':'';const selected=(value,current)=>value===current?'selected':'';const backdrop=document.createElement('div');backdrop.className='pmf-modal-backdrop';App.ui.settingsBadgeTypes=Util.clone(Settings.value.catalogueBadges.types);App.ui.settingsCreatorBadgeTypes=Util.clone(Settings.value.creatorCardBadges.types);App.ui.settingsStatusBadgeTypes=Util.clone(Settings.value.postStatusBadges.types);App.ui.settingsPreview={displayMode:App.displayMode,compactCardScale:Settings.value.compactCardScale,compactThumbnailAspectRatio:Settings.value.compactThumbnailAspectRatio,postAttachmentBadgeSize:Settings.value.postAttachmentBadgeSize,filteredPage:App.filteredPage,postStatusBadgeSize:Settings.value.postStatusBadgeSize,seenCardTreatment:Util.clone(Settings.value.seenCardTreatment),committed:false};
      const evidence=[['attachmentFilenames','Attachment filenames'],['title','Post title'],['tags','Tags'],['content','Description']];const extensions=[['videoExtensions','Video extensions'],['imageExtensions','Image extensions'],['archiveExtensions','Archive extensions'],['projectExtensions','Project file extensions']];
      backdrop.innerHTML=`<section class="pmf-dialog pmf-settings-dialog pmf-surface" role="dialog" aria-modal="true" aria-labelledby="pmf-settings-title"><header><strong id="pmf-settings-title">Media Filter settings</strong><button type="button" class="pmf-icon-close" data-pmf-settings-close aria-label="Close settings">×</button></header><div class="pmf-settings-layout"><nav aria-label="Settings sections"><button type="button" class="pmf-active" data-pmf-settings-tab="general">General</button><button type="button" data-pmf-settings-tab="default-detection">Default detection</button><button type="button" data-pmf-settings-tab="modes">Full catalogue scan</button><button type="button" data-pmf-settings-tab="data">Data & performance</button></nav><div class="pmf-settings-content" tabindex="0">
      <section data-pmf-settings-panel="general"><h3>General</h3><fieldset><legend>Display mode</legend><label><input type="radio" name="displayMode" value="compact" ${checked(App.displayMode==='compact')}> Compact matching posts</label><label><input type="radio" name="displayMode" value="dim" ${checked(App.displayMode==='dim')}> Dim nonmatching posts</label><label><input type="radio" name="displayMode" value="hide" ${checked(App.displayMode==='hide')}> Hide within original page</label><div class="pmf-compact-display-settings"><label for="pmf-compact-card-scale">Post thumbnail size</label><select id="pmf-compact-card-scale" name="compactCardScale" data-compact-only><option value="big" ${selected('big',Settings.value.compactCardScale)}>Big</option><option value="medium" ${selected('medium',Settings.value.compactCardScale)}>Medium</option><option value="small" ${selected('small',Settings.value.compactCardScale)}>Small</option></select><label for="pmf-compact-thumbnail-ratio">Post thumbnail aspect ratio</label><select id="pmf-compact-thumbnail-ratio" name="compactThumbnailAspectRatio" data-compact-only><option value="16-9" ${selected('16-9',Settings.value.compactThumbnailAspectRatio)}>16:9</option><option value="4-3" ${selected('4-3',Settings.value.compactThumbnailAspectRatio)}>4:3</option><option value="1-1" ${selected('1-1',Settings.value.compactThumbnailAspectRatio)}>1:1 (original)</option></select><label for="pmf-attachment-badge-size">Attachment badge size</label><select id="pmf-attachment-badge-size" name="attachmentBadgeSize"><option value="small" ${selected('small',Settings.value.attachmentBadgeSize)}>Small</option><option value="medium" ${selected('medium',Settings.value.attachmentBadgeSize)}>Medium</option><option value="big" ${selected('big',Settings.value.attachmentBadgeSize)}>Big</option></select></div></fieldset><fieldset><legend>Remember</legend><label><input type="checkbox" name="rememberFilters" ${checked(Settings.value.rememberFilters)}> Remember active preset per creator</label><label><input type="checkbox" name="rememberSearch" ${checked(Settings.value.rememberSearch)}> Remember search text</label><label><input type="checkbox" name="rememberFilteredPage" ${checked(Settings.value.rememberFilteredPage)}> Remember filtered page</label></fieldset></section>
      <section data-pmf-settings-panel="default-detection" hidden><h3>Default detection</h3><fieldset><legend>Default filter file extensions</legend>${extensions.map(([name,label])=>`<details class="pmf-accordion"><summary>${label}</summary><div><textarea name="${name}" rows="4">${Util.escapeHtml(Settings.value[name].join(', '))}</textarea><small data-pmf-validation="${name}"></small></div></details>`).join('')}</fieldset><fieldset><legend>Project-file evidence</legend>${evidence.map(([name,label])=>`<label><input type="checkbox" name="project-${name}" ${checked(Settings.value.projectEvidence[name])}> ${label}</label>`).join('')}<details class="pmf-accordion"><summary>Project file search keywords</summary><div><textarea name="projectKeywords" rows="5">${Util.escapeHtml(Settings.value.projectKeywords.join('\n'))}</textarea></div></details></fieldset><fieldset><legend>External-link scope</legend><label><input type="radio" name="externalLinkScope" value="media-download" ${checked(Settings.value.externalLinkScope==='media-download')}> Media and download links</label><label><input type="radio" name="externalLinkScope" value="any" ${checked(Settings.value.externalLinkScope==='any')}> Any external link</label><details class="pmf-accordion"><summary>Known media and download hosts</summary><div><textarea name="knownHosts" rows="5">${Util.escapeHtml(Settings.value.knownHosts.join('\n'))}</textarea></div></details></fieldset></section>
      <section data-pmf-settings-panel="modes" hidden><h3>Full catalogue scan</h3><fieldset><legend>Queue</legend><label class="pmf-inline">Concurrent scans and updates <select name="catalogueConcurrentJobs"><option value="1" ${selected('1',String(Settings.value.catalogueConcurrentJobs))}>1 — Recommended</option><option value="2" ${selected('2',String(Settings.value.catalogueConcurrentJobs))}>2</option></select></label></fieldset><fieldset><legend>Full catalogue scan</legend><label><input type="checkbox" name="confirmCreatorCardScan" ${checked(Settings.value.confirmCreatorCardScan)}> Confirm initial and resumed scans from creator cards</label><div class="pmf-setting-chevron-row"><label><input type="checkbox" name="catalogueBadgesAlways" ${checked(Settings.value.catalogueBadges.alwaysShow)}> <span>Show attachment badges on post cards</span></label><button type="button" data-configure-badges="posts" aria-label="Configure attachment badges" aria-haspopup="dialog" aria-expanded="false">›</button></div><div class="pmf-setting-chevron-row"><label><input type="checkbox" name="postStatusBadgesEnabled" ${checked(Settings.value.postStatusBadges.enabled)}> <span>Show status badges on post cards</span></label><button type="button" data-configure-badges="status" aria-label="Configure post status badges" aria-haspopup="dialog" aria-expanded="false">›</button></div><label><input type="checkbox" name="seenCardTreatmentEnabled" ${checked(Settings.value.seenCardTreatment.enabled)}> Dim seen post cards</label><label class="pmf-inline pmf-seen-strength">Seen dim strength <select name="seenCardTreatmentStrength"><option value="low" ${selected('low',Settings.value.seenCardTreatment.strength)}>Low</option><option value="medium" ${selected('medium',Settings.value.seenCardTreatment.strength)}>Medium</option><option value="high" ${selected('high',Settings.value.seenCardTreatment.strength)}>High</option></select></label><div class="pmf-setting-chevron-row"><label><input type="checkbox" name="creatorCardBadgesEnabled" ${checked(Settings.value.creatorCardBadges.enabled)}> <span>Show attachment badges on creator cards</span></label><button type="button" data-configure-badges="creators" aria-label="Configure creator card attachment badges" aria-haspopup="dialog" aria-expanded="false">›</button></div><label><input type="checkbox" name="synchronizeNativeFavorites" ${checked(Settings.value.synchronizeNativeFavorites)}> Synchronize native favorites during Scan and Update</label></fieldset></section>
      <section data-pmf-settings-panel="data" hidden><h3>Data & performance</h3><fieldset><legend>Request behavior</legend><label class="pmf-inline">Concurrent optional-detail requests <input type="number" min="1" max="10" name="concurrency" value="${Settings.value.concurrency}"></label><label><input type="checkbox" name="retryFailed" ${checked(Settings.value.retryFailed)}> Retry failed requests</label></fieldset><fieldset><legend>Native Favorites</legend><p class="pmf-help">Refresh local Favorite badges and filters from your signed-in Pawchive Favorites pages. Like and Seen remain local and are never sent to Pawchive.</p><div class="pmf-data-actions"><button type="button" data-pmf-sync-favorites>${Icons.sync} Sync native Favorites</button></div></fieldset><fieldset><legend>Full catalogue scan data</legend><p class="pmf-help">Store every post's available metadata locally. Media files are not downloaded.</p><div class="pmf-data-actions"><button type="button" class="pmf-danger" data-clear-kind="catalogue-creator">Clear this creator's full catalogue scan</button><button type="button" class="pmf-danger" data-clear-kind="catalogue-all">Clear all full catalogue scans</button></div></fieldset></section></div></div><div class="pmf-settings-error" aria-live="polite"></div><footer><button type="button" data-pmf-reset-settings>Reset all settings</button><span></span><button type="button" data-pmf-settings-close>Cancel</button><button type="button" class="pmf-primary" data-pmf-settings-save>Save & apply</button></footer></section>`;
      const dialog=backdrop.firstElementChild;backdrop.addEventListener('click',async(event)=>{if(event.target.closest('[data-pmf-settings-close]'))UI.closeSettings('cancel');const tab=event.target.closest('[data-pmf-settings-tab]');if(tab)UI.selectSettingsTab(tab.dataset.pmfSettingsTab);const configure=event.target.closest('[data-configure-badges]');if(configure)UI.openBadgeSettings(configure,configure.dataset.configureBadges);const clear=event.target.closest('[data-clear-kind]');if(clear)UI.confirmClear(clear.dataset.clearKind);const sync=event.target.closest('[data-pmf-sync-favorites]');if(sync&&!sync.disabled){sync.disabled=true;sync.textContent='Syncing…';try{const result=await FavoriteSyncCoordinator.run({manual:true});await App.loadStatuses();App.render();UI.flash(`Synced ${result.count} native Favorite${result.count===1?'':'s'}.`);}catch(error){UI.flash(`Favorite sync failed: ${error.message}`);}finally{if(sync.isConnected){sync.disabled=false;sync.innerHTML=`${Icons.sync} Sync native Favorites`;}}}if(event.target.closest('[data-pmf-reset-settings]')){UI.commitSettingsPreview();Settings.reset();AttachmentBadgeSizing.commit();await Cache.clearUIStates();App.filterState=FilterEngine.createDefaultState();App.filterState.externalLinks.scope=Settings.value.externalLinkScope;Presets.load(App.filterState);App.activePresetId=Presets.default().id;App.query='';App.filteredPage=1;App.filteredFirstResultIndex=0;App.filteredAnchorId='';App.displayMode=Settings.value.displayMode;App.sortMode='published';App.sortDirection='default';await App.reclassifyCatalog();App.persistUIState();UI.closeSettings('reset');UI.openSettings();UI.flash('Settings reset; full catalogue scans were preserved.');}if(event.target.closest('[data-pmf-settings-save]'))await UI.saveSettings();});
      backdrop.addEventListener('change',(event)=>{if(event.target.matches('[name="displayMode"],[name="compactCardScale"],[name="compactThumbnailAspectRatio"],[name="attachmentBadgeSize"],[name="postStatusBadgeSize"],[name="postStatusBadgesEnabled"],[name="seenCardTreatmentEnabled"],[name="seenCardTreatmentStrength"]'))UI.previewDisplaySettings();});
      backdrop.addEventListener('input',(event)=>{if(event.target.matches('textarea'))UI.autoSizeTextarea(event.target);});backdrop.addEventListener('paste',(event)=>{if(event.target.matches('textarea'))queueMicrotask(()=>UI.autoSizeTextarea(event.target));});backdrop.querySelectorAll('details').forEach((details)=>details.addEventListener('toggle',()=>{if(details.open)queueMicrotask(()=>details.querySelectorAll('textarea').forEach(UI.autoSizeTextarea));}));App.ui.root.append(backdrop);App.ui.settings=backdrop;App.ui.settingsOverlayId=OverlayManager.open({node:dialog,root:backdrop,modal:true,onClose:(reason)=>{if(!App.ui)return;const preview=App.ui.settingsPreview;if(preview&&!preview.committed){App.displayMode=preview.displayMode;App.filteredPage=preview.filteredPage;CompactGridScale.previewScale=CompactGridScale.normalizeScale(preview.compactCardScale);CompactThumbnailRatio.previewRatio=CompactThumbnailRatio.normalizeAspectRatio(preview.compactThumbnailAspectRatio);AttachmentBadgeSizing.restorePreview();CompactGridScale.pendingReason='settings-cancel';if(!['page-detach','cleanup'].includes(reason))App.render();}CompactGridScale.restorePreview({apply:false});CompactThumbnailRatio.restorePreview({apply:false});App.ui.settingsPreview=null;App.ui.settings=null;App.ui.settingsOverlayId=null;}});backdrop.querySelectorAll('textarea').forEach(UI.autoSizeTextarea);UI.updateCompactDisplayControls();
    },
    updateCompactDisplayControls(){const dialog=App.ui?.settings;if(!dialog)return;const wrapper=dialog.querySelector('.pmf-compact-display-settings');const compact=dialog.querySelector('[name="displayMode"]:checked')?.value==='compact';wrapper?.querySelectorAll('[data-compact-only]').forEach((select)=>{select.disabled=!compact;});wrapper?.classList.toggle('pmf-disabled',!compact);dialog.querySelector('[name="attachmentBadgeSize"]')?.closest('.pmf-compact-display-settings')?.classList.remove('pmf-disabled');
      if(!dialog.querySelector('[name="postStatusBadgeSize"]'))dialog.querySelector('[name="attachmentBadgeSize"]')?.insertAdjacentHTML('afterend',`<label for="pmf-status-badge-size">Post status badge size</label><select id="pmf-status-badge-size" name="postStatusBadgeSize"><option value="small"${Settings.value.postStatusBadgeSize==='small'?' selected':''}>Small</option><option value="medium"${Settings.value.postStatusBadgeSize==='medium'?' selected':''}>Medium</option><option value="big"${Settings.value.postStatusBadgeSize==='big'?' selected':''}>Big</option></select>`);
      const fullFieldset=dialog.querySelector('[data-pmf-settings-panel="modes"] fieldset:last-of-type');if(fullFieldset&&!dialog.querySelector('[name="postStatusBadgesEnabled"]'))fullFieldset.insertAdjacentHTML('beforeend',`<div class="pmf-setting-chevron-row"><label><input type="checkbox" name="postStatusBadgesEnabled"${Settings.value.postStatusBadges.enabled?' checked':''}> <span>Show status badges on post cards</span></label><button type="button" data-configure-badges="status" aria-label="Configure post status badges" aria-haspopup="dialog" aria-expanded="false">›</button></div><label><input type="checkbox" name="synchronizeNativeFavorites"${Settings.value.synchronizeNativeFavorites?' checked':''}> Synchronize native favorites during Scan and Update</label>`);
      const attachmentLabel=dialog.querySelector('[name="catalogueBadgesAlways"]')?.closest('label')?.querySelector('span');if(attachmentLabel)attachmentLabel.textContent='Show attachment badges on post cards';
      const sync=dialog.querySelector('[data-pmf-sync-favorites]');if(sync&&!dialog.querySelector('[data-pmf-stop-favorites]')){sync.innerHTML=`${Icons.sync} Synchronize native favorites now`;sync.insertAdjacentHTML('afterend','<button type="button" data-pmf-stop-favorites hidden>Stop synchronization</button><span class="pmf-favorite-sync-status" role="status"></span>');dialog.querySelector('[data-pmf-stop-favorites]').addEventListener('click',()=>FavoriteSyncCoordinator.stop());const update=(state)=>{const status=dialog.querySelector('.pmf-favorite-sync-status');const stop=dialog.querySelector('[data-pmf-stop-favorites]');if(status)status.textContent=state.running?state.message||'Synchronizing native favorites…':state.lastAttemptStatus==='failed'?`Last synchronization failed: ${state.lastError||'Unknown error'}`:state.completedAt?`Last synchronized ${new Date(state.completedAt).toLocaleString()} · ${state.favoriteCount||0} favorites`:state.lastAttemptStatus==='stopped'?'Synchronization stopped.':'Not synchronized yet.';if(stop)stop.hidden=!state.running;if(!state.running&&sync.isConnected){sync.disabled=false;sync.innerHTML=`${Icons.sync} Synchronize native favorites now`;}};App.ui.favoriteSyncUnsubscribe?.();const unsubscribe=FavoriteSyncCoordinator.subscribe(update);App.ui.favoriteSyncUnsubscribe=unsubscribe;App.pageController?.signal?.addEventListener('abort',unsubscribe,{once:true});}
    },
    previewDisplaySettings(){
      const dialog=App.ui?.settings;if(!dialog)return;const mode=dialog.querySelector('[name="displayMode"]:checked')?.value||'compact';const scale=CompactGridScale.normalizeScale(dialog.querySelector('[name="compactCardScale"]')?.value);const ratio=CompactThumbnailRatio.normalizeAspectRatio(dialog.querySelector('[name="compactThumbnailAspectRatio"]')?.value);const badgeSize=AttachmentBadgeSizing.normalize(dialog.querySelector('[name="attachmentBadgeSize"]')?.value);App.ui.previewStatusBadgeSize=AttachmentBadgeSizing.normalize(dialog.querySelector('[name="postStatusBadgeSize"]')?.value);if(App.ui.grid&&!App.ui.grid.hidden)App.ui.grid.querySelectorAll('article.post-card[data-id]').forEach((card)=>{const post=App.catalog.get(String(card.dataset.id));PostStatusBadgeRenderer.apply(card,post);SeenCardTreatment.apply(card,post);});
      const previousMode=App.displayMode;const previousScale=CompactGridScale.currentScale();const previousRatio=CompactThumbnailRatio.currentAspectRatio();
      App.displayMode=mode;CompactGridScale.previewScale=scale;CompactThumbnailRatio.previewRatio=ratio;AttachmentBadgeSizing.preview(badgeSize);UI.updateCompactDisplayControls();
      if(previousMode!==mode){CompactGridScale.pendingReason='settings-preview';App.render();return;}
      if(mode!=='compact')return;
      if(previousScale!==scale){CompactGridScale.applyScale(scale,{reason:'scale-preview'});CompactThumbnailRatio.applyAspectRatio(ratio,{reason:'scale-preview'});return;}
      if(previousRatio!==ratio)CompactThumbnailRatio.applyAspectRatio(ratio,{reason:'ratio-preview'});
    },
    commitSettingsPreview(){if(App.ui?.settingsPreview)App.ui.settingsPreview.committed=true;if(App.ui)App.ui.previewStatusBadgeSize=null;CompactGridScale.previewScale=null;CompactThumbnailRatio.previewRatio=null;AttachmentBadgeSizing.previewSizes={post:null,creator:null};},
    autoSizeTextarea(textarea) { const maxHeight = 220; textarea.style.height = 'auto'; const measured = textarea.scrollHeight; textarea.style.height = `${Math.min(maxHeight, Math.max(76, measured))}px`; textarea.style.overflowY = measured >= maxHeight ? 'auto' : 'hidden'; },
    async saveSettings() {
      const dialog = App.ui.settings; const error = dialog.querySelector('.pmf-settings-error'); const extensionValues = {}; let invalid = [];
      const classificationSnapshot=(settings)=>JSON.stringify({videoExtensions:settings.videoExtensions,imageExtensions:settings.imageExtensions,archiveExtensions:settings.archiveExtensions,projectExtensions:settings.projectExtensions,projectEvidence:settings.projectEvidence,projectKeywords:settings.projectKeywords,knownHosts:settings.knownHosts});const previousClassification=classificationSnapshot(Settings.value);const previousFingerprint=CreatorCatalogueSummary.fingerprint();
      for (const name of ['videoExtensions','imageExtensions','archiveExtensions','projectExtensions']) { const result = Util.normalizeExtensions(dialog.querySelector(`[name="${name}"]`).value); extensionValues[name] = result.values; dialog.querySelector(`[data-pmf-validation="${name}"]`).textContent = result.invalid.length ? `Invalid: ${result.invalid.join(', ')}` : ''; invalid = invalid.concat(result.invalid); }
      if (invalid.length || ['videoExtensions','imageExtensions','archiveExtensions'].some((name)=>!extensionValues[name].length)) { error.textContent = 'Correct invalid or empty video, image, and archive extension lists.'; return; }
      const evidenceNames = ['attachmentFilenames','title','tags','content']; const next = { ...extensionValues, displayMode: dialog.querySelector('[name="displayMode"]:checked')?.value || 'compact', compactCardScale:dialog.querySelector('[name="compactCardScale"]')?.value||'big', compactThumbnailAspectRatio:dialog.querySelector('[name="compactThumbnailAspectRatio"]')?.value||'1-1', attachmentBadgeSize:dialog.querySelector('[name="attachmentBadgeSize"]')?.value||'small', confirmCreatorCardScan:dialog.querySelector('[name="confirmCreatorCardScan"]').checked, rememberFilters: dialog.querySelector('[name="rememberFilters"]').checked, rememberSearch: dialog.querySelector('[name="rememberSearch"]').checked, rememberFilteredPage: dialog.querySelector('[name="rememberFilteredPage"]').checked, projectEvidence: Object.fromEntries(evidenceNames.map((name) => [name, dialog.querySelector(`[name="project-${name}"]`).checked])), projectKeywords: Util.unique(dialog.querySelector('[name="projectKeywords"]').value.split(/\n+/).map((x) => x.trim()).filter(Boolean)), externalLinkScope: dialog.querySelector('[name="externalLinkScope"]:checked')?.value || 'media-download', knownHosts: Util.unique(dialog.querySelector('[name="knownHosts"]').value.split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)), concurrency: Util.clamp(Util.parseInteger(dialog.querySelector('[name="concurrency"]').value, 5), 1, 10), retryFailed: dialog.querySelector('[name="retryFailed"]').checked, catalogueBadges:{alwaysShow:dialog.querySelector('[name="catalogueBadgesAlways"]').checked,types:Util.clone(App.ui.settingsBadgeTypes||Settings.value.catalogueBadges.types)},creatorCardBadges:{enabled:dialog.querySelector('[name="creatorCardBadgesEnabled"]').checked,types:Util.clone(App.ui.settingsCreatorBadgeTypes||Settings.value.creatorCardBadges.types)},seenCardTreatment:{enabled:dialog.querySelector('[name="seenCardTreatmentEnabled"]')?.checked===true,strength:dialog.querySelector('[name="seenCardTreatmentStrength"]')?.value||'medium'} };
      next.catalogueConcurrentJobs=Number(dialog.querySelector('[name="catalogueConcurrentJobs"]')?.value)||1;next.creatorCardBadgeCountMode=dialog.querySelector('[name="creatorCardBadgeCountMode"]')?.value||Settings.value.creatorCardBadgeCountMode;Settings.save(next);CatalogueJobManager.setConcurrency(Settings.value.catalogueConcurrentJobs);const classificationChanged=previousClassification!==classificationSnapshot(Settings.value);const fingerprintChanged=previousFingerprint!==CreatorCatalogueSummary.fingerprint();UI.commitSettingsPreview();AttachmentBadgeSizing.commit();App.displayMode = next.displayMode; App.filterState.externalLinks.scope = next.externalLinkScope;if(classificationChanged)await App.reclassifyCatalog();if(CatalogueModel.evaluateCoverage(App.catalogueState.catalogue).coverageComplete&&(fingerprintChanged||!CreatorCatalogueSummary.valid(App.catalogueState.catalogue.creatorCardSummary,App.catalogueState.catalogue))){App.catalogueState.catalogue.creatorCardSummary=await CreatorCatalogueSummary.computeAuthoritative(App.context,[...App.catalog.values()],App.catalogueState.catalogue);await Catalogue.persist(App.context.creatorKey);} App.persistUIState();CompactGridScale.pendingReason='settings-save';UI.closeSettings('save'); App.render();
    },
    closeSettings(reason='cancel') { if(App.ui){App.ui.previewStatusBadgeSize=null;App.ui.settingsStatusBadgeTypes=null;App.ui.favoriteSyncUnsubscribe?.();App.ui.favoriteSyncUnsubscribe=null;}if (App.ui?.settingsOverlayId) OverlayManager.close(App.ui.settingsOverlayId,reason); },
  };

  const SettingsUI = {
    el(tag,className='',text=''){const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node;},
    section(title){const node=SettingsUI.el('section','pmf-settings-section');const heading=SettingsUI.el('h3','',title);node.append(heading);return node;},
    row(label,control,{chevron='',name=''}={}){const row=SettingsUI.el('div','pmf-settings-row');const text=SettingsUI.el('span','',label);row.append(text,control);if(chevron){const button=SettingsUI.el('button','pmf-settings-chevron','›');button.type='button';button.dataset.settingsChild=chevron;button.setAttribute('aria-label',`Configure ${label}`);row.append(button);}if(name)row.dataset.setting=name;return row;},
    select(name,value,options){const shell=SettingsUI.el('span','pmf-select-shell');const select=SettingsUI.el('select');select.name=name;options.forEach(([key,label])=>{const option=SettingsUI.el('option','',label);option.value=key;option.selected=key===value;select.append(option);});const arrow=SettingsUI.el('span','pmf-select-arrow','▾');arrow.setAttribute('aria-hidden','true');shell.append(select,arrow);return shell;},
    toggle(name,value,label,{child=''}={}){const input=document.createElement('input');input.type='checkbox';input.name=name;input.checked=Boolean(value);const wrap=SettingsUI.el('label','pmf-settings-toggle');wrap.append(input,SettingsUI.el('span','',label));return SettingsUI.row('',wrap,{chevron:child,name});},
    action(label,action,{danger=false}={}){const button=SettingsUI.el('button',danger?'pmf-danger':'',label);button.type='button';button.dataset.settingsAction=action;return button;},
    field(name,value,{textarea=false}={}){const input=SettingsUI.el(textarea?'textarea':'input');input.name=name;input.value=Array.isArray(value)?value.join(', '):value||'';return input;},
    panel(name,title=''){const panel=SettingsUI.el('div','pmf-settings-panel');panel.dataset.pmfSettingsPanel=name;if(title)panel.append(SettingsUI.el('h2','pmf-settings-tab-title',title));return panel;},
    buildGeneral(draft){
      const panel=SettingsUI.panel('general','General');const cards=SettingsUI.section('Post cards');
      cards.append(
        SettingsUI.row('Post thumbnail size',SettingsUI.select('compactCardScale',draft.compactCardScale,[['small','Small'],['medium','Medium'],['big','Big']])),
        SettingsUI.row('Post thumbnail aspect ratio',SettingsUI.select('compactThumbnailAspectRatio',draft.compactThumbnailAspectRatio,[['16-9','16:9'],['4-3','4:3'],['1-1','1:1 (original)']])),
        SettingsUI.toggle('catalogueBadgesAlways',draft.catalogueBadges.alwaysShow,'Show attachment badges on post cards',{child:'post-attachment-badges'}),
        SettingsUI.toggle('postStatusBadgesEnabled',draft.postStatusBadges.enabled,'Show status badges on post cards',{child:'post-status-badges'}),
        SettingsUI.toggle('seenCardTreatmentEnabled',draft.seenCardTreatment.enabled,'Dim seen post cards',{child:'seen-dim'})
      );
      const creators=SettingsUI.section('Creator cards');creators.append(
        SettingsUI.toggle('creatorCardBadgesEnabled',draft.creatorCardBadges.enabled,'Show attachment badges on creator cards',{child:'creator-attachment-badges'}),
        SettingsUI.toggle('creatorStatusBadgesEnabled',draft.creatorStatusBadges.enabled,'Show status badges on creator cards',{child:'creator-status-badges'}),
        SettingsUI.toggle('hiddenCreatorTreatmentEnabled',draft.hiddenCreatorTreatment.enabled,'Dim hidden creator cards',{child:'hidden-creator-dim'})
      );
      panel.append(cards,creators);return panel;
    },
    buildDetection(draft){
      const panel=SettingsUI.panel('default-detection','Default detection');
      const files=SettingsUI.section('Default file types');
      [['videoExtensions','Videos'],['imageExtensions','Images'],['archiveExtensions','Archives'],['projectExtensions','Project files']].forEach(([name,label])=>files.append(SettingsUI.row(label,SettingsUI.field(name,draft[name],{textarea:true}))));
      const evidence=SettingsUI.section('Project-file evidence');
      [['attachmentFilenames','Attachment filenames'],['title','Post title'],['tags','Tags'],['content','Description']].forEach(([key,label])=>evidence.append(SettingsUI.toggle(`project-${key}`,draft.projectEvidence[key],label)));
      evidence.append(SettingsUI.row('Project file search keywords',SettingsUI.field('projectKeywords',draft.projectKeywords,{textarea:true})));
      const links=SettingsUI.section('External-link scope');links.append(SettingsUI.row('Match links',SettingsUI.select('externalLinkScope',draft.externalLinkScope,[['media-download','Media and download links'],['any','Any external link']])),SettingsUI.row('Known media and download hosts',SettingsUI.field('knownHosts',draft.knownHosts,{textarea:true})));
      panel.append(files,evidence,links);return panel;
    },
    buildScanning(draft){
      const panel=SettingsUI.panel('scanning','Scanning');const behavior=SettingsUI.section('Scan behavior');
      behavior.append(SettingsUI.toggle('confirmCreatorCardScan',draft.confirmCreatorCardScan,'Confirm creator card scans'),SettingsUI.toggle('synchronizeNativeFavorites',draft.synchronizeNativeFavorites,'Synchronize native favorites during Scan and Update'));
      const queue=SettingsUI.section('Queue and concurrency');queue.append(SettingsUI.row('Concurrent creator scans',SettingsUI.select('catalogueConcurrentJobs',String(draft.catalogueConcurrentJobs),[['1','1'],['2','2']])));
      panel.append(behavior,queue);return panel;
    },
    buildData(draft){
      const panel=SettingsUI.panel('data','Data & performance');const requests=SettingsUI.section('Requests');
      requests.append(SettingsUI.row('Optional detail request concurrency',SettingsUI.select('concurrency',String(draft.concurrency),Array.from({length:10},(_,index)=>[String(index+1),String(index+1)]))),SettingsUI.toggle('retryFailed',draft.retryFailed,'Retry failed optional detail requests'));
      const favorites=SettingsUI.section('Native Favorites');const actions=SettingsUI.el('div','pmf-settings-actions');actions.append(SettingsUI.action('Synchronize native favorites now','sync-favorites'),SettingsUI.action('Stop synchronization','stop-favorites'));favorites.append(actions);
      const stored=SettingsUI.section('Stored Catalogue');const clear=SettingsUI.el('div','pmf-settings-actions');clear.append(SettingsUI.action("Clear this creator's full catalogue scan",'clear-creator',{danger:true}),SettingsUI.action('Clear all full catalogue scans','clear-all',{danger:true}));stored.append(clear);
      panel.append(requests,favorites,stored);return panel;
    },
    showChild(name){
      const dialog=App.ui?.settings?.querySelector?.('.pmf-settings-dialog');if(!dialog)return;const draft=App.ui.settingsDraft;const content=dialog.querySelector('.pmf-settings-content');App.ui.settingsParentScroll=content.scrollTop;content.replaceChildren();
      const child=SettingsUI.el('div','pmf-settings-child');const back=SettingsUI.action('‹ Back to settings','child-back');back.classList.add('pmf-settings-back');const childTitle=name==='seen-dim'?'Dim seen post cards':name==='hidden-creator-dim'?'Hidden creator-card appearance':name==='creator-status-badges'?'Creator-card status badges':name==='post-status-badges'?'Post status badges':name==='creator-attachment-badges'?'Creator card attachment badges':'Post card attachment badges';child.append(back,SettingsUI.el('h2','',childTitle));
      if(name==='seen-dim'||name==='hidden-creator-dim'){
        const creator=name==='hidden-creator-dim';const setting=creator?draft.hiddenCreatorTreatment:draft.seenCardTreatment;const appearance=SettingsUI.section('Appearance');const strength=SettingsUI.select(creator?'hiddenCreatorTreatmentStrength':'seenCardTreatmentStrength',setting.strength,[['low','Low'],['medium','Medium'],['high','High']]);strength.querySelector('select').disabled=!setting.enabled;appearance.append(SettingsUI.row('Dim strength',strength));child.append(appearance);
      }else{
        const status=name==='post-status-badges';const creatorStatus=name==='creator-status-badges';const creator=name==='creator-attachment-badges';const key=status?'postStatusBadges':creatorStatus?'creatorStatusBadges':creator?'creatorCardBadges':'catalogueBadges';const choices=status?[['favorited','Favorited'],['liked','Liked'],['seen','Seen']]:creatorStatus?[['favorited','Favorited'],['liked','Liked'],['hidden','Hidden']]:[['videos','Videos'],['images','Images'],['archives','Archives'],['projectFiles','Project files'],['externalLinks','External links']];
        const sizeName=status?'postStatusBadgeSize':creatorStatus?'creatorStatusBadgeSize':creator?'creatorAttachmentBadgeSize':'postAttachmentBadgeSize';const appearance=SettingsUI.section('Appearance');appearance.append(SettingsUI.row(status?'Post status badge size':creatorStatus?'Badge size':'Attachment badge size',SettingsUI.select(sizeName,draft[sizeName],[['small','Small'],['medium','Medium'],['big','Big']])));if(creator){appearance.append(SettingsUI.row('Count method',SettingsUI.select('creatorCardBadgeCountMode',draft.creatorCardBadgeCountMode,[['posts','Matching posts'],['attachments','Attachments / links']])));appearance.append(SettingsUI.toggle('excludePostsWithMissingAttachments',draft.excludePostsWithMissingAttachments,'Hide and don’t count posts with missing attachments'));}const visible=SettingsUI.section(status?'Visible statuses':creatorStatus?'Visible badges':'Visible badge types');choices.forEach(([field,label])=>visible.append(SettingsUI.toggle(`child-${key}-${field}`,draft[key].types[field],label)));child.append(appearance,visible);
      }
      content.append(child);App.ui.settingsChild=name;
    },
    collect(dialog,draft){
      const get=(name)=>dialog.querySelector(`[name="${name}"]`);const readExtensions=(name)=>Util.normalizeExtensions(String(get(name)?.value||draft[name].join(',')).split(/[\s,]+/)).values;
      return Settings.normalize({...draft,compactCardScale:get('compactCardScale')?.value||draft.compactCardScale,compactThumbnailAspectRatio:get('compactThumbnailAspectRatio')?.value||draft.compactThumbnailAspectRatio,
        postAttachmentBadgeSize:get('postAttachmentBadgeSize')?.value||draft.postAttachmentBadgeSize,creatorAttachmentBadgeSize:get('creatorAttachmentBadgeSize')?.value||draft.creatorAttachmentBadgeSize,postStatusBadgeSize:get('postStatusBadgeSize')?.value||draft.postStatusBadgeSize,creatorStatusBadgeSize:get('creatorStatusBadgeSize')?.value||draft.creatorStatusBadgeSize,creatorCardBadgeCountMode:get('creatorCardBadgeCountMode')?.value||draft.creatorCardBadgeCountMode,excludePostsWithMissingAttachments:get('excludePostsWithMissingAttachments')?.checked??draft.excludePostsWithMissingAttachments,
        confirmCreatorCardScan:get('confirmCreatorCardScan')?.checked??draft.confirmCreatorCardScan,synchronizeNativeFavorites:get('synchronizeNativeFavorites')?.checked??draft.synchronizeNativeFavorites,
        catalogueConcurrentJobs:Number(get('catalogueConcurrentJobs')?.value||draft.catalogueConcurrentJobs),concurrency:Number(get('concurrency')?.value||draft.concurrency),retryFailed:get('retryFailed')?.checked??draft.retryFailed,
        externalLinkScope:get('externalLinkScope')?.value||draft.externalLinkScope,videoExtensions:readExtensions('videoExtensions'),imageExtensions:readExtensions('imageExtensions'),archiveExtensions:readExtensions('archiveExtensions'),projectExtensions:readExtensions('projectExtensions'),
        projectKeywords:String(get('projectKeywords')?.value||draft.projectKeywords.join('\n')).split(/\n+/).map((value)=>value.trim()).filter(Boolean),knownHosts:String(get('knownHosts')?.value||draft.knownHosts.join('\n')).split(/[\s,]+/).filter(Boolean),
        projectEvidence:Object.fromEntries(Object.keys(draft.projectEvidence).map((key)=>[key,get(`project-${key}`)?.checked??draft.projectEvidence[key]])),
        catalogueBadges:{...draft.catalogueBadges,alwaysShow:get('catalogueBadgesAlways')?.checked??draft.catalogueBadges.alwaysShow},creatorCardBadges:{...draft.creatorCardBadges,enabled:get('creatorCardBadgesEnabled')?.checked??draft.creatorCardBadges.enabled},
        postStatusBadges:{...draft.postStatusBadges,enabled:get('postStatusBadgesEnabled')?.checked??draft.postStatusBadges.enabled},creatorStatusBadges:{...draft.creatorStatusBadges,enabled:get('creatorStatusBadgesEnabled')?.checked??draft.creatorStatusBadges.enabled},seenCardTreatment:{...draft.seenCardTreatment,enabled:get('seenCardTreatmentEnabled')?.checked??draft.seenCardTreatment.enabled,strength:get('seenCardTreatmentStrength')?.value||draft.seenCardTreatment.strength},hiddenCreatorTreatment:{...draft.hiddenCreatorTreatment,enabled:get('hiddenCreatorTreatmentEnabled')?.checked??draft.hiddenCreatorTreatment.enabled,strength:get('hiddenCreatorTreatmentStrength')?.value||draft.hiddenCreatorTreatment.strength}});
    },
    renderParent(active='general'){
      const dialog=App.ui.settings.querySelector('.pmf-settings-dialog');const content=dialog.querySelector('.pmf-settings-content');const draft=App.ui.settingsDraft;content.replaceChildren(SettingsUI.buildGeneral(draft),SettingsUI.buildDetection(draft),SettingsUI.buildScanning(draft),SettingsUI.buildData(draft));dialog.querySelectorAll('[data-pmf-settings-tab]').forEach((button)=>button.classList.toggle('pmf-active',button.dataset.pmfSettingsTab===active));content.querySelectorAll('[data-pmf-settings-panel]').forEach((panel)=>panel.hidden=panel.dataset.pmfSettingsPanel!==active);content.scrollTop=App.ui.settingsParentScroll||0;App.ui.settingsChild='';
    },
    preview(dialog){
      const draft=SettingsUI.collect(dialog,App.ui.settingsDraft);App.ui.settingsDraft=draft;App.ui.previewStatusBadgeSize=draft.postStatusBadgeSize;
      const priorSize=App.filteredPageSize();const matches=App.matchingPosts();App.filteredFirstResultIndex=Math.max(0,(App.filteredPage-1)*priorSize);App.filteredAnchorId=matches[App.filteredFirstResultIndex]?.id||App.filteredAnchorId;CompactLayoutEngine.preview({scale:draft.compactCardScale,ratio:draft.compactThumbnailAspectRatio});AttachmentBadgeSizing.preview('post',draft.postAttachmentBadgeSize);AttachmentBadgeSizing.preview('creator',draft.creatorAttachmentBadgeSize);const nextSize=App.filteredPageSize();if(nextSize!==priorSize){App.restoreFirstResultPage(matches.length);App.render();}
      App.ui?.grid?.querySelectorAll?.('article.post-card[data-id]').forEach((card)=>{const post=App.catalog.get(String(card.dataset.id));PostStatusBadgeRenderer.apply(card,post);SeenCardTreatment.apply(card,post);});
    },
    open(){
      UI.closeSettings('reopen');const draft=Util.clone(Settings.value);const backdrop=SettingsUI.el('div','pmf-modal-backdrop');const dialog=SettingsUI.el('section','pmf-dialog pmf-settings-dialog pmf-surface');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
      const header=SettingsUI.el('header');header.append(SettingsUI.el('strong','','Media Filter settings'));const close=SettingsUI.action('×','cancel');close.classList.add('pmf-icon-close');header.append(close);
      const layout=SettingsUI.el('div','pmf-settings-layout');const nav=SettingsUI.el('nav');[['general','General'],['default-detection','Default detection'],['scanning','Scanning'],['data','Data & performance']].forEach(([key,label])=>{const button=SettingsUI.action(label,'tab');button.dataset.pmfSettingsTab=key;nav.append(button);});const content=SettingsUI.el('div','pmf-settings-content');layout.append(nav,content);
      const footer=SettingsUI.el('footer');footer.append(SettingsUI.action('Reset all settings','reset'),SettingsUI.el('span'),SettingsUI.action('Cancel','cancel'));const save=SettingsUI.action('Save & apply','save');save.classList.add('pmf-primary');footer.append(save);dialog.append(header,layout,footer);backdrop.append(dialog);App.ui.root.append(backdrop);
      App.ui.settings=backdrop;App.ui.settingsDraft=draft;App.ui.settingsOpeningSnapshot=Util.clone(Settings.value);App.ui.settingsPreview={compactCardScale:Settings.value.compactCardScale,compactThumbnailAspectRatio:Settings.value.compactThumbnailAspectRatio,postAttachmentBadgeSize:Settings.value.postAttachmentBadgeSize,creatorAttachmentBadgeSize:Settings.value.creatorAttachmentBadgeSize,committed:false};
      App.ui.settingsOverlayId=OverlayManager.open({node:dialog,root:backdrop,modal:true,onClose:(reason)=>{const preview=App.ui?.settingsPreview;if(preview&&!preview.committed){CompactLayoutEngine.restorePreview({apply:true});AttachmentBadgeSizing.restorePreview();App.render();}if(App.ui){App.ui.previewStatusBadgeSize=null;App.ui.settings=null;App.ui.settingsDraft=null;App.ui.settingsOverlayId=null;}Logger.info({operation:'settings-close',reason});}});
      SettingsUI.renderParent();
      backdrop.addEventListener('click',async(event)=>{const action=event.target.closest('[data-settings-action]')?.dataset.settingsAction;const tab=event.target.closest('[data-pmf-settings-tab]')?.dataset.pmfSettingsTab;const child=event.target.closest('[data-settings-child]')?.dataset.settingsChild;if(tab)SettingsUI.renderParent(tab);if(child){App.ui.settingsDraft=SettingsUI.collect(dialog,App.ui.settingsDraft);SettingsUI.showChild(child);}if(action==='child-back')SettingsUI.renderParent('general');if(action==='cancel')UI.closeSettings('cancel');if(action==='save'){App.ui.settingsDraft=SettingsUI.collect(dialog,App.ui.settingsDraft);Settings.save(App.ui.settingsDraft);App.ui.settingsPreview.committed=true;CompactLayoutEngine.restorePreview({apply:false});AttachmentBadgeSizing.commit();CatalogueJobManager.setConcurrency(Settings.value.catalogueConcurrentJobs);UI.closeSettings('save');App.render();App.persistUIState();}if(action==='reset'){App.ui.settingsDraft=Util.clone(DefaultSettings);SettingsUI.renderParent('general');SettingsUI.preview(dialog);}if(action==='sync-favorites')await FavoriteSyncCoordinator.run({manual:true});if(action==='stop-favorites')FavoriteSyncCoordinator.stop();if(action==='clear-creator')UI.confirmClear('catalogue-creator');if(action==='clear-all')UI.confirmClear('catalogue-all');});
      backdrop.addEventListener('change',(event)=>{if(App.ui.settingsChild){const current=App.ui.settingsDraft;const name=event.target.name;if(name==='seenCardTreatmentStrength')current.seenCardTreatment.strength=event.target.value;else if(name==='hiddenCreatorTreatmentStrength')current.hiddenCreatorTreatment.strength=event.target.value;else if(['postAttachmentBadgeSize','creatorAttachmentBadgeSize','postStatusBadgeSize','creatorStatusBadgeSize','creatorCardBadgeCountMode'].includes(name))current[name]=event.target.value;else if(name?.startsWith('child-')){const [,key,...fieldParts]=name.split('-');current[key].types[fieldParts.join('-')]=event.target.checked;}SettingsUI.preview(dialog);}else SettingsUI.preview(dialog);});
    },
  };

  UI.openSettings=SettingsUI.open;

  const CreatorQueuePanel = {
    render(snapshot=CatalogueJobManager.snapshot()) {
      const host=CreatorIndexUI.queuePanel;if(!host)return;const selectedTab=host.querySelector('[data-queue-tab].pmf-active')?.dataset.queueTab||host.dataset.selectedTab||'queue',scrollTop=host.scrollTop,openDetails=new Set([...host.querySelectorAll('details[open][data-detail-key]')].map((item)=>item.dataset.detailKey));const active=snapshot.active||[],waiting=snapshot.pending||[],issues=snapshot.issues||[],recent=snapshot.recent||[],complete=recent.filter((job)=>job.status==='complete'),batches=snapshot.batches||[],overall=CatalogueJobManager.aggregate(snapshot),total=overall.total,completed=overall.finished,percent=total?Math.round(completed/total*100):0;
      const row=(job,kind)=>{const progress=job.progress||{};const progressValue=progress.totalPages?Math.round((Number(progress.page)||0)/progress.totalPages*100):progress.total?Math.round((Number(progress.completed)||0)/progress.total*100):0;const actions=kind==='active'?'<button data-queue-action="stop">Stop</button>':kind==='waiting'?'<button data-queue-action="top">Move to top</button><button data-queue-action="remove">Remove</button>':kind==='complete'?'': '<button data-queue-action="retry">Retry</button><button data-queue-action="dismiss">Dismiss</button>';return`<div class="pmf-queue-row" data-creator-key="${Util.escapeHtml(job.creatorKey)}"><div><strong>${Util.escapeHtml(job.creatorName||job.context?.creatorId||'Creator')}</strong><small>${Util.escapeHtml(progress.message||`${job.kind||job.requestedAction} · ${job.status}`)}</small>${kind==='active'?`<progress max="100" value="${progressValue}" aria-label="${Util.escapeHtml(job.creatorName||'Creator')} progress"></progress>`:''}</div><span>${actions}</span></div>`;};
      const batchCards=batches.map((batch)=>{const counts=CatalogueJobManager.batchCounts(batch.id),batchPercent=counts.total?Math.round(counts.finished/counts.total*100):0;return`<section class="pmf-queue-batch" data-batch-id="${Util.escapeHtml(batch.id)}"><strong>${Util.escapeHtml(batch.label||'Creator batch')}</strong><span>${counts.finished} of ${counts.total} finished · ${counts.remaining} remaining</span><progress max="100" value="${batchPercent}" aria-label="${Util.escapeHtml(batch.label||'Creator batch')}: ${counts.finished} of ${counts.total} finished"></progress>${counts.remaining?'<button data-queue-action="cancel-batch">Cancel remaining</button>':''}</section>`;}).join('');
      const retained=Boolean(active.length||waiting.length||recent.length||issues.length||batches.length);host.innerHTML=`<div class="pmf-queue-tabs"><button data-queue-tab="queue" class="pmf-active">Queue</button><button data-queue-tab="issues">Issues${issues.length?` (${issues.length})`:''}</button></div><div data-queue-pane="queue"><section class="pmf-queue-progress"><strong>Overall batch progress</strong><span>${overall.finished} of ${overall.total} finished · ${overall.remaining} remaining · ${overall.active} active</span><progress max="100" value="${percent}" aria-label="${overall.finished} of ${overall.total} operations finished"></progress><small>Concurrency: ${CatalogueJobManager.concurrency}</small></section>${batchCards}${active.length?`<h3>Active</h3>${active.map((job)=>row(job,'active')).join('')}`:''}${waiting.length?`<h3>Waiting</h3>${waiting.map((job)=>row(job,'waiting')).join('')}`:''}${complete.length?`<details data-detail-key="recent-completed"><summary>Recently completed (${complete.length})</summary>${complete.map((job)=>row(job,'complete')).join('')}</details><button data-queue-action="clear-completed">Clear completed</button>`:''}${!retained?'<p class="pmf-help">Queue empty</p>':!overall.remaining&&!active.length?'<p class="pmf-help">Queue idle</p>':''}</div><div data-queue-pane="issues" hidden>${issues.length?issues.map((job)=>row(job,'issue')).join(''):'<p class="pmf-help">No queue issues.</p>'}</div>`;
      host.querySelectorAll('[data-queue-tab]').forEach((button)=>button.classList.toggle('pmf-active',button.dataset.queueTab===selectedTab));host.querySelectorAll('[data-queue-pane]').forEach((pane)=>pane.hidden=pane.dataset.queuePane!==selectedTab);host.dataset.selectedTab=selectedTab;openDetails.forEach((key)=>{const details=host.querySelector(`details[data-detail-key="${key}"]`);if(details)details.open=true;});host.scrollTop=scrollTop;
      CreatorIndexUI.updateQueueLabel(snapshot);
    },
    handle(event) {
      const tab=event.target.closest('[data-queue-tab]')?.dataset.queueTab;if(tab){CreatorIndexUI.queuePanel.querySelectorAll('[data-queue-tab]').forEach((button)=>button.classList.toggle('pmf-active',button.dataset.queueTab===tab));CreatorIndexUI.queuePanel.querySelectorAll('[data-queue-pane]').forEach((pane)=>pane.hidden=pane.dataset.queuePane!==tab);return;}
      const action=event.target.closest('[data-queue-action]')?.dataset.queueAction;if(!action)return;const key=event.target.closest('[data-creator-key]')?.dataset.creatorKey;
      if(action==='stop')CatalogueJobManager.stop(key);if(action==='top')CatalogueJobManager.moveToTop(key);if(action==='remove')CatalogueJobManager.removeQueued(key);if(action==='dismiss')CatalogueJobManager.dismiss(key);if(action==='clear-completed')CatalogueJobManager.clearCompleted();if(action==='cancel-batch')CatalogueJobManager.cancelBatch(event.target.closest('[data-batch-id]')?.dataset.batchId);if(action==='retry')CatalogueJobManager.retry(key);CreatorQueuePanel.render();
    },
  };

  const LegacyCreatorIndexUI = {
    root:null,toolbar:null,grid:null,stateNode:null,paginator:null,queuePanel:null,queueButton:null,nativeGrid:null,nativeSnapshot:null,nativeGeometry:null,searchInput:null,searchController:null,records:[],page:1,pageSize:45,query:'',sort:{mode:'popularity',direction:'desc'},filterState:CreatorFilterEngine.normalizeState(GM_getValue(Config.creatorFilterStateKey,{})),statusFilters:CreatorStatusFilters.load(),unsubscribe:null,
    mount(found) {
      CreatorIndexUI.cleanup({restoreNative:false});const root=document.createElement('section');root.id='pmf-artists-root';root.dataset.pmfOwned='true';root.dataset.pmfInstance=INSTANCE_ID;const toolbar=document.createElement('section');toolbar.className='pmf-toolbar pmf-creator-index-toolbar';toolbar.innerHTML=`<div class="pmf-controls"><button class="pmf-filter-button" data-creator-index-action="filter">All creators</button><button class="pmf-sort-button" data-creator-index-action="sort">Sort: Popularity <span aria-hidden="true">▼</span></button><span class="pmf-split-primary"><button class="pmf-scan-button" data-creator-index-action="bulk-update">Update</button><button class="pmf-scan-button pmf-split-chevron" data-creator-index-action="bulk-menu" aria-label="More bulk operations" title="More bulk operations">▾</button></span><button class="pmf-icon-button" data-creator-index-action="settings" aria-label="Media Filter settings">${Icons.gear}</button></div><div class="pmf-status"><div class="pmf-status-left"><strong data-creator-matches>0 matches</strong></div><div class="pmf-status-actions"><button class="pmf-details-link" data-creator-index-action="queue">Queue empty</button></div><div class="pmf-status-right" data-creator-summary>Creator index</div></div><section class="pmf-catalogue-details pmf-creator-queue-panel" hidden></section>`;
      const paginator=document.createElement('div');paginator.className='pmf-filtered-paginator pmf-creator-index-paginator';paginator.innerHTML=`<div class="pmf-quick-status-filters" aria-label="Creator status filters"></div><small class="pmf-filtered-count"></small><div class="pmf-page-controls"></div>`;const quick=paginator.querySelector('.pmf-quick-status-filters');[['favorite',Icons.star,'Favorite creator filter'],['liked',Icons.heart,'Like creator filter'],['hidden',Icons.eye,'Hidden creator filter']].forEach(([field,icon,label])=>{const button=document.createElement('button');button.type='button';button.dataset.creatorStatusFilter=field;button.innerHTML=`<span class="pmf-quick-status-main">${icon}</span><span class="pmf-quick-status-negate">${Icons.x}</span>`;button.title=label;button.setAttribute('aria-label',label);quick.append(button);});
      const state=document.createElement('div');state.className='pmf-creator-index-state';state.dataset.pmfOwned='true';state.setAttribute('role','status');state.textContent='Loading creator index…';const grid=document.createElement('div');grid.className='pmf-creator-index-grid';grid.dataset.pmfOwned='true';root.append(toolbar,paginator,state,grid);found.grid.insertAdjacentElement('beforebegin',root);CreatorIndexUI.root=root;CreatorIndexUI.toolbar=toolbar;CreatorIndexUI.grid=grid;CreatorIndexUI.stateNode=state;CreatorIndexUI.paginator=paginator;CreatorIndexUI.queuePanel=toolbar.querySelector('.pmf-creator-queue-panel');CreatorIndexUI.queueButton=toolbar.querySelector('[data-creator-index-action="queue"]');CreatorIndexUI.nativeGrid=found.grid;CreatorIndexUI.nativeGeometry=CreatorGridGeometry.measure(found.grid);CreatorGridGeometry.apply(grid,CreatorIndexUI.nativeGeometry);CreatorIndexUI.searchInput=found.main.querySelector('input[type="search"],input[placeholder*="creator" i],input[placeholder*="artist" i]');CreatorIndexUI.nativeSnapshot=NativeArtistsVisibility.capture(found,CreatorIndexUI.searchInput);NativeArtistsVisibility.hide(CreatorIndexUI.nativeSnapshot);if(CreatorIndexUI.searchInput){CreatorIndexUI.searchController=new AbortController();const update=Util.debounce(()=>{CreatorIndexUI.query=CreatorIndexUI.searchInput.value.trim().toLocaleLowerCase();CreatorIndexUI.page=1;CreatorIndexUI.render();},180);CreatorIndexUI.searchInput.placeholder='Search creators…';CreatorIndexUI.searchInput.addEventListener('input',update,{signal:CreatorIndexUI.searchController.signal});CreatorIndexUI.searchInput.form?.addEventListener('submit',(event)=>{event.preventDefault();CreatorIndexUI.query=CreatorIndexUI.searchInput.value.trim().toLocaleLowerCase();CreatorIndexUI.page=1;CreatorIndexUI.render();},{signal:CreatorIndexUI.searchController.signal});CreatorIndexUI.searchController.signal.addEventListener('abort',()=>update.cancel(),{once:true});}
      root.addEventListener('click',(event)=>CreatorIndexUI.handle(event));CreatorIndexUI.queuePanel.addEventListener('click',(event)=>CreatorQueuePanel.handle(event));CreatorIndexUI.unsubscribe=CatalogueJobManager.subscribe((snapshot)=>CreatorQueuePanel.render(snapshot));return root;
    },
    setState(kind,message){if(!CreatorIndexUI.stateNode)return;CreatorIndexUI.stateNode.dataset.state=kind;CreatorIndexUI.stateNode.textContent=message||'';CreatorIndexUI.stateNode.hidden=!message;},
    setRecords(records){CreatorIndexUI.records=records;CreatorIndexUI.render();NativeArtistsVisibility.hide(CreatorIndexUI.nativeSnapshot);},
    filteredRecords() {
      const query=CreatorIndexUI.query;return CreatorSorter.sort(CreatorIndexUI.records.filter((record)=>{const text=`${record.directory.creatorName} ${record.directory.service} ${record.directory.creatorId}`.toLocaleLowerCase();return(!query||text.includes(query))&&CreatorStatusFilters.matches(record,CreatorIndexUI.statusFilters)&&CreatorFilterEngine.matches(record,CreatorIndexUI.filterState);}),CreatorIndexUI.sort);
    },
    render() {
      if(!CreatorIndexUI.grid)return;const records=CreatorIndexUI.filteredRecords();const totalPages=Math.max(1,Math.ceil(records.length/CreatorIndexUI.pageSize));CreatorIndexUI.page=Util.clamp(CreatorIndexUI.page,1,totalPages);const start=(CreatorIndexUI.page-1)*CreatorIndexUI.pageSize;const visible=records.slice(start,start+CreatorIndexUI.pageSize);CreatorIndexUI.grid.replaceChildren();
      visible.forEach((record)=>{const {card,link}=CreatorCardReconstructor.build(record);const info={card,link,context:{creatorKey:record.directory.creatorKey,domain:record.directory.domain,service:record.directory.service,creatorId:record.directory.creatorId,creatorUrl:record.directory.creatorUrl},creatorName:record.directory.creatorName,displayName:record.directory.creatorName,serviceLabel:CreatorDisplayName.serviceLabel(record.directory.service)};CreatorIndexUI.grid.append(card);CreatorCardRightRail.render(info,record.meta,record.state);});
      CreatorIndexUI.setState(records.length?'ready':'empty',records.length?'':'No creators match the current search and filters.');
      CreatorIndexUI.toolbar.querySelector('[data-creator-matches]').textContent=`✓ ${records.length} matches`;CreatorIndexUI.toolbar.querySelector('[data-creator-summary]').textContent=`Creator index · ${CreatorIndexUI.records.length} known`;CreatorIndexUI.paginator.querySelector('.pmf-filtered-count').textContent=records.length?`Showing ${start+1}–${Math.min(records.length,start+visible.length)} of ${records.length}`:'Showing 0 of 0';const controls=CreatorIndexUI.paginator.querySelector('.pmf-page-controls');controls.replaceChildren();const add=(label,page,disabled=false)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=disabled;button.dataset.creatorPage=String(page);if(page===CreatorIndexUI.page)button.setAttribute('aria-current','page');controls.append(button);};add('‹',CreatorIndexUI.page-1,CreatorIndexUI.page===1);for(let page=Math.max(1,CreatorIndexUI.page-2);page<=Math.min(totalPages,CreatorIndexUI.page+2);page+=1)add(String(page),page);add('›',CreatorIndexUI.page+1,CreatorIndexUI.page===totalPages);CreatorIndexUI.updateQuickFilters();
    },
    updateQuickFilters(){CreatorIndexUI.paginator?.querySelectorAll('[data-creator-status-filter]').forEach((button)=>{const mode=CreatorIndexUI.statusFilters[button.dataset.creatorStatusFilter];button.classList.toggle('pmf-match',mode==='match');button.classList.toggle('pmf-no-match',mode==='no-match');button.setAttribute('aria-pressed',mode==='off'?'false':mode==='match'?'true':'mixed');button.title=`${button.dataset.creatorStatusFilter} filter: ${mode}`;});},
    updateQueueLabel(snapshot=CatalogueJobManager.snapshot()){if(!CreatorIndexUI.queueButton)return;const issues=(snapshot.issues||[]).length;CreatorIndexUI.queueButton.textContent=snapshot.active.length||snapshot.pending.length||issues?`Queue · ${snapshot.active.length} active · ${snapshot.pending.length} waiting${issues?` · ${issues} issue${issues===1?'':'s'}`:''}`:'Queue empty';},
    handle(event) {
      const status=event.target.closest('[data-creator-status-filter]')?.dataset.creatorStatusFilter;if(status){CreatorIndexUI.statusFilters[status]=CreatorStatusFilters.cycle(CreatorIndexUI.statusFilters[status]);CreatorStatusFilters.save(CreatorIndexUI.statusFilters);CreatorIndexUI.page=1;CreatorIndexUI.render();return;}const page=event.target.closest('[data-creator-page]')?.dataset.creatorPage;if(page){CreatorIndexUI.page=Number(page);CreatorIndexUI.render();return;}const action=event.target.closest('[data-creator-index-action]')?.dataset.creatorIndexAction;
      if(action==='queue'){CreatorIndexUI.queuePanel.hidden=!CreatorIndexUI.queuePanel.hidden;return;}if(action==='settings'){CreatorSettingsUI.open(event.target);return;}if(action==='filter'){CreatorFilterUI.open(event.target);return;}if(action==='sort'){CreatorSortUI.open(event.target);return;}if(action==='bulk-update'){CreatorBulkUI.open('update',event.target);return;}if(action==='bulk-menu'){CreatorBulkUI.openMenu(event.target);return;}
    },
    cleanup({restoreNative=true}={}){CreatorIndexUI.unsubscribe?.();CreatorIndexUI.unsubscribe=null;CreatorIndexUI.searchController?.abort();CreatorIndexUI.searchController=null;if(restoreNative)NativeArtistsVisibility.restore(CreatorIndexUI.nativeSnapshot);CreatorIndexUI.root?.remove();CreatorIndexUI.root=null;CreatorIndexUI.toolbar=null;CreatorIndexUI.grid=null;CreatorIndexUI.stateNode=null;CreatorIndexUI.paginator=null;CreatorIndexUI.queuePanel=null;CreatorIndexUI.queueButton=null;CreatorIndexUI.nativeGrid=null;CreatorIndexUI.nativeSnapshot=null;CreatorIndexUI.nativeGeometry=null;CreatorIndexUI.searchInput=null;CreatorIndexUI.records=[];},
  };

  const CreatorIndexUI = {
    root:null,modeSelector:null,toolbar:null,grid:null,stateNode:null,paginator:null,queuePanel:null,queueButton:null,found:null,nativeGrid:null,nativeSnapshot:null,nativeGeometry:null,searchInput:null,searchController:null,records:[],nativeRecords:[],page:1,pageSize:50,query:'',mode:CreatorDirectoryMode.load(),nativeScannedFilter:'off',sort:{mode:'popularity',direction:'desc'},filterState:CreatorFilterEngine.normalizeState(GM_getValue(Config.creatorFilterStateKey,{})),statusFilters:CreatorStatusFilters.load(),unsubscribe:null,
    mount(found) {
      CreatorIndexUI.cleanup({restoreNative:false});Object.assign(CreatorIndexUI,{found,nativeGrid:found.grid,nativeGeometry:CreatorGridGeometry.measure(found.grid),searchInput:found.searchInput,nativeSnapshot:NativeArtistsVisibility.capture(found)});CreatorCardReconstructor.capture(ArtistsDOM.creatorCards(found,{nativeOnly:true})[0]);
      const modeSelector=document.createElement('div');modeSelector.id='pmf-creator-mode-selector';modeSelector.dataset.pmfOwned='true';modeSelector.setAttribute('role','group');modeSelector.setAttribute('aria-label','Creator directory mode');modeSelector.innerHTML='<span>Directory mode</span><div class="pmf-mode-segments"><button type="button" data-creator-mode="native">Native directory</button><button type="button" data-creator-mode="catalogue">Catalogue</button></div>';if(found.searchForm)found.searchForm.append(modeSelector);else found.searchInput?.insertAdjacentElement('afterend',modeSelector);const searchWidth=Math.round(found.searchInput?.getBoundingClientRect?.().width||0);if(searchWidth)modeSelector.style.setProperty('--pmf-search-control-width',`${searchWidth}px`);
      const root=document.createElement('section');root.id='pmf-artists-root';root.dataset.pmfOwned='true';root.dataset.pmfInstance=INSTANCE_ID;const toolbar=document.createElement('section');toolbar.className='pmf-toolbar pmf-creator-index-toolbar';const paginator=document.createElement('div');paginator.className='pmf-filtered-paginator pmf-creator-index-paginator';const state=document.createElement('div');state.className='pmf-creator-index-state';state.dataset.pmfOwned='true';state.setAttribute('role','status');const grid=document.createElement('div');grid.className='pmf-creator-index-grid';grid.dataset.pmfOwned='true';root.append(toolbar,paginator,state,grid);found.grid.insertAdjacentElement('beforebegin',root);CreatorGridGeometry.apply(grid,CreatorIndexUI.nativeGeometry);Object.assign(CreatorIndexUI,{root,modeSelector,toolbar,paginator,stateNode:state,grid});
      modeSelector.addEventListener('click',(event)=>{const mode=event.target.closest('[data-creator-mode]')?.dataset.creatorMode;if(mode)CreatorIndexUI.setMode(mode);});root.addEventListener('click',(event)=>{if(event.target.closest('[data-queue-action],[data-queue-tab]'))CreatorQueuePanel.handle(event);else CreatorIndexUI.handle(event);});root.addEventListener('change',(event)=>CreatorIndexUI.handleChange(event));CreatorIndexUI.unsubscribe=CatalogueJobManager.subscribe((snapshot)=>CreatorQueuePanel.render(snapshot));CreatorIndexUI.applyMode({refresh:false});return root;
    },
    sortLabel(){const item=CreatorSortUI.modes.find(([mode])=>mode===CreatorIndexUI.sort.mode);return`${item?.[1]||'Popularity'} ${CreatorIndexUI.sort.direction==='asc'?'▲':'▼'}`;},
    chrome(){
      const native=CreatorIndexUI.mode==='native';CreatorIndexUI.toolbar.innerHTML=native?`<div class="pmf-controls pmf-native-proxy-controls"><button class="pmf-filter-button pmf-menu-trigger" data-creator-index-action="native-service" aria-haspopup="menu"><span data-proxy-label>Any service</span><span aria-hidden="true">▾</span></button><button class="pmf-sort-button pmf-menu-trigger" data-creator-index-action="native-sort" aria-haspopup="menu"><span data-proxy-label>Sort</span><span data-proxy-direction aria-hidden="true">▼</span></button><span class="pmf-split-primary"><button class="pmf-scan-button" data-creator-index-action="bulk-primary">Scan</button><button class="pmf-scan-button pmf-split-chevron" data-creator-index-action="bulk-menu" aria-label="More scan actions" aria-haspopup="menu">▾</button></span><button class="pmf-icon-button" data-creator-index-action="settings" aria-label="Media Filter settings">${Icons.gear}</button></div>`:`<div class="pmf-controls"><button class="pmf-filter-button" data-creator-index-action="filter">All Catalogue creators</button><button class="pmf-sort-button" data-creator-index-action="sort" aria-haspopup="menu">Sort: ${CreatorIndexUI.sortLabel()}</button><span class="pmf-split-primary"><button class="pmf-scan-button" data-creator-index-action="bulk-primary">Update</button><button class="pmf-scan-button pmf-split-chevron" data-creator-index-action="bulk-menu" aria-label="More update actions" aria-haspopup="menu">▾</button></span><button class="pmf-icon-button" data-creator-index-action="settings" aria-label="Media Filter settings">${Icons.gear}</button></div>`;
      CreatorIndexUI.toolbar.insertAdjacentHTML('beforeend',`<div class="pmf-status ${native?'pmf-native-status':''}"><div class="pmf-status-actions"><button class="pmf-details-link" data-creator-index-action="queue">Queue empty</button></div>${native?'':'<div class="pmf-status-left"><strong data-creator-matches>0 matches</strong></div>'}<div class="pmf-status-right" data-creator-summary></div></div><section class="pmf-catalogue-details pmf-creator-queue-panel" hidden></section>`);CreatorIndexUI.queuePanel=CreatorIndexUI.toolbar.querySelector('.pmf-creator-queue-panel');CreatorIndexUI.queueButton=CreatorIndexUI.toolbar.querySelector('[data-creator-index-action="queue"]');CreatorQueuePanel.render();return !native||NativeArtistsProxy.sync(CreatorIndexUI.found,CreatorIndexUI.toolbar);
    },
    quickButton(field,icon,label){const button=document.createElement('button');button.type='button';button.dataset.creatorStatusFilter=field;button.innerHTML=`<span class="pmf-quick-status-main">${icon}</span><span class="pmf-quick-status-negate">${Icons.x}</span>`;button.setAttribute('aria-label',label);return button;},
    buildPaginator(){
      CreatorIndexUI.paginator.replaceChildren();const quick=document.createElement('div');quick.className='pmf-quick-status-filters';quick.setAttribute('aria-label','Creator status filters');if(CreatorIndexUI.mode==='native')quick.append(CreatorIndexUI.quickButton('native-scanned',Icons.check,'Hide scanned creators on this Pawchive page'));else[['favorite',Icons.star,'Favorite creator filter'],['liked',Icons.heart,'Like creator filter'],['hidden',Icons.eye,'Hidden creator filter']].forEach(([field,icon,label])=>quick.append(CreatorIndexUI.quickButton(field,icon,label)));CreatorIndexUI.paginator.append(quick);if(CreatorIndexUI.mode==='native'){const mirror=document.createElement('div');mirror.className='pmf-native-paginator-mirror';CreatorIndexUI.paginator.append(mirror);NativeArtistsProxy.paginator(CreatorIndexUI.found,mirror);}else CreatorIndexUI.paginator.insertAdjacentHTML('beforeend','<small class="pmf-filtered-count"></small><div class="pmf-page-controls"></div>');CreatorIndexUI.updateQuickFilters();
    },
    bindSearch(){
      CreatorIndexUI.searchController?.abort();CreatorIndexUI.searchController=null;const input=CreatorIndexUI.searchInput;if(!input)return;if(CreatorIndexUI.mode==='native'){input.placeholder=CreatorIndexUI.nativeSnapshot.searchPlaceholder;return;}const controller=new AbortController();CreatorIndexUI.searchController=controller;const update=Util.debounce(()=>{CreatorIndexUI.query=input.value.trim().toLocaleLowerCase();CreatorIndexUI.page=1;CreatorIndexUI.render();},180);input.placeholder='Search Catalogue creators…';input.addEventListener('input',update,{signal:controller.signal});input.form?.addEventListener('submit',(event)=>{event.preventDefault();CreatorIndexUI.query=input.value.trim().toLocaleLowerCase();CreatorIndexUI.page=1;CreatorIndexUI.render();},{signal:controller.signal});controller.signal.addEventListener('abort',()=>update.cancel(),{once:true});
    },
    setMode(value){const mode=CreatorDirectoryMode.save(value);if(mode===CreatorIndexUI.mode)return;OverlayManager.closeAll('creator-mode-switch');CreatorIndexUI.mode=mode;CreatorIndexUI.page=1;CreatorIndexUI.query='';CreatorIndexUI.applyMode();ArtistsPageController.requestRefresh('mode-switch');},
    applyMode({refresh=true}={}){if(!CreatorIndexUI.root)return;CreatorIndexUI.modeSelector.querySelectorAll('[data-creator-mode]').forEach((button)=>{const active=button.dataset.creatorMode===CreatorIndexUI.mode;button.classList.toggle('pmf-active',active);button.setAttribute('aria-pressed',String(active));});const ready=CreatorIndexUI.chrome();CreatorIndexUI.buildPaginator();CreatorIndexUI.bindSearch();NativeArtistsVisibility.apply(CreatorIndexUI.nativeSnapshot,CreatorIndexUI.mode,{proxiesReady:ready});CreatorIndexUI.grid.hidden=CreatorIndexUI.mode==='native';CreatorIndexUI.stateNode.hidden=true;if(refresh)CreatorIndexUI.render();},
    setState(kind,message){if(!CreatorIndexUI.stateNode)return;CreatorIndexUI.stateNode.dataset.state=kind;CreatorIndexUI.stateNode.textContent=message||'';CreatorIndexUI.stateNode.hidden=!message;},
    setRecords(records,nativeRecords=[]){CreatorIndexUI.records=records.filter((record)=>record.scanned);CreatorIndexUI.nativeRecords=nativeRecords;CreatorIndexUI.render();},
    filteredRecords(){if(CreatorIndexUI.mode==='native')return CreatorIndexUI.nativeRecords.filter((record)=>CreatorIndexUI.nativeScannedFilter!=='no-match'||!record.scanned);const query=CreatorIndexUI.query;return CreatorSorter.sort(CreatorIndexUI.records.filter((record)=>{const text=`${record.directory.creatorName} ${record.directory.service} ${record.directory.creatorId}`.toLocaleLowerCase();return(!query||text.includes(query))&&CreatorStatusFilters.matches(record,CreatorIndexUI.statusFilters)&&CreatorFilterEngine.matches(record,CreatorIndexUI.filterState);}),CreatorIndexUI.sort);},
    visibleRecords(){const records=CreatorIndexUI.filteredRecords();if(CreatorIndexUI.mode==='native')return records.filter((record)=>record.nativeInfo?.card?.isConnected&&!record.nativeInfo.card.hidden);const start=(CreatorIndexUI.page-1)*CreatorIndexUI.pageSize;return records.slice(start,start+CreatorIndexUI.pageSize);},
    context(record){return{creatorKey:record.directory.creatorKey,domain:record.directory.domain,service:record.directory.service,creatorId:record.directory.creatorId,creatorUrl:record.directory.creatorUrl};},
    decorateNative(){
      const visible=CreatorIndexUI.filteredRecords();const included=new Set(visible.map((record)=>record.directory.creatorKey));CreatorIndexUI.nativeRecords.forEach((record)=>{const info=record.nativeInfo;if(!info)return;info.card.hidden=!included.has(record.directory.creatorKey);info.card.dataset.pmfCreatorKey=record.directory.creatorKey;CreatorCardRightRail.render(info,record.meta,record.state);});ArtistsPageController.cards=visible.map((record)=>record.nativeInfo).filter(Boolean);ArtistsPageController.cardByElement=new Map(ArtistsPageController.cards.map((info)=>[info.card,info]));const summary=CreatorIndexUI.toolbar.querySelector('[data-creator-summary]');if(summary)summary.textContent='Native directory · Pawchive controls';CreatorIndexUI.setState('ready','');NativeArtistsProxy.sync(CreatorIndexUI.found,CreatorIndexUI.toolbar);const mirror=CreatorIndexUI.paginator.querySelector('.pmf-native-paginator-mirror');if(mirror)NativeArtistsProxy.paginator(CreatorIndexUI.found,mirror);CreatorIndexUI.updateQuickFilters();
    },
    renderCatalogue(){
      const records=CreatorIndexUI.filteredRecords();const totalPages=Math.max(1,Math.ceil(records.length/CreatorIndexUI.pageSize));CreatorIndexUI.page=Util.clamp(CreatorIndexUI.page,1,totalPages);const start=(CreatorIndexUI.page-1)*CreatorIndexUI.pageSize;const visible=records.slice(start,start+CreatorIndexUI.pageSize);CreatorIndexUI.grid.replaceChildren();visible.forEach((record)=>{const built=CreatorCardReconstructor.build(record);const info={...built,context:CreatorIndexUI.context(record),creatorName:record.directory.creatorName,displayName:record.directory.creatorName,serviceLabel:CreatorDisplayName.serviceLabel(record.directory.service)};built.card.dataset.pmfCreatorKey=record.directory.creatorKey;CreatorIndexUI.grid.append(built.card);CreatorCardRightRail.render(info,record.meta,record.state);record.renderedInfo=info;});ArtistsPageController.cards=visible.map((record)=>record.renderedInfo);ArtistsPageController.cardByElement=new Map(ArtistsPageController.cards.map((info)=>[info.card,info]));CreatorIndexUI.setState(records.length?'ready':'empty',records.length?'':'No local Catalogue creators match the current search and filters.');const matches=CreatorIndexUI.toolbar.querySelector('[data-creator-matches]'),summary=CreatorIndexUI.toolbar.querySelector('[data-creator-summary]'),count=CreatorIndexUI.paginator.querySelector('.pmf-filtered-count'),controls=CreatorIndexUI.paginator.querySelector('.pmf-page-controls');if(matches)matches.textContent=`✓ ${records.length} Catalogue creators`;if(summary)summary.textContent=`Catalogue · ${CreatorIndexUI.records.length} stored`;if(count)count.textContent=records.length?`Showing ${start+1}–${Math.min(records.length,start+visible.length)} of ${records.length}`:'Showing 0 of 0';if(controls){controls.replaceChildren();const add=(label,page,disabled=false)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=disabled;button.dataset.creatorPage=String(page);if(page===CreatorIndexUI.page)button.setAttribute('aria-current','page');controls.append(button);};add('‹',CreatorIndexUI.page-1,CreatorIndexUI.page===1);for(let page=Math.max(1,CreatorIndexUI.page-2);page<=Math.min(totalPages,CreatorIndexUI.page+2);page+=1)add(String(page),page);add('›',CreatorIndexUI.page+1,CreatorIndexUI.page===totalPages);}CreatorIndexUI.updateQuickFilters();
    },
    render(){if(!CreatorIndexUI.root)return;NativeArtistsVisibility.apply(CreatorIndexUI.nativeSnapshot,CreatorIndexUI.mode,{proxiesReady:true});if(CreatorIndexUI.mode==='native')CreatorIndexUI.decorateNative();else CreatorIndexUI.renderCatalogue();CreatorIndexUI.updateQueueLabel();},
    updateQuickFilters(){CreatorIndexUI.paginator?.querySelectorAll('[data-creator-status-filter]').forEach((button)=>{const field=button.dataset.creatorStatusFilter;const mode=field==='native-scanned'?CreatorIndexUI.nativeScannedFilter:CreatorIndexUI.statusFilters[field];button.classList.toggle('pmf-match',mode==='match');button.classList.toggle('pmf-no-match',mode==='no-match');button.setAttribute('aria-pressed',mode==='off'?'false':mode==='match'?'true':'mixed');button.title=field==='native-scanned'?'Hide scanned creators on this Pawchive page':`${field} filter: ${mode}`;});},
    updateQueueLabel(snapshot=CatalogueJobManager.snapshot()){if(!CreatorIndexUI.queueButton)return;const issues=(snapshot.issues||[]).length,active=(snapshot.active||[]).length,waiting=(snapshot.pending||[]).length,history=(snapshot.batches||[]).length+(snapshot.recent||[]).length;CreatorIndexUI.queueButton.textContent=active||waiting?`Queue · ${active} active · ${waiting} waiting${issues?` · ${issues} issue${issues===1?'':'s'}`:''}`:issues?`Queue · ${issues} issue${issues===1?'':'s'}`:(snapshot.recent||[]).some((job)=>job.status==='complete')?'Queue · recently completed':history?'Queue idle':'Queue empty';},
    handleChange(event){const proxy=event.target.dataset.nativeProxy;if(proxy==='service'||proxy==='sort')NativeArtistsProxy.activate(CreatorIndexUI.found,proxy,event.target.value);},
    handle(event){
      const status=event.target.closest('[data-creator-status-filter]')?.dataset.creatorStatusFilter;if(status){if(status==='native-scanned')CreatorIndexUI.nativeScannedFilter=CreatorIndexUI.nativeScannedFilter==='no-match'?'off':'no-match';else{CreatorIndexUI.statusFilters[status]=CreatorStatusFilters.cycle(CreatorIndexUI.statusFilters[status]);CreatorStatusFilters.save(CreatorIndexUI.statusFilters);}CreatorIndexUI.page=1;CreatorIndexUI.render();return;}const paginatorIndex=event.target.closest('[data-native-paginator-index]')?.dataset.nativePaginatorIndex;if(paginatorIndex!==undefined){NativeArtistsProxy.activatePage(CreatorIndexUI.found,paginatorIndex);return;}const page=event.target.closest('[data-creator-page]')?.dataset.creatorPage;if(page){CreatorIndexUI.page=Number(page);CreatorIndexUI.render();return;}const action=event.target.closest('[data-creator-index-action]')?.dataset.creatorIndexAction;if(action==='native-service'||action==='native-sort'){NativeControlMenu.open(action,event.target.closest('button'));return;}if(action==='queue'){CreatorIndexUI.queuePanel.hidden=!CreatorIndexUI.queuePanel.hidden;return;}if(action==='settings'){CreatorSettingsUI.open(event.target);return;}if(action==='filter'&&CreatorIndexUI.mode==='catalogue'){CreatorFilterUI.open(event.target);return;}if(action==='sort'&&CreatorIndexUI.mode==='catalogue'){CreatorSortUI.open(event.target);return;}if(action==='bulk-primary'){CreatorBulkUI.open(CreatorIndexUI.mode==='native'?'build':'update',event.target);return;}if(action==='bulk-menu'){CreatorBulkUI.openMenu(event.target);}
    },
    cleanup({restoreNative=true}={}){CreatorIndexUI.unsubscribe?.();CreatorIndexUI.unsubscribe=null;CreatorIndexUI.searchController?.abort();CreatorIndexUI.searchController=null;CreatorIndexUI.nativeRecords.forEach((record)=>{if(record.nativeInfo?.card){record.nativeInfo.card.hidden=false;CreatorCardRightRail.cleanup(record.nativeInfo.card);delete record.nativeInfo.card.dataset.pmfCreatorKey;}});if(restoreNative)NativeArtistsVisibility.restore(CreatorIndexUI.nativeSnapshot);CreatorIndexUI.modeSelector?.remove();CreatorIndexUI.root?.remove();Object.assign(CreatorIndexUI,{root:null,modeSelector:null,toolbar:null,grid:null,stateNode:null,paginator:null,queuePanel:null,queueButton:null,found:null,nativeGrid:null,nativeSnapshot:null,nativeGeometry:null,searchInput:null,records:[],nativeRecords:[]});},
  };

  // Catalogue mode deliberately uses the mature shared page-window helper.
  CreatorIndexUI.renderCatalogue=function renderCatalogueStable(){const records=CreatorIndexUI.filteredRecords(),totalPages=Math.max(1,Math.ceil(records.length/CreatorIndexUI.pageSize));CreatorIndexUI.page=Util.clamp(CreatorIndexUI.page,1,totalPages);const start=(CreatorIndexUI.page-1)*CreatorIndexUI.pageSize,visible=records.slice(start,start+CreatorIndexUI.pageSize);CreatorIndexUI.grid.replaceChildren();visible.forEach((record)=>{const built=CreatorCardReconstructor.build(record);const info={...built,context:CreatorIndexUI.context(record),creatorName:record.directory.creatorName,displayName:record.directory.creatorName,serviceLabel:CreatorDisplayName.serviceLabel(record.directory.service)};built.card.dataset.pmfCreatorKey=record.directory.creatorKey;CreatorIndexUI.grid.append(built.card);CreatorCardRightRail.render(info,record.meta,record.state);record.renderedInfo=info;});ArtistsPageController.cards=visible.map((record)=>record.renderedInfo);ArtistsPageController.cardByElement=new Map(ArtistsPageController.cards.map((info)=>[info.card,info]));CreatorIndexUI.setState(records.length?'ready':'empty',records.length?'':'No local Catalogue creators match the current search and filters.');const matches=CreatorIndexUI.toolbar.querySelector('[data-creator-matches]'),summary=CreatorIndexUI.toolbar.querySelector('[data-creator-summary]'),count=CreatorIndexUI.paginator.querySelector('.pmf-filtered-count'),controls=CreatorIndexUI.paginator.querySelector('.pmf-page-controls');if(matches)matches.textContent=`✓ ${records.length} Catalogue creators`;if(summary)summary.textContent=`Catalogue · ${CreatorIndexUI.records.length} stored`;if(count)count.textContent=records.length?`Showing ${start+1}–${Math.min(records.length,start+visible.length)} of ${records.length}`:'Showing 0 of 0';if(controls){controls.replaceChildren();const add=(label,page,disabled,action)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=disabled;button.dataset.creatorPage=String(page);button.dataset.creatorPageAction=action;if(action==='page'&&page===CreatorIndexUI.page)button.setAttribute('aria-current','page');controls.append(button);};add('«',1,CreatorIndexUI.page===1,'first');add('‹',CreatorIndexUI.page-1,CreatorIndexUI.page===1,'previous');for(const page of Paginator.pageButtons(CreatorIndexUI.page,totalPages,Paginator.windowSize(Number(CreatorIndexUI.paginator?.clientWidth)||800)))add(String(page),page,page===CreatorIndexUI.page,'page');add('›',CreatorIndexUI.page+1,CreatorIndexUI.page===totalPages,'next');add('»',totalPages,CreatorIndexUI.page===totalPages,'last');}CreatorIndexUI.updateQuickFilters();};

  const CreatorSettingsUI = {
    preview(draft){const committed=Settings.value;Settings.value=Settings.normalize(draft);try{CreatorIndexUI.render();}finally{Settings.value=committed;}},
    open(opener) {
      const draft=Util.clone(Settings.value);const backdrop=SettingsUI.el('div','pmf-modal-backdrop');const dialog=SettingsUI.el('section','pmf-dialog pmf-settings-dialog pmf-surface');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Media Filter settings');const header=SettingsUI.el('header');header.append(SettingsUI.el('strong','','Media Filter settings'));const close=SettingsUI.action('×','cancel');close.className='pmf-icon-close';header.append(close);const layout=SettingsUI.el('div','pmf-settings-layout');const nav=SettingsUI.el('nav');const content=SettingsUI.el('div','pmf-settings-content');const panels=[SettingsUI.buildGeneral(draft),SettingsUI.buildDetection(draft),SettingsUI.buildScanning(draft),SettingsUI.buildData(draft)];[['general','General'],['default-detection','Default detection'],['scanning','Scanning'],['data','Data & performance']].forEach(([key,label])=>{const button=SettingsUI.action(label,'tab');button.dataset.creatorSettingsTab=key;nav.append(button);});content.append(...panels);layout.append(nav,content);const footer=SettingsUI.el('footer');footer.append(SettingsUI.action('Reset all settings','reset'),SettingsUI.el('span'),SettingsUI.action('Cancel','cancel'));const save=SettingsUI.action('Save & apply','save');save.className='pmf-primary';footer.append(save);dialog.append(header,layout,footer);backdrop.append(dialog);CreatorIndexUI.root.append(backdrop);
      const show=(name)=>{nav.querySelectorAll('button').forEach((button)=>button.classList.toggle('pmf-active',button.dataset.creatorSettingsTab===name));content.querySelectorAll('[data-pmf-settings-panel]').forEach((panel)=>panel.hidden=panel.dataset.pmfSettingsPanel!==name);};show('general');let committed=false;const overlay=OverlayManager.open({node:dialog,root:backdrop,opener,modal:true,onClose:()=>{if(!committed)CreatorIndexUI.render();}});
      backdrop.addEventListener('click',(event)=>{const action=event.target.closest('[data-settings-action]')?.dataset.settingsAction;const tab=event.target.closest('[data-creator-settings-tab]')?.dataset.creatorSettingsTab;const child=event.target.closest('[data-settings-child]')?.dataset.settingsChild;if(tab)show(tab);if(child)CreatorSettingsUI.openChild(child,draft,event.target);if(action==='cancel')OverlayManager.close(overlay,'cancel');if(action==='reset'){Object.assign(draft,Util.clone(DefaultSettings));CreatorSettingsUI.preview(draft);}if(action==='save'){const next=SettingsUI.collect(dialog,draft);Settings.save(next);committed=true;OverlayManager.close(overlay,'save');CreatorIndexUI.render();}});
      backdrop.addEventListener('change',()=>{Object.assign(draft,SettingsUI.collect(dialog,draft));CreatorSettingsUI.preview(draft);});
    },
    openChild(name,draft,opener) {
      const backdrop=SettingsUI.el('div','pmf-modal-backdrop');const dialog=SettingsUI.el('section','pmf-dialog pmf-small-dialog pmf-surface');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');const creatorStatus=name==='creator-status-badges',hidden=name==='hidden-creator-dim',attachment=name==='creator-attachment-badges';const title=creatorStatus?'Creator-card status badges':hidden?'Hidden creator-card appearance':attachment?'Creator card attachment badges':name==='seen-dim'?'Dim seen post cards':'Badge settings';dialog.innerHTML=`<header><strong>${title}</strong><button class="pmf-icon-close" data-child-action="cancel">×</button></header><div class="pmf-editor-body"></div><footer><span></span><button data-child-action="cancel">Cancel</button><button class="pmf-primary" data-child-action="apply">Apply</button></footer>`;const body=dialog.querySelector('.pmf-editor-body');
      if(hidden||name==='seen-dim'){const key=hidden?'hiddenCreatorTreatment':'seenCardTreatment';body.innerHTML=`<section class="pmf-settings-section"><h3>Appearance</h3><div class="pmf-settings-row"><span>Dim strength</span>${SettingsUI.select('strength',draft[key].strength,[['low','Low'],['medium','Medium'],['high','High']]).outerHTML}</div></section>`;}else{const key=creatorStatus?'creatorStatusBadges':attachment?'creatorCardBadges':'postStatusBadges';const sizeKey=creatorStatus?'creatorStatusBadgeSize':attachment?'creatorAttachmentBadgeSize':'postStatusBadgeSize';const fields=creatorStatus?['favorited','liked','hidden']:attachment?['videos','images','archives','projectFiles','externalLinks']:['favorited','liked','seen'];body.innerHTML=`<section class="pmf-settings-section"><h3>Appearance</h3><div class="pmf-settings-row"><span>Badge size</span>${SettingsUI.select('size',draft[sizeKey],[['small','Small'],['medium','Medium'],['big','Big']]).outerHTML}</div>${attachment?`<div class="pmf-settings-row"><span>Count method</span>${SettingsUI.select('countMethod',draft.creatorCardBadgeCountMode,[['posts','Matching posts'],['attachments','Attachments / links']]).outerHTML}</div>`:''}</section><section class="pmf-settings-section"><h3>Visible badges</h3>${fields.map((field)=>`<label class="pmf-check"><input type="checkbox" name="${field}" ${draft[key].types[field]?'checked':''}> ${field[0].toUpperCase()+field.slice(1)}</label>`).join('')}</section>`;}
      backdrop.append(dialog);CreatorIndexUI.root.append(backdrop);const overlay=OverlayManager.open({node:dialog,root:backdrop,opener,modal:true});backdrop.addEventListener('click',(event)=>{const action=event.target.closest('[data-child-action]')?.dataset.childAction;if(action==='cancel')OverlayManager.close(overlay,'cancel');if(action==='apply'){if(hidden||name==='seen-dim'){const key=hidden?'hiddenCreatorTreatment':'seenCardTreatment';draft[key].strength=dialog.querySelector('[name="strength"]').value;}else{const key=creatorStatus?'creatorStatusBadges':attachment?'creatorCardBadges':'postStatusBadges';const sizeKey=creatorStatus?'creatorStatusBadgeSize':attachment?'creatorAttachmentBadgeSize':'postStatusBadgeSize';draft[sizeKey]=dialog.querySelector('[name="size"]').value;if(attachment)draft.creatorCardBadgeCountMode=dialog.querySelector('[name="countMethod"]').value;dialog.querySelectorAll('input[type="checkbox"]').forEach((input)=>{draft[key].types[input.name]=input.checked;});}CreatorSettingsUI.preview(draft);OverlayManager.close(overlay,'apply');}});
    },
  };

  const CreatorFilterUI = {
    open(opener) {
      let draft=CreatorFilterEngine.normalizeState(CreatorIndexUI.filterState);let presetRecord=CreatorPresets.load();
      const backdrop=SettingsUI.el('div','pmf-modal-backdrop');const dialog=SettingsUI.el('section','pmf-dialog pmf-filter-editor pmf-surface');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Creator filters');dialog.innerHTML='<header><strong>Creator filters</strong><button class="pmf-icon-close" data-filter-action="cancel" aria-label="Close creator filters">×</button></header><div class="pmf-editor-body"></div><footer><span></span><button data-filter-action="cancel">Cancel</button><button class="pmf-primary" data-filter-action="apply">Apply</button></footer>';
      const body=dialog.querySelector('.pmf-editor-body');const dateField=(name,value)=>{const input=SettingsUI.field(name,value);input.type='date';return input;};const summary=(rule)=>{const count=rule?.count||rule||CreatorAggregateCondition.normalize({});return`${count.operator.replace('-',' ')} ${count.from}${count.operator==='between'?`–${count.to}`:''}${rule?.percentageEnabled?` · ${rule.percentage.operator.replace('-',' ')} ${rule.percentage.from}${rule.percentage.operator==='between'?`–${rule.percentage.to}`:''}%`:''}`;};
      const presets=SettingsUI.section('Creator presets');const presetSelect=SettingsUI.select('creatorPreset',presetRecord.activeId,presetRecord.presets.map((preset)=>[preset.id,preset.name]));const presetActions=SettingsUI.el('div','pmf-settings-actions');presetActions.append(SettingsUI.action('Save current as preset','save-preset'),SettingsUI.action('Update','update-preset'),SettingsUI.action('Rename','rename-preset'),SettingsUI.action('Delete','delete-preset'),SettingsUI.action('Reset Default','reset-default-preset'));presets.append(SettingsUI.row('Preset',presetSelect),presetActions);
      const directory=SettingsUI.section('Directory');directory.append(SettingsUI.row('Service',SettingsUI.select('service',draft.service,[['all','All services'],['patreon','Patreon'],['fanbox','Pixiv Fanbox']])),SettingsUI.toggle('publicFavoritesEnabled',Boolean(draft.publicFavorites),`Public creator favorite count · ${summary(draft.publicFavorites)}`,{child:'creator-aggregate-publicFavorites'}),SettingsUI.row('Date indexed — from',dateField('dateIndexedFrom',draft.dateIndexedFrom)),SettingsUI.row('Date indexed — to',dateField('dateIndexedTo',draft.dateIndexedTo)),SettingsUI.row('Date updated — from',dateField('dateUpdatedFrom',draft.dateUpdatedFrom)),SettingsUI.row('Date updated — to',dateField('dateUpdatedTo',draft.dateUpdatedTo)));
      const catalogue=SettingsUI.section('Catalogue');catalogue.append(SettingsUI.row('Catalogue state',SettingsUI.select('catalogueState',draft.catalogueState,[['any','Any'],['complete','Complete'],['partial','Partial'],['unscanned','Unscanned']])),SettingsUI.toggle('totalPostsEnabled',Boolean(draft.totalPosts),`Total Catalogue posts · ${summary(draft.totalPosts)}`,{child:'creator-aggregate-totalPosts'}),SettingsUI.row('Last Catalogue update — from',dateField('lastCatalogueUpdateFrom',draft.lastCatalogueUpdateFrom)),SettingsUI.row('Last Catalogue update — to',dateField('lastCatalogueUpdateTo',draft.lastCatalogueUpdateTo)),SettingsUI.row('Earliest published post — from',dateField('earliestPublishedFrom',draft.earliestPublishedFrom)),SettingsUI.row('Latest published post — to',dateField('latestPublishedTo',draft.latestPublishedTo)),SettingsUI.row('Posts published within — from',dateField('publishedWithinFrom',draft.publishedWithinFrom)),SettingsUI.row('Posts published within — to',dateField('publishedWithinTo',draft.publishedWithinTo)),SettingsUI.toggle('includePartial',draft.includePartialLowerBounds,'Include partial Catalogues as lower-bound results'));
      const media=SettingsUI.section('Media');[['videos','Videos'],['images','Images'],['archives','Archives'],['projectFiles','Project files'],['externalLinks','External links'],['customExtensions','Custom extensions']].forEach(([type,label])=>media.append(SettingsUI.toggle(`media-${type}`,draft.media[type].enabled,`${label} · ${summary(draft.media[type])}`,{child:`creator-media-${type}`})));
      const status=SettingsUI.section('Post-status aggregates');[['liked','Liked posts'],['seen','Seen posts'],['favorited','Native-favorited posts']].forEach(([type,label])=>status.append(SettingsUI.toggle(`status-${type}`,draft.postStatuses[type].enabled,`${label} · ${summary(draft.postStatuses[type])}`,{child:`creator-status-${type}`})));status.append(SettingsUI.el('p','pmf-help','Native Favorite filters preserve unknown state and require sufficient known-state coverage.'));
      const custom=SettingsUI.section('Custom Catalogue search rules');custom.append(SettingsUI.el('p','pmf-help','Creator-level custom aggregate rules are evaluated only from locally stored Catalogue data.'));const customRows=SettingsUI.el('div','pmf-creator-custom-rules');const renderCustomRules=()=>{customRows.replaceChildren();draft.customRules.forEach((raw,index)=>{const rule=CreatorCustomRule.normalize(raw);const row=SettingsUI.el('div','pmf-custom-rule-row');row.dataset.customRuleIndex=String(index);row.innerHTML=`<label class="pmf-check"><input type="checkbox" name="customEnabled" ${rule.enabled?'checked':''}> Enabled</label><select name="customField">${CreatorCustomRule.fields.map((field)=>`<option value="${field}" ${field===rule.field?'selected':''}>${field}</option>`).join('')}</select><select name="customMatch">${CreatorCustomRule.matches.map((match)=>`<option value="${match}" ${match===rule.match?'selected':''}>${match.replace('-',' ')}</option>`).join('')}</select><input name="customValue" value="${Util.escapeHtml(rule.value)}" placeholder="Search value"><select name="customOperator">${CreatorAggregateCondition.operators.map((operator)=>`<option value="${operator}" ${operator===rule.count.operator?'selected':''}>${operator.replace('-',' ')}</option>`).join('')}</select><input type="number" min="0" name="customFrom" value="${rule.count.from}"><input type="number" min="0" name="customTo" value="${rule.count.to}"><button type="button" data-filter-action="remove-custom-rule" data-rule-index="${index}" aria-label="Remove custom rule">×</button>`;customRows.append(row);});};renderCustomRules();const addCustom=SettingsUI.action('+ Add custom rule','add-custom-rule');custom.append(customRows,addCustom);
      body.append(presets,directory,catalogue,media,status,custom);backdrop.append(dialog);CreatorIndexUI.root.append(backdrop);const overlay=OverlayManager.open({node:dialog,root:backdrop,opener,modal:true});
      const syncControls=()=>{const assign=(name,value)=>{const control=dialog.querySelector(`[name="${name}"]`);if(control)control.value=value||'';};assign('service',draft.service);assign('catalogueState',draft.catalogueState);['dateIndexedFrom','dateIndexedTo','dateUpdatedFrom','dateUpdatedTo','lastCatalogueUpdateFrom','lastCatalogueUpdateTo','earliestPublishedFrom','latestPublishedTo','publishedWithinFrom','publishedWithinTo'].forEach((name)=>assign(name,draft[name]));dialog.querySelector('[name="includePartial"]').checked=draft.includePartialLowerBounds;dialog.querySelector('[name="publicFavoritesEnabled"]').checked=Boolean(draft.publicFavorites);dialog.querySelector('[name="totalPostsEnabled"]').checked=Boolean(draft.totalPosts);Object.keys(draft.media).forEach((type)=>{dialog.querySelector(`[name="media-${type}"]`).checked=draft.media[type].enabled;});Object.keys(draft.postStatuses).forEach((type)=>{dialog.querySelector(`[name="status-${type}"]`).checked=draft.postStatuses[type].enabled;});};
      const collect=()=>{draft.service=dialog.querySelector('[name="service"]').value;draft.catalogueState=dialog.querySelector('[name="catalogueState"]').value;draft.includePartialLowerBounds=dialog.querySelector('[name="includePartial"]').checked;['dateIndexedFrom','dateIndexedTo','dateUpdatedFrom','dateUpdatedTo','lastCatalogueUpdateFrom','lastCatalogueUpdateTo','earliestPublishedFrom','latestPublishedTo','publishedWithinFrom','publishedWithinTo'].forEach((name)=>{draft[name]=dialog.querySelector(`[name="${name}"]`).value;});draft.publicFavorites=dialog.querySelector('[name="publicFavoritesEnabled"]').checked?CreatorAggregateCondition.normalize(draft.publicFavorites||{}):null;draft.totalPosts=dialog.querySelector('[name="totalPostsEnabled"]').checked?CreatorAggregateCondition.normalize(draft.totalPosts||{}):null;Object.keys(draft.media).forEach((type)=>{draft.media[type].enabled=dialog.querySelector(`[name="media-${type}"]`)?.checked||false;});Object.keys(draft.postStatuses).forEach((type)=>{draft.postStatuses[type].enabled=dialog.querySelector(`[name="status-${type}"]`)?.checked||false;});draft.customRules=[...dialog.querySelectorAll('[data-custom-rule-index]')].map((row,index)=>CreatorCustomRule.normalize({id:draft.customRules[index]?.id,enabled:row.querySelector('[name="customEnabled"]').checked,field:row.querySelector('[name="customField"]').value,match:row.querySelector('[name="customMatch"]').value,value:row.querySelector('[name="customValue"]').value,count:{operator:row.querySelector('[name="customOperator"]').value,from:row.querySelector('[name="customFrom"]').value,to:row.querySelector('[name="customTo"]').value}}));};
      dialog.querySelector('[name="creatorPreset"]').addEventListener('change',(event)=>{const applied=CreatorPresets.apply(presetRecord,event.target.value);if(applied){draft=applied;syncControls();}});
      backdrop.addEventListener('click',(event)=>{const action=event.target.closest('[data-filter-action]')?.dataset.filterAction;const settingsAction=event.target.closest('[data-settings-action]')?.dataset.settingsAction;const child=event.target.closest('[data-settings-child]')?.dataset.settingsChild;if(child?.startsWith('creator-media-'))CreatorFilterUI.openMedia(child.replace('creator-media-',''),draft,event.target);if(child?.startsWith('creator-status-'))CreatorFilterUI.openAggregate(child.replace('creator-status-',''),draft,event.target,{status:true});if(child?.startsWith('creator-aggregate-'))CreatorFilterUI.openAggregate(child.replace('creator-aggregate-',''),draft,event.target);if(settingsAction==='add-custom-rule'){collect();draft.customRules.push(CreatorCustomRule.normalize({}));renderCustomRules();}if(action==='remove-custom-rule'){collect();draft.customRules.splice(Number(event.target.closest('[data-rule-index]').dataset.ruleIndex),1);renderCustomRules();}if(settingsAction==='save-preset'){collect();const name=globalThis.prompt?.('Creator preset name','Creator preset');if(name){presetRecord=CreatorPresets.create(presetRecord,name,draft);GlobalUI.flash('Creator preset saved.');}}if(settingsAction==='update-preset'){collect();presetRecord=CreatorPresets.update(presetRecord,dialog.querySelector('[name="creatorPreset"]').value,draft);GlobalUI.flash('Creator preset updated.');}if(settingsAction==='rename-preset'){const id=dialog.querySelector('[name="creatorPreset"]').value;const current=presetRecord.presets.find((preset)=>preset.id===id);const name=globalThis.prompt?.('Rename creator preset',current?.name||'');if(name)presetRecord=CreatorPresets.rename(presetRecord,id,name);}if(settingsAction==='delete-preset'){const id=dialog.querySelector('[name="creatorPreset"]').value;presetRecord=CreatorPresets.remove(presetRecord,id);if(id==='default')GlobalUI.flash('Default cannot be deleted.');}if(settingsAction==='reset-default-preset'){presetRecord=CreatorPresets.resetDefault(presetRecord);draft=CreatorFilterEngine.normalizeState({});syncControls();renderCustomRules();}if(action==='cancel')OverlayManager.close(overlay,'cancel');if(action==='apply'){collect();const invalid=draft.customRules.find((rule)=>rule.enabled&&!CreatorCustomRule.valid(rule));if(invalid){GlobalUI.flash('Complete or remove every enabled custom Catalogue rule.');return;}CreatorIndexUI.filterState=CreatorFilterEngine.normalizeState(draft);GM_setValue(Config.creatorFilterStateKey,CreatorIndexUI.filterState);CreatorIndexUI.page=1;OverlayManager.close(overlay,'apply');ArtistsPageController.requestRefresh('filters-applied');}});
    },
    openAggregate(type,draft,opener,{status=false}={}) {
      const target=status?draft.postStatuses:draft;const source=status?target[type]:target[type]||{};const count=CreatorAggregateCondition.normalize(source.count||source);const percentage=CreatorAggregateCondition.normalize(source.percentage||{},true);const title=status?`${type[0].toUpperCase()+type.slice(1)} posts`:type==='publicFavorites'?'Public creator favorite count':'Total Catalogue posts';
      const backdrop=SettingsUI.el('div','pmf-modal-backdrop');const dialog=SettingsUI.el('section','pmf-dialog pmf-small-dialog pmf-surface');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',`Configure ${title}`);
      dialog.innerHTML=`<header><strong>${title}</strong><button class="pmf-icon-close" data-aggregate-action="cancel" aria-label="Close">×</button></header><div class="pmf-editor-body"><section class="pmf-settings-section"><h3>Primary condition</h3><label>Condition<select name="operator">${CreatorAggregateCondition.operators.map((value)=>`<option value="${value}">${value.replace('-',' ')}</option>`).join('')}</select></label><label>Value<input type="number" name="from" min="0" step="1" value="${count.from}"></label><label data-between hidden>To<input type="number" name="to" min="0" step="1" value="${count.to}"></label></section>${status?`<section class="pmf-settings-section"><h3>Catalogue percentage</h3><label class="pmf-check"><input type="checkbox" name="percentageEnabled" ${source.percentageEnabled?'checked':''}> Add percentage condition</label><label>Condition<select name="percentageOperator">${CreatorAggregateCondition.operators.map((value)=>`<option value="${value}">${value.replace('-',' ')}</option>`).join('')}</select></label><label>Percentage<input type="number" name="percentageFrom" min="0" max="100" step=".1" value="${percentage.from}"> %</label><label data-percentage-between hidden>To<input type="number" name="percentageTo" min="0" max="100" step=".1" value="${percentage.to}"> %</label></section>`:''}<p class="pmf-editor-error"></p></div><footer><span></span><button data-aggregate-action="cancel">Cancel</button><button class="pmf-primary" data-aggregate-action="apply">Apply</button></footer>`;
      backdrop.append(dialog);CreatorIndexUI.root.append(backdrop);const overlay=OverlayManager.open({node:dialog,root:backdrop,opener,modal:true});
      const update=()=>{dialog.querySelector('[data-between]').hidden=dialog.querySelector('[name="operator"]').value!=='between';if(status)dialog.querySelector('[data-percentage-between]').hidden=dialog.querySelector('[name="percentageOperator"]').value!=='between';};dialog.querySelector('[name="operator"]').value=count.operator;if(status)dialog.querySelector('[name="percentageOperator"]').value=percentage.operator;update();dialog.addEventListener('change',update);
      backdrop.addEventListener('click',(event)=>{const action=event.target.closest('[data-aggregate-action]')?.dataset.aggregateAction;if(action==='cancel')OverlayManager.close(overlay,'cancel');if(action==='apply'){const next={operator:dialog.querySelector('[name="operator"]').value,from:dialog.querySelector('[name="from"]').value,to:dialog.querySelector('[name="to"]').value};const nextPercentage=status?{operator:dialog.querySelector('[name="percentageOperator"]').value,from:dialog.querySelector('[name="percentageFrom"]').value,to:dialog.querySelector('[name="percentageTo"]').value,percentage:true}:null;const validation=CreatorAggregateCondition.validateRaw(next),percentageValidation=status?CreatorAggregateCondition.validateRaw(nextPercentage,true):{valid:true};if(!validation.valid||!percentageValidation.valid){dialog.querySelector('.pmf-editor-error').textContent=validation.message||percentageValidation.message;return;}if(status)Object.assign(target[type],{count:CreatorAggregateCondition.normalize(validation.value),percentageEnabled:dialog.querySelector('[name="percentageEnabled"]').checked,percentage:CreatorAggregateCondition.normalize(percentageValidation.value,true)});else target[type]=CreatorAggregateCondition.normalize(validation.value);OverlayManager.close(overlay,'apply');}});
    },
    openMedia(type,draft,opener) {
      const rule=draft.media[type];const backdrop=SettingsUI.el('div','pmf-modal-backdrop');const dialog=SettingsUI.el('section','pmf-dialog pmf-small-dialog pmf-surface');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.innerHTML=`<header><strong>${type}</strong><button class="pmf-icon-close" data-media-action="cancel">×</button></header><div class="pmf-editor-body"><section class="pmf-settings-section"><h3>Primary condition</h3>${type==='customExtensions'?`<label>Extensions<textarea name="extensions" placeholder="psd, clip, blend">${Util.escapeHtml((rule.extensions||[]).join(', '))}</textarea></label>`:''}<label>Measure<select name="measure"><option value="posts">Posts containing the type</option><option value="attachments">Total attachments or links</option></select></label><label>Condition<select name="operator">${CreatorAggregateCondition.operators.map((value)=>`<option value="${value}">${value.replace('-',' ')}</option>`).join('')}</select></label><label>Value<input type="number" name="from" min="0" step="1" value="${rule.count.from}"></label><label data-between hidden>To<input type="number" name="to" min="0" step="1" value="${rule.count.to}"></label></section><section class="pmf-settings-section"><h3>Catalogue percentage</h3><label class="pmf-check"><input type="checkbox" name="percentageEnabled" ${rule.percentageEnabled?'checked':''}> Add percentage condition</label><label>Condition<select name="percentageOperator">${CreatorAggregateCondition.operators.map((value)=>`<option value="${value}">${value.replace('-',' ')}</option>`).join('')}</select></label><label>Percentage<input type="number" name="percentageFrom" min="0" max="100" step=".1" value="${rule.percentage.from}"> %</label><label data-percentage-between hidden>To<input type="number" name="percentageTo" min="0" max="100" step=".1" value="${rule.percentage.to}"> %</label><p class="pmf-editor-error"></p></section></div><footer><span></span><button data-media-action="cancel">Cancel</button><button class="pmf-primary" data-media-action="apply">Apply</button></footer>`;backdrop.append(dialog);CreatorIndexUI.root.append(backdrop);const overlay=OverlayManager.open({node:dialog,root:backdrop,opener,modal:true});const update=()=>{dialog.querySelector('[data-between]').hidden=dialog.querySelector('[name="operator"]').value!=='between';dialog.querySelector('[data-percentage-between]').hidden=dialog.querySelector('[name="percentageOperator"]').value!=='between';};dialog.querySelector('[name="measure"]').value=rule.measure;dialog.querySelector('[name="operator"]').value=rule.count.operator;dialog.querySelector('[name="percentageOperator"]').value=rule.percentage.operator;update();dialog.addEventListener('change',update);backdrop.addEventListener('click',(event)=>{const action=event.target.closest('[data-media-action]')?.dataset.mediaAction;if(action==='cancel')OverlayManager.close(overlay,'cancel');if(action==='apply'){const rawCount={operator:dialog.querySelector('[name="operator"]').value,from:dialog.querySelector('[name="from"]').value,to:dialog.querySelector('[name="to"]').value};const rawPercentage={operator:dialog.querySelector('[name="percentageOperator"]').value,from:dialog.querySelector('[name="percentageFrom"]').value,to:dialog.querySelector('[name="percentageTo"]').value,percentage:true};const countValidation=CreatorAggregateCondition.validateRaw(rawCount);const percentageValidation=CreatorAggregateCondition.validateRaw(rawPercentage,true);const extensions=type==='customExtensions'?Util.normalizeExtensions(dialog.querySelector('[name="extensions"]').value.split(/[\s,]+/)):null;if(!countValidation.valid||!percentageValidation.valid||extensions&&(!extensions.values.length||extensions.invalid.length)){dialog.querySelector('.pmf-editor-error').textContent=countValidation.message||percentageValidation.message||'Enter at least one valid extension without a leading dot.';return;}Object.assign(rule,{measure:dialog.querySelector('[name="measure"]').value,count:CreatorAggregateCondition.normalize(countValidation.value),percentageEnabled:dialog.querySelector('[name="percentageEnabled"]').checked,percentage:CreatorAggregateCondition.normalize(percentageValidation.value,true),...(extensions?{extensions:extensions.values}:{})});OverlayManager.close(overlay,'apply');}});
    },
  };

  const AnchoredMenu = {
    open(opener,items,{selected='',onSelect=()=>{},anchor=opener,owner=`anchored:${opener?.dataset?.creatorIndexAction||opener?.id||opener?.getAttribute?.('aria-label')||'menu'}`}={}){const menu=SettingsUI.el('div','pmf-floating-menu pmf-surface pmf-control-menu');menu.setAttribute('role','menu');items.forEach(({value,label})=>{const button=SettingsUI.el('button','',label);button.type='button';button.dataset.menuValue=String(value);button.setAttribute('role','menuitemradio');button.setAttribute('aria-checked',String(String(value)===String(selected)));menu.append(button);});document.body.append(menu);const rect=(anchor||opener).getBoundingClientRect();const width=Math.max(1,rect.width);menu.style.left=`${Math.max(4,Math.min(rect.left,window.innerWidth-width-4))}px`;menu.style.top=`${rect.bottom+4}px`;menu.style.width=`${width}px`;menu.style.minWidth=`${width}px`;const overlay=OverlayManager.open({owner,node:menu,root:menu,opener,dismissible:true});if(!overlay){menu.remove();return null;}menu.addEventListener('click',(event)=>{const value=event.target.closest('[data-menu-value]')?.dataset.menuValue;if(value===undefined)return;onSelect(value);OverlayManager.close(overlay,'select');});menu.querySelector('[aria-checked="true"]')?.focus();return overlay;},
  };

  const NativeControlMenu = {
    open(action,opener){const service=action==='native-service',source=service?CreatorIndexUI.found?.serviceControl:CreatorIndexUI.found?.sortControl;if(!source)return;AnchoredMenu.open(opener,NativeArtistsProxy.options(source,{service}),{owner:`artists:${action}`,selected:source.value,onSelect:(value)=>{NativeArtistsProxy.activate(CreatorIndexUI.found,service?'service':'sort',value);queueMicrotask(()=>NativeArtistsProxy.sync(CreatorIndexUI.found,CreatorIndexUI.toolbar));}});},
  };

  const CreatorSortUI = {
    modes:[['popularity','Popularity'],['alphabetical','Alphabetical'],['service','Service'],['indexed','Date indexed'],['updated','Date updated'],['posts','Catalogue post count'],['catalogueUpdated','Catalogue updated'],['latest','Latest post'],['earliest','Earliest post'],...['videos','images','archives','projectFiles','externalLinks'].flatMap((type)=>[[`${type}:posts`,`${type} — Posts`],[`${type}:${type==='externalLinks'?'links':'attachments'}`,`${type} — Attachments / links`],[`${type}:percentage`,`${type} — Catalogue percentage`]]),['liked','Liked posts'],['seen','Seen posts'],['favorited','Favorited posts']],
    open(opener){AnchoredMenu.open(opener,CreatorSortUI.modes.map(([value,label])=>({value,label})),{selected:CreatorIndexUI.sort.mode,onSelect:(mode)=>{if(CreatorIndexUI.sort.mode===mode)CreatorIndexUI.sort.direction=CreatorIndexUI.sort.direction==='asc'?'desc':'asc';else CreatorIndexUI.sort={mode,direction:mode==='alphabetical'||mode==='service'?'asc':'desc'};CreatorIndexUI.toolbar.querySelector('[data-creator-index-action="sort"]').textContent=`Sort: ${CreatorSortUI.modes.find((item)=>item[0]===mode)?.[1]} ${CreatorIndexUI.sort.direction==='asc'?'▲':'▼'}`;CreatorIndexUI.render();}});},
  };

  const CreatorBulkSelection = {
    state(record){return record?.summary?.completeness==='complete'||record?.catalogueState==='complete'?'complete':record?.scanned?'partial':'unscanned';},
    reason(record,kind){const key=record.directory?.creatorKey;if(CatalogueJobManager.activeForCreator(key))return'already active';if(CatalogueJobManager.queuedForCreator(key))return'already queued';const state=CreatorBulkSelection.state(record);if(kind==='build'&&state==='complete')return'Catalogue complete';if(kind==='resume'&&state!=='partial')return state==='complete'?'Catalogue complete':'not scanned';if(kind==='update'&&state!=='complete')return state==='partial'?'Catalogue incomplete':'not scanned';return'';},
    action(record,kind){if(CreatorBulkSelection.reason(record,kind))return'';if(kind==='build')return CreatorBulkSelection.state(record)==='partial'?'resume':'build';return kind;},
    evaluate(records,kind){const eligible=[],skipped=[];(records||[]).forEach((record)=>{const reason=CreatorBulkSelection.reason(record,kind);(reason?skipped:eligible).push(reason?{record,reason}:{record,action:CreatorBulkSelection.action(record,kind)});});return{eligible,skipped};},
    first(records,kind,count){const selected=[];for(const record of records||[]){const action=CreatorBulkSelection.action(record,kind);if(!action)continue;selected.push({record,action});if(selected.length>=count)break;}return selected;},
  };

  const NativeCreatorDirectorySource = {
    cache:null,
    async creators(signal){if(NativeCreatorDirectorySource.cache)return NativeCreatorDirectorySource.cache;const response=await fetch('/api/v1/creators',{signal,credentials:'same-origin'});if(!response.ok)throw new Error(`Native creator directory request failed (${response.status}).`);const data=await response.json();NativeCreatorDirectorySource.cache=Array.isArray(data)?data:[];return NativeCreatorDirectorySource.cache;},
    compare(a,b,field){const numeric=['indexed','updated','favorited','popularity','favorites'].includes(String(field));const value=(item)=>numeric?Number(item[field]??item.favorited??item.favorite_count) || 0:String(item[field]??item.name??'').toLocaleLowerCase();const left=value(a),right=value(b);return typeof left==='string'?left.localeCompare(right,undefined,{numeric:true,sensitivity:'base'}):left-right;},
    async records(signal){const found=CreatorIndexUI.found,service=found?.serviceControl?.value||'',field=found?.sortControl?.value||'favorited',direction=found?.directionControl?.value||'desc',query=String(CreatorIndexUI.searchInput?.value||'').trim().toLocaleLowerCase(),existing=new Map([...CreatorIndexUI.records,...CreatorIndexUI.nativeRecords].map((record)=>[record.directory.creatorKey,record]));let creators=[...await NativeCreatorDirectorySource.creators(signal)];creators=creators.filter((creator)=>(!service||creator.service===service)&&(!query||String(creator.name||'').toLocaleLowerCase().includes(query))).sort((a,b)=>NativeCreatorDirectorySource.compare(a,b,field)*(direction==='asc'?1:-1));return creators.map((creator)=>{const creatorKey=`${location.hostname}|${creator.service}|${creator.id}`,known=existing.get(creatorKey);if(known)return known;return{directory:CreatorDirectory.normalize({creatorKey,domain:location.hostname,service:creator.service,creatorId:String(creator.id),creatorName:creator.name||String(creator.id),creatorUrl:`${location.origin}/${creator.service}/user/${creator.id}`,publicFavoriteCount:creator.favorited,indexedAt:Number(creator.indexed)*1000,updatedAt:Number(creator.updated)*1000}),meta:null,state:CreatorState.empty(creatorKey),summary:null,catalogueState:'unscanned',scanned:false};});},
  };

  const CreatorBulkUI = {
    openMenu(opener){AnchoredMenu.open(opener,[{value:'resume',label:'Retry/resume incomplete'}],{anchor:opener.closest('.pmf-split-primary')||opener,owner:`artists:split:${CreatorIndexUI.mode}`,onSelect:()=>CreatorBulkUI.open('resume',opener)});},
    async selected(kind,scope,count,signal){const source=scope==='page'?CreatorIndexUI.visibleRecords():CreatorIndexUI.mode==='native'?await NativeCreatorDirectorySource.records(signal):CreatorIndexUI.filteredRecords();const limit=scope==='page'?Number.MAX_SAFE_INTEGER:scope==='all'?Number.MAX_SAFE_INTEGER:kind==='build'?Util.clamp(Number(count)||50,1,1000):Math.max(1,Number(count)||50);return CreatorBulkSelection.first(source,kind,limit);},
    open(kind,opener){const backdrop=SettingsUI.el('div','pmf-modal-backdrop');const dialog=SettingsUI.el('section','pmf-dialog pmf-confirm-dialog pmf-bulk-dialog pmf-surface');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');const label=kind==='build'?'scan':kind==='resume'?'resume':'update';dialog.innerHTML=`<header><strong>Bulk ${label} creators</strong><button class="pmf-icon-close" data-bulk-action="cancel" aria-label="Close">×</button></header><div class="pmf-confirm-body"><section><h3>Scope</h3><label class="pmf-bulk-scope"><input type="radio" name="scope" value="page" checked><span><strong>Current visible result page</strong><small>Use the cards currently shown in this mode.</small></span></label><label class="pmf-bulk-scope"><input type="radio" name="scope" value="first"><span><strong>First matching creators</strong><small>Continue past unavailable or already queued creators.</small></span><input type="number" name="first" min="1" max="150" value="50" aria-label="Number of creators"></label></section><section><h3>Preview</h3><p data-bulk-count></p><ol data-bulk-preview></ol></section></div><footer><span></span><button data-bulk-action="cancel">Cancel</button><button class="pmf-primary" data-bulk-action="confirm"></button></footer>`;backdrop.append(dialog);CreatorIndexUI.root.append(backdrop);let selected=[],revision=0,controller=null;const refresh=async()=>{const current=++revision;controller?.abort();controller=new AbortController();const scope=dialog.querySelector('[name="scope"]:checked').value,count=dialog.querySelector('[name="first"]').value,confirm=dialog.querySelector('[data-bulk-action="confirm"]');confirm.disabled=true;confirm.textContent='Loading preview…';dialog.querySelector('[data-bulk-count]').textContent=scope==='first'&&CreatorIndexUI.mode==='native'?'Checking matching native-directory creators…':'';try{const next=await CreatorBulkUI.selected(kind,scope,count,controller.signal);if(current!==revision)return;selected=next;dialog.querySelector('[data-bulk-count]').textContent=selected.length?`${selected.length} creator${selected.length===1?'':'s'} will be queued`:'No actionable creators are available in this scope.';dialog.querySelector('[data-bulk-preview]').innerHTML=selected.slice(0,10).map(({record,action})=>`<li><strong>${Util.escapeHtml(record.directory.creatorName)}</strong><small>${action==='build'?'Scan':action==='resume'?'Resume':'Update'}</small></li>`).join('');confirm.disabled=!selected.length;confirm.textContent=`Queue ${selected.length} ${label}${selected.length===1?'':'s'}`;}catch(error){if(error.name!=='AbortError'){selected=[];dialog.querySelector('[data-bulk-count]').textContent=error.message;confirm.textContent=`Queue 0 ${label}s`;}}};const overlay=OverlayManager.open({node:dialog,root:backdrop,opener,modal:true,onClose:()=>controller?.abort()});refresh();dialog.addEventListener('change',refresh);dialog.querySelector('[name="first"]').addEventListener('input',Util.debounce(refresh,150));backdrop.addEventListener('click',(event)=>{const action=event.target.closest('[data-bulk-action]')?.dataset.bulkAction;if(action==='cancel')OverlayManager.close(overlay,'cancel');if(action==='confirm'&&selected.length){const batch=CatalogueJobManager.createBatch({label:`Bulk ${label}`,total:selected.length});selected.forEach(({record,action:actualAction},index)=>CatalogueJobManager.enqueue(CreatorIndexUI.context(record),actualAction,{creatorName:record.directory.creatorName,batchId:batch.id,batchLabel:batch.label,batchSequence:index+1}));OverlayManager.close(overlay,'confirm');CreatorIndexUI.queuePanel.hidden=false;CreatorQueuePanel.render();}});
    },
  };

  // Keep the bulk dialog's selection frozen only at confirmation.  Native
  // discovery is cancelled and generation-guarded whenever its scope changes.
  CreatorBulkUI.open = function openBulk(kind,opener){
    const backdrop=SettingsUI.el('div','pmf-modal-backdrop'),dialog=SettingsUI.el('section','pmf-dialog pmf-confirm-dialog pmf-bulk-dialog pmf-surface');
    const label=kind==='build'?'scan':kind==='resume'?'resume':'update';const all=kind==='build'?'':`<label class="pmf-bulk-scope"><input type="radio" name="scope" value="all"><span><strong>All creators</strong><small>Use every eligible creator in the current filtered result.</small></span></label>`;
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.innerHTML=`<header><strong>Bulk ${label} creators</strong><button class="pmf-icon-close" data-bulk-action="cancel" aria-label="Close">×</button></header><div class="pmf-confirm-body"><section><h3>Scope</h3><label class="pmf-bulk-scope"><input type="radio" name="scope" value="page" checked><span><strong>Current visible result page</strong><small>Use the cards currently shown in this mode.</small></span></label><label class="pmf-bulk-scope"><input type="radio" name="scope" value="first"><span><strong>First matching creators</strong><small>Continue past unavailable or already queued creators.</small></span><input type="number" name="first" min="1" ${kind==='build'?'max="1000"':''} value="50"></label>${all}</section><section><h3>Preview</h3><p data-bulk-count></p><ol data-bulk-preview tabindex="0"></ol></section></div><footer><span></span><button data-bulk-action="cancel">Cancel</button><button class="pmf-primary" data-bulk-action="confirm"></button></footer>`;
    backdrop.append(dialog);CreatorIndexUI.root.append(backdrop);let selected=[],revision=0,controller=null;const refresh=async()=>{const generation=++revision;controller?.abort();controller=new AbortController();const scope=dialog.querySelector('[name="scope"]:checked').value,count=dialog.querySelector('[name="first"]').value,confirm=dialog.querySelector('[data-bulk-action="confirm"]');confirm.disabled=true;confirm.textContent='Loading preview…';try{const next=await CreatorBulkUI.selected(kind,scope,count,controller.signal);if(generation!==revision)return;selected=next;dialog.querySelector('[data-bulk-count]').textContent=selected.length?`${selected.length} creator${selected.length===1?'':'s'} selected`:'No actionable creators are available in this scope.';dialog.querySelector('[data-bulk-preview]').innerHTML=selected.slice(0,100).map(({record,action},index)=>`<li><strong>${index+1}. ${Util.escapeHtml(record.directory.creatorName||record.directory.creatorId)}</strong><small>${action==='build'?'Scan':action==='resume'?'Resume':'Update'}</small></li>`).join('')+(selected.length>100?`<li class="pmf-bulk-more">…and ${selected.length-100} more</li>`:'');confirm.disabled=!selected.length;confirm.textContent=`Queue ${selected.length} ${label}${selected.length===1?'':'s'}`;}catch(error){if(error.name!=='AbortError'){selected=[];dialog.querySelector('[data-bulk-count]').textContent=error.message;confirm.textContent=`Queue 0 ${label}s`;}}};const overlay=OverlayManager.open({node:dialog,root:backdrop,opener,modal:true,onClose:()=>controller?.abort()});refresh();dialog.addEventListener('change',refresh);dialog.querySelector('[name="first"]').addEventListener('input',Util.debounce(refresh,150));backdrop.addEventListener('click',(event)=>{const action=event.target.closest('[data-bulk-action]')?.dataset.bulkAction;if(action==='cancel')OverlayManager.close(overlay,'cancel');if(action==='confirm'&&selected.length){const batch=CatalogueJobManager.createBatch({label:`Bulk ${label}`,total:selected.length});selected.forEach(({record,action:actualAction},index)=>CatalogueJobManager.enqueue(CreatorIndexUI.context(record),actualAction,{creatorName:record.directory.creatorName,directorySnapshot:record.directory,batchId:batch.id,batchLabel:batch.label,batchSequence:index+1}));OverlayManager.close(overlay,'confirm');CreatorIndexUI.queuePanel.hidden=false;CreatorQueuePanel.render();}});
  };

  GM_addStyle(`
    #pmf-artists-root{width:min(1540px,calc(100% - 24px));margin:10px auto 18px;color:var(--pmf-text);font-family:Arial,sans-serif}
    #pmf-creator-mode-selector{display:block;width:var(--pmf-search-control-width,calc(100% - 20px));max-width:100%;box-sizing:border-box;margin:4px auto 10px;font-family:Arial,sans-serif}#pmf-creator-mode-selector>span{display:block;color:var(--pmf-muted);font-size:12px;text-align:left;margin:0 0 4px}
    #pmf-creator-mode-selector .pmf-mode-segments{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--pmf-border);border-radius:5px;overflow:hidden;background:var(--pmf-panel)}#pmf-creator-mode-selector button{min-height:32px;border:0;border-right:1px solid var(--pmf-border);background:#1a1f22;color:var(--pmf-text);border-radius:0}#pmf-creator-mode-selector button:last-child{border-right:0}#pmf-creator-mode-selector button.pmf-active{box-shadow:inset 0 0 0 2px var(--pmf-accent);background:#632c18;color:#fff}
    .pmf-creator-index-toolbar{width:min(920px,100%);margin:0 auto 12px}
    .pmf-creator-index-toolbar .pmf-controls{grid-template-columns:minmax(210px,1fr) minmax(210px,1fr) minmax(150px,190px) 52px}
    .pmf-creator-index-toolbar .pmf-native-proxy-controls{grid-template-columns:minmax(210px,1fr) minmax(210px,1fr) minmax(150px,190px) 52px}
    .pmf-menu-trigger{display:flex!important;align-items:center;justify-content:space-between;gap:8px;text-align:left}.pmf-control-menu{box-sizing:border-box;max-height:min(420px,70vh);overflow:auto}.pmf-control-menu button[aria-checked="true"]{box-shadow:inset 0 0 0 1px var(--pmf-accent);color:var(--pmf-accent)}
    .pmf-split-primary{display:grid;grid-template-columns:minmax(0,1fr) 38px;min-width:0}.pmf-split-primary .pmf-scan-button{width:100%}.pmf-split-chevron{padding:0!important;border-left-color:#b95b2e!important}
    .pmf-creator-index-grid{display:grid!important;gap:8px;width:100%;align-items:stretch}
    .pmf-creator-index-grid>*{min-width:0}
    .pmf-creator-index-grid>.user-card,.pmf-creator-index-grid>.pmf-catalogue-creator-card{box-sizing:border-box;min-height:var(--pmf-native-creator-card-height,100px);height:var(--pmf-native-creator-card-height,100px)}
    .pmf-creator-index-state{width:min(920px,100%);margin:8px auto;padding:18px;text-align:center;color:var(--pmf-muted);border:1px solid var(--pmf-border);border-radius:5px}.pmf-creator-index-state[data-state="error"]{color:#ffabab;border-color:#a54a4a}.pmf-creator-index-state[hidden]{display:none}
    .pmf-reconstructed-creator-card{position:relative;min-height:var(--pmf-native-creator-card-height,100px);overflow:hidden;border:1px solid var(--pmf-border);border-radius:8px;background:#1a1f22}.pmf-reconstructed-creator-link{display:block;min-height:var(--pmf-native-creator-card-height,100px);color:inherit;text-decoration:none}.pmf-reconstructed-creator-visual{position:absolute;inset:0;display:flex;align-items:center;padding:12px;background-size:cover;background-position:center;background-color:#252b2f}.pmf-reconstructed-creator-visual:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#101416e8 0%,#101416a8 55%,#10141678)}.pmf-reconstructed-creator-visual img,.pmf-reconstructed-avatar-placeholder{position:relative;z-index:1;width:76px;height:76px;object-fit:cover;border-radius:7px;background:#111;display:grid;place-items:center;font-size:30px}.pmf-reconstructed-creator-content{position:relative;z-index:2;display:flex;min-height:var(--pmf-native-creator-card-height,100px);box-sizing:border-box;flex-direction:column;justify-content:center;gap:4px;padding:12px 64px 12px 102px}.pmf-reconstructed-creator-content strong{font-size:20px;line-height:1.1}.pmf-reconstructed-creator-content small{color:#d8d8d8}
    .pmf-creator-index-paginator{--pmf-status-summary-gap:7px;display:flex!important;flex-direction:column;align-items:center;gap:var(--pmf-status-summary-gap)!important;margin:8px auto!important}.pmf-native-paginator-mirror{display:flex;flex-direction:column;align-items:center;gap:var(--pmf-status-summary-gap);width:100%}.pmf-native-status{grid-template-columns:minmax(0,1fr) auto!important}.pmf-native-status .pmf-status-actions{justify-self:start}.pmf-native-status .pmf-status-right{justify-self:end}
    .pmf-creator-index-paginator .pmf-quick-status-filters{display:flex;gap:6px}.pmf-creator-index-paginator .pmf-quick-status-filters button{position:relative;width:30px;height:28px;display:grid;place-items:center}
    .pmf-creator-index-paginator .pmf-quick-status-main svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2}.pmf-creator-index-paginator .pmf-quick-status-negate{display:none;position:absolute;right:1px;top:1px;width:10px;height:10px}.pmf-creator-index-paginator button.pmf-no-match .pmf-quick-status-negate{display:block}.pmf-creator-index-paginator button.pmf-match svg,.pmf-creator-index-paginator button.pmf-no-match .pmf-quick-status-main svg{fill:currentColor}
    .pmf-creator-card-right-rail{position:absolute;z-index:6;right:7px;top:6px;bottom:6px;display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;gap:4px;pointer-events:none}
    .pmf-creator-status-group{display:flex;justify-content:flex-end;gap:4px}.pmf-creator-status-middle{margin:auto 0}.pmf-creator-card-right-rail .pmf-creator-card-badges{position:static;transform:none}
    .pmf-creator-status-badge{display:grid;place-items:center;border:1px solid currentColor;border-radius:3px;background:#111d;box-sizing:border-box}.pmf-creator-status-badge svg{width:62%;height:62%;fill:none;stroke:currentColor;stroke-width:2}.pmf-creator-status-badge.pmf-creator-status-favorited{color:#ffd25b}.pmf-creator-status-badge.pmf-creator-status-liked{color:#ff5d9e}.pmf-creator-status-badge.pmf-creator-status-hidden{color:#d98989}.pmf-creator-status-size-small{width:18px;height:18px}.pmf-creator-status-size-medium{width:22px;height:22px}.pmf-creator-status-size-big{width:27px;height:27px}
    .pmf-creator-card-has-rail [data-pmf-creator-content]{padding-right:var(--pmf-creator-rail-width,0)!important}
    .pmf-hidden-creator-dimmed img,.pmf-hidden-creator-dimmed [style*="background"]{filter:saturate(var(--pmf-seen-saturate,.55)) brightness(var(--pmf-seen-brightness,.72));opacity:var(--pmf-seen-opacity,.72)}.pmf-hidden-creator-dim-low{--pmf-seen-saturate:.72;--pmf-seen-brightness:.86;--pmf-seen-opacity:.84}.pmf-hidden-creator-dim-medium{--pmf-seen-saturate:.52;--pmf-seen-brightness:.74;--pmf-seen-opacity:.74}.pmf-hidden-creator-dim-high{--pmf-seen-saturate:.25;--pmf-seen-brightness:.56;--pmf-seen-opacity:.58}
    .pmf-field-availability{text-align:center}.pmf-field-availability .pmf-availability-row{display:block!important;margin:9px auto!important;text-align:center!important}.pmf-availability-note{display:block;color:var(--pmf-muted);text-align:center}
    .pmf-creator-queue-panel{max-height:min(480px,calc(100vh - 220px));overflow:auto;overscroll-behavior:contain}.pmf-queue-tabs{display:flex;justify-content:center;gap:8px;border-bottom:1px solid var(--pmf-border);margin-bottom:10px}.pmf-queue-tabs button{border:0;background:transparent;color:var(--pmf-muted);padding:7px 12px}.pmf-queue-tabs button.pmf-active{color:var(--pmf-accent);border-bottom:2px solid var(--pmf-accent)}.pmf-queue-progress{display:grid;gap:5px;text-align:center;padding:9px;border-left:3px solid var(--pmf-success);background:#18231e}.pmf-queue-progress progress{width:100%;accent-color:var(--pmf-success)}.pmf-queue-batch{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 10px;align-items:center;margin-top:8px;padding:8px;border:1px solid var(--pmf-border);background:var(--pmf-panel)}.pmf-queue-batch>span{justify-self:end;color:var(--pmf-muted)}.pmf-queue-batch>progress{width:100%;grid-column:1/-1}.pmf-queue-batch>button{grid-column:2;grid-row:3}.pmf-queue-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--pmf-border)}.pmf-queue-row div{display:flex;flex-direction:column}.pmf-queue-row span{display:flex;gap:5px}.pmf-queue-row button{min-height:28px}.pmf-bulk-dialog .pmf-confirm-body{display:grid;gap:16px}.pmf-bulk-dialog .pmf-confirm-body section{padding:12px;border:1px solid var(--pmf-border);border-radius:5px;background:#191e21}.pmf-bulk-dialog h3{margin:0 0 10px;color:var(--pmf-accent);font-size:12px;text-transform:uppercase}.pmf-bulk-scope{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0}.pmf-bulk-scope span{display:flex;flex-direction:column;gap:3px}.pmf-bulk-scope small{color:var(--pmf-muted)}.pmf-bulk-scope input[type="number"]{width:82px}.pmf-bulk-dialog [data-bulk-preview]{max-height:210px;overflow:auto;margin:8px 0 0}.pmf-bulk-dialog [data-bulk-preview] li{display:flex;justify-content:space-between;gap:14px;padding:5px 0}.pmf-bulk-dialog [data-bulk-preview] small{color:var(--pmf-muted)}
    @media(max-width:760px){.pmf-creator-index-toolbar .pmf-controls,.pmf-creator-index-toolbar .pmf-native-proxy-controls{grid-template-columns:1fr 1fr 52px}.pmf-creator-index-toolbar .pmf-filter-button{grid-column:1/-1}.pmf-split-primary{grid-column:2}.pmf-creator-index-grid{grid-template-columns:1fr!important}}
  `);

  GM_addStyle('.pmf-bulk-dialog [data-bulk-preview]{padding-right:18px;scrollbar-width:none;-ms-overflow-style:none}.pmf-bulk-dialog [data-bulk-preview]::-webkit-scrollbar{display:none}.pmf-bulk-dialog [data-bulk-preview] li{display:grid!important;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center}.pmf-bulk-dialog [data-bulk-preview] strong{overflow-wrap:anywhere}.pmf-bulk-dialog .pmf-bulk-more{display:block!important;color:var(--pmf-muted)}');

  const ArtistsPageController = {
    page:null,found:null,cards:[],cardByElement:new Map(),metas:new Map(),states:new Map(),directory:new Map(),metaErrors:new Set(),controller:null,observer:null,generation:0,refreshRevision:0,refreshPromise:null,refreshPending:false,refreshReasons:new Set(),unsubscribeJob:null,unsubscribeSettings:null,renderingOwnedUi:false,backfillQueue:[],backfillKeys:new Set(),backfillActive:0,
    isPmfNode(node){return Boolean(node?.nodeType===1&&(node.matches?.('[data-pmf-owned="true"]')||node.closest?.('[data-pmf-owned="true"]')));},
    isRelevantNativeMutation(mutation){if(ArtistsPageController.isPmfNode(mutation.target))return false;const changed=[...mutation.addedNodes,...mutation.removedNodes].filter((node)=>node.nodeType===1);return !changed.length||changed.some((node)=>!ArtistsPageController.isPmfNode(node));},
    renderBadgesFromCurrentState(){if(!ArtistsPageController.mounted())return;ArtistsPageController.renderingOwnedUi=true;try{CreatorIndexUI.render();}finally{queueMicrotask(()=>{ArtistsPageController.renderingOwnedUi=false;});}},
    mounted(){return Boolean(ArtistsPageController.controller&&!ArtistsPageController.controller.signal.aborted&&ArtistsPageController.found?.grid?.isConnected&&CreatorIndexUI.root?.isConnected&&CreatorIndexUI.grid?.isConnected);},
    health(page=Route.parsePage(location.href)){return page.kind==='artists'&&ArtistsPageController.mounted()&&ArtistsPageController.page?.pageKey===page.pageKey&&CreatorIndexUI.nativeGrid===ArtistsPageController.found.grid&&CreatorIndexUI.nativeSnapshot?.grid===ArtistsPageController.found.grid&&ArtistsDOM.creatorLinks(CreatorIndexUI.grid,{nativeOnly:true}).length===0;},
    async mount(page,{generation:routeGeneration=Lifecycle.routeGeneration,signal:routeSignal}={}) {
      const guard=()=>!routeSignal?.aborted&&routeGeneration===Lifecycle.routeGeneration&&Route.parsePage(location.href).kind==='artists'&&Route.parsePage(location.href).pageKey===page.pageKey;
      AttachmentBadgeSizing.applyAll({reason:'artists-mount'});await Cache.migrateCatalogueOnly();if(!guard())return false;if(ArtistsPageController.health(page)){await ArtistsPageController.refresh();return guard();}ArtistsPageController.cleanup();if(!guard())return false;const found=ArtistsDOM.find();if(!found)return false;
      ArtistsPageController.page=page;ArtistsPageController.found=found;ArtistsPageController.controller=new AbortController();const signal=ArtistsPageController.controller.signal;const generation=++ArtistsPageController.generation;try{CreatorIndexUI.mount(found);}catch(error){CreatorIndexUI.cleanup();NativeArtistsVisibility.restore(CreatorIndexUI.nativeSnapshot);throw error;}
      const contextMenu=(event)=>ArtistsPageController.handleContextMenu(event);const keyboardMenu=(event)=>{if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){const card=event.target.closest?.('[data-pmf-creator-key]');if(card&&ArtistsPageController.cardByElement.has(card)){event.preventDefault();ArtistsPageController.openAction(ArtistsPageController.cardByElement.get(card));}}};[CreatorIndexUI.grid,found.grid].forEach((grid)=>{grid.addEventListener('contextmenu',contextMenu,{signal});grid.addEventListener('keydown',keyboardMenu,{signal});});
      const schedule=Util.debounce(()=>{if(generation===ArtistsPageController.generation)ArtistsPageController.requestRefresh('native-mutation');},120);ArtistsPageController.observer=new MutationObserver((mutations)=>{if(ArtistsPageController.renderingOwnedUi)return;if(mutations.some(ArtistsPageController.isRelevantNativeMutation))schedule();});ArtistsPageController.observer.observe(found.grid,{childList:true,subtree:true});window.addEventListener('resize',()=>{CreatorGridGeometry.apply(CreatorIndexUI.grid,CreatorIndexUI.nativeGeometry);CreatorCardBadgeRenderer.refreshReservations(CreatorIndexUI.grid,'window-resize');},{signal});signal.addEventListener('abort',()=>schedule.cancel(),{once:true});
      ArtistsPageController.unsubscribeJob=CatalogueJobManager.subscribe(()=>ArtistsPageController.renderJobs());ArtistsPageController.unsubscribeSettings=SettingsEvents.subscribe((event)=>{if(!ArtistsPageController.mounted())return;CatalogueJobManager.setConcurrency(event.current.catalogueConcurrentJobs);AttachmentBadgeSizing.applyAll({reason:'settings-event'});ArtistsPageController.renderBadgesFromCurrentState();Logger.info({operation:'creator-badge-settings-applied',enabled:event.current.creatorCardBadges.enabled,enabledTypes:CreatorCardBadgeRenderer.enabledTypes(event.current.creatorCardBadges),visibleCardCount:ArtistsPageController.cards.length,changed:event.changed});});try{await ArtistsPageController.requestRefresh('mount');}catch(error){CreatorIndexUI.setState('error',`Could not load the creator index: ${error.message}`);Logger.error('Could not load the creator index.',error);return guard();}if(!guard()){ArtistsPageController.cleanup();return false;}if(Logger.debug)Logger.info({operation:'artists-page-mounted',pageKey:page.pageKey,creatorCardCount:ArtistsPageController.cards.length});return true;
    },
    requestRefresh(reason='request') {
      ArtistsPageController.refreshReasons.add(reason);if(ArtistsPageController.refreshPromise){ArtistsPageController.refreshPending=true;return ArtistsPageController.refreshPromise;}const run=async()=>{do{ArtistsPageController.refreshPending=false;const reasons=[...ArtistsPageController.refreshReasons];ArtistsPageController.refreshReasons.clear();await ArtistsPageController.refreshNow(reasons);}while(ArtistsPageController.refreshPending&&ArtistsPageController.mounted());};ArtistsPageController.refreshPromise=run().finally(()=>{ArtistsPageController.refreshPromise=null;});return ArtistsPageController.refreshPromise;
    },
    async refresh(){return ArtistsPageController.requestRefresh('legacy-refresh');},
    async refreshNow(reasons=[]) {
      const generation=ArtistsPageController.generation;const revision=++ArtistsPageController.refreshRevision;if(!ArtistsPageController.mounted())return;const found=ArtistsPageController.found;if(!found?.grid?.isConnected)throw new Error('The saved native creator grid is no longer connected.');
      const cards=ArtistsDOM.creatorCards(found,{nativeOnly:true});const captured=cards.map((info)=>CreatorDirectory.fromCard(info));const priorDirectory=await Cache.getCreatorDirectory(captured.map((record)=>record.creatorKey));const merged=captured.map((record)=>CreatorDirectory.merge(priorDirectory.get(record.creatorKey)||{},record));await Cache.putCreatorDirectory(merged);const allMetas=await Cache.getCreatorMetas();const existingDirectory=await Cache.getCreatorDirectory();const discovered=[];for(const [key,meta] of allMetas){if(existingDirectory.has(key))continue;const [domain,service,creatorId]=String(key).split('|');discovered.push(CreatorDirectory.normalize({creatorKey:key,domain,service,creatorId,creatorName:meta.creatorName||meta.name||creatorId,creatorUrl:`https://${domain}/${service}/user/${creatorId}`,firstSeenAt:meta.createdAt||meta.scannedAt||Date.now()}));}if(discovered.length)await Cache.putCreatorDirectory(discovered);const directory=await Cache.getCreatorDirectory();const keys=[...directory.keys()];let metas;try{metas=await Cache.getCreatorMetas(keys);ArtistsPageController.metaErrors.clear();}catch{metas=new Map();keys.forEach((key)=>ArtistsPageController.metaErrors.add(key));}const states=await Cache.getCreatorStates(keys);if(generation!==ArtistsPageController.generation||revision!==ArtistsPageController.refreshRevision){Logger.info({operation:'artists-refresh-discarded',generation,revision,reasons});return;}ArtistsPageController.metas=metas;ArtistsPageController.states=states;ArtistsPageController.directory=directory;
      const records=keys.map((key)=>{const meta=metas.get(key);const normalized=CatalogueModel.normalize(meta||{},{restoreTransient:false});const catalogue=normalized.catalogue;const summary=catalogue.creatorCardSummary;const state=states.get(key)||CreatorState.empty(key);return{directory:directory.get(key),meta,state,summary:CreatorCatalogueSummary.valid(summary,catalogue)?summary:null,catalogueState:CatalogueModel.evaluateCoverage(catalogue).coverageComplete?'complete':Number(catalogue.storedPostCount)>0||Object.keys(catalogue.pageCoverage||{}).length>0?'partial':'unscanned',scanned:Number(catalogue.storedPostCount)>0||Object.keys(catalogue.pageCoverage||{}).length>0,favorite:state.favoriteDirectValue};});
      await ArtistsPageController.hydrateDynamicAggregates(records);if(generation!==ArtistsPageController.generation||revision!==ArtistsPageController.refreshRevision)return;
      records.forEach((record)=>ArtistsPageController.scheduleBackfill({
        context:{
          creatorKey:record.directory.creatorKey,
          domain:record.directory.domain,
          service:record.directory.service,
          creatorId:record.directory.creatorId,
          creatorUrl:record.directory.creatorUrl,
        },
        creatorName:record.directory.creatorName,
      },record.meta));
      const byKey=new Map(records.map((record)=>[record.directory.creatorKey,record]));const nativeRecords=cards.map((info)=>{const record=byKey.get(info.context.creatorKey);if(!record)return null;record.nativeInfo=info;return record;}).filter(Boolean);CreatorIndexUI.setRecords(records,nativeRecords);ArtistsPageController.renderJobs();
    },
    async hydrateDynamicAggregates(records=[]) {
      const filter=CreatorFilterEngine.normalizeState(CreatorIndexUI.filterState);const extensions=filter.media.customExtensions?.enabled?filter.media.customExtensions.extensions:[];const rules=filter.customRules.filter((rule)=>rule.enabled);if(!extensions.length&&!rules.length)return;
      const extensionFingerprint=extensions.length?CreatorCatalogueSummary.extensionFingerprint(extensions):'';const pending=records.filter((record)=>record.summary&&record.summary.completeness==='complete'&&(extensionFingerprint&&!record.summary.customExtensionAggregates?.[extensionFingerprint]||rules.some((rule)=>!record.summary.customRuleAggregates?.[CreatorCatalogueSummary.ruleFingerprint(rule)])));
      let cursor=0;const worker=async()=>{while(cursor<pending.length){const record=pending[cursor++],key=record.directory.creatorKey;const posts=await Cache.getCreatorPosts(key);const summary=Util.clone(record.summary);summary.customExtensionAggregates={...(summary.customExtensionAggregates||{})};summary.customRuleAggregates={...(summary.customRuleAggregates||{})};if(extensionFingerprint&&!summary.customExtensionAggregates[extensionFingerprint]){const aggregate=CreatorCatalogueSummary.customExtensionAggregate(posts,extensions);summary.customExtensionAggregates[aggregate.fingerprint]=aggregate;}rules.forEach((rule)=>{const fingerprint=CreatorCatalogueSummary.ruleFingerprint(rule);if(!summary.customRuleAggregates[fingerprint])summary.customRuleAggregates[fingerprint]=CreatorCatalogueSummary.customRuleAggregate(posts,rule);});record.summary=summary;record.meta=await Cache.patchMeta(key,{catalogue:{creatorCardSummary:summary}});}};
      await Promise.all(Array.from({length:Math.min(4,pending.length)},()=>worker()));if(pending.length&&Logger.debug)Logger.info({operation:'creator-dynamic-aggregates-hydrated',creatorCount:pending.length,extensionFingerprint,customRuleCount:rules.length});
    },
    scheduleBackfill(info,meta) {
      if(!meta||ArtistsPageController.backfillKeys.has(info.context.creatorKey))return;const normalized=CatalogueModel.normalize(meta,{restoreTransient:false});const evaluation=CatalogueModel.evaluateCoverage(normalized.catalogue);if(!evaluation.coverageComplete||CreatorCatalogueSummary.valid(normalized.catalogue.creatorCardSummary,normalized.catalogue))return;
      ArtistsPageController.backfillKeys.add(info.context.creatorKey);ArtistsPageController.backfillQueue.push({context:info.context,creatorName:info.creatorName,generation:ArtistsPageController.generation});ArtistsPageController.pumpBackfills();
    },
    pumpBackfills() {
      while(ArtistsPageController.backfillActive<2&&ArtistsPageController.backfillQueue.length){const task=ArtistsPageController.backfillQueue.shift();ArtistsPageController.backfillActive+=1;const run=async()=>{const started=Date.now();try{const summary=await CreatorCatalogueSummary.recomputeAndPersist(task.context);if(Logger.debug)Logger.info({operation:'creator-summary-backfill',creatorKey:task.context.creatorKey,postCount:summary.sourcePostCount,counts:summary.counts,fingerprint:summary.classificationFingerprint,elapsedMs:Date.now()-started});if(task.generation===ArtistsPageController.generation&&ArtistsPageController.mounted())await ArtistsPageController.refresh();}catch(error){Logger.warn('Creator summary backfill failed.',error);}finally{ArtistsPageController.backfillActive-=1;ArtistsPageController.pumpBackfills();}};if(typeof requestIdleCallback==='function')requestIdleCallback(()=>run(),{timeout:800});else setTimeout(run,0);}
    },
    handleContextMenu(event) {
      const card=event.target.closest?.('[data-pmf-creator-key]');const info=card&&ArtistsPageController.cardByElement.get(card);if(!info)return;event.preventDefault();ArtistsPageController.openAction(info);
    },
    async openAction(info) {
      const key=info.context.creatorKey;const active=CatalogueJobManager.activeForCreator(key);if(active){CatalogueJobManager.stop(key);GlobalUI.flash(`Stopping ${active.creatorName}.`);return;}const queued=CatalogueJobManager.queuedForCreator(key);if(queued){CatalogueJobManager.removeQueued(key);GlobalUI.flash(`Removed ${queued.creatorName} from the queue.`);return;}
      let meta=ArtistsPageController.metas.get(key);let loadError=ArtistsPageController.metaErrors.has(key);if(!meta&&!loadError){try{meta=await Cache.getMeta(key);}catch{loadError=true;}}const action=ArtistCatalogueAction.forState(meta,null,{loadError});if(action==='unavailable'){GlobalUI.flash('Catalogue metadata is unavailable for this creator.');return;}const name=info.displayName||CreatorDisplayName.format({creatorName:info.creatorName,service:info.context.service,serviceLabel:info.serviceLabel});const start=()=>CatalogueJobManager.enqueue(info.context,action,{creatorName:name});if(action==='update'||!Settings.value.confirmCreatorCardScan){start();return;}const config=action==='resume'?{title:`Resume scan for ${name}?`,paragraphs:['This creator has a partial scan. Only missing or unverified pages will be requested.'],label:'Resume'}:{title:`Scan ${name}?`,paragraphs:['This will scan every post for this creator and store the available post metadata locally.'],label:'Scan'};UI.confirmDialog({title:config.title,paragraphs:config.paragraphs,confirmLabel:config.label,opener:info.card,onConfirm:start});
    },
    renderJobs() {
      if(!ArtistsPageController.mounted())return;ArtistsPageController.renderingOwnedUi=true;ArtistsPageController.cards.forEach((info)=>{const job=CatalogueJobManager.jobForCreator(info.context.creatorKey);const old=info.card.querySelector('.pmf-creator-card-job-status');if(!job){old?.remove();info.card.classList.remove('pmf-creator-card-job-active');return;}const status=old||document.createElement('span');status.className='pmf-creator-card-job-status';status.dataset.pmfOwned='true';status.setAttribute('role','status');const p=job.progress||{};const position=CatalogueJobManager.queuePosition(info.context.creatorKey);status.textContent=job.status==='queued'?`Queued · Position ${position}`:p.message||(job.kind==='update'?'Checking for new posts…':job.kind==='metadata-retry'?'Retrying optional details…':`${job.kind==='resume'?'Resuming scan':'Scanning'}${p.totalPages?` · ${p.page} / ${p.totalPages} pages`:p.page?` · Page ${p.page}`:''}`);const action=job.kind==='update'?'update':job.kind==='metadata-retry'?'metadata retry':'scan';const activeVerb=job.kind==='update'?'Updating':job.kind==='metadata-retry'?'Retrying optional details for':job.kind==='resume'?'Resuming scan for':'Scanning';status.setAttribute('aria-label',job.status==='queued'?`Queued ${action} for ${job.creatorName}, position ${position}`:`${activeVerb}${activeVerb.endsWith('for')?' ':' '}${job.creatorName}${p.page?`, page ${p.page}${p.totalPages?` of ${p.totalPages}`:''}`:''}`);if(!old)info.card.append(status);info.card.classList.toggle('pmf-creator-card-job-active',job.status==='running');if(['complete','failed','stopped'].includes(job.status)&&!job.artistsRefreshed){job.artistsRefreshed=true;queueMicrotask(()=>ArtistsPageController.refresh());}});queueMicrotask(()=>{ArtistsPageController.renderingOwnedUi=false;});
    },
    cleanup() {
      ArtistsPageController.generation+=1;ArtistsPageController.refreshRevision+=1;ArtistsPageController.controller?.abort();ArtistsPageController.controller=null;ArtistsPageController.observer?.disconnect();ArtistsPageController.observer=null;ArtistsPageController.unsubscribeJob?.();ArtistsPageController.unsubscribeJob=null;ArtistsPageController.unsubscribeSettings?.();ArtistsPageController.unsubscribeSettings=null;ArtistsPageController.cards.forEach((info)=>CreatorCardRightRail.cleanup(info.card));CreatorIndexUI.cleanup();ArtistsPageController.cards=[];ArtistsPageController.cardByElement.clear();ArtistsPageController.metas.clear();ArtistsPageController.states.clear();ArtistsPageController.directory.clear();ArtistsPageController.metaErrors.clear();ArtistsPageController.backfillQueue=[];ArtistsPageController.backfillKeys.clear();ArtistsPageController.refreshPending=false;ArtistsPageController.refreshReasons.clear();ArtistsPageController.refreshPromise=null;ArtistsPageController.page=null;ArtistsPageController.found=null;
    },
  };

  const App = {
    context: null, dom: null, ui: null, catalog: new Map(), nativeThumbnailById: new Map(),
    filterState: FilterEngine.createDefaultState(), activePresetId: '', presetSavedVisible: false, presetSavedTimer: null, query: '', filteredPage: 1, filteredAnchorId:'', filteredFirstResultIndex:0, sortMode:'published', sortDirection:'default',
    statuses:new Map(),
    creatorMeta: null, catalogueState: CatalogueModel.empty(),
    totalPosts: 0, totalPages: 0, sessionToken: 0, activeToken: 0, pageController: null, mutationObserver: null, searchOriginal: null, searchHandler: null, unsubscribeCatalogueJob:null,unsubscribePostStatus:null,
    persistDebounced: Util.debounce(() => App.persistUIState(), 220),
    savePresetDebounced: Util.debounce(() => App.saveActivePreset(), 320),
    saveActivePreset() {
      if (!App.activePresetId || !Presets.updateSnapshot(App.activePresetId, App.filterState)) return;
      App.presetSavedVisible = true; if (App.ui?.filterPopover) App.ui.filterPopover.querySelector('.pmf-preset-saved').textContent = 'Preset saved';
      clearTimeout(App.presetSavedTimer); App.presetSavedTimer = setTimeout(() => { App.presetSavedVisible = false; if (App.ui?.filterPopover) App.ui.filterPopover.querySelector('.pmf-preset-saved').textContent = ''; }, 1300);
    },
    activatePreset(id) {
      const preset = Presets.get(id); if (!preset) return false;
      App.savePresetDebounced.cancel(); App.saveActivePreset(); App.activePresetId = preset.id; App.filterState = Presets.apply(preset.snapshot, App.filterState); App.filteredPage = 1;App.filteredFirstResultIndex=0;App.filteredAnchorId=''; App.persistUIState(); UI.updateFilterButton(); App.render(); UI.refreshFilterPopover(); return true;
    },
    setSort(mode){
      const next=PostSorter.nextSelection(App.sortMode,App.sortDirection,mode);App.sortMode=next.mode;App.sortDirection=next.direction;App.filteredPage=1;App.filteredFirstResultIndex=0;App.filteredAnchorId='';App.persistUIState();UI.updateSortButton();App.render();return next;
    },
    cataloguePosts(){return [...App.catalog.values()].filter((post)=>post.cacheSources?.catalogue===true&&post.scanSchemaVersion===Config.schemaVersion);},
    cataloguePostCount(){return App.cataloguePosts().length;},
    statusFor(post){const status=App.statuses.get(String(post?.id||post?.postId||''))||PostStatus.empty({...App.context,postId:String(post?.id||post?.postId||''),postKey:post?.key});return {...status,resolvedFavorite:FavoriteStateResolver.resolve({postKey:status.key,postStatus:status,snapshotMeta:App.favoriteSnapshotMeta,snapshotMembership:App.favoriteSnapshotMembership})};},
    matchingPosts() { return PostSorter.sort(App.cataloguePosts().filter((post) => FilterEngine.matches(post, App.filterState, App.query,App.statusFor(post))),{mode:App.sortMode,direction:App.sortDirection}); },
    filteredPageSize(){return CompactLayoutEngine.pageSize();},
    async loadStatuses(creatorKey=App.context?.creatorKey){const statuses=await Cache.getCreatorStatuses(creatorKey);if(creatorKey!==App.context?.creatorKey)return;App.statuses=new Map(statuses.map((status)=>[String(status.postId),PostStatus.normalize(status)]));const host=App.context?.domain||location.hostname;App.favoriteSnapshotMeta=await Cache.getFavoriteSyncMeta(host);App.favoriteSnapshotMembership=await Cache.getFavoriteSnapshotKeys(host,App.favoriteSnapshotMeta?.activeSnapshotId);const session=CreatorSessionCache.get(creatorKey,{touch:false});if(session){session.statuses=App.statuses;session.favoriteSnapshotMeta=App.favoriteSnapshotMeta;session.favoriteSnapshotMembership=App.favoriteSnapshotMembership;}},
    restoreAnchorPage(){
      if(!App.filteredAnchorId)return false;const index=App.matchingPosts().findIndex((post)=>String(post.id)===String(App.filteredAnchorId));if(index<0)return false;
      App.filteredFirstResultIndex=index;const page=Math.floor(index/App.filteredPageSize())+1;if(page===App.filteredPage)return false;App.filteredPage=page;return true;
    },
    restoreFirstResultPage(totalMatches=App.matchingPosts().length){
      const pageSize=App.filteredPageSize();const clamped=Math.max(0,Math.min(Math.max(0,totalMatches-1),Number(App.filteredFirstResultIndex)||0));const page=Math.floor(clamped/pageSize)+1;if(page!==App.filteredPage)App.filteredPage=page;App.filteredFirstResultIndex=Math.max(0,(App.filteredPage-1)*pageSize);return App.filteredPage;
    },
    async loadCreator(context) {
      AttachmentBadgeSizing.applyAll({reason:'creator-load'});await Cache.migrateCatalogueOnly();
      const knownDirectory=await Cache.getCreatorDirectory([context.creatorKey]);await Cache.putCreatorDirectory([CreatorDirectory.merge(knownDirectory.get(context.creatorKey)||{},CreatorDirectory.normalize({...context,creatorUrl:location.href,lastSeenInDirectoryAt:Date.now()}))]);
      const retained=CreatorSessionCache.get(context.creatorKey);if(retained){App.sessionToken+=1;App.activeToken=App.sessionToken;CreatorSessionCache.restoreToApp(retained);App.context={...retained.context,...context};OperationIssues.clear();return true;}
      App.context = context; App.sessionToken += 1; App.activeToken = App.sessionToken; App.catalog = new Map();OperationIssues.clear();
      const token = App.sessionToken; const meta = await Cache.getMeta(context.creatorKey); if (token !== App.sessionToken) return false;
      App.creatorMeta = meta; App.catalogueState = CatalogueModel.normalize(meta || {});
      const cached = await Cache.getCreatorPosts(context.creatorKey);
      if (token !== App.sessionToken) return false; cached.forEach((post) => App.catalog.set(post.id, post));
      await App.loadStatuses(context.creatorKey);if(token!==App.sessionToken)return false;
      App.totalPosts = meta?.totalPosts || App.catalogueState.catalogue.totalExpectedPosts || 0; App.totalPages = meta?.totalPages || Math.ceil(App.totalPosts / Config.pageSize) || 0;
      if (meta) { await Catalogue.reconcileRestoredState(); if (token !== App.sessionToken) return false; }
      const saved = await Cache.getUIState(context.creatorKey); if (token !== App.sessionToken) return false;
      const migratedState = FilterEngine.normalizeState(saved?.filterState ? saved.filterState : FilterEngine.createDefaultState(Settings.value.legacyFilter));
      migratedState.externalLinks.scope = Settings.value.externalLinkScope;
      Presets.load(migratedState);
      App.activePresetId = Presets.get(saved?.activePresetId) ? saved.activePresetId : Presets.default().id;
      App.filterState = Presets.apply(Presets.get(App.activePresetId).snapshot, migratedState);
      App.filterState.externalLinks.scope = Settings.value.externalLinkScope;
      App.query = String(saved?.searchQuery || '');
      App.filteredPage = Math.max(1, Util.parseInteger(saved?.filteredPage, 1));
      App.filteredAnchorId=String(saved?.filteredAnchorId||'');
      App.filteredFirstResultIndex=Math.max(0,Util.parseInteger(saved?.filteredFirstResultIndex,(App.filteredPage-1)*Config.filteredPageSize));
      const sort=PostSorter.normalize(saved?.sortMode,saved?.sortDirection);App.sortMode=sort.mode;App.sortDirection=sort.direction;
      return true;
    },
    addNativeStubs() {
      App.dom?.nativeCards?.forEach((card) => { const native = PostNormalizer.fromNativeCard(card, App.context); if (native && !App.catalog.has(native.id)) App.catalog.set(native.id, native); });
    },
    async rebindNativePage(context, dom) {
      App.detachPage(); App.context = context; App.dom = dom; App.totalPosts = dom.totalPosts || App.totalPosts; App.totalPages = App.totalPosts ? Math.ceil(App.totalPosts / Config.pageSize) : App.totalPages;
      App.pageController = new AbortController();App.unsubscribeCatalogueJob?.();App.unsubscribeCatalogueJob=CatalogueJobManager.subscribe(()=>{if(!App.context||App.context.creatorKey!==context.creatorKey)return;const job=CatalogueJobManager.jobForCreator(context.creatorKey);if(job?.status==='running'&&job.progress){UI.setScanning?.();UI.updateCatalogueProgress?.(job.progress);return;}if(job&&['complete','failed','stopped'].includes(job.status)&&!job.creatorPageReloaded){job.creatorPageReloaded=true;UI.reloadCurrentCreatorData?.();return;}UI.setScanning?.();App.renderStatus?.();});
      App.nativeThumbnailById = new Map(dom.nativeCards.map((card) => [String(card.dataset.id), card.querySelector('.post-card__image')?.src || '']));
      App.searchOriginal = { parent: dom.searchForm.parentNode, nextSibling: dom.searchForm.nextSibling, placeholder: dom.searchInput.placeholder, value: dom.searchInput.value };
      dom.tabs?.insertAdjacentElement('afterend', dom.searchForm); Lifecycle.removeStaleRoots(); UI.mount(); App.addNativeStubs(); App.bindSearch(); App.observeNativeDOM(); CompactLayoutEngine.connect(); App.render();const session=CreatorSessionCache.get(context.creatorKey);if(session?.dirtyStatusKeys?.size){session.dirtyStatusKeys.clear();}if(session?.scrollY)requestAnimationFrame(()=>globalThis.scrollTo?.(0,session.scrollY)); return true;
    },
    bindSearch() {
      const input = App.dom.searchInput; if (App.cataloguePostCount()) input.value = App.query;
      App.searchHandler = Util.debounce(() => { if (!App.cataloguePostCount()) return; App.query = input.value; App.filteredPage = 1; App.persistDebounced(); App.render(); }, 200);
      input.addEventListener('input', App.searchHandler, { signal: App.pageController.signal });
      App.dom.searchForm.addEventListener('submit', (event) => { if (!App.cataloguePostCount()) return; event.preventDefault(); App.query = input.value; App.filteredPage = 1; App.persistUIState(); App.render(); }, { capture: true, signal: App.pageController.signal });
    },
    observeNativeDOM() {
      const schedule = Util.debounce(() => Lifecycle.routeHealth('native DOM mutation'), 160);
      App.mutationObserver = new MutationObserver((mutations) => {
        const relevant = mutations.some((mutation) => !mutation.target.closest?.('[data-pmf-owned="true"]') && [...mutation.addedNodes, ...mutation.removedNodes].some((node) => node.nodeType === 1 && !node.closest?.('[data-pmf-owned="true"]')));
        if (relevant) schedule();
      });
      const target = document.querySelector('#component-container') || App.dom.grid.parentElement; if (target) App.mutationObserver.observe(target, { childList: true, subtree: true });
      App.pageController.signal.addEventListener('abort', () => schedule.cancel(), { once: true });
    },
    requiresRebind(context, dom) { return !App.ui?.root?.isConnected || App.context?.nativePageKey !== context.nativePageKey || App.dom?.searchForm !== dom.searchForm || App.dom?.grid !== dom.grid || !App.dom?.grid?.isConnected; },
    async mergePosts(posts, persist = false) {
      if (persist) await Cache.putPosts(posts);
      posts.forEach((post) => {
        const existing = App.catalog.get(post.id);
        App.catalog.set(post.id, Cache.mergePost(existing, post));
      });
      App.render();
    },
    async reclassifyCatalog() {
      const posts = [];
      for (const post of App.cataloguePosts()) {
        if (post.completeness === 'unresolved' || post.scanSchemaVersion !== Config.schemaVersion) continue;
        const next = PostNormalizer.normalize(PostNormalizer.rawFromStored(post), App.context, post.thumbnailUrl);
        if (next) { next.completeness = post.completeness; App.catalog.set(next.id, next); posts.push(next); }
      }
      if (posts.length) await Cache.putPosts(posts); App.render();
    },
    uiStateRecord() {
      return { creatorKey: App.context.creatorKey, activePresetId: App.activePresetId, selectedMediaFilters: FilterEngine.enabledCategories(App.filterState), mediaMatchMode: App.filterState.media.matchMode, externalLinkScope: App.filterState.externalLinks.scope, customExtensionsEnabled: App.filterState.media.enabled.customExtensions, customExtensions: App.filterState.customExtensions.values, customRulesEnabled: App.filterState.customRules.enabled, customRules: App.filterState.customRules.rows, publishedDateEnabled: App.filterState.publishedDate.enabled, publishedDateFilter: App.filterState.publishedDate, filterState: App.filterState, searchQuery: App.query, filteredPage: App.filteredPage, filteredAnchorId:App.filteredAnchorId,filteredFirstResultIndex:App.filteredFirstResultIndex, sortMode:App.sortMode, sortDirection:App.sortDirection, scrollY:globalThis.scrollY||0, updatedAt: Date.now() };
    },
    persistUIState() { if (!App.context) return Promise.resolve(); return Cache.putUIState(App.uiStateRecord()).catch((error) => Logger.warn('Could not persist creator UI state.', error)); },
    render() {
      if (!App.ui) return;return PmfDomMutationGuard.run(()=>{App.dom.searchInput.placeholder = App.cataloguePostCount() ? 'Search scanned posts…' : App.searchOriginal.placeholder; UI.setScanning(); UI.updateFilterButton();UI.updateSortButton();UI.updateQuickStatusFilters();
      if (App.cataloguePostCount()) App.renderCompact(); else App.renderNative(); App.renderStatus(); UI.renderErrors();});
    },
    renderCompact() {
      const matches = App.matchingPosts(); App.dom.grid.hidden = true; App.ui.grid.hidden = false; App.ui.paginator.hidden = false; App.dom.countNodes.forEach((node) => { node.hidden = true; }); App.dom.menuNodes.forEach((node) => { node.hidden = true; }); if (App.dom.bottomPaginator) App.dom.bottomPaginator.hidden = true;
      const sizingReason=CompactGridScale.pendingReason||'render';CompactGridScale.pendingReason='';CompactLayoutEngine.apply({reason:sizingReason,verify:false});
      if(App.filteredAnchorId)App.restoreAnchorPage();else App.restoreFirstResultPage(matches.length);Paginator.render(matches.length);const pageSize=App.filteredPageSize();const start=(App.filteredPage-1)*pageSize;App.filteredFirstResultIndex=start;App.filteredAnchorId=matches[start]?.id||App.filteredAnchorId;App.ui.grid.replaceChildren();const pagePosts=matches.slice(start,start+pageSize);
      if (!pagePosts.length) { const empty = document.createElement('div'); empty.className = 'pmf-empty'; empty.innerHTML = '<strong>No matching posts</strong><span>Adjust filters, search, or sorting.</span>'; App.ui.grid.append(empty); }
      else pagePosts.forEach((post) => App.ui.grid.append(App.dom.template ? CardRenderer.clone(post) : CardRenderer.fallback(post)));
      let renderedCardCount=App.ui.grid.querySelectorAll?App.ui.grid.querySelectorAll(':scope > article.post-card').length:pagePosts.length;if(pagePosts.length&&renderedCardCount!==pagePosts.length){if(Logger.debug)Logger.warn('Compact clone assertion failed; using generated cards.',{expected:pagePosts.length,actual:renderedCardCount});App.ui.grid.replaceChildren(...pagePosts.map(CardRenderer.fallback));renderedCardCount=App.ui.grid.querySelectorAll?App.ui.grid.querySelectorAll(':scope > article.post-card').length:pagePosts.length;}
      CompactLayoutEngine.apply({reason:sizingReason});Logger.info({operation:'compact-render',creatorKey:App.context?.creatorKey,filteredPage:App.filteredPage,pageSize,totalMatches:matches.length,sliceCount:pagePosts.length,renderedCardCount,sortMode:App.sortMode,sortDirection:App.sortDirection});
    },
    renderNative() {
      CompactThumbnailRatio.clearOwnedStyles();CardRenderer.clearCropDebug();
      App.dom.grid.hidden = false; App.ui.grid.hidden = true; App.ui.paginator.hidden = true; App.dom.countNodes.forEach((node) => { node.hidden = false; }); App.dom.menuNodes.forEach((node) => { node.hidden = false; }); if (App.dom.bottomPaginator) App.dom.bottomPaginator.hidden = false;
      [...App.dom.grid.querySelectorAll('article.post-card[data-id]')].forEach((card) => { const post = App.catalog.get(String(card.dataset.id)); card.classList.remove('pmf-dimmed','pmf-hidden-card'); BadgeRenderer.apply(card, post);StatusBadgeRenderer.apply(card,post);SeenCardTreatment.apply(card,post); });
    },
    renderStatus() {
      if (!App.ui || App.context&&CatalogueJobManager.activeForCreator(App.context.creatorKey)) return; const matches = App.matchingPosts();const count=App.cataloguePostCount();
      App.ui.statusLeft.innerHTML = `<strong>${count ? Icons.check : ''}${count?matches.length:App.dom.nativeCards.length} matches</strong>`;
      const state=App.catalogueState.catalogue;const evaluation=CatalogueModel.evaluateCoverage(state);
      if(!count&&state.status==='none')App.ui.statusRight.textContent='Ready to scan';
      else if(!evaluation.coverageComplete){const pages=evaluation.missingOffsets.length;App.ui.statusRight.textContent=`Scan incomplete${pages?` · ${pages} page${pages===1?'':'s'} remaining`:''}`;}
      else{const updated=state.lastUpdateCheckAt;const today=updated&&new Date(updated).toDateString()===new Date().toDateString();App.ui.statusRight.textContent=`Catalogue · ${count||evaluation.storedPostCount} posts${updated?` · Updated ${today?'today':Util.formatDate(new Date(updated).toISOString())}`:''}`;}
    },
    detachPage() {
      return PmfDomMutationGuard.run(()=>{
      OverlayManager.closeAll('page-detach');
      CreatorSessionCache.captureFromApp();CompactLayoutEngine.cleanup();App.unsubscribeCatalogueJob?.();App.unsubscribeCatalogueJob=null;App.pageController?.abort(); App.pageController = null; App.mutationObserver?.disconnect(); App.mutationObserver = null; App.searchHandler?.cancel?.(); App.searchHandler = null;
      if (App.dom) { App.dom.nativeCards?.forEach((card) => { card.classList.remove('pmf-dimmed','pmf-hidden-card'); BadgeRenderer.cleanup(card);StatusBadgeRenderer.cleanup(card);SeenCardTreatment.cleanup(card); }); App.dom.grid.hidden = false; App.dom.countNodes?.forEach((node)=>{node.hidden=false;}); App.dom.menuNodes?.forEach((node)=>{node.hidden=false;}); if (App.dom.bottomPaginator) App.dom.bottomPaginator.hidden=false; }
      if (App.searchOriginal && App.dom?.searchForm) { App.dom.searchInput.placeholder = App.searchOriginal.placeholder; if(App.searchOriginal.parent?.isConnected){if (App.searchOriginal.nextSibling?.parentNode === App.searchOriginal.parent) App.searchOriginal.parent.insertBefore(App.dom.searchForm, App.searchOriginal.nextSibling); else App.searchOriginal.parent.append(App.dom.searchForm);} }
      document.querySelectorAll(`[data-pmf-instance="${CSS.escape(INSTANCE_ID)}"]`).forEach((node)=>node.remove()); App.ui=null; App.dom=null; App.searchOriginal=null;});
    },
    fullCleanup() { App.persistDebounced.cancel(); App.savePresetDebounced.cancel(); App.saveActivePreset(); App.persistUIState(); App.sessionToken += 1; App.activeToken = App.sessionToken; App.detachPage(); App.context=null; App.creatorMeta=null; App.catalogueState=CatalogueModel.empty(); App.catalog=new Map();App.statuses=new Map(); App.nativeThumbnailById=new Map(); App.query=''; App.filteredPage=1;App.filteredAnchorId='';App.filteredFirstResultIndex=0;App.sortMode='published';App.sortDirection='default'; App.totalPosts=0; App.totalPages=0; },
  };

  GM_addStyle(`
    :root{--pmf-bg:#121416;--pmf-surface-1:#191c1f;--pmf-surface-2:#202428;--pmf-surface-3:#292e33;--pmf-border:#41484e;--pmf-border-strong:#5a636b;--pmf-text:#f2f3f4;--pmf-muted:#aab1b7;--pmf-accent:#e8793c;--pmf-accent-hover:#ff9558;--pmf-accent-soft:#522816;--pmf-danger:#ef7064;--pmf-success:#55c977;--pmf-shadow:0 18px 55px #000c;--pmf-radius:6px;--pmf-control-height:32px;--pmf-dialog-content-padding:16px;--pmf-editor-section-gap:12px;--pmf-font:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
    #pmf-root,#pmf-root *,.pmf-modal-backdrop,.pmf-modal-backdrop *,.pmf-floating-menu,.pmf-floating-menu *{box-sizing:border-box;font-family:var(--pmf-font)}
    #pmf-root{position:relative;z-index:30;width:min(960px,calc(100% - 24px));margin:8px auto 10px;color:var(--pmf-text)}
    .pmf-surface{color:var(--pmf-text);background:var(--pmf-surface-2);border:1px solid var(--pmf-border);border-radius:var(--pmf-radius);box-shadow:var(--pmf-shadow)}
    .pmf-toolbar{overflow:visible;background:linear-gradient(180deg,#1f2326e8,#171a1de8);border:1px solid var(--pmf-border);border-radius:var(--pmf-radius);box-shadow:0 6px 18px #0007}
    .pmf-controls{display:grid;grid-template-columns:minmax(210px,1fr) minmax(150px,.78fr) minmax(145px,160px) 48px;gap:16px;align-items:center;padding:9px 18px;border-bottom:1px solid var(--pmf-border)}
    .pmf-controls button,.pmf-controls select,.pmf-dialog button,.pmf-dialog input:not([type="checkbox"]):not([type="radio"]),.pmf-dialog select,.pmf-filter-popover button,.pmf-filter-popover select{min-height:var(--pmf-control-height);color:var(--pmf-text);background:var(--pmf-surface-1);border:1px solid var(--pmf-border-strong);border-radius:4px;padding:0 11px;font-size:14px}
    .pmf-controls button,.pmf-dialog button,.pmf-filter-popover button,.pmf-settings-layout>nav button{cursor:pointer}.pmf-controls button:hover,.pmf-dialog button:hover,.pmf-filter-popover button:hover{background:var(--pmf-surface-3);border-color:#707980}
    .pmf-filter-button{position:relative;overflow:hidden;text-align:left;text-overflow:ellipsis;white-space:nowrap;padding-right:30px!important}.pmf-filter-button::after{content:'▾';position:absolute;right:10px;color:var(--pmf-muted)}
    .pmf-sort-button{display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;white-space:nowrap}.pmf-sort-label{min-width:0;overflow:hidden;text-overflow:ellipsis}.pmf-sort-direction{flex:none;color:var(--pmf-muted)}.pmf-sort-menu button[aria-checked="true"]{color:#ffc09a;background:var(--pmf-surface-3)}
    .pmf-scan-button{color:#ffad7d!important;border-color:#8e431b!important;background:#51230d!important;white-space:nowrap}.pmf-scan-button:hover{color:#ffd0b4!important;background:#713015!important}.pmf-stop-button{color:#ffb0a8!important;border-color:#98443b!important;background:#54211d!important}
    .pmf-icon-button{display:grid;place-items:center;padding:0!important}.pmf-icon-button svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8}
    .pmf-status{min-height:39px;display:flex;align-items:center;padding:7px 13px;font-size:13px}.pmf-status-left{display:flex;align-items:center;gap:12px;min-width:0}.pmf-status-left strong{display:flex;align-items:center;gap:5px;color:var(--pmf-success)}.pmf-status-left strong svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2}.pmf-status-left span:not(:first-child)::before{content:'·';margin-right:12px;color:#697177}.pmf-status-actions{display:flex;gap:6px;margin-left:8px}.pmf-status-actions button{color:#eeb18d;background:transparent;border:0;text-decoration:underline;cursor:pointer}.pmf-status-right{margin-left:auto;color:#dce0e2;white-space:nowrap}
    .pmf-progress{height:3px;background:#23282c;overflow:hidden}.pmf-progress span{display:block;width:0;height:100%;background:linear-gradient(90deg,var(--pmf-accent),#f2a371);transition:width .2s}.pmf-catalogue-details,.pmf-scan-error-details{max-height:320px;overflow:auto;overscroll-behavior:contain;margin:0 12px 10px;padding:13px;color:var(--pmf-text);background:var(--pmf-surface-1);border:1px solid var(--pmf-border);border-radius:4px;font:12.5px/1.45 Arial,sans-serif;scrollbar-width:none}.pmf-catalogue-details::-webkit-scrollbar,.pmf-scan-error-details::-webkit-scrollbar{width:0;height:0}.pmf-scan-error-details{max-height:150px;color:#ffbbb3;background:#251a1a;border-color:#693c37;white-space:pre-wrap;font-family:ui-monospace,monospace}.pmf-details-summary{padding:10px 12px;border-left:3px solid var(--pmf-success);background:#18231e}.pmf-details-summary h3,.pmf-details-section h3{margin:0 0 5px;font-size:13px}.pmf-details-summary p,.pmf-details-section p{margin:4px 0}.pmf-details-summary.pmf-details-warning{border-color:var(--pmf-accent);background:#282017}.pmf-details-summary.pmf-details-error,.pmf-details-section.pmf-details-error{border-color:#a94b43;background:#291b1b}.pmf-details-summary-actions{display:flex;justify-content:center;gap:8px;margin-top:10px}.pmf-details-summary-actions button{min-height:30px;padding:0 10px;color:#ffc09a;background:#2b1d16;border:1px solid #96502a;border-radius:4px;cursor:pointer}.pmf-details-summary-actions button:hover:not(:disabled){background:#422416;border-color:#c36a38}.pmf-details-summary-actions button:disabled{cursor:wait;opacity:.7}.pmf-details-section{margin-top:12px;padding-top:10px;border-top:1px solid var(--pmf-border)}.pmf-details-section h3{color:var(--pmf-accent);text-transform:uppercase;letter-spacing:.05em;font-size:11px}.pmf-details-section details{margin-top:7px}.pmf-details-section summary{color:#d8dcdf;cursor:pointer}.pmf-details-section code{font:11.5px/1.4 ui-monospace,monospace}.pmf-details-section ul{margin:7px 0 0;padding-left:20px}.pmf-details-id-list li{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:8px;margin:4px 0}.pmf-details-warning-text{color:#e4a66f;font-style:normal}.pmf-details-error-text{color:#ff9f96}.pmf-availability-row{display:grid;grid-template-columns:110px minmax(0,1fr);gap:8px;margin:7px 0}.pmf-availability-row strong{color:#eef0f1}.pmf-availability-row small{grid-column:2;color:var(--pmf-muted)}
    .pmf-filtered-paginator{display:flex;flex-direction:column;align-items:center;gap:7px;margin:8px auto 10px;color:var(--pmf-muted)}.pmf-page-controls{display:flex;justify-content:center;align-items:center;gap:7px;min-height:31px}.pmf-page-controls button{min-width:40px;height:31px;color:var(--pmf-text);background:var(--pmf-surface-1);border:1px solid var(--pmf-border);border-radius:4px;cursor:pointer;font-variant-numeric:tabular-nums}.pmf-page-controls button:disabled{color:#6f767b;cursor:default;opacity:.68}.pmf-page-controls .pmf-current-page{color:#ffc09a;background:#632500;border-color:#943c09;opacity:1}.pmf-quick-status-filters{display:flex;align-items:center;justify-content:center;gap:8px;min-height:28px}.pmf-quick-status-filters button{display:grid;place-items:center;width:29px;height:27px;padding:0;color:#d6d9dc;background:#16191c;border:1px solid #535a60;border-radius:4px;cursor:pointer}.pmf-quick-status-filters svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8}.pmf-quick-status-filters button.pmf-active{color:#ff5d63;border-color:#ff5d63;background:#4b1d20}.pmf-quick-status-filters button.pmf-active svg{fill:currentColor}.pmf-filter-grid{width:100%;align-items:start!important;grid-auto-rows:var(--pmf-card-height,max-content)!important}.pmf-filter-grid>.post-card{position:relative!important;width:var(--pmf-card-width,auto)!important;min-width:0!important;max-width:none!important;height:var(--pmf-card-height,auto)!important;min-height:0!important;max-height:none!important;inline-size:var(--pmf-card-width,auto)!important;min-inline-size:0!important;max-inline-size:none!important;block-size:var(--pmf-card-height,auto)!important;min-block-size:0!important;max-block-size:none!important;aspect-ratio:var(--pmf-card-aspect-ratio,1.7777778)!important;flex:none!important;grid-column:auto!important;align-self:start!important;justify-self:center!important;box-sizing:border-box!important;overflow:hidden!important}.pmf-filter-grid>.post-card>a.image-link,.pmf-filter-grid>.post-card>.image-link{position:absolute!important;inset:0!important;display:block!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;block-size:100%!important;min-block-size:0!important;max-block-size:none!important;aspect-ratio:auto!important;box-sizing:border-box!important;overflow:hidden!important;transform:none!important;transform-origin:50% 50%!important;translate:none!important;scale:none!important;rotate:none!important}.pmf-filter-grid .post-card__image-container{position:absolute!important;inset:0!important;display:block!important;flex:none!important;width:100%!important;height:100%!important;block-size:100%!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;aspect-ratio:auto!important;margin:0!important;padding:0!important;box-sizing:border-box!important;overflow:hidden!important;transform:none!important;transform-origin:50% 50%!important;translate:none!important;scale:none!important;rotate:none!important}.pmf-filter-grid .post-card__image-container .post-card__image{position:absolute!important;inset:0!important;top:0!important;left:0!important;display:block!important;width:100%!important;height:100%!important;min-width:100%!important;min-height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;object-fit:cover!important;object-position:50% 50%!important;transform:none!important;transform-origin:50% 50%!important;translate:none!important;scale:none!important;rotate:none!important}.pmf-filter-grid .post-card:hover .post-card__image{object-position:50% 50%!important;transform:none!important;transform-origin:50% 50%!important;translate:none!important;scale:none!important;rotate:none!important}.pmf-filter-grid>.post-card .post-card__header{position:absolute!important;left:0!important;right:0!important;top:0!important;z-index:3!important}.pmf-filter-grid>.post-card .post-card__footer{position:absolute!important;left:0!important;right:0!important;bottom:0!important;z-index:3!important}.pmf-card-statuses{position:absolute;right:4px;top:4px;z-index:6;display:flex;gap:3px;pointer-events:none}.pmf-card-status{display:grid;place-items:center;width:20px;height:20px;color:#ff6268;background:#14171ae6;border:1px solid currentColor;border-radius:3px}.pmf-card-status svg{width:13px;height:13px;fill:currentColor;stroke:currentColor;stroke-width:1.8}.pmf-card-status-favorite{color:#ffd25b}
    .pmf-post-status-controls{display:inline-flex;align-items:center;gap:22px;margin-left:22px;vertical-align:middle}.pmf-post-status-button{display:inline-flex;align-items:center;gap:7px;color:#ff555c;background:transparent;border:0;font:inherit;cursor:pointer}.pmf-post-status-button svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2}.pmf-post-status-button.pmf-active svg{fill:currentColor}.pmf-post-status-button:disabled{opacity:.55;cursor:wait}.pmf-data-actions button svg{width:16px;height:16px;vertical-align:-3px;fill:none;stroke:currentColor;stroke-width:1.8}
    .pmf-empty{grid-column:1/-1;min-height:160px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border:1px dashed var(--pmf-border);color:var(--pmf-muted);background:var(--pmf-surface-1);border-radius:var(--pmf-radius)}.pmf-empty strong{color:var(--pmf-text);font-size:16px}.post-card{position:relative}.pmf-dimmed{opacity:.24!important;filter:saturate(.2)}.pmf-dimmed:hover{opacity:.58!important}.pmf-hidden-card{display:none!important}
    html.pmf-post-attachment-size-small{--pmf-post-badge-height:20px;--pmf-post-badge-min-width:21px;--pmf-post-badge-icon:13px;--pmf-post-badge-font:10px;--pmf-post-badge-padding:3px;--pmf-post-badge-gap:2px;--pmf-post-badge-spacing:3px;--pmf-post-footer-height:26px;--pmf-post-many-height:19px;--pmf-post-many-min-width:19px;--pmf-post-many-padding:2px;--pmf-post-many-footer-height:38px}
    html.pmf-post-attachment-size-medium{--pmf-post-badge-height:25px;--pmf-post-badge-min-width:26px;--pmf-post-badge-icon:16px;--pmf-post-badge-font:12px;--pmf-post-badge-padding:4px;--pmf-post-badge-gap:3px;--pmf-post-badge-spacing:4px;--pmf-post-footer-height:31px;--pmf-post-many-height:24px;--pmf-post-many-min-width:24px;--pmf-post-many-padding:3px;--pmf-post-many-footer-height:48px}
    html.pmf-post-attachment-size-big{--pmf-post-badge-height:30px;--pmf-post-badge-min-width:31px;--pmf-post-badge-icon:19px;--pmf-post-badge-font:14px;--pmf-post-badge-padding:5px;--pmf-post-badge-gap:4px;--pmf-post-badge-spacing:5px;--pmf-post-footer-height:36px;--pmf-post-many-height:29px;--pmf-post-many-min-width:29px;--pmf-post-many-padding:4px;--pmf-post-many-footer-height:58px}
    html.pmf-creator-attachment-size-small{--pmf-creator-badge-height:21px;--pmf-creator-badge-min-width:34px;--pmf-creator-badge-icon:13px;--pmf-creator-badge-font:10px;--pmf-creator-badge-padding:4px;--pmf-creator-badge-gap:3px;--pmf-creator-badge-spacing:4px;--pmf-creator-column-gap:4px}
    html.pmf-creator-attachment-size-medium{--pmf-creator-badge-height:26px;--pmf-creator-badge-min-width:42px;--pmf-creator-badge-icon:16px;--pmf-creator-badge-font:12px;--pmf-creator-badge-padding:5px;--pmf-creator-badge-gap:4px;--pmf-creator-badge-spacing:5px;--pmf-creator-column-gap:5px}
    html.pmf-creator-attachment-size-big{--pmf-creator-badge-height:31px;--pmf-creator-badge-min-width:50px;--pmf-creator-badge-icon:19px;--pmf-creator-badge-font:14px;--pmf-creator-badge-padding:6px;--pmf-creator-badge-gap:5px;--pmf-creator-badge-spacing:6px;--pmf-creator-column-gap:6px}
    .pmf-badges{display:flex;align-items:center;gap:var(--pmf-post-badge-spacing);margin-left:auto;flex-wrap:nowrap}.pmf-badge{height:var(--pmf-post-badge-height);min-width:var(--pmf-post-badge-min-width);display:inline-flex;align-items:center;justify-content:center;gap:var(--pmf-post-badge-gap);padding:0 var(--pmf-post-badge-padding);color:#cb8ee6;background:#17191de6;border:1px solid #4e3c57;border-radius:3px;font:600 var(--pmf-post-badge-font)/1 Arial,sans-serif;white-space:nowrap}.pmf-badge svg{width:var(--pmf-post-badge-icon);height:var(--pmf-post-badge-icon);fill:none;stroke:currentColor;stroke-width:1.8}.pmf-badge--images,.pmf-badge--image{color:#76cba4;border-color:#345b4a}.pmf-badge--archives,.pmf-badge--archive,.pmf-badge--projectFiles{color:#e0ad62;border-color:#625137}.pmf-badge--externalLinks,.pmf-badge--link{color:#67c9eb;border-color:#365966}.pmf-badge--customExtensions{color:#aab7ff;border-color:#465080}.post-card__footer>div{display:flex;align-items:flex-end}.pmf-card-has-badges .post-card__footer{position:relative;min-height:var(--pmf-post-footer-height)}.pmf-card-has-badges .post-card__footer>div{display:grid;grid-template-columns:minmax(0,1fr) max-content;align-items:center;gap:var(--pmf-post-badge-spacing);min-height:var(--pmf-post-footer-height);width:100%;padding:2px 3px;box-sizing:border-box}.pmf-attachment-count-hidden{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important}.pmf-card-has-badges .pmf-card-date{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pmf-card-has-badges .pmf-badges{justify-content:flex-end;padding:0}.pmf-many-badges .post-card__footer{min-height:var(--pmf-post-many-footer-height)}.pmf-many-badges .post-card__footer>div{grid-template-columns:1fr;grid-template-rows:auto auto;align-content:center;gap:1px;min-height:var(--pmf-post-many-footer-height);padding:2px 3px}.pmf-many-badges .pmf-badges{gap:var(--pmf-post-badge-gap)}.pmf-many-badges .pmf-badge{height:var(--pmf-post-many-height);min-width:var(--pmf-post-many-min-width);padding:0 var(--pmf-post-many-padding)}.pmf-tight-badges .pmf-card-date{font-size:10px}.pmf-fallback-thumb{min-height:0;background:linear-gradient(135deg,#24282b,#17191b);position:relative}.pmf-fallback-thumb::after{content:'No preview';position:absolute;inset:0;display:grid;place-items:center;color:#777;font-size:12px}#paginator-top>form{width:min(492px,calc(100% - 24px));margin:10px auto 8px}#paginator-top>form .search-input{width:100%;box-sizing:border-box}
    .pmf-filter-popover{position:absolute;left:50%;top:49px;transform:translateX(-290px);width:350px;padding:12px;z-index:1100;user-select:none;-webkit-user-select:none}.pmf-popover-title,.pmf-popover-section{color:var(--pmf-accent);font-size:11px;font-weight:750;letter-spacing:.08em;text-transform:uppercase}.pmf-popover-title{margin-bottom:8px}.pmf-popover-section{margin:11px 0 4px}.pmf-match-mode{display:grid;grid-template-columns:1fr 92px;align-items:center;gap:10px;padding-bottom:9px;border-bottom:1px solid var(--pmf-border)}.pmf-match-mode select{width:100%}.pmf-preset-selector{width:100%;display:flex;align-items:center;justify-content:space-between;margin-top:9px;text-align:left}.pmf-preset-selector b{color:var(--pmf-muted);font-size:20px;font-weight:400}
    .pmf-filter-row{display:grid;grid-template-columns:28px 1fr 32px;align-items:center;min-height:34px;border-radius:4px}.pmf-filter-row:hover{background:var(--pmf-surface-3)}.pmf-filter-row label{display:grid;grid-template-columns:28px 1fr;grid-column:1/3;align-items:center;min-height:34px;padding:0 5px;cursor:pointer}.pmf-filter-row input{justify-self:center;accent-color:var(--pmf-accent)}.pmf-row-chevron{grid-column:3;width:32px!important;min-height:28px!important;padding:0!important;border:0!important;background:transparent!important;color:var(--pmf-muted)!important;font-size:21px!important}.pmf-row-spacer{grid-column:3}.pmf-preset-saved{min-height:17px;padding:5px 4px 0;color:var(--pmf-success);font-size:11px;text-align:right}
    .pmf-modal-backdrop{position:fixed;inset:0;display:grid;place-items:center;padding:16px;background:#000a;z-index:4000}.pmf-dialog{width:min(620px,calc(100vw - 32px));max-height:calc(100vh - 48px);display:flex;flex-direction:column;overflow:hidden}.pmf-dialog>header,.pmf-dialog>footer{flex:none;display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--pmf-surface-3)}.pmf-dialog>header{border-bottom:1px solid var(--pmf-border)}.pmf-dialog>header strong{font-size:15px}.pmf-dialog>header .pmf-icon-close{margin-left:auto}.pmf-dialog>footer{justify-content:flex-end;border-top:1px solid var(--pmf-border)}.pmf-dialog>footer>span{flex:1}.pmf-icon-close{width:32px;padding:0!important;border:0!important;background:transparent!important;color:var(--pmf-muted)!important;font-size:22px!important}
    .pmf-editor-body,.pmf-settings-content,.pmf-preset-list{min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:none;padding:15px}.pmf-filter-editor .pmf-editor-body{display:flex;flex-direction:column;gap:var(--pmf-editor-section-gap);padding:var(--pmf-dialog-content-padding)}.pmf-editor-body::-webkit-scrollbar,.pmf-settings-content::-webkit-scrollbar,.pmf-preset-list::-webkit-scrollbar,.pmf-list-editor::-webkit-scrollbar{display:none}.pmf-editor-error{color:#ffaaa0;font-size:12px}.pmf-editor-error:empty{display:none}.pmf-filter-editor>.pmf-editor-error:not(:empty){margin:0 var(--pmf-dialog-content-padding) 12px;padding:8px 10px;border:1px solid #693c37;border-radius:4px;background:#251a1a}.pmf-settings-error{min-height:18px;padding:0 15px;color:#ffaaa0;font-size:12px}.pmf-primary{color:#ffd0b4!important;border-color:#9a4a20!important;background:#5a260e!important}.pmf-danger{color:#ffd0cb!important;border-color:#9f4840!important;background:#5a211d!important}.pmf-help{margin:0;color:var(--pmf-muted);font-size:12px;line-height:1.5}
    .pmf-list-editor{max-height:390px;overflow:auto;overscroll-behavior:contain;border:1px solid var(--pmf-border);border-radius:4px;padding:6px}.pmf-extension-row{display:grid;grid-template-columns:1fr 34px;gap:7px;align-items:center;margin:5px 0}.pmf-extension-row input,.pmf-rule-row input,.pmf-date-editor input:not([type="checkbox"]):not([type="radio"]),.pmf-block-label input,.pmf-settings-dialog textarea{width:100%;min-width:0;color:var(--pmf-text);background:var(--pmf-surface-1);border:1px solid var(--pmf-border-strong);border-radius:4px;padding:7px}.pmf-delete-row{width:34px;min-height:32px!important;padding:0!important;color:var(--pmf-muted)!important}.pmf-add-row{width:100%;margin-top:6px;border-style:dashed!important}
    .pmf-rule-row{display:grid;grid-template-columns:70px 94px minmax(120px,1fr) 108px 34px;gap:7px;align-items:center;margin:6px 0;white-space:nowrap}.pmf-rule-first{color:var(--pmf-muted);font-size:11px;text-align:center}.pmf-choice{display:flex;align-items:center;justify-content:space-between;gap:5px;padding:0 8px!important;white-space:nowrap}.pmf-choice b{color:var(--pmf-muted);font-size:10px}.pmf-expression-preview{margin:0;color:#d7aa8f;font:12px/1.4 ui-monospace,monospace;white-space:normal}.pmf-expression-preview:empty{display:none}.pmf-date-editor{width:100%;max-width:none;text-align:left!important}.pmf-date-condition{display:flex;flex-direction:column;align-items:flex-start;gap:6px;text-align:left!important}.pmf-date-condition .pmf-choice{width:250px;max-width:100%}.pmf-date-fields{display:grid;grid-template-columns:minmax(0,250px);justify-content:start;gap:16px;margin:16px 0}.pmf-date-fields.pmf-between{grid-template-columns:repeat(2,minmax(0,250px))}.pmf-date-fields label{display:flex;flex-direction:column;align-items:flex-start;gap:6px;text-align:left!important}.pmf-date-fields input[type="date"]{width:250px;max-width:100%;color-scheme:dark}.pmf-date-fields input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(1);opacity:.85;cursor:pointer}.pmf-check{display:flex;align-items:center;justify-content:flex-start;gap:9px;margin:8px 0;cursor:pointer;text-align:left!important}.pmf-date-unknown{width:auto!important;max-width:430px;font-size:14px;line-height:1.35}.pmf-date-unknown span{display:inline}.pmf-check input{accent-color:var(--pmf-accent)}
    .pmf-floating-menu{position:fixed;z-index:5000;min-width:190px;max-height:280px;overflow:auto;overscroll-behavior:contain;padding:5px}.pmf-floating-menu button{width:100%;min-height:32px;display:flex;align-items:center;gap:8px;padding:0 9px;color:var(--pmf-text);background:transparent;border:0;border-radius:3px;text-align:left;cursor:pointer}.pmf-floating-menu button:hover,.pmf-floating-menu button:focus,.pmf-floating-menu button[aria-current="true"]{background:var(--pmf-surface-3)}.pmf-field-menu button span{width:18px;color:var(--pmf-accent)}.pmf-overlay-inactive{pointer-events:none}
    .pmf-preset-dialog{width:min(470px,calc(100vw - 32px));background:var(--pmf-surface-1)}.pmf-preset-dialog>header,.pmf-preset-dialog>footer{background:var(--pmf-surface-2)}.pmf-preset-list{padding:8px;background:var(--pmf-surface-1)}.pmf-preset-row{display:grid;grid-template-columns:1fr 38px;align-items:center;background:var(--pmf-surface-1);border-bottom:1px solid var(--pmf-border)}.pmf-preset-row:hover,.pmf-preset-row:has([aria-checked="true"]){background:var(--pmf-surface-2)}.pmf-preset-row>button:first-child{display:flex;align-items:center;gap:10px;border:0;background:transparent;text-align:left}.pmf-radio-dot{width:14px;height:14px;border:2px solid var(--pmf-muted);border-radius:50%}.pmf-preset-row [aria-checked="true"] .pmf-radio-dot{border:4px solid var(--pmf-accent)}.pmf-more{padding:0!important;border:0!important;background:transparent!important;font-size:20px!important}.pmf-small-dialog{width:min(460px,calc(100vw - 32px))}.pmf-confirm-dialog{width:min(520px,calc(100vw - 32px));background:var(--pmf-surface-1)}.pmf-confirm-dialog>header{padding:14px 18px;background:var(--pmf-surface-2)}.pmf-confirm-dialog>footer{padding:12px 18px;background:var(--pmf-surface-2)}.pmf-confirm-body{display:flex;flex-direction:column;gap:12px;padding:18px;color:var(--pmf-text);font-size:14px;line-height:1.5}.pmf-confirm-body p{margin:0}.pmf-confirm-dialog>footer button{white-space:nowrap}
    #pmf-global-host{position:relative;z-index:2147483000}.pmf-global-flash{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483600;padding:10px 14px;border:1px solid var(--pmf-border);border-radius:5px;color:var(--pmf-text);box-shadow:0 8px 28px #0009}
    .pmf-creator-card{position:relative!important}.pmf-creator-card-has-badges [data-pmf-creator-content]{box-sizing:border-box!important;padding-right:var(--pmf-creator-badge-width,0)!important}.pmf-creator-card-badges{position:absolute;right:8px;top:50%;transform:translateY(-50%);display:flex;flex-direction:row;gap:var(--pmf-creator-badge-spacing);justify-content:flex-start;align-items:center;pointer-events:none;z-index:4}.pmf-creator-badge-column{display:flex;flex-direction:column;gap:var(--pmf-creator-column-gap);align-items:stretch}.pmf-creator-badge{width:var(--pmf-creator-column-badge-width,auto);height:var(--pmf-creator-badge-height);min-width:var(--pmf-creator-badge-min-width);display:inline-flex;align-items:center;justify-content:center;gap:var(--pmf-creator-badge-gap);padding:0 var(--pmf-creator-badge-padding);border:1px solid currentColor;border-radius:3px;background:#111d;color:#d9dde1;font:600 var(--pmf-creator-badge-font)/1 sans-serif;box-sizing:border-box;white-space:nowrap}.pmf-creator-badge svg{width:var(--pmf-creator-badge-icon);height:var(--pmf-creator-badge-icon);fill:none;stroke:currentColor;stroke-width:1.8}.pmf-creator-badge--videos{color:#d47be5}.pmf-creator-badge--images{color:#67d7b1}.pmf-creator-badge--archives{color:#e4ad51}.pmf-creator-badge--projectFiles{color:#e4ad51}.pmf-creator-badge--externalLinks{color:#62c8ed}.pmf-creator-card-job-status{position:absolute;right:8px;bottom:6px;z-index:5;max-width:60%;padding:3px 6px;border:1px solid var(--pmf-border);border-radius:3px;background:#111e;color:#fff;font:600 10px/1.2 sans-serif;pointer-events:none}.pmf-creator-card-job-active .pmf-creator-card-badges{opacity:.4}
    .pmf-settings-dialog{width:min(920px,calc(100vw - 32px));height:min(700px,calc(100vh - 48px));text-align:left!important}.pmf-settings-layout{display:grid;grid-template-columns:235px minmax(0,1fr);min-height:0;flex:1}.pmf-settings-layout>nav{padding:10px;background:var(--pmf-surface-1);border-right:1px solid var(--pmf-border)}.pmf-settings-layout>nav button{width:100%;min-height:36px;margin:2px 0;padding:0 10px;color:var(--pmf-text);background:transparent;border:0;border-radius:4px;text-align:left;white-space:nowrap}.pmf-settings-layout>nav button.pmf-active{color:#ffb184;background:var(--pmf-accent-soft)}.pmf-settings-content,.pmf-settings-content section,.pmf-settings-content h3,.pmf-settings-content fieldset,.pmf-settings-content legend,.pmf-settings-content p,.pmf-settings-content small{ text-align:left!important}.pmf-settings-content{padding:18px 20px}.pmf-settings-content h3{margin:0 0 15px;color:var(--pmf-accent)}.pmf-settings-content fieldset{border:0;border-top:1px solid var(--pmf-border);margin:13px 0;padding:11px 0 0}.pmf-settings-content legend{color:var(--pmf-accent);font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.07em}.pmf-settings-content label:not(.pmf-inline):not(.pmf-block-label){display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px;margin:9px 0;text-align:left!important}.pmf-settings-content input[type="checkbox"],.pmf-settings-content input[type="radio"],.pmf-date-unknown input[type="checkbox"]{width:16px!important;height:16px!important;min-width:16px!important;min-height:0!important;padding:0!important;margin:0!important;flex:0 0 auto!important;accent-color:var(--pmf-accent);vertical-align:middle}.pmf-inline{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:12px;margin:9px 0;text-align:left!important}.pmf-inline input[type="number"]{width:72px;margin-left:auto}.pmf-compact-display-settings{display:grid;grid-template-columns:minmax(0,1fr) 170px;align-items:center;gap:10px 12px;margin:14px 0 2px;padding-top:10px;border-top:1px solid var(--pmf-border)}.pmf-compact-display-settings label{margin:0!important}.pmf-compact-display-settings select{width:170px}.pmf-compact-display-settings.pmf-disabled{opacity:.55}.pmf-setting-chevron-row{display:grid;grid-template-columns:minmax(0,1fr) 34px;align-items:center}.pmf-setting-chevron-row label{margin:9px 0!important}.pmf-setting-chevron-row>button{width:34px;min-height:32px!important;padding:0!important;font-size:22px}.pmf-data-actions{display:flex;flex-wrap:wrap;gap:8px;margin:9px 0}
    .pmf-accordion{margin:10px 0;border:1px solid var(--pmf-border);border-radius:4px;background:var(--pmf-surface-1);text-align:left!important}.pmf-accordion summary{padding:10px 12px;color:#f1f2f3;cursor:pointer;text-align:left!important;user-select:none}.pmf-accordion>div{padding:0 12px 12px;text-align:left!important}.pmf-settings-dialog textarea{display:block;max-height:220px;margin-top:7px;resize:none;overflow:auto;overscroll-behavior:contain;line-height:1.4;text-align:left!important}.pmf-block-label{display:block;color:#d4d8db;text-align:left!important}.pmf-cache-actions,.pmf-catalogue-actions{display:flex;justify-content:flex-start;gap:8px;flex-wrap:wrap;margin-top:16px;padding-top:12px;border-top:1px solid var(--pmf-border);text-align:left!important}html{scrollbar-gutter:stable}.pmf-overlay{overscroll-behavior:contain}.pmf-dialog,.pmf-settings-dialog{overscroll-behavior:contain}:where(#pmf-root,.pmf-modal-backdrop,.pmf-floating-menu) :focus-visible{outline:2px solid var(--pmf-accent-hover)!important;outline-offset:2px}
    @media(max-width:760px){#pmf-root{width:calc(100% - 12px)}.pmf-controls{grid-template-columns:minmax(0,1fr) minmax(145px,160px) 48px;padding:9px;gap:8px}.pmf-controls .pmf-filter-button{grid-column:1/-1}.pmf-controls .pmf-sort-button{grid-column:1}.pmf-controls .pmf-scan-button{grid-column:2}.pmf-controls .pmf-icon-button{grid-column:3}.pmf-status{align-items:flex-start;flex-wrap:wrap}.pmf-status-left{flex-wrap:wrap}.pmf-status-right{width:100%;margin-left:0;text-align:right}.pmf-filter-popover{left:4px;transform:none;width:min(350px,calc(100vw - 20px))}.pmf-settings-layout{grid-template-columns:1fr}.pmf-settings-layout>nav{display:flex;overflow:auto;border-right:0;border-bottom:1px solid var(--pmf-border)}.pmf-settings-layout>nav button{min-width:max-content}.pmf-compact-display-settings{grid-template-columns:1fr}.pmf-compact-display-settings select{width:100%}.pmf-rule-row{grid-template-columns:62px 84px minmax(110px,1fr) 96px 34px;min-width:520px}.pmf-rule-list{overflow-x:auto}.pmf-date-fields.pmf-between{grid-template-columns:minmax(0,250px)}.pmf-confirm-dialog>footer{flex-wrap:wrap}.pmf-confirm-dialog>footer button{flex:1 1 auto}}
  `);

  GM_addStyle(`
    .pmf-filtered-paginator{--pmf-status-summary-gap:7px;gap:var(--pmf-status-summary-gap)!important;margin:2px auto 8px!important}
    .pmf-page-controls{gap:5px!important;min-height:27px!important}.pmf-page-controls button{min-width:34px!important;height:27px!important}
    .pmf-filter-grid{display:flex!important;flex-wrap:wrap!important;justify-content:center!important;align-items:flex-start!important;align-content:flex-start!important;width:100%!important;column-gap:var(--pmf-column-gap,4px)!important;row-gap:var(--pmf-row-gap,4px)!important;grid-template-columns:none!important;grid-auto-rows:auto!important}
    .pmf-filter-grid>.post-card{flex:0 0 var(--pmf-card-width)!important;width:var(--pmf-card-width)!important;min-width:var(--pmf-card-width)!important;max-width:var(--pmf-card-width)!important;inline-size:var(--pmf-card-width)!important;height:var(--pmf-thumbnail-height)!important;block-size:var(--pmf-thumbnail-height)!important;aspect-ratio:auto!important;overflow:hidden!important}
    .pmf-filter-grid>.post-card>a.image-link,.pmf-filter-grid>.post-card>.image-link,.pmf-filter-grid .post-card__image-container{height:var(--pmf-thumbnail-height)!important;block-size:var(--pmf-thumbnail-height)!important;aspect-ratio:auto!important}
    .pmf-filter-grid .post-card__image-container{background-size:cover!important;background-position:center center!important}
    .pmf-quick-status-filters{gap:6px!important;min-height:28px!important;margin:0!important}.pmf-quick-status-filters button{width:30px!important;height:28px!important}
    .pmf-quick-status-filters button{position:relative}
    .pmf-quick-status-filters .pmf-quick-status-main{display:grid;place-items:center}
    .pmf-quick-status-filters .pmf-quick-status-negate{display:none;position:absolute;right:1px;top:1px;width:10px;height:10px;color:#fff;filter:none!important;opacity:1!important;text-shadow:0 0 2px #000}
    .pmf-quick-status-filters button.pmf-match,.pmf-quick-status-filters button.pmf-no-match{background:#25282b}
    .pmf-quick-status-filters button[data-pmf-quick-status="favorite"].pmf-match,.pmf-quick-status-filters button[data-pmf-quick-status="favorite"].pmf-no-match{color:#ffd25b;border-color:#ffd25b}
    .pmf-quick-status-filters button[data-pmf-quick-status="liked"].pmf-match,.pmf-quick-status-filters button[data-pmf-quick-status="liked"].pmf-no-match{color:#ff5d9e;border-color:#ff5d9e}
    .pmf-quick-status-filters button[data-pmf-quick-status="seen"].pmf-match,.pmf-quick-status-filters button[data-pmf-quick-status="seen"].pmf-no-match{color:#4f8fd8;border-color:#4f8fd8}
    .pmf-quick-status-filters button.pmf-match .pmf-quick-status-main svg,.pmf-quick-status-filters button.pmf-no-match .pmf-quick-status-main svg{fill:currentColor}.pmf-quick-status-filters button.pmf-no-match .pmf-quick-status-main{opacity:.74;filter:saturate(.65) brightness(.9)}
    .pmf-quick-status-filters button.pmf-no-match .pmf-quick-status-negate{display:grid}
    .pmf-quick-status-filters .pmf-quick-status-negate svg{width:10px;height:10px;fill:none!important;stroke:currentColor;stroke-width:2.25;stroke-linecap:round;stroke-linejoin:round}
    .pmf-filtered-paginator>span,.pmf-filtered-paginator>.pmf-page-summary,.pmf-filtered-paginator .pmf-page-controls{margin:0!important}
    .pmf-seen-dimmed .post-card__image-container{filter:saturate(var(--pmf-seen-saturate,.55)) brightness(var(--pmf-seen-brightness,.72));opacity:var(--pmf-seen-opacity,.72)}
    .pmf-seen-dim-low{--pmf-seen-saturate:.72;--pmf-seen-brightness:.86;--pmf-seen-opacity:.84}.pmf-seen-dim-medium{--pmf-seen-saturate:.52;--pmf-seen-brightness:.74;--pmf-seen-opacity:.74}.pmf-seen-dim-high{--pmf-seen-saturate:.25;--pmf-seen-brightness:.56;--pmf-seen-opacity:.58}
    .pmf-card-statuses{top:calc(var(--pmf-status-header-height,0px) + 4px)}
    .pmf-card-status-seen{color:#4f8fd8}.pmf-card-status-liked{color:#ff5d9e}
    .pmf-card-status{box-sizing:border-box;flex:0 0 auto}.pmf-card-statuses-small .pmf-card-status{width:16px;height:16px}.pmf-card-statuses-small .pmf-card-status svg{width:10px;height:10px;transform:scale(.88)}
    .pmf-card-statuses-medium .pmf-card-status{width:20px;height:20px}.pmf-card-statuses-medium .pmf-card-status svg{width:13px;height:13px;transform:scale(.9)}
    .pmf-card-statuses-big .pmf-card-status{width:25px;height:25px}.pmf-card-statuses-big .pmf-card-status svg{width:17px;height:17px;transform:scale(.92)}
    .pmf-post-status-fallback{display:inline-flex;align-items:center;gap:var(--pmf-native-action-gap,1em);margin:0}.pmf-post-status-button{display:inline-flex;align-items:center;gap:var(--pmf-native-icon-label-gap,5px);color:inherit;background:transparent;border:0;font:inherit;line-height:var(--pmf-native-action-line-height,inherit);cursor:pointer;transform:translateY(var(--pmf-native-action-shift-y,0))}
    .pmf-post-status-icon{display:inline-grid;place-items:center;flex:0 0 auto;width:var(--pmf-native-action-icon-width,1em);height:var(--pmf-native-action-icon-height,1em)}.pmf-post-status-icon svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:2}.pmf-post-status-liked .pmf-post-status-icon svg{transform:scale(.88)}.pmf-post-status-seen .pmf-post-status-icon svg{transform:scale(.92)}
    .pmf-post-status-liked.pmf-active{color:#ff5d9e}.pmf-post-status-seen.pmf-active{color:#4f8fd8}
    .pmf-post-status-button.pmf-active svg{fill:currentColor}
    .pmf-details-summary-actions{display:flex;justify-content:center}
    .pmf-favorite-sync-status{align-self:center;color:var(--pmf-muted)}
    .pmf-settings-panel{display:flex;flex-direction:column;gap:14px}.pmf-settings-panel[hidden]{display:none}
    .pmf-settings-tab-title{margin:0;color:var(--pmf-accent);font-size:25px;font-weight:500;line-height:1.2}
    .pmf-settings-section{border-top:1px solid var(--pmf-border);padding-top:8px}.pmf-settings-section h3{margin:0 0 8px;color:var(--pmf-accent);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
    .pmf-settings-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,240px) auto;align-items:center;gap:9px;min-height:38px;padding:3px 0}.pmf-settings-row>span:empty{display:none}
    .pmf-select-shell{position:relative;display:block;min-width:0}.pmf-select-shell select{width:100%;appearance:none;-webkit-appearance:none;padding-right:31px!important}.pmf-select-arrow{position:absolute;right:11px;top:50%;transform:translateY(-52%);color:var(--pmf-muted);font-size:12px;line-height:1;pointer-events:none}.pmf-select-shell:has(select:disabled) .pmf-select-arrow{color:#6f767b;opacity:.55}
    .pmf-settings-toggle{display:flex;align-items:center;gap:8px;grid-column:1/3}.pmf-settings-chevron{width:34px;padding:0!important;font-size:22px}
    .pmf-settings-actions{display:flex;flex-wrap:wrap;gap:8px}.pmf-settings-child h2{margin:8px 0 16px;color:var(--pmf-accent)}.pmf-settings-back{margin-bottom:8px}
  `);

  const NativeActionAlignment = {
    clamp(value){return Util.clamp(Math.round(Number(value)||0),-6,6);},
    center(node){const rect=node?.getBoundingClientRect?.();return rect&&rect.height?rect.top+rect.height/2:null;},
    async align(reference,actions,{fallback=4,operation='native-action-alignment'}={}) {
      const buttons=(actions||[]).filter(Boolean);if(!reference||!buttons.length)return 0;
      try{await Promise.race([document.fonts?.ready||Promise.resolve(),Util.sleep(350)]);}catch{}
      await new Promise((resolve)=>requestAnimationFrame(()=>resolve()));
      if(!reference.isConnected||buttons.some((button)=>!button.isConnected))return 0;
      const nativeCenter=NativeActionAlignment.center(reference);const firstCenter=NativeActionAlignment.center(buttons[0]);const measured=nativeCenter!=null&&firstCenter!=null?nativeCenter-firstCenter:fallback;const correction=NativeActionAlignment.clamp(measured);
      buttons.forEach((button)=>button.style.setProperty('--pmf-native-action-shift-y',`${correction}px`));
      await new Promise((resolve)=>requestAnimationFrame(()=>resolve()));
      if(reference.isConnected&&buttons.every((button)=>button.isConnected)){const verifiedNative=NativeActionAlignment.center(reference);const verifiedPmf=NativeActionAlignment.center(buttons[0]);if(verifiedNative!=null&&verifiedPmf!=null){const residual=NativeActionAlignment.clamp(verifiedNative-verifiedPmf);if(Math.abs(residual)>=1)buttons.forEach((button)=>button.style.setProperty('--pmf-native-action-shift-y',`${NativeActionAlignment.clamp(correction+residual)}px`));}}
      Logger.info({operation,nativeCenterY:nativeCenter,pmfCenterY:firstCenter,appliedTranslateY:correction});return correction;
    },
    async balanceTrailing(previous,target,container,{maxShift=14,operation='native-action-trailing-spacing'}={}){if(!previous||!target||!container)return 0;await new Promise((resolve)=>requestAnimationFrame(resolve));const before=previous.getBoundingClientRect?.(),button=target.getBoundingClientRect?.(),bounds=container.getBoundingClientRect?.();if(!before?.height||!button?.height||!bounds?.height)return 0;const desiredTop=(before.bottom+bounds.bottom-button.height)/2,shift=Util.clamp(Math.round(desiredTop-button.top),0,maxShift);target.style.setProperty('--pmf-native-action-shift-y',`${shift}px`);Logger.info({operation,gapAbove:button.top-before.bottom,gapBelow:bounds.bottom-button.bottom,appliedTranslateY:shift});return shift;},
  };

  const PostPageController = {
    context:null,root:null,buttons:[],fallbackRoot:null,status:null,nativeFavorite:null,controller:null,observer:null,generation:0,favoriteTimer:null,
    actionText(node){return String(node?.value||node?.textContent||node?.getAttribute?.('aria-label')||node?.title||'').replace(/\s+/g,' ').trim();},
    candidates(pattern){return [...document.querySelectorAll('a,button,input[type="submit"]')].filter((node)=>node.isConnected&&!node.hidden&&!node.closest?.('[data-pmf-owned="true"],aside,nav,[class*="sidebar"],[class*="comment"]')&&pattern.test(PostPageController.actionText(node)));},
    actionGroup(){
      const flags=PostPageController.candidates(/\bflag\b/i);
      const containsFlag=(candidate)=>flags.some((flag)=>candidate===flag.parentElement||candidate.contains?.(flag));
      for(const favorite of PostPageController.candidates(/\b(?:un)?favorite\b/i)){let host=favorite.parentElement;for(let depth=0;host&&depth<5;depth+=1,host=host.parentElement){if(containsFlag(host))return{host,favorite};}}
      return null;
    },
    findNativeFavorite(){return PostPageController.actionGroup()?.favorite||null;},
    findNativeFlag(){return PostPageController.candidates(/\bflag\b/i)[0]||null;},
    favoriteState(node=PostPageController.nativeFavorite){
      if(!node)return null;const text=PostPageController.actionText(node);if(/\bunfavorite\b/i.test(text))return true;if(/\bfavorite\b/i.test(text))return false;
      const pressed=node.getAttribute?.('aria-pressed');if(pressed==='true'||pressed==='false')return pressed==='true';
      if(node.classList?.contains?.('active')||node.classList?.contains?.('selected'))return true;
      return null;
    },
    hostFor(node){
      if(!node)return null;const parent=node.parentElement;if(parent&&parent.children?.length<=8)return parent;
      return node.closest?.('header,section,article,div')||parent;
    },
    nativeMetrics(group){
      const flag=PostPageController.findNativeFlag();const favorite=group?.favorite||PostPageController.nativeFavorite;const host=group?.host||PostPageController.hostFor(favorite);const rect=(node)=>node?.getBoundingClientRect?.()||null;
      const flagRect=rect(flag);const favoriteRect=rect(favorite);const style=globalThis.getComputedStyle?.(favorite)||{};const icon=favorite?.querySelector?.('svg,i,[class*="icon"]');const iconRect=rect(icon);
      const actionGap=flagRect&&favoriteRect?Math.max(10,Math.round(favoriteRect.left-flagRect.right)):22;
      let iconLabelGap=5;if(icon){const text=[...favorite.childNodes].find((node)=>node.nodeType===3&&String(node.textContent).trim())||favorite.querySelector?.('span');const textRect=rect(text);if(textRect&&iconRect)iconLabelGap=Math.max(3,Math.round(textRect.left-iconRect.right));}
      const iconWidth=Math.max(12,Math.round(iconRect?.width||16));const iconHeight=Math.max(12,Math.round(iconRect?.height||16));const lineHeight=parseFloat(style.lineHeight)||Math.max(18,Math.round(favoriteRect?.height||18));
      const metrics={actionGap,iconLabelGap,iconWidth,iconHeight,lineHeight,directSiblingInsertion:Boolean(favorite?.nextSibling)};
      Logger.info({operation:'post-action-metrics',postKey:PostPageController.context?.postKey,actionGap,iconLabelGap,iconWidth,iconHeight,lineHeight,directSiblingInsertion:metrics.directSiblingInsertion});
      return metrics;
    },
    applyNativeMetrics(root,group){
      const metrics=PostPageController.nativeMetrics(group);if(!root?.style)return metrics;
      root.style.setProperty('--pmf-native-action-gap',`${metrics.actionGap}px`);
      root.style.setProperty('--pmf-native-icon-label-gap',`${metrics.iconLabelGap}px`);
      root.style.setProperty('--pmf-native-action-icon-width',`${metrics.iconWidth}px`);
      root.style.setProperty('--pmf-native-action-icon-height',`${metrics.iconHeight}px`);
      root.style.setProperty('--pmf-native-action-line-height',`${metrics.lineHeight}px`);
      return metrics;
    },
    sanitizeNativeTemplate(root){
      [root,...root?.querySelectorAll?.('*')||[]].filter(Boolean).forEach((node)=>{[...node.attributes||[]].forEach((attribute)=>{if(attribute.name==='id'||attribute.name==='href'||attribute.name==='action'||attribute.name==='form'||attribute.name==='name'||attribute.name==='value'||attribute.name.startsWith('on')||attribute.name.startsWith('data-')||attribute.name==='aria-pressed')node.removeAttribute(attribute.name);});});
      return root;
    },
    createButton(field,nativeFavorite=null){
      const template=PostPageController.sanitizeNativeTemplate(nativeFavorite?.cloneNode?.(true));const button=document.createElement('button');button.type='button';const safeClasses=[...template?.classList||[]].filter((name)=>/^[a-z0-9_-]+$/i.test(name)&&!/active|selected|favorite|unfavorite|disabled|turbo|stimulus|controller|action|^js-/i.test(name));button.className=[...safeClasses,'pmf-post-status-button',`pmf-post-status-${field}`].join(' ');button.dataset.pmfPostStatus=field;
      const templateIcon=template?.querySelector?.('svg,i,[class*="icon"]');const icon=document.createElement('span');icon.className='pmf-post-status-icon';icon.innerHTML=PostStatus.icon(field);if(templateIcon){const rect=templateIcon.getBoundingClientRect?.();if(rect?.width)icon.style.setProperty('--pmf-template-icon-width',`${rect.width}px`);}const label=document.createElement('span');label.className='pmf-post-status-label';label.textContent=PostStatus.label(field);button.append(icon,label);return button;
    },
    alignToNative(reference,buttons,insertion){return NativeActionAlignment.align(reference,buttons,{fallback:4,operation:`post-action-geometry:${insertion}`});},
    render(){
      if(!PostPageController.root||!PostPageController.status)return;const status=PostStatus.normalize(PostPageController.status);
      PostPageController.buttons.forEach((button)=>{const field=button.dataset.pmfPostStatus;const active=Boolean(status[field]);const label=field==='liked'?(active?'Unlike':'Like'):(active?'Unsee':'Seen');button.classList.toggle('pmf-active',active);button.setAttribute('aria-pressed',String(active));button.title=field==='liked'?(active?'Remove like from this post':'Like this post'):(active?'Mark this post as unseen':'Mark this post as seen');button.querySelector('.pmf-post-status-label').textContent=label;});
    },
    async refreshNativeFavorite(source='native-dom'){
      const value=PostPageController.favoriteState();if(value==null||!PostPageController.context)return;
      if(PostPageController.status?.favoriteDirectValue===value)return;
      PostPageController.status=await PostStatus.set(PostPageController.context,{favoriteDirectValue:value},source);PostPageController.render();
    },
    async mount(context,{generation,signal}={}){
      PostPageController.cleanup();if(signal?.aborted||generation!==Lifecycle.routeGeneration)return false;
      const group=PostPageController.actionGroup();const nativeFavorite=group?.favorite;const reference=nativeFavorite;if(!reference||!group?.host)return false;const host=group.host;
      const controller=new AbortController();PostPageController.controller=controller;const localSignal=controller.signal;PostPageController.context=context;PostPageController.nativeFavorite=nativeFavorite;PostPageController.generation=generation;
      const liked=BaseUI.own(PostPageController.createButton('liked',nativeFavorite));const seen=BaseUI.own(PostPageController.createButton('seen',nativeFavorite));liked.dataset.pmfOwned='true';seen.dataset.pmfOwned='true';
      const directSafe=reference.parentElement===host&&reference.parentElement?.children?.length<=8;PmfDomMutationGuard.run(()=>{if(directSafe){reference.insertAdjacentElement?.('afterend',seen);reference.insertAdjacentElement?.('afterend',liked);}else{const wrapper=BaseUI.own(document.createElement('span'));wrapper.className='pmf-post-status-fallback';wrapper.dataset.pmfOwned='true';wrapper.append(liked,seen);reference.insertAdjacentElement?.('afterend',wrapper);if(!wrapper.isConnected)host.append(wrapper);PostPageController.fallbackRoot=wrapper;}if(!liked.isConnected)host.append(liked,seen);});PostPageController.root=liked;PostPageController.buttons=[liked,seen];PostPageController.applyNativeMetrics(PostPageController.fallbackRoot||liked,group);PostPageController.applyNativeMetrics(liked,group);PostPageController.applyNativeMetrics(seen,group);PostPageController.alignToNative(reference,[liked,seen],directSafe?'direct-siblings':'measured-wrapper');PostPageController.status=await PostStatus.get(context);Logger.info({operation:'post-action-layout',postKey:context.postKey,insertion:directSafe?'direct-siblings':'measured-wrapper'});
      const favorite=PostPageController.favoriteState(nativeFavorite);if(favorite!=null&&favorite!==PostPageController.status.favoriteDirectValue)PostPageController.status=await PostStatus.set(context,{favoriteDirectValue:favorite},'native-post-page');
      if(signal?.aborted||localSignal.aborted||generation!==Lifecycle.routeGeneration){PostPageController.cleanup();return false;}PostPageController.render();
      const handle=async(event)=>{const button=event.currentTarget;button.disabled=true;const prior=PostPageController.status;try{PostPageController.status=await PostStatus.toggle(context,button.dataset.pmfPostStatus);PostPageController.render();}catch(error){PostPageController.status=prior;PostPageController.render();GlobalUI.flash('Could not save post status.');}finally{button.disabled=false;}};PostPageController.buttons.forEach((button)=>button.addEventListener('click',handle,{signal:localSignal}));
      nativeFavorite?.addEventListener('click',()=>{PostPageController.observer?.disconnect();PostPageController.observer=new MutationObserver(()=>PostPageController.refreshNativeFavorite('native-favorite-mutation'));PostPageController.observer.observe(nativeFavorite,{attributes:true,childList:true,subtree:true,characterData:true});clearTimeout(PostPageController.favoriteTimer);PostPageController.favoriteTimer=setTimeout(()=>{PostPageController.refreshNativeFavorite('native-favorite-click');PostPageController.observer?.disconnect();PostPageController.observer=null;},1500);},{signal:localSignal});
      return true;
    },
    health(context){return Boolean(PostPageController.context?.postKey===context.postKey&&PostPageController.root?.isConnected&&(!PostPageController.nativeFavorite||PostPageController.nativeFavorite.isConnected));},
    cleanup(){PostPageController.controller?.abort();PostPageController.controller=null;PostPageController.observer?.disconnect();PostPageController.observer=null;clearTimeout(PostPageController.favoriteTimer);PostPageController.favoriteTimer=null;PostPageController.buttons.forEach((button)=>button.remove());PostPageController.buttons=[];PostPageController.fallbackRoot?.remove();PostPageController.fallbackRoot=null;PostPageController.root=null;PostPageController.nativeFavorite=null;PostPageController.status=null;PostPageController.context=null;},
  };

  const CreatorActionController = {
    context:null,reference:null,buttons:[],controller:null,observer:null,
    findFavorite(){
      return [...document.querySelectorAll('a,button,input[type="submit"]')].find((node)=>node.isConnected&&!node.closest?.('[data-pmf-owned="true"],aside,nav,[class*="sidebar"]')&&/\b(?:un)?favorite\b/i.test(PostPageController.actionText(node)))||null;
    },
    create(field,template) {
      const button=document.createElement('button');button.type='button';const safeClasses=[...template?.classList||[]].filter((name)=>/^[a-z0-9_-]+$/i.test(name)&&!/active|selected|favorite|unfavorite|disabled|turbo|stimulus|controller|action|^js-/i.test(name));button.className=[...safeClasses,'pmf-post-status-button','pmf-creator-action',`pmf-creator-action-${field}`].join(' ');button.dataset.pmfOwned='true';button.dataset.pmfCreatorAction=field;
      const icon=document.createElement('span');icon.className='pmf-post-status-icon';icon.innerHTML=field==='liked'?Icons.heart:Icons.eye;const label=document.createElement('span');label.className='pmf-post-status-label';button.append(icon,label);
      const style=globalThis.getComputedStyle?.(template);if(style){button.style.font=style.font;button.style.color=style.color;}return button;
    },
    nativeFavoriteValue(){const text=PostPageController.actionText(CreatorActionController.reference);if(/\bunfavorite\b/i.test(text))return true;if(/\bfavorite\b/i.test(text))return false;const pressed=CreatorActionController.reference?.getAttribute?.('aria-pressed');return pressed==='true'?true:pressed==='false'?false:null;},
    render(state) {
      CreatorActionController.buttons.forEach((button)=>{const field=button.dataset.pmfCreatorAction;const active=Boolean(state?.[field]);const label=field==='liked'?(active?'Unlike':'Like'):(active?'Unhide':'Hide');button.classList.toggle('pmf-active',active);button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',`${label} this creator`);button.title=`${label} this creator`;button.querySelector('.pmf-post-status-label').textContent=label;});
    },
    async mount(context) {
      CreatorActionController.cleanup();const favorite=CreatorActionController.findFavorite();if(!favorite?.parentElement)return false;const controller=new AbortController();CreatorActionController.controller=controller;CreatorActionController.context=context;CreatorActionController.reference=favorite;
      const liked=CreatorActionController.create('liked',favorite);const hidden=CreatorActionController.create('hidden',favorite);PmfDomMutationGuard.run(()=>{favorite.insertAdjacentElement('afterend',hidden);favorite.insertAdjacentElement('afterend',liked);});CreatorActionController.buttons=[liked,hidden];
      let state=await Cache.getCreatorState(context.creatorKey);const favoriteValue=CreatorActionController.nativeFavoriteValue();if(favoriteValue!=null&&favoriteValue!==state.favoriteDirectValue)state=await CreatorState.set(context.creatorKey,{favoriteDirectValue:favoriteValue},'native-creator-page');CreatorActionController.render(state);NativeActionAlignment.align(favorite,[liked],{fallback:4,operation:'creator-action-geometry'});const upload=PostPageController.candidates(/\bupload file\b/i).find((node)=>node.closest('header,section,article,div')===favorite.closest('header,section,article,div'))||PostPageController.candidates(/\bupload file\b/i)[0];NativeActionAlignment.balanceTrailing(upload||favorite,hidden,favorite.parentElement,{operation:'creator-hide-spacing'});
      const click=async(event)=>{const button=event.currentTarget;button.disabled=true;try{state=await CreatorState.toggle(context.creatorKey,button.dataset.pmfCreatorAction);CreatorActionController.render(state);}catch(error){Logger.warn('Could not save creator state.',error);GlobalUI.flash('Could not save creator state.');}finally{button.disabled=false;}};
      liked.addEventListener('click',click,{signal:controller.signal});hidden.addEventListener('click',click,{signal:controller.signal});
      CreatorActionController.observer=new MutationObserver(async()=>{if(!favorite.isConnected){queueMicrotask(()=>{if(CreatorActionController.context?.creatorKey===context.creatorKey)CreatorActionController.mount(context);});return;}const value=CreatorActionController.nativeFavoriteValue();if(value!=null&&value!==state.favoriteDirectValue){state=await CreatorState.set(context.creatorKey,{favoriteDirectValue:value},'native-creator-observation');}});
      CreatorActionController.observer.observe(favorite.parentElement,{attributes:true,childList:true,subtree:true,characterData:true});return true;
    },
    cleanup(){CreatorActionController.controller?.abort();CreatorActionController.controller=null;CreatorActionController.observer?.disconnect();CreatorActionController.observer=null;CreatorActionController.buttons.forEach((button)=>button.remove());CreatorActionController.buttons=[];CreatorActionController.reference=null;CreatorActionController.context=null;},
  };

  const CreatorPageController = {
    mounted(){return Boolean(App.context&&App.ui?.root?.isConnected);},
    health(context,dom=PawchiveDOM.find(context)){
      const roots=[...document.querySelectorAll('#pmf-root')];
      let compactHealthy=true;
      if(App.cataloguePostCount()){
        const matches=App.matchingPosts();const pageSize=App.filteredPageSize();const totalPages=Math.max(1,Math.ceil(matches.length/pageSize));const page=Util.clamp(App.filteredPage,1,totalPages);const start=(page-1)*pageSize;const expected=Math.min(pageSize,Math.max(0,matches.length-start));const actual=App.ui?.grid?.querySelectorAll?.(':scope > article.post-card').length||0;
        compactHealthy=Boolean(App.ui?.grid?.isConnected&&!App.ui.grid.hidden&&App.ui?.paginator?.isConnected&&!App.ui.paginator.hidden&&actual===expected);
      }
      return roots.length===1&&roots[0].dataset.pmfInstance===INSTANCE_ID&&App.ui?.root===roots[0]&&App.context?.creatorKey===context.creatorKey&&App.context?.nativePageKey===context.nativePageKey&&dom&&App.dom?.searchForm===dom.searchForm&&App.dom?.grid===dom.grid&&App.dom.grid.isConnected&&compactHealthy;
    },
    async mount(context,{generation,signal,priorGrid,priorSignatureKey}={}) {
      const guard=()=>!signal?.aborted&&generation===Lifecycle.routeGeneration&&Route.parsePage(location.href).kind==='creator'&&Route.parsePage(location.href).context.nativePageKey===context.nativePageKey;
      if(App.context&&App.context.creatorKey!==context.creatorKey)App.fullCleanup();if(!App.context){Lifecycle.restoreNativePage();Lifecycle.removeStaleRoots();const loaded=await App.loadCreator(context);if(!loaded||!guard())return false;}const found=await Lifecycle.waitForCreatorDOM(context,{generation,signal,priorGrid,priorSignatureKey});if(!found||!guard())return false;
      const roots=[...document.querySelectorAll('#pmf-root')];const singletonHealthy=roots.length===1&&roots[0].dataset.pmfInstance===INSTANCE_ID;if(!singletonHealthy||App.requiresRebind(found.context,found.dom))await App.rebindNativePage(found.context,found.dom);else App.context=found.context;if(!guard())return false;await CreatorActionController.mount(found.context);const signature=PawchiveDOM.signature(found.dom);Logger.info({operation:'creator-dom-bound',creatorKey:context.creatorKey,nativePageKey:context.nativePageKey,gridChanged:Boolean(priorGrid&&priorGrid!==found.dom.grid),cardCount:signature.cardCount,firstCardId:signature.firstCardId,lastCardId:signature.lastCardId});return true;
    },
    cleanup({retainSession=false}={}){CreatorActionController.cleanup();if(retainSession&&App.context){App.persistUIState();App.detachPage();return;}if(App.context||App.ui)App.fullCleanup();},
  };

  const isPmfOwnedNode = (node) => {
    const element=node?.nodeType===1?node:node?.parentElement;
    return Boolean(element?.matches?.('[data-pmf-owned="true"],#pmf-root,#pmf-toolbar,#pmf-global-host')||element?.closest?.('[data-pmf-owned="true"],#pmf-root,#pmf-toolbar,#pmf-global-host'));
  };

  const PmfDomMutationGuard = {
    depth:0,
    run(work){PmfDomMutationGuard.depth+=1;try{return work();}finally{queueMicrotask(()=>{PmfDomMutationGuard.depth=Math.max(0,PmfDomMutationGuard.depth-1);});}},
    ownsMutation(mutation){
      const changed=[...mutation.addedNodes,...mutation.removedNodes].filter((node)=>node.nodeType===1||node.nodeType===3);
      if(!changed.length)return PmfDomMutationGuard.depth>0&&isPmfOwnedNode(mutation.target);
      return changed.every(isPmfOwnedNode);
    },
  };

  const NativeStylesheetHealth = {
    state:'bootstrapping',baseline:null,observer:null,observedHead:null,documentRef:document,headRef:null,documentEpoch:0,wasHealthy:false,recoveryAttempted:false,lossTimer:null,history:[],lastLogKey:'',
    reloadWindowMs:30000,
    normalizedUrl(){const url=new URL(location.href);url.hash='';return url.href;},
    nativeLinks(){return [...document.querySelectorAll('link[rel~="stylesheet"]')].filter((link)=>link.dataset.pmfOwned!=='true');},
    descriptor(link){return{href:link.href||link.getAttribute('href')||'',rel:link.rel||'stylesheet',media:link.media||'',type:link.type||'',integrity:link.integrity||'',crossOrigin:link.crossOrigin||'',referrerPolicy:link.referrerPolicy||'',disabled:Boolean(link.disabled)};},
    nativeStructurePresent(){
      const page=Route.parsePage(location.href);if(page.kind==='other')return false;
      return Boolean(document.querySelector('main,#main,.card-list__items,article.post-card,[class*="creator"],[class*="artist"]'));
    },
    snapshot(reason='snapshot'){
      if(document!==NativeStylesheetHealth.documentRef){NativeStylesheetHealth.documentRef=document;NativeStylesheetHealth.documentEpoch+=1;NativeStylesheetHealth.wasHealthy=false;NativeStylesheetHealth.recoveryAttempted=false;}
      const head=document.head;const headChanged=head!==NativeStylesheetHealth.headRef;if(headChanged){NativeStylesheetHealth.headRef=head;NativeStylesheetHealth.documentEpoch+=1;NativeStylesheetHealth.ensureHeadObserver();}
      const links=NativeStylesheetHealth.nativeLinks();const restored=links.filter((link)=>link.dataset.pmfRestoredNativeStylesheet==='true');return{reason,pageKey:typeof Lifecycle!=='undefined'?Lifecycle.pageKey(Route.parsePage(location.href)):location.pathname,at:Date.now(),documentEpoch:NativeStylesheetHealth.documentEpoch,headChanged,linkCount:links.length,restoredCount:restored.length,restoredLoaded:restored.filter((link)=>link.dataset.pmfStylesheetLoadState==='loaded'||Boolean(link.sheet)).length,restoredFailed:restored.filter((link)=>link.dataset.pmfStylesheetLoadState==='error').length,styleSheetCount:document.styleSheets?.length||0,structureHealthy:NativeStylesheetHealth.nativeStructurePresent(),visible:document.visibilityState!=='hidden',links:links.map(NativeStylesheetHealth.descriptor)};
    },
    log(event,data={}){
      const record={event,state:NativeStylesheetHealth.state,...data};const key=JSON.stringify([event,record.state,record.pageKey,record.documentEpoch,record.linkCount,record.reason]);
      if(key===NativeStylesheetHealth.lastLogKey)return;NativeStylesheetHealth.lastLogKey=key;NativeStylesheetHealth.history.push({...record,at:Date.now()});if(NativeStylesheetHealth.history.length>80)NativeStylesheetHealth.history.shift();Logger.info({operation:'native-stylesheet-health',...record});
    },
    captureBaseline(reason='baseline'){
      const shot=NativeStylesheetHealth.snapshot(reason);if(!shot.linkCount||!shot.structureHealthy)return false;
      NativeStylesheetHealth.baseline={pageKey:shot.pageKey,capturedAt:shot.at,documentEpoch:shot.documentEpoch,linkCount:shot.linkCount,styleSheetCount:shot.styleSheetCount,structureHealthy:shot.structureHealthy,links:shot.links};
      NativeStylesheetHealth.wasHealthy=true;NativeStylesheetHealth.state='healthy';NativeStylesheetHealth.log('baseline-captured',shot);return true;
    },
    health(reason='health'){
      const shot=NativeStylesheetHealth.snapshot(reason);
      if(shot.restoredCount&&(shot.restoredFailed>0||shot.restoredLoaded<shot.restoredCount)){NativeStylesheetHealth.state=shot.restoredFailed?'broken':'recovering';return{ok:false,state:NativeStylesheetHealth.state,snapshot:shot};}
      if(shot.linkCount>0){if(shot.structureHealthy){NativeStylesheetHealth.wasHealthy=true;NativeStylesheetHealth.state='healthy';if(!NativeStylesheetHealth.baseline)NativeStylesheetHealth.captureBaseline(reason);}return{ok:true,state:NativeStylesheetHealth.state,snapshot:shot};}
      if(!NativeStylesheetHealth.wasHealthy){NativeStylesheetHealth.state='bootstrapping';return{ok:true,state:'bootstrapping',snapshot:shot};}
      if(!shot.visible||!shot.structureHealthy){NativeStylesheetHealth.state='suspect';return{ok:true,state:'suspect',snapshot:shot};}
      NativeStylesheetHealth.state='suspect';NativeStylesheetHealth.scheduleLossCheck(reason);return{ok:false,state:'suspect',snapshot:shot};
    },
    scheduleLossCheck(reason){
      clearTimeout(NativeStylesheetHealth.lossTimer);NativeStylesheetHealth.lossTimer=setTimeout(async()=>{
        const first=NativeStylesheetHealth.snapshot(`${reason}:stabilize-1`);await Util.sleep(140).catch(()=>{});const second=NativeStylesheetHealth.snapshot(`${reason}:stabilize-2`);
        if(first.documentEpoch!==second.documentEpoch||second.linkCount||!second.visible||!second.structureHealthy||!NativeStylesheetHealth.wasHealthy)return;
        NativeStylesheetHealth.state='broken';NativeStylesheetHealth.log('confirmed-loss',second);Lifecycle.cancelForStylesheetFailure?.(second);await NativeStylesheetHealth.recover(second);
      },180);
    },
    restoreDescriptors(){
      const head=document.head;if(!head||!NativeStylesheetHealth.baseline?.links?.length)return 0;let restored=0;
      PmfDomMutationGuard.run(()=>NativeStylesheetHealth.baseline.links.forEach((descriptor)=>{
        if(!descriptor.href||[...document.querySelectorAll('link[rel~="stylesheet"]')].some((link)=>link.href===descriptor.href))return;
        const link=document.createElement('link');link.rel=descriptor.rel||'stylesheet';link.href=descriptor.href;if(descriptor.media)link.media=descriptor.media;if(descriptor.type)link.type=descriptor.type;if(descriptor.integrity)link.integrity=descriptor.integrity;if(descriptor.crossOrigin)link.crossOrigin=descriptor.crossOrigin;if(descriptor.referrerPolicy)link.referrerPolicy=descriptor.referrerPolicy;link.disabled=descriptor.disabled;link.dataset.pmfRestoredNativeStylesheet='true';link.dataset.pmfStylesheetLoadState='pending';link.addEventListener('load',()=>{link.dataset.pmfStylesheetLoadState='loaded';},{once:true});link.addEventListener('error',()=>{link.dataset.pmfStylesheetLoadState='error';},{once:true});head.append(link);restored+=1;
      }));return restored;
    },
    async recover(snapshot){
      if(NativeStylesheetHealth.recoveryAttempted)return;NativeStylesheetHealth.recoveryAttempted=true;NativeStylesheetHealth.state='recovering';const restored=NativeStylesheetHealth.restoreDescriptors();NativeStylesheetHealth.log('descriptor-restoration-attempt',{...snapshot,restored});
      await Util.sleep(1200).catch(()=>{});const result=NativeStylesheetHealth.snapshot('post-restoration');const restoredHealthy=result.restoredCount===0||result.restoredFailed===0&&result.restoredLoaded===result.restoredCount;
      if(result.linkCount>0&&restoredHealthy){NativeStylesheetHealth.state='healthy';NativeStylesheetHealth.wasHealthy=true;NativeStylesheetHealth.log('restoration-succeeded',result);Lifecycle.schedule?.('native stylesheet restored');return;}
      NativeStylesheetHealth.state='broken';NativeStylesheetHealth.log('restoration-failed',result);NativeStylesheetHealth.guardedReload(result);
    },
    guardedReload(snapshot){
      const key=`pmf-stylesheet-reload:${NativeStylesheetHealth.normalizedUrl()}`;let guard={at:0,attempts:0};try{guard=JSON.parse(sessionStorage.getItem(key)||'{}');}catch{}
      const recent=Date.now()-(Number(guard.at)||0)<NativeStylesheetHealth.reloadWindowMs;if(recent&&(Number(guard.attempts)||0)>=1){NativeStylesheetHealth.log('reload-suppressed',{...snapshot,reloadGuard:guard});return false;}
      try{sessionStorage.setItem(key,JSON.stringify({at:Date.now(),attempts:recent?(Number(guard.attempts)||0)+1:1}));NativeStylesheetHealth.log('guarded-hard-reload',{...snapshot});location.reload();return true;}catch(error){Logger.error('Native stylesheet recovery reload failed.',error);return false;}
    },
    ensureHeadObserver(){
      const head=document.head;if(!head||head===NativeStylesheetHealth.observedHead&&NativeStylesheetHealth.observer)return;
      NativeStylesheetHealth.observer?.disconnect();NativeStylesheetHealth.observedHead=head;NativeStylesheetHealth.observer=new MutationObserver((mutations)=>{if(mutations.every(PmfDomMutationGuard.ownsMutation))return;NativeStylesheetHealth.health('head mutation');});NativeStylesheetHealth.observer.observe(head,{childList:true});
    },
    start(){
      NativeStylesheetHealth.ensureHeadObserver();NativeStylesheetHealth.health('start');
      document.addEventListener('DOMContentLoaded',()=>{NativeStylesheetHealth.ensureHeadObserver();NativeStylesheetHealth.captureBaseline('DOMContentLoaded');NativeStylesheetHealth.health('DOMContentLoaded');},{once:true});
      globalThis.__PMF_DEBUG__=globalThis.__PMF_DEBUG__||{};globalThis.__PMF_DEBUG__.stylesheetHealth=()=>({state:NativeStylesheetHealth.state,baseline:Util.clone(NativeStylesheetHealth.baseline),snapshot:NativeStylesheetHealth.snapshot('debug'),history:Util.clone(NativeStylesheetHealth.history)});
    },
    stop(){clearTimeout(NativeStylesheetHealth.lossTimer);NativeStylesheetHealth.observer?.disconnect();NativeStylesheetHealth.observer=null;NativeStylesheetHealth.observedHead=null;},
  };

  const Lifecycle = {
    lastHref: location.href,
    timer: null,
    stopped: false,
    routeGeneration:0,
    activePageKey:'',
    desiredPageKey:'',
    mountingPageKey:'',
    mountedPageKey:'',
    domEpoch:0,
    mountController:null,
    mountPromise:null,
    eventController: null,
    documentObserver: null,
    delayedChecks: new Set(),
    fallbackTimer:null,
    earlyShellTimer:null,
    pendingReason:'startup',
    mutationSchedule: Util.debounce(() => Lifecycle.routeHealth('documentElement mutation'), 140),
    removeStaleRoots() {
      document.querySelectorAll('#pmf-root, #pmf-toolbar, #pmf-artists-root, #pmf-creator-mode-selector, .pmf-filtered-paginator, .pmf-filter-grid').forEach((node) => node.remove());
    },
    restoreNativePage() {
      document.querySelectorAll('.card-list__items,.paginator').forEach((node)=>{if(!node.closest('[data-pmf-owned="true"]'))node.hidden=false;});
      document.querySelectorAll('article.post-card').forEach((card)=>{if(!card.closest('[data-pmf-owned="true"]')){card.classList.remove('pmf-dimmed','pmf-hidden-card');BadgeRenderer.cleanup(card);}});
    },
    pageKey(page){return page.kind==='creator'?`creator|${page.context.nativePageKey}`:page.kind==='post'?`post|${page.context.postKey}`:page.kind==='artists'?`artists|${page.pageKey}`:'other';},
    mutationIsOwned: PmfDomMutationGuard.ownsMutation,
    cancelForStylesheetFailure(snapshot){
      Lifecycle.mountController?.abort();Lifecycle.mountingPageKey='';Lifecycle.mountedPageKey='';Lifecycle.mountPromise=null;CreatorPageController.cleanup();PostPageController.cleanup();ArtistsPageController.cleanup();Lifecycle.restoreNativePage();Lifecycle.removeStaleRoots();OverlayManager.closeAll('native-stylesheet-loss');Logger.warn('Native stylesheet loss confirmed; PMF takeover was cancelled.',snapshot);
    },
    resumeRouteObservers(){
      if(!Lifecycle.documentObserver||Lifecycle.stopped)return;
      Lifecycle.documentObserver.disconnect();Lifecycle.documentObserver.observe(document.documentElement,{childList:true,subtree:true});
    },
    schedule(reason = 'signal', delay = 0) {
      if (Lifecycle.stopped) return;
      Lifecycle.pendingReason=reason;
      Logger.info('Route health scheduled:', reason, location.href);
      Lifecycle.desiredPageKey=Lifecycle.pageKey(Route.parsePage(location.href));
      if(!delay){queueMicrotask(()=>Lifecycle.ensureMounted());return;}
      clearTimeout(Lifecycle.fallbackTimer);Lifecycle.fallbackTimer=setTimeout(()=>{Lifecycle.fallbackTimer=null;Lifecycle.ensureMounted();},Math.min(250,Math.max(0,delay)));
    },
    waitForCreatorDOM(context,{generation,signal,priorGrid=null,priorSignatureKey=''}={}) {
      return new Promise((resolve, reject) => {
        let timer;let stableKey='';let stableCount=0;
        const finish = (value, error) => { clearInterval(timer); signal?.removeEventListener('abort', abort); if (error) reject(error); else resolve(value); };
        const abort = () => finish(null, new DOMException('Aborted', 'AbortError'));
        const check = () => { const page=Route.parsePage(location.href);const current=page.kind==='creator'?page.context:null;if (signal?.aborted||generation!==Lifecycle.routeGeneration||!current||current.nativePageKey!==context.nativePageKey) { abort(); return; } const dom = PawchiveDOM.find(current);if(!dom)return;const signature=PawchiveDOM.signature(dom);const key=PawchiveDOM.signatureKey(signature);const staleReplacement=current.nativePageKey!==App.context?.nativePageKey&&priorGrid&&dom.grid===priorGrid&&key===priorSignatureKey;if(staleReplacement)return;if(key===stableKey)stableCount+=1;else{stableKey=key;stableCount=1;}if(stableCount>=2)finish({ context: current, dom,signature }); };
        signal?.addEventListener('abort', abort, { once: true }); timer = setInterval(check, 80); check();
      });
    },
    async performEnsureMounted(requestedPage,{generation,signal,priorGrid,priorSignatureKey}={}) {
      if (Lifecycle.stopped) return;
      const stylesheet=NativeStylesheetHealth.health('before mount');if(!stylesheet.ok){Lifecycle.cancelForStylesheetFailure(stylesheet.snapshot);return;}
      const page=requestedPage?.kind?requestedPage:Route.parsePage(location.href);
      Lifecycle.lastHref = location.href;
      if(page.kind==='creator'){PostPageController.cleanup();ArtistsPageController.cleanup();await CreatorPageController.mount(page.context,{generation,signal,priorGrid,priorSignatureKey});return;}
      if(page.kind==='post'){CreatorPageController.cleanup({retainSession:true});ArtistsPageController.cleanup();Lifecycle.removeStaleRoots();await PostPageController.mount(page.context,{generation,signal});return;}
      if(page.kind==='artists'){PostPageController.cleanup();CreatorPageController.cleanup();Lifecycle.removeStaleRoots();await ArtistsPageController.mount(page,{generation,signal});return;}
      PostPageController.cleanup();CreatorPageController.cleanup();ArtistsPageController.cleanup();Lifecycle.removeStaleRoots();OverlayManager.closeAll('unrelated-route');
    },
    ensureMounted(page = Route.parsePage(location.href)) {
      if (Lifecycle.stopped) return Promise.resolve();
      const stylesheet=NativeStylesheetHealth.health('ensure mounted');if(!stylesheet.ok)return Promise.resolve();
      const nextKey=Lifecycle.pageKey(page);const healthy=page.kind==='creator'?CreatorPageController.health(page.context):page.kind==='post'?PostPageController.health(page.context):page.kind==='artists'?ArtistsPageController.health(page):!CreatorPageController.mounted()&&!ArtistsPageController.mounted()&&!PostPageController.root;
      Lifecycle.desiredPageKey=nextKey;
      if(nextKey===Lifecycle.mountedPageKey&&healthy)return Lifecycle.mountPromise||Promise.resolve();
      if(nextKey===Lifecycle.mountingPageKey&&Lifecycle.mountPromise){Logger.info({operation:'route-mount-reused',pageKey:nextKey,reason:Lifecycle.pendingReason||'same-route'});return Lifecycle.mountPromise;}
      const fromPageKey=Lifecycle.activePageKey;const transition=Boolean(fromPageKey&&fromPageKey!==nextKey);const priorDom=App.dom||(transition&&page.kind==='creator'?PawchiveDOM.find(page.context):null);const priorGrid=priorDom?.grid||null;const priorSignatureKey=priorDom?PawchiveDOM.signatureKey(PawchiveDOM.signature(priorDom)):'';
      Lifecycle.activePageKey=nextKey;Lifecycle.mountingPageKey=nextKey;const generation=++Lifecycle.routeGeneration;Lifecycle.mountController?.abort();const controller=new AbortController();Lifecycle.mountController=controller;
      const reason=Lifecycle.pendingReason||'ensure-mounted';Lifecycle.pendingReason='';
      Logger.info({operation:'route-transition',generation,fromPageKey,toPageKey:nextKey,reason});
      const promise=Lifecycle.performEnsureMounted(page,{generation,signal:controller.signal,priorGrid,priorSignatureKey}).then(()=>{if(!controller.signal.aborted&&generation===Lifecycle.routeGeneration){Lifecycle.mountedPageKey=nextKey;Lifecycle.domEpoch+=1;clearTimeout(Lifecycle.earlyShellTimer);}}).catch((error)=>{if(error.name!=='AbortError')Logger.error('Mount failed.',error);}).finally(()=>{if(Lifecycle.mountPromise===promise){Lifecycle.mountPromise=null;Lifecycle.mountingPageKey='';}const current=Route.parsePage(location.href);const unhealthy=current.kind==='creator'?!CreatorPageController.health(current.context):current.kind==='post'?!PostPageController.health(current.context):current.kind==='artists'?!ArtistsPageController.health(current):Boolean(App.context||App.ui||ArtistsPageController.mounted()||PostPageController.root);if(!Lifecycle.stopped&&generation===Lifecycle.routeGeneration&&unhealthy&&NativeStylesheetHealth.health('post-init').ok)Lifecycle.schedule('post-init health check',220);});
      Lifecycle.mountPromise=promise;return promise;
    },
    routeHealth(reason = 'watchdog') {
      if (Lifecycle.stopped) return;
      const page=Route.parsePage(location.href);const healthy=page.kind==='creator'?CreatorPageController.health(page.context):page.kind==='post'?PostPageController.health(page.context):page.kind==='artists'?ArtistsPageController.health(page):!CreatorPageController.mounted()&&!ArtistsPageController.mounted()&&!PostPageController.root;
      if (!healthy) Lifecycle.schedule(reason, 0);
    },
    prepareSnapshot(reason = 'pagehide',event=null) {
      Logger.info('Preparing page snapshot:', reason);App.savePresetDebounced.cancel(); App.saveActivePreset(); App.persistUIState();CreatorSessionCache.captureFromApp();if(event?.persisted||reason==='turbo:before-cache'){CatalogueJobManager.suspendForBfcache();Lifecycle.documentObserver?.disconnect();Logger.info({operation:'soft-snapshot',pageKey:Lifecycle.activePageKey,rootConnected:Boolean(App.ui?.root?.isConnected),nativeAnchorConnected:Boolean(App.dom?.grid?.isConnected||PostPageController.nativeFavorite?.isConnected)});return;}CatalogueJobManager.shutdown(); App.detachPage();PostPageController.cleanup();ArtistsPageController.cleanup();Lifecycle.restoreNativePage(); Lifecycle.removeStaleRoots();
    },
    handlePageShow(event) {
      if (Lifecycle.stopped) return;
      Logger.info('pageshow', { persisted: Boolean(event.persisted), href: location.href }); Lifecycle.lastHref = location.href;
      if(event.persisted){CatalogueJobManager.resumeFromBfcache();Lifecycle.resumeRouteObservers();const stylesheet=NativeStylesheetHealth.health('persisted pageshow');const page=Route.parsePage(location.href);const healthy=stylesheet.ok&&(page.kind==='creator'?CreatorPageController.health(page.context):page.kind==='post'?PostPageController.health(page.context):page.kind==='artists'?ArtistsPageController.health(page):false);Logger.info({operation:'bfcache-resume',pageKey:Lifecycle.pageKey(page),stylesheetState:stylesheet.state,rootConnected:Boolean(App.ui?.root?.isConnected),nativeAnchorConnected:Boolean(App.dom?.grid?.isConnected||PostPageController.nativeFavorite?.isConnected),renderContractValid:healthy,repaired:!healthy});if(healthy){Lifecycle.activePageKey=Lifecycle.pageKey(page);Lifecycle.mountedPageKey=Lifecycle.activePageKey;return;}if(!stylesheet.ok){Lifecycle.cancelForStylesheetFailure(stylesheet.snapshot);return;}}
      Lifecycle.mountController?.abort();Lifecycle.activePageKey='';if (App.ui)App.detachPage();PostPageController.cleanup();ArtistsPageController.cleanup();Lifecycle.restoreNativePage();Lifecycle.removeStaleRoots();
      Lifecycle.schedule('pageshow');
    },
    handleCreatorClick(event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest?.('a[href]'); if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const destination = Route.parsePage(anchor.href); if (destination.kind==='other') return;
      queueMicrotask(() => Lifecycle.routeHealth('creator-link microtask'));
      requestAnimationFrame(() => Lifecycle.routeHealth('creator-link animation frame'));
      Lifecycle.schedule('creator-link 100ms', 100); Lifecycle.schedule('creator-link 300ms', 300);
    },
    shutdown() {
      if (Lifecycle.stopped) return; Lifecycle.stopped = true; clearInterval(Lifecycle.timer);clearTimeout(Lifecycle.fallbackTimer);clearTimeout(Lifecycle.earlyShellTimer); Lifecycle.mountController?.abort(); Lifecycle.documentObserver?.disconnect(); Lifecycle.documentObserver = null; Lifecycle.mutationSchedule.cancel();NativeStylesheetHealth.stop(); Lifecycle.delayedChecks.forEach(clearTimeout); Lifecycle.delayedChecks.clear();CatalogueJobManager.shutdown();FavoriteSyncCoordinator.stop();PostStatusStateCoordinator.shutdown();PostPageController.cleanup();ArtistsPageController.cleanup(); App.fullCleanup();CreatorSessionCache.clear();Lifecycle.restoreNativePage(); Lifecycle.removeStaleRoots();AttachmentBadgeSizing.remove();document.querySelector('#pmf-global-host')?.remove(); Lifecycle.eventController?.abort();
    },
    start() {
      Settings.load();PostStatusFilters.load();PostStatusStateCoordinator.start();NativeStylesheetHealth.start();CatalogueJobManager.setConcurrency(Settings.value.catalogueConcurrentJobs);CatalogueJobManager.restoreSession();AttachmentBadgeSizing.applyAll({reason:'startup'});Lifecycle.eventController = new AbortController(); const signal = Lifecycle.eventController.signal;
      document.addEventListener('pmf:shutdown-instance', (event) => { if (event.detail?.instanceId !== INSTANCE_ID) Lifecycle.shutdown(); }, { signal });
      document.dispatchEvent(new CustomEvent('pmf:shutdown-instance', { detail: { instanceId: INSTANCE_ID } }));
      OverlayManager.install(signal); Lifecycle.removeStaleRoots();
      const signalRoute = (reason) => { Lifecycle.lastHref = location.href; Lifecycle.schedule(reason); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => signalRoute('DOMContentLoaded'), { once: true, signal });
      window.addEventListener('load', () => signalRoute('load'), { once: true, signal });
      window.addEventListener('popstate', () => signalRoute('popstate'), { signal });
      window.addEventListener('hashchange', () => signalRoute('hashchange'), { signal });
      window.addEventListener('pageshow', (event) => Lifecycle.handlePageShow(event), { signal });
      window.addEventListener('pagehide', (event) => Lifecycle.prepareSnapshot('pagehide',event), { signal });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') signalRoute('visibilitychange visible'); }, { signal });
      document.addEventListener('click', (event) => Lifecycle.handleCreatorClick(event), { capture: true, signal });
      document.addEventListener('turbo:before-cache', () => Lifecycle.prepareSnapshot('turbo:before-cache'), { signal });
      document.addEventListener('turbo:before-render', () => {NativeStylesheetHealth.health('turbo:before-render');Lifecycle.mountController?.abort();}, { signal });
      document.addEventListener('turbo:load', () => {CatalogueJobManager.resumeFromBfcache();Lifecycle.resumeRouteObservers();signalRoute('turbo:load');}, { signal });
      document.addEventListener('turbo:render', () => signalRoute('turbo:render'), { signal });
      try { window.navigation?.addEventListener('navigate', () => Lifecycle.schedule('Navigation API'), { signal }); } catch (error) { Logger.info('Navigation API observer unavailable.', error); }
      Lifecycle.documentObserver = new MutationObserver((mutations) => { if (mutations.every(Lifecycle.mutationIsOwned)) return; NativeStylesheetHealth.health('document mutation');Lifecycle.mutationSchedule(); });
      Lifecycle.documentObserver.observe(document.documentElement, { childList: true, subtree: true });
      Lifecycle.timer = setInterval(() => { if (location.href !== Lifecycle.lastHref) { Lifecycle.lastHref = location.href; Lifecycle.schedule('URL polling'); } else Lifecycle.routeHealth('watchdog polling'); }, 750);
      Lifecycle.earlyShellTimer=setTimeout(()=>{const page=Route.parsePage(location.href);const healthy=page.kind==='creator'?CreatorPageController.health(page.context):page.kind==='post'?PostPageController.health(page.context):page.kind==='artists'?ArtistsPageController.health(page):true;if(!healthy){Lifecycle.restoreNativePage();Lifecycle.removeStaleRoots();Logger.warn('Early PMF shell timed out; native content was restored.');}},2500);
      Lifecycle.schedule('initial startup');
    },
  };

  Lifecycle.start();
})();
