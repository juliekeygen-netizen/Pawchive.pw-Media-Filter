'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource } = loadUserscript();
const { Route, PawchiveDOM, App, Lifecycle } = api;
const offset0 = Route.parsePage('https://pawchive.pw/patreon/user/35150295?o=0').context;
const offset50 = Route.parsePage('https://pawchive.pw/patreon/user/35150295?o=50').context;
assert.notEqual(offset0.nativePageKey, offset50.nativePageKey);
assert.equal(Lifecycle.pageKey({kind:'creator',context:offset0}), `creator|${offset0.nativePageKey}`);
assert.equal(Lifecycle.pageKey({kind:'creator',context:offset50}), `creator|${offset50.nativePageKey}`);

const oldGrid={isConnected:true};
const newGrid={isConnected:true};
const searchForm={};
App.ui={root:{isConnected:true}};
App.context=offset0;
App.dom={grid:oldGrid,searchForm};
assert.equal(App.requiresRebind(offset0,{grid:oldGrid,searchForm}), false);
assert.equal(App.requiresRebind(offset50,{grid:oldGrid,searchForm}), true, 'offset identity forces rebind even if old grid remains connected');
assert.equal(App.requiresRebind(offset50,{grid:newGrid,searchForm}), true);

const signature0={grid:oldGrid,cardCount:50,firstCardId:'100',lastCardId:'51',currentPaginatorPage:'1'};
const signature50={grid:newGrid,cardCount:50,firstCardId:'50',lastCardId:'1',currentPaginatorPage:'2'};
assert.notEqual(PawchiveDOM.signatureKey(signature0), PawchiveDOM.signatureKey(signature50));
assert.match(Lifecycle.waitForCreatorDOM.toString(), /dom\.grid===priorGrid&&key===priorSignatureKey/);
assert.match(originalSource, /window\.addEventListener\('popstate'/);
assert.match(originalSource, /window\.addEventListener\('pageshow'/);
assert.doesNotMatch(App.renderNative.toString(), /preventDefault|stopPropagation/);

console.log('Pawchive Media Filter native page identity and rebind tests passed.');
