const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
class Element {
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.events={};this.value='';this.style={};this.dataset={};this.classList={add(){},remove(){},toggle(){}};}
  append(...children){this.children.push(...children);} appendChild(child){this.append(child);}
  setAttribute(key,value){this.attributes[key]=String(value);}
  addEventListener(type,listener){this.events[type]=listener;}
  setCustomValidity(value){this.validationMessage=value;} reportValidity(){} select(){} blur(){} contains(){return false;}
}
const elements={};
for(const id of ['wallThickness','innerWallThickness','outerWallThickness','gridStep','floorplanUnit'])elements[id]=new Element('input');
const document={activeElement:null,createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),getElementById:id=>elements[id],querySelectorAll:()=>[],addEventListener(){}};
const context=vm.createContext({console,document,window:{},requestAnimationFrame:fn=>fn(),setTimeout(){},clearTimeout(){}});
const run=source=>vm.runInContext(source,context);
for(const name of ['units','dimensions','walls','inspector'])run(fs.readFileSync(path.join(__dirname,`../script/pages/floorplan-${name}.js`),'utf8'));
run(fs.readFileSync(path.join(__dirname,'../script/pages/floorplan.js'),'utf8'));
run(`canvas={viewportTransform:[2,0,0,2,30,40],contextContainer:{},getZoom:()=>2,getObjects:()=>[],requestRenderAll(){},clearContext(){},renderAll(){this.rendered=true;}}`);
assert.equal(run('floorplanUnitLabel()'),'mm');
assert.equal(run('floorplanFromDisplayLength("1250")'),125);
assert.equal(run('floorplanFromDisplayLength("-600")'),-60);
assert.equal(run('floorplanFromDisplayLength("1250,5")'),125.05);
assert.equal(run('floorplanFormatLength(12.5)'),'125');
run('syncFloorplanUnitControls()');
assert.equal(elements.outerWallThickness.value,'250');
let stored=90;const container=new Element();context.container=container;
context.definition={key:'length',label:'Door width · cm',min:1,max:100000,read:()=>stored,apply:value=>{stored=value;return true;}};
const control=run('floorplanInspectorField(container,definition)');
assert.equal(control.value,'900');assert.equal(control.attributes['aria-label'],'Door width · mm');
control.value='1200';control.events.change();assert.equal(stored,120);
run('setFloorplanUnit("cm")');
assert.equal(run('floorplanFromDisplayLength("120")'),120);
assert.equal(stored,120,'Changing display units never scales the model');
assert.equal(elements.outerWallThickness.value,'25');
let angle=22.5;context.angleDefinition={key:'angle',label:'Rotation · °',read:()=>angle,apply:value=>{angle=value;return true;}};
const angleControl=run('floorplanInspectorField(container,angleDefinition)');
run('setFloorplanUnit("mm")');angleControl.value='37.5';angleControl.events.change();assert.equal(angle,37.5,'Rotation is independent of length units');
let name='Sofa';context.nameDefinition={key:'name',label:'Name',literal:true,read:()=>name,apply:value=>{name=value;return true;}};
const nameControl=run('floorplanInspectorField(container,nameDefinition)');nameControl.value='Guest sofa';nameControl.events.change();assert.equal(name,'Guest sofa');
run('wallLengthTyped=true;wallLengthInput={value:"-600"};wallStart={x:0,y:0};wallTypedDirection=null');
assert.equal(run('typedWallPoint({x:100,y:0}).x'),-60);
run('wallDefaultThickness.outer=30;floorplanUnit="cm";let settings=floorplanSettings();floorplanUnit="mm";wallDefaultThickness.outer=25;restoreFloorplanSettings(settings)');
assert.equal(run('floorplanUnit'),'cm');assert.equal(run('wallDefaultThickness.outer'),30);
run('restoreFloorplanSettings(null)');assert.equal(run('floorplanUnit'),'mm','Legacy plans default to mm without modifying their geometry');
run(`let offscreen={};wallDimensionUI={replaceChildren(){throw Error('Thumbnail moved the overlay');}};
  canvas.toDataURL=function(){const original=this.viewportTransform;this.viewportTransform=[.3,0,0,.3,0,0];renderWallDimensions({ctx:offscreen});this.viewportTransform=original;return 'preview';};`);
assert.equal(run('captureFloorplanImage({multiplier:.3})'),'preview');
assert.deepEqual(Array.from(run('canvas.viewportTransform')),[2,0,0,2,30,40]);
assert.equal(run('canvas.rendered'),true);
run(`canvas.rendered=false;canvas.contextTop={};canvas.interactive=true;canvas.enableRetinaScaling=true;canvas.width=800;canvas.height=600;
  let originalTop=canvas.contextTop;
  canvas.toDataURL=()=>{canvas.contextTop=null;canvas.interactive=false;canvas.enableRetinaScaling=false;canvas.width=240;canvas.height=180;canvas.viewportTransform=[.3,0,0,.3,0,0];throw Error("encoder failed")}`);
assert.throws(()=>run('captureFloorplanImage({})'),/encoder failed/);assert.equal(run('canvas.rendered'),true);
assert.equal(run('canvas.contextTop===originalTop'),true,'Failed thumbnails must restore the interaction layer');
assert.equal(run('canvas.interactive && canvas.enableRetinaScaling'),true,'Failed thumbnails must leave pointer interaction and retina scaling enabled');
assert.equal(run('canvas.width'),800);assert.equal(run('canvas.height'),600);
assert.deepEqual(Array.from(run('canvas.viewportTransform')),[2,0,0,2,30,40]);
// All interaction overlays must ignore thumbnail rendering with no top context.
run(`let overlayHandlers=[];canvas.on=(name,handler)=>{if(name==='after:render')overlayHandlers.push(handler)};canvas.getActiveObject=()=>null;
  setupWallDimensions=()=>{};setupWalls();canvas.contextTop=null;currentTool='select';
  canvas.clearContext=context=>{if(!context)throw Error('Unavailable interaction layer')};`);
for(const tool of ['select','wall'])assert.doesNotThrow(()=>run(`currentTool='${tool}';overlayHandlers.forEach(handler=>handler({ctx:{}}))`));
run(`let hitRecords=[{wall:'diagonal',points:[{x:0,y:0},{x:300,y:300}],thickness:15},{wall:'vertical',points:[{x:300,y:0},{x:300,y:300}],thickness:15}];`);
assert.equal(run('closestFloorplanWall({x:296,y:100},hitRecords,1)'),'vertical');
assert.equal(run('closestFloorplanWall({x:100,y:200},hitRecords,1)'),null,'An empty part of a diagonal bounding box does not select a wall');
assert.equal(run('closestFloorplanWall({x:309,y:100},hitRecords,1)'),'vertical','A small click tolerance makes thin walls selectable');
console.log('Editor integration: mm/cm conversion, inputs, angles, names, settings, stable save overlays and wall hit testing passed.');
