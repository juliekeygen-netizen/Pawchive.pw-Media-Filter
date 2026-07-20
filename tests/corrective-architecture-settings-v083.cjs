'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, stored, originalSource } = loadUserscript();
const {
  Config, Settings, CompactLayoutEngine, CompactGridScale, CreatorSessionCache,
  PostStatusStateCoordinator, PostPageController, Lifecycle, SettingsUI,
} = api;

assert.equal(Config.version, '0.11.2');
assert.equal(Config.schemaVersion, 2);
assert.equal(Config.databaseVersion, 5);

stored.set(Config.settingsKey, { compactCardScale:'small', displayMode:'dim', rememberSearch:false });
Settings.load();
assert.equal(Settings.value.compactCardScale, 'big');
assert.equal(stored.get(Config.cardScaleMigrationKey), true);
assert.equal('displayMode' in Settings.value, false);
assert.equal('rememberSearch' in Settings.value, false);
Settings.save({ compactCardScale:'small' });
assert.equal(Settings.load().compactCardScale, 'small');

const base={availableWidth:1400,cardWidth:220,nativeCardHeight:124,nativeVisibleCardRatio:16/9,columnGap:8};
const big=CompactLayoutEngine.calculateLayout({...base,scale:'big'});
const medium=CompactLayoutEngine.calculateLayout({...base,scale:'medium'});
const small=CompactLayoutEngine.calculateLayout({...base,scale:'small'});
assert.equal(big.legacySmall,Math.max(110,Math.round(124*1.26)));
assert.equal(big.newBig,Math.round(big.legacySmall/1.25));
assert.equal(big.newMedium,Math.round(big.newBig/1.5));
assert.equal(big.newSmall,Math.round(big.newBig/2));
assert.ok(big.cardHeight>medium.cardHeight&&medium.cardHeight>small.cardHeight);
for(const [columns,pageSize] of [[3,48],[4,48],[5,50],[6,48],[7,49],[8,48],[9,45],[10,50]])assert.equal(CompactGridScale.pageSizeForColumns(columns),pageSize);

assert.equal(CreatorSessionCache.capacity,5);
for(let index=0;index<6;index+=1)CreatorSessionCache.put(CreatorSessionCache.create({creatorKey:`creator-${index}`}));
assert.equal(CreatorSessionCache.sessions.size,5);
assert.match(PostStatusStateCoordinator.start.toString(),/PostStatusEvents\.subscribe/);
assert.doesNotMatch(PostPageController.mount.toString(),/PostStatusEvents\.subscribe/);
assert.match(PostPageController.mount.toString(),/directSafe\?'direct-siblings':'measured-wrapper'/);
assert.doesNotMatch(PostPageController.mount.toString(),/pmf-post-status-controls/);

assert.equal(typeof SettingsUI.row,'function');
assert.equal(typeof SettingsUI.toggle,'function');
assert.equal(typeof SettingsUI.select,'function');
assert.match(SettingsUI.buildGeneral.toString(),/Creator cards/);
assert.match(SettingsUI.buildData.toString(),/Update missing-attachment metadata/);
assert.match(SettingsUI.open.toString(),/MissingAttachmentMaintenance\.openScopeDialog/);

assert.match(Lifecycle.ensureMounted.toString(),/mountingPageKey/);
assert.match(Lifecycle.ensureMounted.toString(),/mountedPageKey/);
assert.match(Lifecycle.ensureMounted.toString(),/route-mount-reused/);
assert.doesNotMatch(originalSource,/scheduleSeries\(/);
assert.match(Lifecycle.prepareSnapshot.toString(),/soft-snapshot/);

assert.match(originalSource,/width:10px;height:10px;color:#fff/);
assert.doesNotMatch(originalSource,/\.pmf-post-status-button\{[^}]*font-weight:/);
assert.match(originalSource,/const CompactLayoutEngine = \{/);

console.log('Pawchive Media Filter retained corrective architecture and settings tests passed.');
