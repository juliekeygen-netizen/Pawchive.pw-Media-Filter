'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadUserscript}=require('./test-helper.cjs');
const {CreatorCardBadgeRenderer:renderer,ArtistsPageController:artists,Settings,SettingsEvents}=loadUserscript().api;

const canonical=['videos','images','archives','projectFiles','externalLinks'];
for(let mask=0;mask<32;mask+=1){
  const types=canonical.filter((_,index)=>mask&(1<<index));
  assert.deepEqual(JSON.parse(JSON.stringify(renderer.columns(types))),Array.from({length:Math.ceil(types.length/2)},(_,index)=>types.slice(index*2,index*2+2)));
  assert.ok(renderer.columns(types).every((column)=>column.length>=1&&column.length<=2));
}
assert.deepEqual(JSON.parse(JSON.stringify(renderer.columns(['videos','archives','externalLinks']))),[['videos','archives'],['externalLinks']]);

function style(){const map=new Map();return{setProperty:(key,value)=>map.set(key,value),removeProperty:(key)=>map.delete(key),getPropertyValue:(key)=>map.get(key)||''};}
function badge(width,scrollWidth=width){return{style:style(),scrollWidth,getBoundingClientRect:()=>({width})};}
const first=[badge(31,35),badge(48)];const second=[badge(70)];
const columns=[
  {style:style(),querySelectorAll:()=>first},
  {style:style(),querySelectorAll:()=>second},
];
const rail={isConnected:true,getBoundingClientRect:()=>({width:130}),querySelectorAll:(selector)=>selector==='.pmf-creator-badge-column'?columns:[]};
const card={dataset:{pmfCreatorKey:'creator'},style:style(),querySelector:(selector)=>selector==='.pmf-creator-card-badges'?rail:null};
assert.equal(renderer.layout(card,'test'),142);
assert.equal(columns[0].style.getPropertyValue('--pmf-creator-column-badge-width'),'48px');
assert.equal(columns[1].style.getPropertyValue('--pmf-creator-column-badge-width'),'70px');
assert.notEqual(columns[0].style.getPropertyValue('--pmf-creator-column-badge-width'),columns[1].style.getPropertyValue('--pmf-creator-column-badge-width'));
assert.equal(card.style.getPropertyValue('--pmf-creator-badge-width'),'142px');

const pmfNode={nodeType:1,matches:(selector)=>selector==='[data-pmf-owned="true"]',closest:()=>null};
const nativeNode={nodeType:1,matches:()=>false,closest:()=>null};
assert.equal(artists.isRelevantNativeMutation({target:nativeNode,addedNodes:[pmfNode],removedNodes:[]}),false);
assert.equal(artists.isRelevantNativeMutation({target:nativeNode,addedNodes:[nativeNode],removedNodes:[]}),true);

let event=null;let eventCount=0;const unsubscribe=SettingsEvents.subscribe((detail)=>{event||=detail;eventCount+=1;});for(let index=0;index<5;index+=1)Settings.save({creatorCardBadges:{enabled:true,types:{videos:false,images:true,archives:true,projectFiles:false,externalLinks:true}}});unsubscribe();
assert.equal(eventCount,5,'each repeated save emits one settings event without accumulating subscribers');
assert.ok(event.changed.includes('creatorCardBadges'));
assert.deepEqual(JSON.parse(JSON.stringify(renderer.enabledTypes(Settings.value.creatorCardBadges))),['images','archives','externalLinks']);

const source=fs.readFileSync(path.resolve(__dirname,'..','pawchive-pw-media-filter.user.js'),'utf8');
assert.equal((source.match(/Settings\.load\(\)/g)||[]).length,1,'settings are loaded once at lifecycle startup');
assert.match(source,/column\.dataset\.pmfColumnIndex=String\(logicalIndex\)/);
assert.match(source,/column\.dataset\.pmfBadgeTypes=typesInColumn\.join/);
assert.match(source,/artists-refresh-discarded/);
assert.match(source,/renderBadgesFromCurrentState/);
assert.match(source,/align-items:stretch/);
assert.doesNotMatch(source,/\.pmf-creator-card-badges\{[^}]*flex-direction:row-reverse/);

console.log('Pawchive Media Filter creator badge layout and refresh tests passed.');
