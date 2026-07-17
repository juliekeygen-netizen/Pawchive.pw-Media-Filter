'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api } = loadUserscript();
const { Config, Paginator, App } = api;
const posts = Array.from({length:150}, (_, index) => ({id:String(index + 1)}));
let persists=0;let renders=0;
App.persistUIState=()=>{persists+=1;};
App.render=()=>{renders+=1;};
App.matchingPosts=()=>posts;

const slice = () => posts.slice((App.filteredPage - 1) * Config.filteredPageSize, App.filteredPage * Config.filteredPageSize).map((post) => post.id);
App.filteredPage=1;
assert.equal(Paginator.goToPage(0,{source:'previous',totalPages:3}), false);
assert.equal(Paginator.goToPage(2,{source:'next',totalPages:3}), true);
assert.equal(App.filteredPage,2);
assert.equal(slice()[0],'51');
assert.equal(slice().at(-1),'100');
assert.equal(Paginator.goToPage(1,{source:'previous',totalPages:3}), true);
assert.equal(App.filteredPage,1);
assert.equal(Paginator.goToPage(3,{source:'last',totalPages:3}), true);
assert.equal(slice()[0],'101');
assert.equal(slice().at(-1),'150');
assert.equal(Paginator.goToPage(4,{source:'next',totalPages:3}), false);
assert.equal(App.filteredPage,3);
assert.equal(Paginator.goToPage(1,{source:'first',totalPages:3}), true);
assert.equal(Paginator.goToPage(2,{source:'number',totalPages:3}), true);
assert.equal(App.filteredPage,2);
assert.equal(persists,5);
assert.equal(renders,5);
assert.deepEqual(JSON.parse(JSON.stringify(Paginator.pageButtons(2,3))), [1,2,3]);

console.log('Pawchive Media Filter filtered paginator tests passed.');
