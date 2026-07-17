'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, context } = loadUserscript();
const { Config, PostPageController } = api;

assert.equal(Config.version, '0.8.4');

function styleStore() {
  const values = new Map();
  return {
    setProperty(name, value) { values.set(name, String(value)); },
    getPropertyValue(name) { return values.get(name) || ''; },
  };
}

const icon = { getBoundingClientRect:() => ({ left:400, right:418, width:18, height:18 }) };
const textNode = { nodeType:3, textContent:' Favorite ', getBoundingClientRect:() => ({ left:423, right:486, width:63, height:22 }) };
const favorite = {
  childNodes:[icon, textNode],
  nextSibling:{},
  getBoundingClientRect:() => ({ left:392, right:486, width:94, height:24 }),
  querySelector(selector) { return selector === 'svg,i,[class*="icon"]' ? icon : null; },
};
const flag = { getBoundingClientRect:() => ({ left:320, right:370, width:50, height:24 }) };
const root = { style:styleStore() };

PostPageController.findNativeFlag = () => flag;
PostPageController.nativeFavorite = favorite;
PostPageController.context = { postKey:'post-1' };
context.getComputedStyle = () => ({ lineHeight:'24px' });

const metrics = PostPageController.applyNativeMetrics(root, { favorite, host:{} });
assert.equal(metrics.actionGap, 22);
assert.equal(metrics.iconLabelGap, 5);
assert.equal(metrics.iconWidth, 18);
assert.equal(metrics.iconHeight, 18);
assert.equal(metrics.lineHeight, 24);
assert.equal(root.style.getPropertyValue('--pmf-native-action-gap'), '22px');
assert.equal(root.style.getPropertyValue('--pmf-native-icon-label-gap'), '5px');
assert.equal(root.style.getPropertyValue('--pmf-native-action-icon-width'), '18px');
assert.equal(root.style.getPropertyValue('--pmf-native-action-icon-height'), '18px');
assert.equal(root.style.getPropertyValue('--pmf-native-action-line-height'), '24px');

console.log('Pawchive Media Filter v0.8.2 post action native metrics tests passed.');
