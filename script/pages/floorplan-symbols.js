// Furniture and fixtures use simple architectural vectors. All saved dimensions
// remain centimetres; display units are supplied by the editor.
const floorplanSymbolDefinitions = [
  {id:'fireplace',name:'Fireplace',category:'Living',width:100,depth:55},
  {id:'sofa',name:'Sofa',category:'Living',width:210,depth:90},
  {id:'armchair',name:'Armchair',category:'Living',width:85,depth:85},
  {id:'coffee-table',name:'Coffee table',category:'Living',width:110,depth:60},
  {id:'tv',name:'Television',category:'Living',width:140,depth:35},
  {id:'bookcase',name:'Bookcase',category:'Living',width:100,depth:35},
  {id:'plant',name:'Plant',category:'Living',width:50,depth:50},
  {id:'bed-double',name:'Double bed',category:'Bedroom',width:160,depth:210},
  {id:'bed-single',name:'Single bed',category:'Bedroom',width:90,depth:210},
  {id:'wardrobe',name:'Wardrobe',category:'Bedroom',width:180,depth:60},
  {id:'nightstand',name:'Bedside table',category:'Bedroom',width:45,depth:45},
  {id:'toilet',name:'Toilet',category:'Bathroom',width:40,depth:70},
  {id:'shower',name:'Shower',category:'Bathroom',width:90,depth:90},
  {id:'sink',name:'Washbasin',category:'Bathroom',width:60,depth:50},
  {id:'bathtub',name:'Bathtub',category:'Bathroom',width:75,depth:170},
  {id:'washer',name:'Washing machine',category:'Utility',width:60,depth:60},
  {id:'dryer',name:'Tumble dryer',category:'Utility',width:60,depth:60},
  {id:'radiator',name:'Radiator',category:'Utility',width:100,depth:15},
  {id:'dining-table',name:'Dining table',category:'Dining',width:160,depth:90},
  {id:'round-table',name:'Round table',category:'Dining',width:110,depth:110},
  {id:'chair',name:'Chair',category:'Dining',width:45,depth:50},
  {id:'bench',name:'Bench',category:'Dining',width:120,depth:45},
  {id:'desk',name:'Desk',category:'Office',width:140,depth:70},
  {id:'office-chair',name:'Office chair',category:'Office',width:65,depth:65},
  {id:'kitchen-counter',name:'Kitchen counter',category:'Kitchen',width:180,depth:60},
  {id:'kitchen-island',name:'Kitchen island',category:'Kitchen',width:180,depth:90},
  {id:'kitchen-sink',name:'Kitchen sink',category:'Kitchen',width:80,depth:60},
  {id:'fridge',name:'Refrigerator',category:'Kitchen',width:60,depth:65},
  {id:'stove',name:'Stove / hob',category:'Kitchen',width:60,depth:60},
  {id:'dishwasher',name:'Dishwasher',category:'Kitchen',width:60,depth:60},
  {id:'car',name:'Car',category:'Vehicles',width:460,depth:180},
  {id:'bicycle',name:'Bicycle / bike',category:'Vehicles',width:180,depth:60},
  {id:'motorcycle',name:'Motorcycle',category:'Vehicles',width:210,depth:85},
  {id:'van',name:'Van',category:'Vehicles',width:540,depth:205},
  {id:'scooter',name:'Kick scooter',category:'Vehicles',width:120,depth:50},
  {id:'corner-sofa',name:'Corner sofa',category:'Living',width:280,depth:210},
  {id:'ottoman',name:'Ottoman',category:'Living',width:80,depth:60},
  {id:'chaise-longue',name:'Chaise longue',category:'Living',width:85,depth:165},
  {id:'console-table',name:'Console table',category:'Living',width:120,depth:35},
  {id:'sideboard',name:'Sideboard',category:'Living',width:180,depth:45},
  {id:'bunk-bed',name:'Bunk bed',category:'Bedroom',width:110,depth:210},
  {id:'crib',name:'Cot / crib',category:'Bedroom',width:70,depth:140},
  {id:'dresser',name:'Chest of drawers',category:'Bedroom',width:120,depth:45},
  {id:'dressing-table',name:'Dressing table',category:'Bedroom',width:100,depth:45},
  {id:'dining-set-4',name:'Dining table · 4 seats',category:'Dining',width:180,depth:180},
  {id:'dining-set-6',name:'Dining table · 6 seats',category:'Dining',width:260,depth:190},
  {id:'round-dining-set',name:'Round dining table · 4 seats',category:'Dining',width:180,depth:180},
  {id:'bar-stool',name:'Bar stool',category:'Dining',width:45,depth:45},
  {id:'meeting-table',name:'Meeting table · 8 seats',category:'Office',width:360,depth:180},
  {id:'filing-cabinet',name:'Filing cabinet',category:'Office',width:50,depth:60},
  {id:'workbench',name:'Workbench',category:'Utility',width:180,depth:75},
  {id:'freezer',name:'Chest freezer',category:'Utility',width:90,depth:70}
];
let floorplanSymbolsVisible=true, floorplanSymbolType='sofa', floorplanSymbolPointer=null, symbolLastError='';
let floorplanSymbolsReady=false;
function floorplanSymbolDefinition(id){return floorplanSymbolDefinitions.find(item=>item.id===id);}
function floorplanSymbolId(){return `symbol-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}
function floorplanSymbolGridPoint(point){
  const step=typeof getSnapInterval==='function'?getSnapInterval():10;
  return typeof snapEnabled!=='undefined'&&snapEnabled?{x:Math.round(point.x/step)*step,y:Math.round(point.y/step)*step}:point;
}

// One geometry description drives the canvas renderer, library previews and SVG
// export, so symbols retain their detail when plans are saved or printed.
function floorplanSymbolShapes(data){
  const shapes=[],w=data.width,d=data.depth;
  const rect=(x,y,width,height,fill=true,r=0)=>shapes.push({type:'rect',x:x*w-w/2,y:y*d-d/2,width:width*w,height:height*d,fill,r:r*Math.min(w,d)});
  const ellipse=(x,y,rx,ry,fill=false)=>shapes.push({type:'ellipse',cx:x*w-w/2,cy:y*d-d/2,rx:rx*w,ry:ry*d,fill});
  const line=(x1,y1,x2,y2)=>shapes.push({type:'line',x1:x1*w-w/2,y1:y1*d-d/2,x2:x2*w-w/2,y2:y2*d-d/2});
  const path=(points,close=false,fill=false)=>shapes.push({type:'path',points:points.map(([x,y])=>[x*w-w/2,y*d-d/2]),close,fill});
  const frame=()=>rect(.01,.01,.98,.98,true,.025);
  const diningChair=(x,y,cw,ch,back)=>{
    rect(x,y,cw,ch,true,.025);
    if(back==='top'||back==='bottom')line(x+.07*cw,y+(back==='top'?.18:.82)*ch,x+.93*cw,y+(back==='top'?.18:.82)*ch);
    else line(x+(back==='left'?.18:.82)*cw,y+.07*ch,x+(back==='left'?.18:.82)*cw,y+.93*ch);
  };
  switch(data.symbolType){
    case 'toilet':
      rect(.08,.02,.84,.25,true,.04);ellipse(.5,.59,.41,.39,true);ellipse(.5,.62,.26,.26);rect(.39,.1,.22,.055,false,.02);break;
    case 'shower':
      frame();rect(.06,.06,.88,.88,false,.025);line(.07,.93,.93,.07);ellipse(.5,.5,.045,.045);line(.18,.02,.18,.13);break;
    case 'sink':
      rect(.02,.04,.96,.92,true,.1);ellipse(.5,.57,.37,.3);ellipse(.5,.53,.03,.035);line(.5,.06,.5,.27);line(.38,.13,.62,.13);break;
    case 'bathtub':
      rect(.01,.01,.98,.98,true,.13);rect(.1,.065,.8,.87,false,.22);ellipse(.5,.17,.04,.018);line(.5,.025,.5,.09);break;
    case 'bed-double': case 'bed-single':
      frame();rect(.015,.01,.97,.06,true,.01);rect(.045,.095,.91,.87,false,.035);
      if(data.symbolType==='bed-double'){rect(.09,.12,.37,.18,true,.035);rect(.54,.12,.37,.18,true,.035);}else rect(.15,.12,.7,.18,true,.045);
      line(.045,.36,.955,.36);line(.045,.41,.955,.41);break;
    case 'sofa': case 'armchair':
      frame();rect(.05,.04,.9,.19,true,.045);rect(.04,.21,.12,.73,true,.035);rect(.84,.21,.12,.73,true,.035);
      {const seats=data.symbolType==='sofa'?3:1;for(let i=0;i<seats;i++)rect(.175+i*.65/seats,.255,.65/seats-.02,.66,true,.04);}break;
    case 'dining-table': case 'coffee-table': case 'nightstand':
      frame();rect(.055,.07,.89,.86,false,.025);break;
    case 'round-table':ellipse(.5,.5,.49,.49,true);ellipse(.5,.5,.445,.445);break;
    case 'chair':
      rect(.06,.05,.88,.17,true,.025);rect(.1,.25,.8,.69,true,.035);line(.12,.22,.12,.3);line(.88,.22,.88,.3);break;
    case 'office-chair':
      ellipse(.5,.5,.43,.43);rect(.12,.05,.76,.19,true,.045);rect(.19,.27,.62,.61,true,.06);line(.08,.4,.08,.73);line(.92,.4,.92,.73);break;
    case 'bench':frame();line(.04,.22,.96,.22);line(.04,.78,.96,.78);line(.15,.05,.15,.95);line(.85,.05,.85,.95);break;
    case 'desk':
      frame();rect(.04,.05,.92,.9,false);rect(.04,.09,.2,.82,true);line(.04,.35,.24,.35);line(.04,.63,.24,.63);break;
    case 'kitchen-counter':case 'kitchen-island':
      frame();line(.02,.88,.98,.88);{const units=Math.max(1,Math.round(w/60));for(let i=1;i<units;i++)line(i/units,.025,i/units,.975);}break;
    case 'kitchen-sink':
      frame();rect(.05,.1,.42,.78,false,.1);rect(.52,.1,.42,.78,false,.1);ellipse(.26,.51,.025,.035);ellipse(.73,.51,.025,.035);line(.49,.025,.49,.24);break;
    case 'stove':
      frame();rect(.04,.04,.92,.12,false);[.28,.72].forEach(x=>[.38,.76].forEach(y=>{ellipse(x,y,.155,.15);ellipse(x,y,.1,.095);}));break;
    case 'fridge':
      frame();line(.025,.19,.975,.19);line(.08,.25,.08,.52);line(.5,.42,.5,.79);line(.34,.51,.66,.7);line(.34,.7,.66,.51);break;
    case 'washer':case 'dryer':
      frame();line(.02,.19,.98,.19);ellipse(.78,.105,.045,.045);ellipse(.5,.58,.32,.32);ellipse(.5,.58,.255,.255);
      if(data.symbolType==='dryer'){line(.32,.53,.4,.63);line(.4,.63,.5,.51);line(.5,.51,.6,.63);line(.6,.63,.69,.53);}break;
    case 'dishwasher':
      frame();line(.02,.18,.98,.18);rect(.24,.07,.52,.04,false);line(.12,.35,.88,.35);line(.12,.52,.88,.52);line(.12,.69,.88,.69);break;
    case 'wardrobe':
      frame();{const doors=Math.max(1,Math.round(w/60));for(let i=0;i<doors;i++){const l=i/doors,r=(i+1)/doors;if(i)line(l,.02,l,.98);path([[l+.1/doors,.65],[(l+r)/2,.3],[r-.1/doors,.65]],true);line((l+r)/2,.3,(l+r)/2,.18);}}break;
    case 'bookcase':
      frame();for(let x=.1;x<.95;x+=.105){rect(x,.1,.055,.7,true);line(x,.18,x+.055,.18);}break;
    case 'tv':
      rect(.01,.06,.98,.18,true,.02);line(.5,.24,.5,.81);rect(.3,.81,.4,.12,true,.015);break;
    case 'plant':
      ellipse(.5,.5,.16,.16,true);for(let i=0;i<8;i++){const a=i*Math.PI/4;ellipse(.5+Math.cos(a)*.25,.5+Math.sin(a)*.25,.17,.17,true);}ellipse(.5,.5,.095,.095,true);break;
    case 'fireplace':
      frame();rect(.05,.08,.13,.82,true);rect(.82,.08,.13,.82,true);rect(.18,.1,.64,.13,true);rect(.24,.37,.52,.46,false);
      path([[.3,.76],[.42,.45],[.48,.65],[.6,.36],[.71,.76]],false);break;
    case 'radiator':
      frame();for(let x=.07;x<.94;x+=.085)rect(x,.08,.035,.84,false,.01);break;
    case 'car':
      // Overhead view: tyres, tapered body, roof and glazing. The front points
      // right; the object's regular rotation handle sets its parking direction.
      [.19,.73].forEach(x=>{rect(x,.07,.12,.08,true,.02);rect(x,.85,.12,.08,true,.02);});
      path([[.035,.28],[.075,.15],[.87,.15],[.96,.26],[.985,.42],[.985,.58],[.96,.74],[.87,.85],[.075,.85],[.035,.72]],true,true);
      rect(.29,.23,.38,.54,false,.065);
      path([[.68,.23],[.755,.3],[.755,.7],[.68,.77]],true);path([[.275,.23],[.20,.3],[.20,.7],[.275,.77]],true);
      line(.81,.25,.90,.25);line(.81,.75,.90,.75);line(.08,.29,.08,.71);
      path([[.67,.15],[.71,.045],[.76,.045],[.75,.15]],true,true);path([[.67,.85],[.71,.955],[.76,.955],[.75,.85]],true,true);break;
    case 'van':
      [.15,.76].forEach(x=>{rect(x,.035,.13,.09,true,.02);rect(x,.875,.13,.09,true,.02);});
      rect(.025,.10,.95,.8,true,.075);rect(.075,.17,.58,.66,false,.025);
      path([[.72,.18],[.82,.24],[.82,.76],[.72,.82]],true);rect(.84,.2,.085,.6,false,.03);
      line(.055,.13,.055,.87);line(.03,.5,.11,.5);line(.68,.12,.68,.88);line(.38,.88,.48,.88);
      rect(.74,.01,.09,.08,true,.02);rect(.74,.91,.09,.08,true,.02);break;
    case 'bicycle':
      ellipse(.15,.5,.14,.055,true);ellipse(.85,.5,.14,.055,true);
      path([[.15,.5],[.46,.34],[.65,.5],[.46,.66],[.15,.5],[.65,.5],[.85,.5]],false);
      line(.46,.34,.46,.66);line(.72,.16,.78,.16);line(.78,.16,.78,.84);line(.78,.84,.72,.84);
      rect(.32,.32,.12,.36,true,.04);ellipse(.49,.5,.045,.09);line(.49,.5,.49,.25);line(.49,.5,.57,.74);
      line(.45,.25,.53,.25);line(.53,.74,.61,.74);break;
    case 'motorcycle':
      rect(.025,.44,.22,.12,true,.035);rect(.785,.44,.19,.12,true,.035);
      path([[.19,.42],[.43,.31],[.72,.36],[.85,.46],[.85,.54],[.72,.64],[.43,.69],[.19,.58]],true,true);
      rect(.23,.36,.29,.28,true,.08);ellipse(.61,.5,.13,.22,true);ellipse(.64,.5,.035,.06);
      line(.77,.15,.77,.85);line(.69,.13,.79,.15);line(.69,.87,.79,.85);ellipse(.78,.5,.065,.17);
      rect(.14,.24,.20,.06,true,.02);rect(.14,.70,.20,.06,true,.02);break;
    case 'scooter':
      ellipse(.11,.5,.085,.055,true);ellipse(.88,.5,.08,.055,true);
      rect(.16,.38,.57,.24,true,.09);line(.24,.45,.62,.45);line(.24,.55,.62,.55);
      line(.71,.5,.85,.5);line(.83,.09,.83,.91);rect(.79,.04,.08,.19,true,.02);rect(.79,.77,.08,.19,true,.02);break;
    case 'corner-sofa':
      path([[.01,.01],[.99,.01],[.99,.99],[.66,.99],[.66,.4],[.01,.4]],true,true);
      rect(.025,.025,.93,.075,true,.02);rect(.9,.11,.075,.85,true,.02);rect(.025,.1,.08,.285,true,.025);
      [.12,.30,.48].forEach(x=>rect(x,.12,.16,.26,true,.025));rect(.68,.12,.20,.26,true,.025);
      rect(.68,.405,.20,.245,true,.025);rect(.68,.67,.20,.245,true,.025);rect(.68,.935,.205,.045,true,.02);break;
    case 'ottoman':
      rect(.025,.025,.95,.95,true,.12);rect(.10,.10,.80,.80,false,.1);ellipse(.5,.5,.035,.045);break;
    case 'chaise-longue':
      frame();rect(.04,.035,.92,.16,true,.04);rect(.045,.22,.12,.70,true,.03);rect(.835,.22,.12,.70,true,.03);
      rect(.19,.22,.62,.33,true,.045);rect(.19,.57,.62,.37,true,.045);break;
    case 'console-table':
      frame();rect(.055,.10,.89,.80,false);[.33,.66].forEach(x=>line(x,.1,x,.9));
      [.18,.50,.82].forEach(x=>line(x-.06,.82,x+.06,.82));break;
    case 'sideboard':
      frame();rect(.04,.08,.92,.84,false);[.34,.66].forEach(x=>line(x,.08,x,.92));
      [.29,.39,.61,.71].forEach(x=>line(x,.62,x,.78));break;
    case 'bunk-bed':
      frame();rect(.04,.04,.73,.92,false,.025);rect(.08,.09,.65,.83,false,.025);rect(.16,.12,.49,.16,true,.03);
      line(.08,.36,.73,.36);line(.82,.05,.82,.96);line(.96,.05,.96,.96);
      for(let y=.1;y<.96;y+=.12)line(.82,y,.96,y);break;
    case 'crib':
      frame();rect(.13,.07,.74,.86,false,.055);rect(.19,.15,.62,.68,false,.045);rect(.25,.17,.50,.13,true,.025);
      for(let y=.12;y<.96;y+=.09){line(.025,y,.13,y);line(.87,y,.975,y);}
      for(let x=.16;x<.9;x+=.12){line(x,.025,x,.07);line(x,.93,x,.975);}break;
    case 'dresser':
      frame();rect(.04,.08,.92,.84,false);line(.5,.08,.5,.92);
      [.35,.65].forEach(y=>line(.04,y,.96,y));[.22,.75].forEach(x=>[.22,.51,.8].forEach(y=>line(x-.07,y,x+.07,y)));break;
    case 'dressing-table':
      frame();rect(.05,.08,.24,.85,true);rect(.71,.08,.24,.85,true);ellipse(.5,.18,.18,.10);
      line(.08,.42,.26,.42);line(.74,.42,.92,.42);line(.08,.72,.26,.72);line(.74,.72,.92,.72);line(.33,.33,.67,.33);break;
    case 'dining-set-4':case 'round-dining-set':
      if(data.symbolType==='round-dining-set')ellipse(.5,.5,.28,.28,true);else rect(.235,.235,.53,.53,true,.025);
      diningChair(.38,.01,.24,.20,'top');diningChair(.38,.79,.24,.20,'bottom');
      diningChair(.01,.38,.20,.24,'left');diningChair(.79,.38,.20,.24,'right');break;
    case 'dining-set-6':
      rect(.20,.255,.60,.49,true,.025);[.27,.57].forEach(x=>{diningChair(x,.025,.16,.21,'top');diningChair(x,.765,.16,.21,'bottom');});
      diningChair(.02,.38,.15,.24,'left');diningChair(.83,.38,.15,.24,'right');break;
    case 'bar-stool':
      ellipse(.5,.5,.475,.475);ellipse(.5,.5,.38,.38,true);ellipse(.5,.5,.30,.30);line(.13,.5,.20,.5);line(.8,.5,.87,.5);break;
    case 'meeting-table':
      rect(.155,.245,.69,.51,true,.09);[.205,.425,.645].forEach(x=>{diningChair(x,.025,.145,.2,'top');diningChair(x,.775,.145,.2,'bottom');});
      diningChair(.01,.37,.12,.26,'left');diningChair(.87,.37,.12,.26,'right');break;
    case 'filing-cabinet':
      frame();rect(.06,.06,.88,.88,false);line(.06,.72,.94,.72);rect(.3,.79,.4,.07,false,.015);rect(.39,.16,.22,.12,false);break;
    case 'workbench':
      frame();rect(.04,.08,.92,.78,false);line(.04,.2,.96,.2);rect(.09,.68,.16,.29,true,.015);
      line(.08,.76,.26,.76);line(.08,.89,.26,.89);line(.06,.82,.29,.82);for(let x=.12;x<.95;x+=.1)ellipse(x,.13,.008,.018);break;
    case 'freezer':
      frame();rect(.06,.075,.88,.85,false,.025);rect(.34,.83,.32,.055,true,.015);
      [.20,.72].forEach(x=>rect(x,.035,.08,.085,true,.015));ellipse(.88,.80,.02,.025);break;
    default:frame();
  }
  return shapes;
}
function floorplanSymbolPalette(data){
  const colors=typeof floorplanColors==='function'?floorplanColors():{};
  return {fill:data.color||colors.background||'#f0f4f3',stroke:colors.outline||'#455d59'};
}
function renderFloorplanSymbol(ctx,data){
  const colors=floorplanSymbolPalette(data);
  ctx.save();ctx.fillStyle=colors.fill;ctx.strokeStyle=colors.stroke;ctx.lineWidth=1.2;ctx.lineJoin='round';
  floorplanSymbolShapes(data).forEach(shape=>{
    ctx.beginPath();
    if(shape.type==='rect'){
      if(shape.r&&typeof ctx.roundRect==='function')ctx.roundRect(shape.x,shape.y,shape.width,shape.height,shape.r);
      else ctx.rect(shape.x,shape.y,shape.width,shape.height);
    }else if(shape.type==='ellipse')ctx.ellipse(shape.cx,shape.cy,shape.rx,shape.ry,0,0,Math.PI*2);
    else if(shape.type==='line'){ctx.moveTo(shape.x1,shape.y1);ctx.lineTo(shape.x2,shape.y2);}
    else {shape.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(shape.close)ctx.closePath();}
    if(shape.fill)ctx.fill();ctx.stroke();
  });
  ctx.restore();
}
function floorplanSymbolSVG(data){
  const colors=floorplanSymbolPalette(data),n=value=>Number(value.toFixed(3));
  const shapes=floorplanSymbolShapes(data).map(shape=>{
    const fill=shape.fill?colors.fill:'none';
    if(shape.type==='rect')return `<rect x="${n(shape.x)}" y="${n(shape.y)}" width="${n(shape.width)}" height="${n(shape.height)}" rx="${n(shape.r)}" fill="${fill}"/>`;
    if(shape.type==='ellipse')return `<ellipse cx="${n(shape.cx)}" cy="${n(shape.cy)}" rx="${n(shape.rx)}" ry="${n(shape.ry)}" fill="${fill}"/>`;
    if(shape.type==='line')return `<line x1="${n(shape.x1)}" y1="${n(shape.y1)}" x2="${n(shape.x2)}" y2="${n(shape.y2)}"/>`;
    return `<path d="${shape.points.map(([x,y],i)=>`${i?'L':'M'}${n(x)} ${n(y)}`).join(' ')}${shape.close?' Z':''}" fill="${fill}"/>`;
  }).join('');
  return `<g fill="none" stroke="${colors.stroke}" stroke-width="1.2" stroke-linejoin="round">${shapes}</g>`;
}
function installFloorplanSymbol(object){
  if(object.data?.kind!=='symbol')return;
  const definition=floorplanSymbolDefinition(object.data.symbolType);
  if(!definition)return;
  object.set({objectCaching:false,hasControls:true,hasBorders:true,lockRotation:false,lockScalingX:true,lockScalingY:true,
    snapAngle:45,snapThreshold:3,visible:floorplanSymbolsVisible,evented:floorplanSymbolsVisible,selectable:floorplanSymbolsVisible});
  object.setControlsVisibility?.({tl:false,tr:false,bl:false,br:false,ml:false,mr:false,mt:false,mb:false,mtr:true});
  object._render=function(ctx){renderFloorplanSymbol(ctx,this.data);};
  object._toSVG=function(){return ['<g ', 'COMMON_PARTS', '>',floorplanSymbolSVG(this.data),'</g>'];};
}
function updateFloorplanSymbol(object,values){
  symbolLastError='';
  if(object?.data?.kind!=='symbol'){symbolLastError='Select a furniture item first.';return false;}
  const width=Number(values.width??object.data.width),depth=Number(values.depth??object.data.depth),angle=Number(values.angle??object.angle??0);
  if(!Number.isFinite(width)||!Number.isFinite(depth)||width<1||depth<1||width>10000||depth>10000){symbolLastError='Enter valid furniture dimensions.';return false;}
  if(!Number.isFinite(angle)){symbolLastError='Enter a valid rotation angle.';return false;}
  const name=String(values.name??object.data.name??'').trim().slice(0,80);
  if(!name){symbolLastError='Enter a name for this furniture item.';return false;}
  const color=values.color===undefined?object.data.color:values.color;
  if(color!==null&&color!==undefined&&!/^#[0-9a-f]{6}$/i.test(color)){symbolLastError='Choose a valid furniture colour.';return false;}
  wallCheckpoint();
  object.set({width,height:depth,angle:((angle%360)+360)%360,data:{...object.data,width,depth,name,color:color||null}});
  object.setCoords();isDirty=true;syncSaveButton();canvas.requestRenderAll();return true;
}
function commitFloorplanSymbol(point){
  const definition=floorplanSymbolDefinition(floorplanSymbolType);if(!definition)return false;
  wallCheckpoint();
  const object=new fabric.Rect({left:point.x,top:point.y,width:definition.width,height:definition.depth,angle:0,originX:'center',originY:'center',strokeWidth:0,
    data:{kind:'symbol',id:floorplanSymbolId(),symbolType:definition.id,name:definition.name,width:definition.width,depth:definition.depth,color:null}});
  canvas.add(object);installFloorplanSymbol(object);floorplanSymbolPointer=null;
  setTool('select');canvas.setActiveObject(object);isDirty=true;syncSaveButton();canvas.requestRenderAll();return true;
}
function cancelFloorplanSymbol(){
  floorplanSymbolPointer=null;
  if(typeof canvas!=='undefined'&&canvas){canvas.clearContext(canvas.contextTop);canvas.requestRenderAll();}
}
function setFloorplanSymbolType(id){
  const definition=floorplanSymbolDefinition(id);if(!definition)return false;
  floorplanSymbolType=id;
  if(!floorplanSymbolsVisible)toggleFloorplanSymbols();
  toggleFloorplanSymbolLibrary(false);setTool('symbol');
  const status=document.getElementById('wallStatus');if(status)status.textContent=`Click to place ${definition.name.toLowerCase()}. Select it to resize or rotate.`;
  return true;
}
function toggleFloorplanSymbols(){
  floorplanSymbolsVisible=!floorplanSymbolsVisible;
  canvas.getObjects().filter(object=>object.data?.kind==='symbol').forEach(object=>object.set({visible:floorplanSymbolsVisible,selectable:floorplanSymbolsVisible,evented:floorplanSymbolsVisible}));
  if(!floorplanSymbolsVisible&&canvas.getActiveObject()?.data?.kind==='symbol')canvas.discardActiveObject();
  const button=document.getElementById('symbolsVisibilityBtn');
  button?.classList.toggle('active',floorplanSymbolsVisible);button?.setAttribute('aria-pressed',String(floorplanSymbolsVisible));
  canvas.requestRenderAll();return floorplanSymbolsVisible;
}
function toggleFloorplanSymbolLibrary(force){
  const library=document.getElementById('floorplanSymbolLibrary');if(!library)return;
  const open=typeof force==='boolean'?force:library.hidden;
  library.hidden=!open;document.getElementById('symbolLibraryBtn')?.setAttribute('aria-expanded',String(open));
  if(open){renderFloorplanSymbolLibrary();document.getElementById('floorplanSymbolSearch')?.focus();}
}
function renderFloorplanSymbolLibrary(){
  const list=document.getElementById('floorplanSymbolList');if(!list)return;
  const query=(document.getElementById('floorplanSymbolSearch')?.value||'').trim().toLowerCase();
  const category=document.getElementById('floorplanSymbolCategory')?.value||'';
  list.replaceChildren();
  floorplanSymbolDefinitions.filter(item=>(!category||category==='all'||item.category===category)&&`${item.name} ${item.category}`.toLowerCase().includes(query)).forEach(definition=>{
    const button=document.createElement('button');button.type='button';button.className='fp-symbol-choice';button.title=`Place ${definition.name.toLowerCase()}`;
    const preview=document.createElementNS('http://www.w3.org/2000/svg','svg');preview.classList.add('fp-symbol-preview');
    const margin=Math.max(definition.width,definition.depth)*.06;
    preview.setAttribute('viewBox',`${-definition.width/2-margin} ${-definition.depth/2-margin} ${definition.width+2*margin} ${definition.depth+2*margin}`);
    preview.setAttribute('aria-hidden','true');preview.innerHTML=floorplanSymbolSVG({...definition,symbolType:definition.id});
    const name=document.createElement('span');name.className='fp-symbol-name';name.textContent=definition.name;
    const dimensions=document.createElement('small');dimensions.className='fp-symbol-size';
    const format=value=>typeof floorplanFormatLength==='function'?floorplanFormatLength(value):value;
    const unit=typeof floorplanUnitLabel==='function'?floorplanUnitLabel():'cm';
    dimensions.textContent=`${format(definition.width)} × ${format(definition.depth)} ${unit}`;
    button.append(preview,name,dimensions);button.addEventListener('click',()=>setFloorplanSymbolType(definition.id));list.appendChild(button);
  });
  if(!list.children.length){const empty=document.createElement('p');empty.className='fp-symbol-empty';empty.textContent='No matching symbols.';list.appendChild(empty);}
}
function setupFloorplanSymbols(){
  if(floorplanSymbolsReady)return;floorplanSymbolsReady=true;
  const categories=document.getElementById('floorplanSymbolCategory');
  if(categories)new Set(floorplanSymbolDefinitions.map(item=>item.category)).forEach(category=>{const option=document.createElement('option');option.value=category;option.textContent=category;categories.appendChild(option);});
  document.getElementById('floorplanSymbolSearch')?.addEventListener('input',renderFloorplanSymbolLibrary);
  categories?.addEventListener('change',renderFloorplanSymbolLibrary);
  document.getElementById('floorplanSymbolClose')?.addEventListener('click',()=>toggleFloorplanSymbolLibrary(false));
  document.getElementById('floorplanSymbolLibrary')?.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();toggleFloorplanSymbolLibrary(false);document.getElementById('symbolLibraryBtn')?.focus();}});
  document.addEventListener('pointerdown',event=>{const library=document.getElementById('floorplanSymbolLibrary');if(library&&!library.hidden&&!library.contains(event.target)&&!document.getElementById('symbolLibraryBtn')?.contains(event.target))toggleFloorplanSymbolLibrary(false);});
  canvas.on('object:added',event=>installFloorplanSymbol(event.target));canvas.getObjects().forEach(installFloorplanSymbol);
  canvas.on('before:transform',event=>{if(event.transform?.target?.data?.kind==='symbol')wallCheckpoint();});
  canvas.on('object:moving',event=>{if(event.target?.data?.kind==='symbol'){const point=floorplanSymbolGridPoint({x:event.target.left,y:event.target.top});event.target.set({left:point.x,top:point.y});}});
  canvas.on('mouse:down',event=>{if(currentTool==='symbol'&&!isPanning&&event.e.button===0)commitFloorplanSymbol(floorplanSymbolGridPoint(canvas.getPointer(event.e)));});
  canvas.on('mouse:move',event=>{if(currentTool==='symbol'&&!isPanning){floorplanSymbolPointer=floorplanSymbolGridPoint(canvas.getPointer(event.e));canvas.requestRenderAll();}});
  canvas.on('mouse:out',()=>{if(currentTool==='symbol'){floorplanSymbolPointer=null;canvas.requestRenderAll();}});
  canvas.on('after:render',event=>{
    if((event?.ctx&&event.ctx!==canvas.contextContainer)||!canvas.contextTop)return;
    if(currentTool!=='symbol')return;const ctx=canvas.contextTop;canvas.clearContext(ctx);if(!floorplanSymbolPointer)return;
    const definition=floorplanSymbolDefinition(floorplanSymbolType);if(!definition)return;
    ctx.save();ctx.transform(...canvas.viewportTransform);ctx.save();ctx.translate(floorplanSymbolPointer.x,floorplanSymbolPointer.y);ctx.globalAlpha=.65;
    renderFloorplanSymbol(ctx,{...definition,symbolType:definition.id});ctx.restore();
    if(typeof drawFloorplanSnapMarker==='function')drawFloorplanSnapMarker(ctx,floorplanSymbolPointer);
    else {ctx.strokeStyle='#008c85';ctx.lineWidth=2/canvas.getZoom();ctx.beginPath();ctx.arc(floorplanSymbolPointer.x,floorplanSymbolPointer.y,5/canvas.getZoom(),0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  });
}
