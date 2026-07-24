'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

(() => {
  const { api, originalSource } = loadUserscript();
  const {
    Config,
    Settings,
    PostStatusFilters,
    CreatorStatusFilters,
    CreatorPresets,
    CreatorFilterEngine,
    CreatorFilterUI,
    CreatorIndexUI,
    SettingsUI,
    DataPortability,
  } = api;

  assert.equal(Config.version, '0.13.9');
  assert.match(originalSource, /\/\/ @version\s+0\.13\.9/);

  Settings.load();
  assert.equal(Settings.value.confirmCreatorCardScan, false);
  assert.equal(Settings.normalize({ confirmCreatorCardScan:true }).confirmCreatorCardScan, false);
  assert.doesNotMatch(SettingString(SettingsUI), /Confirm creator card scans|Confirm initial and resumed scans/);
  assert.doesNotMatch(api.ArtistsPageController.openAction.toString(), /confirmCreatorCardScan|ConfirmDialog/);

  assert.equal(PostStatusFilters.normalize({ seen:'match' }).seen, 'no-match');
  PostStatusFilters.value = { favorite:'off', liked:'off', seen:'off' };
  assert.equal(PostStatusFilters.cycle('seen').seen, 'no-match');
  assert.equal(PostStatusFilters.cycle('seen').seen, 'off');
  assert.equal(CreatorStatusFilters.normalize({ hidden:'match' }).hidden, 'no-match');
  assert.equal(CreatorStatusFilters.cycle('off','hidden'), 'no-match');
  assert.equal(CreatorStatusFilters.cycle('no-match','hidden'), 'off');

  const independentlyEnabled = CreatorFilterEngine.normalizeState({ customRulesEnabled:true, customRules:[] });
  assert.equal(independentlyEnabled.customRulesEnabled, true);
  assert.equal(CreatorFilterEngine.activeGroupCount(independentlyEnabled), 0);
  const emptyExtensions = CreatorFilterEngine.normalizeState({ media:{ customExtensions:{ enabled:true, extensions:[] } } });
  assert.equal(emptyExtensions.media.customExtensions.enabled, true);
  assert.deepEqual(Array.from(emptyExtensions.media.customExtensions.extensions), []);

  const presetRecord = CreatorPresets.normalize({ activeId:'default', presets:[{ id:'default', name:'Default', state:{} }] });
  const duplicate = CreatorPresets.duplicate(presetRecord, 'default');
  assert.equal(duplicate.valid, true);
  assert.equal(duplicate.record.presets.length, 2);
  assert.match(duplicate.preset.name, /^Default copy/);
  const presetUi = CreatorFilterUI.openPresets.toString();
  assert.match(presetUi, /label:'Rename'/);
  assert.match(presetUi, /label:'Duplicate'/);
  assert.match(presetUi, /label:'Delete'/);
  assert.doesNotMatch(presetUi, /label:'Update'|label:'Reset'/);

  const filterOpen = CreatorFilterUI.open.toString();
  assert.match(filterOpen, /data-creator-filter-editor="media:\$\{type\}"/);
  assert.match(filterOpen, /next\.media\.customExtensions\.enabled=event\.target\.checked/);
  assert.match(filterOpen, /next\.customRulesEnabled=event\.target\.checked/);
  assert.doesNotMatch(filterOpen, /configure-extensions|configure-rules/);
  const mediaEditor = CreatorFilterUI.openMedia.toString();
  assert.match(mediaEditor, /extensions&&extensions\.invalid\.length/);
  assert.doesNotMatch(mediaEditor, /extensions\.values\.length\)\{/);
  assert.doesNotMatch(CreatorFilterUI.openAdvancedRules.toString(), /pmf-rule-enabled|name="enabled"/);

  assert.doesNotMatch(originalSource, /data-creator-matches/);
  assert.match(CreatorIndexUI.chrome.toString(), /pmf-sort-label/);
  assert.match(CreatorIndexUI.chrome.toString(), /pmf-sort-direction/);
  assert.match(originalSource, /data-pmf-creator-service/);
  assert.match(originalSource, /data-pmf-creator-service-badge/);
  assert.match(originalSource, /data-pmf-creator-service-badge="fanbox"\]\{background:#30343a/);
  assert.doesNotMatch(originalSource, /data-pmf-creator-service="fanbox"\][^{]*\{background-color/);
  assert.doesNotMatch(originalSource, /linear-gradient\(rgba\(67,70,74|linear-gradient\(rgba\(78,29,25/);

  assert.match(originalSource, /\.pmf-popular-aggregate-picker\{display:grid;grid-template-columns:repeat\(3,minmax\(58px,1fr\)\)/);
  assert.match(originalSource, /\.pmf-creator-rule-controls\{display:grid;grid-template-columns:[^}]+minmax\(76px,88px\) 14px minmax\(76px,88px\) 30px/);
  assert.match(originalSource, /button\[data-creator-rule-action="remove"\]\{width:30px!important/);
  assert.match(originalSource, /preferredWidth=mobile\?Math\.max\(220,rect\.width/);
  assert.match(originalSource, /:Math\.max\(190,rect\.width\)/);

  const generalText = treeText(SettingsUI.buildGeneral(structuredClone(Settings.value)));
  const scanningText = treeText(SettingsUI.buildScanning(structuredClone(Settings.value)));
  const dataText = treeText(SettingsUI.buildData(structuredClone(Settings.value)));
  assert.equal(generalText.includes('Count method'), false);
  assert.equal(generalText.includes('Hide and don’t count posts with missing attachments'), false);
  assert.match(scanningText, /Scanning & detection/);
  assert.match(scanningText, /Creator catalogue detection/);
  assert.match(scanningText, /Count method/);
  assert.match(scanningText, /Hide and don’t count posts with missing attachments/);
  assert.match(dataText, /Open catalogue maintenance/);
  assert.match(originalSource, /const CatalogueMaintenanceUI = \{/);
  assert.match(originalSource, /Missing-attachment metadata/);
  assert.match(originalSource, /Creator profile metadata/);
  assert.match(originalSource, /Native favorites/);

  assert.ok(DataPortability.catalogueStores.includes('popularPeriods'));
  assert.ok(DataPortability.catalogueStores.includes('popularEntries'));
  assert.ok(DataPortability.catalogueStores.includes('popularUiStates'));
  assert.ok(DataPortability.auxiliarySettingKeys.includes(Config.popularAggregatePeriodKey));
  assert.match(DataPortability.exportPresets.toString(), /post:/);
  assert.match(DataPortability.exportPresets.toString(), /creator:/);

  console.log('Pawchive Media Filter v0.13.9 creator catalogue, filters, portability, and settings polish tests passed.');

  function treeText(node, output = []) {
    if (!node) return output.join('\n');
    if (node.textContent) output.push(String(node.textContent));
    for (const child of node.children || []) treeText(child, output);
    return output.join('\n');
  }
  function SettingString(object) {
    return [object.buildGeneral, object.buildScanning, object.buildData, object.open].map((fn) => fn?.toString?.() || '').join('\n');
  }
})();
