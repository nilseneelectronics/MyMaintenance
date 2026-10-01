const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const objects=[],snapshots=[],handlers={};
let active=null;
class Rect {
  constructor(values){Object.assign(this,values);}
  set(values){Object.assign(this,values);}
  setCoords(){}
  setControlsVisibility(controls){this.controls=controls;}
}
const canvas={getObjects:()=>objects,add:object=>objects.push(object),requestRenderAll(){},clearContext(){},
  setActiveObject:object=>active=object,getActiveObject:()=>active,discardActiveObject:()=>active=null,on:(event,handler)=>handlers[event]=handler};
const context=vm.createContext({console,Math,Date,canvas,fabric:{Rect},snapEnabled:true,isDirty:false,currentTool:'select',isPanning:false,
  document:{getElementById:()=>null,addEventListener(){}},getSnapInterval:()=>10,wallCheckpoint:()=>snapshots.push(JSON.stringify(objects)),syncSaveButton(){},setTool(){}});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../script/pages/floorplan-symbols.js'),'utf8'),context);
const run=source=>vm.runInContext(source,context);
assert.ok(run('floorplanSymbolDefinitions.length')>=50);
assert.equal(run('new Set(floorplanSymbolDefinitions.map(item=>item.id)).size'),run('floorplanSymbolDefinitions.length'));
assert.equal(run('floorplanSymbolDefinitions.every(item=>item.width>0&&item.depth>0)'),true);
// Every library item has visible geometry in both live view and SVG export.
const calls=[];
context.draw={save(){},restore(){},beginPath(){},rect(){calls.push('rect');},roundRect(){calls.push('rect');},ellipse(){calls.push('ellipse');},moveTo(){},lineTo(){calls.push('line');},closePath(){},fill(){},stroke(){}};
run('floorplanSymbolDefinitions.forEach(item=>renderFloorplanSymbol(draw,{...item,symbolType:item.id}))');
assert.ok(calls.length>150);
assert.equal(run('floorplanSymbolDefinitions.every(item=>floorplanSymbolSVG({...item,symbolType:item.id}).includes("<g"))'),true);
assert.equal(run('floorplanSymbolSVG({symbolType:"stove",width:60,depth:60}).split("<ellipse").length'),9);
const additions=['car','bicycle','motorcycle','van','scooter','corner-sofa','ottoman','chaise-longue','console-table','sideboard',
  'bunk-bed','crib','dresser','dressing-table','dining-set-4','dining-set-6','round-dining-set','bar-stool','meeting-table','filing-cabinet','workbench','freezer'];
