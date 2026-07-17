'use strict';

const assert = require('node:assert/strict');
const { loadUserscript } = require('./test-helper.cjs');

const { api, originalSource } = loadUserscript();
const { PostSorter, App, UI } = api;
const posts = [
  {id:'10',title:'Post 10',publishedAt:'2025-01-02T00:00:00Z'},
  {id:'2',title:'post 2',publishedAt:'2026-03-04T00:00:00Z'},
  {id:'3',title:'Alpha',publishedAt:'2024-06-01T00:00:00Z'},
  {id:'4',title:'Unknown',publishedAt:''},
];
const ids = (options) => JSON.parse(JSON.stringify(PostSorter.sort(posts, options).map((post) => post.id)));

assert.deepEqual(ids({mode:'published',direction:'default'}), ['2','10','3','4']);
assert.deepEqual(ids({mode:'published',direction:'reverse'}), ['3','10','2','4']);
assert.deepEqual(ids({mode:'title',direction:'default'}), ['3','2','10','4']);
assert.deepEqual(ids({mode:'title',direction:'reverse'}), ['4','10','2','3']);
assert.deepEqual(posts.map((post) => post.id), ['10','2','3','4'], 'sorting returns a new array');

assert.deepEqual(JSON.parse(JSON.stringify(PostSorter.nextSelection('published','default','title'))), {mode:'title',direction:'default'});
assert.deepEqual(JSON.parse(JSON.stringify(PostSorter.nextSelection('title','default','title'))), {mode:'title',direction:'reverse'});
assert.deepEqual(JSON.parse(JSON.stringify(PostSorter.nextSelection('title','reverse','title'))), {mode:'title',direction:'default'});
assert.deepEqual(JSON.parse(JSON.stringify(PostSorter.normalize('bad','bad'))), {mode:'published',direction:'default'});

let persisted=0;let rendered=0;let updated=0;
App.sortMode='published';App.sortDirection='default';App.filteredPage=8;
App.persistUIState=()=>{persisted+=1;};
App.render=()=>{rendered+=1;};
UI.updateSortButton=()=>{updated+=1;};
App.setSort('published');
assert.equal(App.sortDirection,'reverse');
assert.equal(App.filteredPage,1);
App.setSort('title');
assert.equal(App.sortMode,'title');
assert.equal(App.sortDirection,'default');
assert.equal(persisted,2);
assert.equal(rendered,2);
assert.equal(updated,2);

assert.match(originalSource, /localeCompare\(String\(b\.post\?\.title\|\|''\),undefined,\{numeric:true,sensitivity:'base'\}\)/);
assert.match(originalSource, /aria-haspopup','menu'/);
assert.match(originalSource, /role','menuitemradio'/);
assert.match(originalSource, /initialFocus==='last'/);

console.log('Pawchive Media Filter post sorting tests passed.');
