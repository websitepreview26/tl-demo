const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('dist/assets/app.js', 'utf8');
// Run the actual pure helpers without a browser or copied implementation.
const functions = ['route','detailsValid','validDay','fillEmpty','localDay','orderPhase','orderHistory'].map(name => source.split('\n').find(line => line.startsWith(`function ${name}(`))).join('\n');
const context = vm.createContext({location:{hash:'#home'},db:{draft:{}}, Date});
vm.runInContext(functions,context);
const valid = {type:'hydro',address:'Минск, ул. Тестовая, 1',destination:'Минск, ул. Тестовая, 2',cargo:'Оборудование',weight:'800',volume:'4',day:''};
test('Telegram launch hash opens home instead of a broken route',()=>{
 context.location.hash='#tgWebAppVersion=9.6&tgWebAppPlatform=macos';
 assert.equal(context.route().page,'home');
});
test('contact step requires valid route and cargo',()=>{
 context.location.hash='#request/contact';context.db.draft={...valid,address:''};
 assert.equal(context.route().id,undefined);
 context.db.draft={...valid};assert.equal(context.route().id,'contact');
});
test('sample fills only empty fields and preserves user values',()=>{
 const draft={address:'Мой адрес',phone:'',weight:'900'};
 assert.equal(context.fillEmpty(draft,{address:'Пример',phone:'+375290000000',weight:'800'}),1);
 assert.deepEqual(draft,{address:'Мой адрес',phone:'+375290000000',weight:'900'});
 assert.equal(context.fillEmpty(draft,{phone:'Другой номер'}),0);
});
test('invalid weight, volume and dates cannot be submitted',()=>{
 assert.equal(context.detailsValid(valid),true);
 for(const change of [{weight:'-5'},{volume:'0'},{day:'2026-99-99'},{day:'2020-01-01'}])assert.equal(context.detailsValid({...valid,...change}),false,JSON.stringify(change));
 assert.equal(context.detailsValid({...valid,type:'freight'}),true);
});

test('request progress advances and stays in place during discussion',()=>{
 for(const [o,phase] of [[{status:'new'},1],[{status:'question'},1],[{status:'offer',offer:{}},2],[{status:'question',offer:{}},2],[{status:'accepted',accepted:0},3],[{status:'scheduled',accepted:0},4],[{status:'completed',accepted:0},4]])assert.equal(context.orderPhase(o),phase);
});
test('existing requests use only known historical timestamps',()=>{
 const history=context.orderHistory({created:1000,status:'accepted',accepted:0,offer:{sent:2000}});
 assert.equal(history.find(e=>e.status==='received').at,1000);
 assert.equal(history.find(e=>e.status==='offer').at,2000);
 assert.equal(history.some(e=>e.status==='accepted'),false);
 const saved=[{status:'accepted',at:3000}];
 assert.equal(context.orderHistory({history:saved})[0].at,3000);
});

test('legacy hours and mileage do not block a request sent for manager review',()=>{
 assert.equal(context.detailsValid({...valid,type:'hydro'}),true);
 assert.equal(context.detailsValid({...valid,type:'hydro',hours:'',km:'-20'}),true);
});