context.additions=additions;
// Vehicle footprints are real plan dimensions, not preview-icon dimensions.
for(const [id,width,depth] of [['car',460,180],['bicycle',180,60],['motorcycle',210,85],['van',540,205]]){
  assert.equal(run(`floorplanSymbolDefinition('${id}').width`),width);
  assert.equal(run(`floorplanSymbolDefinition('${id}').depth`),depth);
}
// Different additions have their own recognizable drawing, even when normalized
// to the same footprint. A missing switch case would produce the generic box.
assert.equal(run('new Set(additions.map(symbolType=>JSON.stringify(floorplanSymbolShapes({symbolType,width:100,depth:100})))).size'),additions.length);
assert.equal(run('additions.every(symbolType=>floorplanSymbolShapes({symbolType,width:100,depth:100}).length>=3)'),true);
const allShapes=JSON.parse(run('JSON.stringify(floorplanSymbolDefinitions.map(item=>({definition:item,shapes:floorplanSymbolShapes({...item,symbolType:item.id})})))'));
for(const {definition,shapes} of allShapes){
  const inside=(x,y)=>assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<=definition.width/2+.001&&Math.abs(y)<=definition.depth/2+.001,`${definition.id} extends beyond its editable footprint`);
  for(const shape of shapes){
    if(shape.type==='rect'){inside(shape.x,shape.y);inside(shape.x+shape.width,shape.y+shape.height);assert.ok(shape.width>0&&shape.height>0);}
    else if(shape.type==='ellipse'){inside(shape.cx-shape.rx,shape.cy-shape.ry);inside(shape.cx+shape.rx,shape.cy+shape.ry);assert.ok(shape.rx>0&&shape.ry>0);}
    else if(shape.type==='line'){inside(shape.x1,shape.y1);inside(shape.x2,shape.y2);}
    else shape.points.forEach(([x,y])=>inside(x,y));
  }
}
assert.deepEqual(JSON.parse(run('JSON.stringify(floorplanSymbolGridPoint({x:14,y:-17}))')),{x:10,y:-20});
run('floorplanSymbolType="toilet";commitFloorplanSymbol({x:100,y:200})');
assert.equal(objects[0].data.symbolType,'toilet');
assert.equal(objects[0].width,40);assert.equal(objects[0].height,70);
assert.equal(objects[0].left,100);assert.equal(objects[0].top,200);
assert.equal(objects[0].controls.mtr,true);assert.equal(objects[0].controls.br,false);
assert.equal(run('updateFloorplanSymbol(canvas.getObjects()[0],{width:50,depth:80,angle:-45,name:"Guest toilet",color:"#44aabb"})'),true);
assert.equal(objects[0].angle,315);assert.equal(objects[0].height,80);assert.equal(objects[0].data.name,'Guest toilet');
assert.equal(JSON.parse(snapshots.at(-1))[0].width,40);
const checkpoint=snapshots.length;
for(const values of ['{width:0}','{angle:Infinity}','{name:" "}','{color:"not a colour"}'])assert.equal(run(`updateFloorplanSymbol(canvas.getObjects()[0],${values})`),false);
assert.equal(snapshots.length,checkpoint);
// Names, dimensions, colour and arbitrary rotation survive the same JSON reload
// used by file load and undo. The custom renderer is reinstated on added objects.
run('setupFloorplanSymbols()');
const reloaded=new Rect(JSON.parse(JSON.stringify(objects[0])));
handlers['object:added']({target:reloaded});
assert.equal(reloaded.angle,315);assert.equal(reloaded.data.name,'Guest toilet');
assert.equal(reloaded.data.color,'#44aabb');assert.equal(typeof reloaded._render,'function');
assert.ok(reloaded._toSVG().join('').includes('#44aabb'));
handlers['before:transform']({transform:{target:objects[0],action:'rotate'}});
objects[0].angle=12.25;
assert.equal(JSON.parse(snapshots.at(-1))[0].angle,315);
objects[0].left=112;objects[0].top=187;handlers['object:moving']({target:objects[0]});
assert.equal(objects[0].left,110);assert.equal(objects[0].top,190);
assert.equal(run('toggleFloorplanSymbols()'),false);
assert.equal(objects[0].visible,false);assert.equal(objects[0].selectable,false);assert.equal(active,null);
assert.equal(objects.length,1);assert.equal(objects[0].data.name,'Guest toilet');
assert.equal(run('toggleFloorplanSymbols()'),true);assert.equal(objects[0].visible,true);
// The larger vehicle additions use the same editable and persistent object path.
run('floorplanSymbolType="car";commitFloorplanSymbol({x:600,y:100})');
assert.equal(objects[1].data.symbolType,'car');assert.equal(objects[1].width,460);
assert.equal(run('updateFloorplanSymbol(canvas.getObjects()[1],{width:490,depth:195,angle:37.5,name:"Garage car",color:"#808080"})'),true);
assert.equal(objects[1].angle,37.5);assert.equal(objects[1].height,195);
const savedCar=new Rect(JSON.parse(JSON.stringify(objects[1])));handlers['object:added']({target:savedCar});
assert.equal(savedCar.data.name,'Garage car');assert.equal(savedCar.angle,37.5);
assert.ok(savedCar._toSVG().join('').includes('<path'));assert.ok(savedCar._toSVG().join('').includes('#808080'));
console.log('Furniture: 52 distinct library choices, vehicle defaults, bounded geometry, placement, SVG export, editing, validation, rotation undo, JSON persistence, grid movement and visibility passed.');
