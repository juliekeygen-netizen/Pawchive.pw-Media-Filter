'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource } = loadUserscript();
const { Config, SettingsUI } = api;

assert.equal(Config.version, '0.12.5');
assert.match(originalSource, /\/\/ @version\s+0\.12\.5/);

// Settings rows expose stable semantic classes so mobile CSS can stack
// title and control without guessing from child order.
const fieldRow = SettingsUI.row(
  'Post thumbnail size',
  SettingsUI.select('compactCardScale', 'big', [['big', 'Big']]),
);
assert.equal(fieldRow.classList.contains('pmf-settings-row-field'), true);
assert.equal(fieldRow.classList.contains('pmf-settings-row-toggle'), false);
assert.equal(fieldRow.children[0].className, 'pmf-settings-row-label');

const toggleRow = SettingsUI.toggle(
  'postStatusBadgesEnabled',
  true,
  'Show status badges on post cards',
  { child: 'post-status-badges' },
);
assert.equal(toggleRow.classList.contains('pmf-settings-row-toggle'), true);
assert.equal(toggleRow.classList.contains('pmf-settings-row-chevron'), true);

// Dialogs use the dynamic mobile viewport and safe-area-aware spacing.
assert.ok(originalSource.includes('.pmf-dialog{width:calc(100vw - 10px);max-width:calc(100vw - 10px);max-height:calc(100dvh - 10px)'));
assert.ok(originalSource.includes('.pmf-settings-dialog{width:calc(100vw - 10px);height:calc(100dvh - 10px);max-height:calc(100dvh - 10px)'));
assert.ok(originalSource.includes('padding-bottom:max(10px,env(safe-area-inset-bottom))'));

// Settings tabs scroll horizontally as compact, non-wrapping controls.
assert.ok(originalSource.includes('.pmf-settings-layout>nav button{width:auto!important;min-width:max-content!important;min-height:42px;flex:0 0 auto'));
assert.ok(originalSource.includes('scroll-snap-type:x proximity'));
assert.match(originalSource, /scrollIntoView\?\.\(\{\s*block:\s*['"]nearest['"],\s*inline:\s*['"]center['"]/);

// Field rows stack title above control; toggle rows retain a compact
// checkbox + optional chevron arrangement.
assert.ok(originalSource.includes('.pmf-settings-row-field{grid-template-columns:minmax(0,1fr);align-items:stretch'));
assert.ok(originalSource.includes('.pmf-settings-row-toggle.pmf-settings-row-chevron{grid-template-columns:minmax(0,1fr) 42px}'));
assert.ok(originalSource.includes('word-break:normal;overflow-wrap:break-word'));

// Post custom-search rules no longer require horizontal dragging.
const legacyRuleLayout = originalSource.indexOf('.pmf-rule-row{grid-template-columns:62px 84px minmax(110px,1fr) 96px 34px;min-width:520px}');
const mobileRuleLayout = originalSource.lastIndexOf('.pmf-rule-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 38px;');
assert.ok(legacyRuleLayout >= 0);
assert.ok(mobileRuleLayout > legacyRuleLayout, 'mobile rule stack must override the legacy horizontal minimum width');
assert.ok(originalSource.includes('.pmf-rule-list{overflow-x:hidden}'));
assert.ok(originalSource.includes('.pmf-rule-row>[data-pmf-rule-text]{grid-column:1/-1;grid-row:2'));
assert.ok(originalSource.includes('.pmf-rule-row>.pmf-field-choice{grid-column:1/-1;grid-row:3'));

// Creator advanced rules and toolbar split buttons also reflow vertically
// or into safe two-column groups rather than overflowing.
assert.ok(originalSource.includes('.pmf-creator-rule-controls{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;min-width:0}'));
assert.ok(originalSource.includes('.pmf-split-primary>.pmf-scan-button:first-child{grid-column:1!important;grid-row:1!important'));
assert.ok(originalSource.includes('.pmf-split-primary>.pmf-split-chevron{grid-column:2!important;grid-row:1!important'));

// Floating menus widen to a useful mobile width, remain clamped to the
// viewport, and may open above a trigger when space below is insufficient.
assert.ok(originalSource.includes('preferredWidth=mobile?Math.max(rect.width,Math.min(286,viewportWidth-16))'));
assert.ok(originalSource.includes('const spaceBelow=viewportHeight-rect.bottom-8'));
assert.ok(originalSource.includes("menu.style.maxWidth='calc(100vw - 16px)'"));

console.log('Pawchive Media Filter v0.11.3 mobile responsive UI tests passed.');
