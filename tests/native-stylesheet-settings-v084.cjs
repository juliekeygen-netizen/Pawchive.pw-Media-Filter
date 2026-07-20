'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, stored, originalSource } = loadUserscript();
const {
  Config, Settings, PmfDomMutationGuard, NativeStylesheetHealth,
  SettingsUI, PostPageController, Lifecycle,
} = api;

assert.equal(Config.version, '0.11.2');
assert.equal(Config.schemaVersion, 2);
assert.equal(Config.databaseVersion, 5);
assert.equal(Config.settingsKey, 'pmf-settings-v5');

stored.set(Config.settingsKey, {
  attachmentBadgeSize: 'medium',
  catalogueBadges: { alwaysShow:false, types:{ videos:false } },
  projectExtensions: [],
  settingsSchemaVersion: 1,
});
Settings.load();
assert.equal(Settings.value.postAttachmentBadgeSize, 'medium');
assert.equal(Settings.value.creatorAttachmentBadgeSize, 'medium');
assert.equal(Settings.value.catalogueBadges.alwaysShow, false);
assert.equal(Settings.value.catalogueBadges.types.videos, false);
assert.deepEqual(JSON.parse(JSON.stringify(Settings.value.projectExtensions)), []);
assert.equal('attachmentBadgeSize' in Settings.value, false);
assert.equal(stored.get(Config.settingsBackupKey).attachmentBadgeSize, 'medium');
const firstMigration = JSON.stringify(stored.get(Config.settingsKey));
Settings.load();
assert.equal(JSON.stringify(stored.get(Config.settingsKey)), firstMigration, 'migration is idempotent');

const owned = { nodeType:1, matches:(selector) => selector.includes('[data-pmf-owned'), closest:() => null };
const nativeParent = { nodeType:1, matches:() => false, closest:() => null };
assert.equal(PmfDomMutationGuard.ownsMutation({target:nativeParent,addedNodes:[owned],removedNodes:[]}), true);
assert.equal(PmfDomMutationGuard.ownsMutation({target:nativeParent,addedNodes:[nativeParent],removedNodes:[]}), false);

assert.equal(typeof NativeStylesheetHealth.start, 'function');
assert.equal(typeof NativeStylesheetHealth.captureBaseline, 'function');
assert.equal(typeof NativeStylesheetHealth.snapshot, 'function');
assert.equal(typeof NativeStylesheetHealth.health, 'function');
assert.equal(typeof NativeStylesheetHealth.recover, 'function');
assert.equal(typeof NativeStylesheetHealth.stop, 'function');
assert.match(NativeStylesheetHealth.restoreDescriptors.toString(), /pmfRestoredNativeStylesheet/);
assert.match(NativeStylesheetHealth.guardedReload.toString(), /sessionStorage/);
assert.match(NativeStylesheetHealth.guardedReload.toString(), /reloadWindowMs/);
assert.match(Lifecycle.performEnsureMounted.toString(), /NativeStylesheetHealth\.health\('before mount'\)/);
assert.match(Lifecycle.handlePageShow.toString(), /persisted pageshow/);
assert.match(Lifecycle.start.toString(), /turbo:before-render/);

assert.match(SettingsUI.select.toString(), /pmf-select-shell/);
assert.match(SettingsUI.select.toString(), /pmf-select-arrow/);
assert.doesNotMatch(SettingsUI.buildGeneral.toString(), /Attachment badge size|Post status badge size/);
assert.match(SettingsUI.showChild.toString(), /Appearance/);
assert.match(SettingsUI.showChild.toString(), /Visible badge types/);
assert.match(SettingsUI.showChild.toString(), /Visible statuses/);
assert.match(SettingsUI.showChild.toString(), /postAttachmentBadgeSize/);
assert.match(SettingsUI.showChild.toString(), /creatorAttachmentBadgeSize/);
assert.match(SettingsUI.showChild.toString(), /postStatusBadgeSize/);

assert.match(originalSource, /--pmf-status-summary-gap:7px/);
assert.match(originalSource, /gap:var\(--pmf-status-summary-gap\)!important/);
assert.match(originalSource, /\.pmf-select-shell select\{[^}]*appearance:none/);
assert.match(originalSource, /\.pmf-settings-tab-title\{/);
assert.match(originalSource, /pmf-post-attachment-size-small/);
assert.match(originalSource, /pmf-creator-attachment-size-small/);
assert.doesNotMatch(originalSource, /html\.pmf-badge-size-/);

assert.match(PostPageController.nativeMetrics.toString(), /iconWidth/);
assert.match(PostPageController.nativeMetrics.toString(), /iconHeight/);
assert.doesNotMatch(PostPageController.nativeMetrics.toString(), /fontSize/);
assert.match(PostPageController.alignToNative.toString(), /NativeActionAlignment\.align/);
assert.match(PostPageController.sanitizeNativeTemplate.toString(), /attribute\.name==='href'/);
assert.match(originalSource, /--pmf-native-action-icon-width/);
assert.match(originalSource, /--pmf-native-action-icon-height/);
assert.doesNotMatch(originalSource, /\.pmf-post-status-button\{[^}]*padding:0/);
assert.doesNotMatch(originalSource, /\.pmf-post-status-button\{[^}]*vertical-align:baseline/);

console.log('Pawchive Media Filter v0.8.4 native stylesheet, settings, and post-action tests passed.');
