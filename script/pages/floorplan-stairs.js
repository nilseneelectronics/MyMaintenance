// Stair footprints are editable rectangles; connected flights share a route ID.
let stairDraft = null, stairPointer = null, stairLastError = '';
let stairDimensionUI, stairLengthEditor, stairLengthInput, stairLengthCaption, stairLengthEdit = null;
function stairId() { return `stair-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
function stairGridPoint(point) {
  const step = typeof getSnapInterval === 'function' ? getSnapInterval() : 10;
  return snapEnabled ? {x:Math.round(point.x/step)*step,y:Math.round(point.y/step)*step} : point;
}
function stairSnapPoint(point,records,zoom) {
  if(!snapEnabled)return {...point};
  const grid=stairGridPoint(point);
  if(typeof wallFaceGeometry!=='function')return grid;
  records=records||(typeof wallRecords==='function'?wallRecords():[]);
  zoom=zoom??(typeof canvas!=='undefined'&&canvas?.getZoom?canvas.getZoom():1);
  const tolerance=12/Math.max(.01,zoom),step=getSnapInterval();
  let corner=null,cornerDistance=Infinity,cornerInner=false,facePoint=null,faceDistance=Infinity;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const project=(p,[a,b])=>{
    const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;
    const t=length2?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length2)):0;
    return {x:a.x+t*dx,y:a.y+t*dy};
  };
  for(const record of records){
    if(distance(...record.points)<.001)continue;
    const geometry=wallFaceGeometry(record,records);
    const insideWall=distance(point,project(point,record.points))<=record.thickness/2+.001;
    // A click within the wall body still lands on its surface. This also reaches
    // the real mitred corner from a centreline junction on a thick outside wall.
    const reach=insideWall?Math.max(tolerance,record.thickness*.8):tolerance;
    const faces=geometry.faces.flatMap(face=>face.segments.map(segment=>({points:segment.points,inner:face.name==='Inner'})));
    // Only expose an end cap when no other wall occupies that junction.
    record.points.forEach((end,index)=>{
      const connected=records.some(other=>other!==record&&distance(end,project(end,other.points))<.001);
      if(!connected)faces.push({points:[geometry.faces[0].points[index],geometry.faces[1].points[index]],inner:false});
    });
    for(const face of faces){
      for(const candidate of face.points){
        const d=distance(point,candidate);
        if(d<=reach&&(d<cornerDistance-.001||(Math.abs(d-cornerDistance)<.001&&face.inner&&!cornerInner))){
          corner={...candidate};cornerDistance=d;cornerInner=face.inner;
        }
      }
      const projected=project(point,face.points),d=distance(point,projected);
      if(d>reach||d>=faceDistance)continue;
      // Keep the normal coordinate on the actual face, while the coordinate
      // along the wall follows the grid. Never round a wall face to a centreline.
      const [a,b]=face.points,axis=Math.abs(b.x-a.x)>=Math.abs(b.y-a.y)?'x':'y';
      const span=b[axis]-a[axis];
      const t=Math.abs(span)>.000001?Math.max(0,Math.min(1,(Math.round(projected[axis]/step)*step-a[axis])/span)):0;
      facePoint={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};faceDistance=d;
    }
  }
  return corner||facePoint||grid;
}
function stairResolveStart(rawPoint,end,initialStart,records,zoom) {
  if(!snapEnabled||!rawPoint||typeof wallFaceGeometry!=='function')return initialStart;
  records=records||(typeof wallRecords==='function'?wallRecords():[]);
  zoom=zoom??(typeof canvas!=='undefined'&&canvas?.getZoom?canvas.getZoom():1);
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  if(distance(initialStart,end)<2/Math.max(.01,zoom))return initialStart;
  const geometries=records.filter(record=>distance(...record.points)>.001).map(record=>({record,geometry:wallFaceGeometry(record,records)}));
  const polygons=geometries.map(({geometry})=>geometry.polygon || [geometry.faces[0].points[0],geometry.faces[0].points[1],geometry.faces[1].points[1],geometry.faces[1].points[0]]);
  const project=(point,a,b)=>{
    const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;
    const t=length2?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/length2)):0;
    return {x:a.x+t*dx,y:a.y+t*dy};
  };
  const inside=(point,polygon)=>{
    let result=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const a=polygon[j],b=polygon[i];
      // Touching the surface is allowed; only the wall's filled interior blocks
      // a stair footprint extending away from a candidate corner.
      if(distance(point,project(point,a,b))<.00001)return false;
      if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)result=!result;
    }
    return result;
  };
  const inWall=point=>{
    if(polygons.some(polygon=>inside(point,polygon)))return true;
    // Adjacent mitred walls share a diagonal polygon edge. That edge is inside
    // the combined wall body, even though it is a boundary of either polygon.
    const epsilon=.0001;
    return [[epsilon,0],[-epsilon,0],[0,epsilon],[0,-epsilon]].every(([x,y])=>polygons.some(polygon=>inside({x:point.x+x,y:point.y+y},polygon)));
  };
  // A deliberate click on a visible surface stays there. A click in the wall
  // body instead resolves to whichever surface the rectangle extends away from.
  if(!inWall(rawPoint))return initialStart;
  const candidates=[initialStart],step=getSnapInterval();
  geometries.forEach(({record,geometry})=>{
    const reach=Math.max(12/Math.max(.01,zoom),record.thickness*1.5);
    const add=point=>{if(distance(point,rawPoint)<=reach&&!candidates.some(other=>distance(point,other)<.001))candidates.push(point);};
    geometry.faces.forEach(face=>face.segments.forEach(({points:[a,b]})=>{
      add(a);add(b);
      const projected=project(rawPoint,a,b),axis=Math.abs(b.x-a.x)>=Math.abs(b.y-a.y)?'x':'y',span=b[axis]-a[axis];
      const t=Math.abs(span)>.000001?Math.max(0,Math.min(1,(Math.round(projected[axis]/step)*step-a[axis])/span)):0;
      add({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
    }));
  });
  const free=candidate=>{
    const dx=end.x-candidate.x,dy=end.y-candidate.y;
    if(Math.abs(dx)<.001||Math.abs(dy)<.001)return false;
    const x=candidate.x+Math.sign(dx)*Math.min(.1,Math.abs(dx)/2),y=candidate.y+Math.sign(dy)*Math.min(.1,Math.abs(dy)/2);
    return [{x,y},{x,y:candidate.y},{x:candidate.x,y}].every(point=>!inWall(point));
  };
  const isCorner=point=>geometries.some(({geometry})=>geometry.faces.some(face=>face.segments.some(segment=>segment.points.some(end=>distance(point,end)<.001))));
  const preferCorner=isCorner(initialStart);
  const best=candidates.filter(free).sort((a,b)=>(preferCorner?Number(isCorner(b))-Number(isCorner(a)):0)||distance(a,rawPoint)-distance(b,rawPoint))[0];
  return best?{...best}:initialStart;
}
function stairRectangle(a,b) {
  const width = Math.abs(b.x-a.x), height = Math.abs(b.y-a.y);
  return {left:(a.x+b.x)/2,top:(a.y+b.y)/2,width:Math.min(width,height),length:Math.max(width,height),angle:width>height?90:0};
}
function stairConnection(rect, stairs) {
  const halfX = (rect.angle===90?rect.length:rect.width)/2, halfY = (rect.angle===90?rect.width:rect.length)/2;
  let nearest=null,best=Infinity;
  for(const stair of stairs) {
    const r = stair.getBoundingRect(true,true);
    const dx = Math.max(0, r.left-(rect.left+halfX),rect.left-halfX-(r.left+r.width));
    const dy = Math.max(0, r.top-(rect.top+halfY),rect.top-halfY-(r.top+r.height));
    const distance=Math.hypot(dx,dy);
    if(distance<=getSnapInterval() && distance<best) {best=distance;nearest=stair;}
  }
  return nearest;
}
function stairDrawArrow(ctx,points) {
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();
  const end=points.at(-1), prev=points.at(-2), angle=Math.atan2(end[1]-prev[1],end[0]-prev[0]);
  ctx.beginPath();ctx.moveTo(...end);ctx.lineTo(end[0]-9*Math.cos(angle-.5),end[1]-9*Math.sin(angle-.5));
  ctx.moveTo(...end);ctx.lineTo(end[0]-9*Math.cos(angle+.5),end[1]-9*Math.sin(angle+.5));ctx.stroke();
}
function stairLocalPolygon(data) {
  const w=data.width,l=data.length,flight=Math.min(w*.45,l*.35);
  const points=data.stairType==='quarter'
    ? [[-w/2,-l/2],[w/2,-l/2],[w/2,-l/2+flight],[-w/2+flight,-l/2+flight],[-w/2+flight,l/2],[-w/2,l/2]]
    : [[-w/2,-l/2],[w/2,-l/2],[w/2,l/2],[-w/2,l/2]];
  const direction=data.direction==='reverse'?-1:1;
  return points.map(([x,y])=>({x:x*direction,y:y*direction}));
}
function stairWorldPoint(object,point) {
  const angle=(object.angle||0)*Math.PI/180;
  const m=object.calcTransformMatrix?.() || [Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle),object.left,object.top];
  return {x:m[0]*point.x+m[2]*point.y+m[4],y:m[1]*point.x+m[3]*point.y+m[5]};
}
function floorplanStairPolygon(object) {return stairLocalPolygon(object.data).map(point=>stairWorldPoint(object,point));}
function renderStairSymbol(ctx,data) {
  const w=data.width,l=data.length;
  ctx.save();
  if(data.direction==='reverse') ctx.rotate(Math.PI);
  const colors=typeof floorplanColors==='function'?floorplanColors():{};
  ctx.fillStyle=colors.background||'#f1f5f3';ctx.strokeStyle=colors.outline||'#455d59';ctx.lineWidth=1;
  // Paint only the occupied flights. The unused corner remains transparent.
  const outline=stairLocalPolygon({...data,direction:'forward'});
  ctx.beginPath();outline.forEach((point,index)=>index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));
  ctx.closePath();ctx.fill();ctx.stroke();
  const tread=(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
  const spacing=Math.max(18,Math.min(28,l/8));
  if(data.stairType==='half') {
    const landing=Math.min(w/2,l/3), gap=Math.min(10,w/10);
    for(let y=-l/2+landing+spacing;y<l/2;y+=spacing){tread(-w/2,y,-gap/2,y);tread(gap/2,y,w/2,y);}
    tread(-gap/2,-l/2+landing,-gap/2,l/2);tread(gap/2,-l/2+landing,gap/2,l/2);
    stairDrawArrow(ctx,[[-w/4,l/2-12],[-w/4,-l/2+landing/2],[w/4,-l/2+landing/2],[w/4,l/2-12]]);
  } else if(data.stairType==='quarter') {
    const flight=Math.min(w*.45,l*.35), turnY=-l/2+flight;
    for(let y=turnY+spacing;y<l/2;y+=spacing)tread(-w/2,y,-w/2+flight,y);
    for(let x=-w/2+flight+spacing;x<w/2;x+=spacing)tread(x,-l/2,x,turnY);
    tread(-w/2+flight,turnY,-w/2+flight,l/2);tread(-w/2+flight,turnY,w/2,turnY);
    stairDrawArrow(ctx,[[-w/2+flight/2,l/2-12],[-w/2+flight/2,-l/2+flight/2],[w/2-12,-l/2+flight/2]]);
  } else {
    for(let y=-l/2+spacing;y<l/2;y+=spacing)tread(-w/2,y,w/2,y);
    stairDrawArrow(ctx,[[0,l/2-12],[0,-l/2+12]]);
  }
  ctx.restore();
}
function installFloorplanStair(object) {
  if(object.data?.kind!=='stair')return;
  object.set({objectCaching:false,perPixelTargetFind:true,hasControls:true,hasBorders:object.data.stairType!=='quarter',lockRotation:false,lockScalingX:true,lockScalingY:true,snapAngle:45,snapThreshold:3});
  object.setControlsVisibility?.({tl:false,tr:false,bl:false,br:false,ml:false,mr:false,mt:false,mb:false,mtr:true});
  object._render=function(ctx){renderStairSymbol(ctx,this.data);};
  object._toSVG=function(){return ['<g ', 'COMMON_PARTS', '>',floorplanStairSVG(this.data),'</g>'];};
}
function floorplanStairSVG(data) {
  const pieces=[];let path=[];
  const number=value=>Number(value.toFixed(3));
  const drawing={save(){},restore(){},rotate(){},
    fillRect(x,y,w,h){pieces.push(`<rect x="${number(x)}" y="${number(y)}" width="${number(w)}" height="${number(h)}" fill="${this.fillStyle}"/>`);},
    strokeRect(x,y,w,h){pieces.push(`<rect x="${number(x)}" y="${number(y)}" width="${number(w)}" height="${number(h)}" fill="none" stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}"/>`);},
    beginPath(){path=[];},moveTo(x,y){path.push(`M${number(x)} ${number(y)}`);},lineTo(x,y){path.push(`L${number(x)} ${number(y)}`);},closePath(){path.push('Z');},
    fill(){pieces.push(`<path d="${path.join(' ')}" fill="${this.fillStyle}"/>`);},
    stroke(){pieces.push(`<path d="${path.join(' ')}" fill="none" stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}"/>`);}};
  renderStairSymbol(drawing,{...data,direction:'forward'});
  return `<g${data.direction==='reverse'?' transform="rotate(180)"':''}>${pieces.join('')}</g>`;
}
function updateFloorplanStair(object,values) {
  stairLastError='';
  const {angle:angleValue,...properties}=values;
  const angle=Number(angleValue??object.angle??0);
  const data={...object.data,...properties,width:Number(values.width??object.data.width),length:Number(values.length??object.data.length)};
  if(!Number.isFinite(data.width)||!Number.isFinite(data.length)||data.width<30||data.length<30||data.width>10000||data.length>10000){
    const format=value=>typeof floorplanFormatLength==='function'?floorplanFormatLength(value):value;
    const unit=typeof floorplanUnitLabel==='function'?floorplanUnitLabel():'cm';
    stairLastError=`Stair width and length must be between ${format(30)} and ${format(10000)} ${unit}.`;return false;
  }
  if(!['straight','quarter','half'].includes(data.stairType)||!['forward','reverse'].includes(data.direction)){stairLastError='Choose a stair type and direction.';return false;}
  if(!Number.isFinite(angle)){stairLastError='Enter a valid rotation angle.';return false;}
  wallCheckpoint();object.set({width:data.width,height:data.length,angle:((angle%360)+360)%360,data});installFloorplanStair(object);object.setCoords();
  isDirty=true;syncSaveButton();canvas.requestRenderAll();return true;
}
function cancelFloorplanStair(){stairDraft=null;stairPointer=null;stairLengthEdit=null;if(stairLengthEditor)stairLengthEditor.hidden=true;if(typeof canvas!=='undefined'&&canvas){canvas.clearContext(canvas.contextTop);canvas.requestRenderAll();}}
function commitFloorplanStair(point) {
  if(!stairDraft)return false;
  if(stairDraft.startInput)stairDraft.start=stairResolveStart(stairDraft.startInput,point,stairDraft.startBase);
  const rectangle=stairRectangle(stairDraft.start,point);
  if(rectangle.width<30||rectangle.length<30)return false;
  const other=stairConnection(rectangle,canvas.getObjects().filter(o=>o.data?.kind==='stair'));
  const radians=rectangle.angle*Math.PI/180;
  const forward={x:Math.sin(radians),y:-Math.cos(radians)};
  const direction=other&&((rectangle.left-other.left)*forward.x+(rectangle.top-other.top)*forward.y)<0?'reverse':'forward';
  const id=stairId();
  wallCheckpoint();
  const object=new fabric.Rect({left:rectangle.left,top:rectangle.top,width:rectangle.width,height:rectangle.length,
    angle:rectangle.angle,originX:'center',originY:'center',strokeWidth:0,
    data:{kind:'stair',id,width:rectangle.width,length:rectangle.length,stairType:'straight',direction,
      routeId:other?.data.routeId||id,connectedTo:other?.data.id||null}});
  canvas.add(object);installFloorplanStair(object);stairDraft=null;
  setTool('select');canvas.setActiveObject(object);isDirty=true;syncSaveButton();canvas.requestRenderAll();return true;
}
function stairMeasurements(object) {
  const {width:w,length:l,direction}=object.data,sign=direction==='reverse'?-1:1;
  return [
    {key:'width',name:'Width',length:w,points:[{x:-w/2,y:-l/2},{x:w/2,y:-l/2}]},
    {key:'length',name:'Length',length:l,points:[{x:-w/2,y:l/2},{x:-w/2,y:-l/2}]}
  ].map(measurement=>({...measurement,points:measurement.points.map(point=>stairWorldPoint(object,{x:point.x*sign,y:point.y*sign}))}));
}
function stairMeasurementPlacement(measurement) {
  const points=measurement.points.map(point=>fabric.util.transformPoint(point,canvas.viewportTransform));
  const [a,b]=points,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
  const normal={x:dy/length,y:-dx/length};
  const ends=points.map(point=>({x:point.x+normal.x*22,y:point.y+normal.y*22}));
  let angle=Math.atan2(dy,dx)*180/Math.PI;
  if(angle>90||angle<-90)angle+=180;
  return {points,ends,angle,anchor:{x:(ends[0].x+ends[1].x)/2,y:(ends[0].y+ends[1].y)/2}};
}
function positionStairLengthEditor() {
  if(!stairLengthEdit)return;
  const {object,key}=stairLengthEdit;
  if(!canvas.getObjects().includes(object)){stairLengthEdit=null;stairLengthEditor.hidden=true;return;}
  const measurement=stairMeasurements(object).find(item=>item.key===key);
  const {anchor}=stairMeasurementPlacement(measurement);
  const position=floorplanMeasurementEditorPosition(anchor,stairLengthEditor.offsetWidth||186,stairLengthEditor.offsetHeight||76,canvas.width,canvas.height);
  stairLengthEditor.style.left=`${position.x}px`;stairLengthEditor.style.top=`${position.y}px`;
}
function editStairMeasurement(object,key) {
  setTool('select');canvas.setActiveObject(object);
  stairLengthEdit={object,key};
  stairLengthCaption.textContent=`Stair ${key} · ${floorplanUnitLabel()}`;
  stairLengthInput.value=floorplanFormatLength(object.data[key]);stairLengthInput.setCustomValidity('');
  stairLengthEditor.hidden=false;positionStairLengthEditor();
  stairLengthInput.focus({preventScroll:true});stairLengthInput.select();
}
function renderStairDimensions(event) {
  if(!stairDimensionUI||(event?.ctx&&event.ctx!==canvas.contextContainer))return;
  stairDimensionUI.replaceChildren();
  stairDimensionUI.hidden=typeof floorplanDimensionsVisible!=='undefined'&&!floorplanDimensionsVisible;
  positionStairLengthEditor();
  if(stairDimensionUI.hidden)return;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');stairDimensionUI.append(svg);
  const line=(a,b)=>{
    const element=document.createElementNS('http://www.w3.org/2000/svg','line');
    for(const [key,value] of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#8b9d9a','stroke-width':'.65'}))element.setAttribute(key,value);
    svg.append(element);
  };
  for(const object of canvas.getObjects().filter(object=>object.data?.kind==='stair'&&object.visible!==false)){
    for(const measurement of stairMeasurements(object)){
      const {points,ends,angle,anchor}=stairMeasurementPlacement(measurement);
      line(...ends);points.forEach((point,index)=>{line(point,ends[index]);const end=ends[index];line({x:end.x-3,y:end.y+3},{x:end.x+3,y:end.y-3});});
      const button=document.createElement('button');button.type='button';button.className='fp-wall-dimension fp-stair-dimension';
      button.disabled=currentTool!=='select';button.textContent=floorplanFormatLength(measurement.length);
      button.setAttribute('aria-label',`Stair ${measurement.key} ${floorplanFormatLength(measurement.length)} ${floorplanUnitLabel()}`);
      button.title=`Double-click or press Enter to edit stair ${measurement.key}`;
      button.style.left=`${anchor.x}px`;button.style.top=`${anchor.y}px`;button.style.transform=`translate(-50%, -50%) rotate(${angle}deg)`;
      bindFloorplanDimensionEditing(button,()=>editStairMeasurement(object,measurement.key));stairDimensionUI.append(button);
    }
  }
}
function setupStairDimensions() {
  if(typeof document==='undefined'||stairDimensionUI)return;
  const wrapper=document.getElementById('canvasWrapper');if(!wrapper)return;
  stairDimensionUI=document.createElement('div');stairDimensionUI.className='fp-wall-dimensions fp-stair-dimensions';
  stairLengthEditor=document.createElement('form');stairLengthEditor.className='fp-wall-length-editor fp-stair-length-editor';stairLengthEditor.hidden=true;
  stairLengthCaption=document.createElement('label');stairLengthCaption.htmlFor='stairLengthInput';
  stairLengthInput=document.createElement('input');Object.assign(stairLengthInput,{id:'stairLengthInput',type:'text',inputMode:'decimal',autocomplete:'off'});
  const apply=document.createElement('button');apply.type='submit';apply.textContent='Apply';
  stairLengthEditor.append(stairLengthCaption,stairLengthInput,apply);wrapper.append(stairDimensionUI,stairLengthEditor);
  stairLengthEditor.addEventListener('pointerdown',event=>event.stopPropagation());
  stairLengthEditor.addEventListener('submit',event=>{
    event.preventDefault();if(!stairLengthEdit)return;
    const {object,key}=stairLengthEdit,value=floorplanFromDisplayLength(stairLengthInput.value);
    if(!updateFloorplanStair(object,{[key]:value})){stairLengthInput.setCustomValidity(stairLastError);stairLengthInput.reportValidity();return;}
    stairLengthEdit=null;stairLengthEditor.hidden=true;
    if(typeof refreshFloorplanInspector==='function')refreshFloorplanInspector();
  });
  stairLengthInput.addEventListener('input',()=>stairLengthInput.setCustomValidity(''));
  stairLengthInput.addEventListener('keydown',event=>{
    event.stopPropagation();if(event.key==='Escape'){event.preventDefault();stairLengthEdit=null;stairLengthEditor.hidden=true;}
  });
  canvas.on('after:render',renderStairDimensions);
}
function setupFloorplanStairs() {
  setupStairDimensions();
  canvas.on('object:added',e=>installFloorplanStair(e.target));
  canvas.on('before:transform',e=>{if(e.transform?.target?.data?.kind==='stair')wallCheckpoint();});
  canvas.on('object:moving',e=>{
    if(e.target?.data?.kind!=='stair'||!snapEnabled)return;
    const point=stairGridPoint({x:e.target.left,y:e.target.top});e.target.set({left:point.x,top:point.y});
  });
  canvas.getObjects().forEach(installFloorplanStair);
  canvas.on('mouse:down',e=>{
    if(currentTool!=='stair'||e.e.button>0||isPanning)return;
    const rawPoint=canvas.getPointer(e.e),point=stairSnapPoint(rawPoint);
    stairPointer=point;
    if(stairDraft&&commitFloorplanStair(point))return;
    stairDraft={start:point,end:point,startInput:{...rawPoint},startBase:{...point}};
    document.getElementById('wallStatus').textContent='Drag a rectangle for the stair footprint. Select it to change type or direction.';
  });
  canvas.on('mouse:move',e=>{
    if(currentTool!=='stair'||isPanning)return;
    stairPointer=stairSnapPoint(canvas.getPointer(e.e));
    if(stairDraft){
      stairDraft.end=stairPointer;
      if(stairDraft.startInput)stairDraft.start=stairResolveStart(stairDraft.startInput,stairPointer,stairDraft.startBase);
    }
    canvas.requestRenderAll();
  });
  canvas.on('mouse:out',()=>{if(currentTool==='stair'){stairPointer=null;canvas.requestRenderAll();}});
  canvas.on('mouse:up',e=>{if(currentTool==='stair'&&stairDraft)commitFloorplanStair(stairSnapPoint(canvas.getPointer(e.e)));});
  canvas.on('after:render',event=>{
    if((event?.ctx&&event.ctx!==canvas.contextContainer)||!canvas.contextTop)return;
    const selected=canvas.getActiveObject?.();
    if(currentTool==='select'&&selected?.data?.kind==='stair'&&selected.data.stairType==='quarter'){
      const ctx=canvas.contextTop,points=floorplanStairPolygon(selected);
      ctx.save();ctx.transform(...canvas.viewportTransform);ctx.lineWidth=1/canvas.getZoom();
      ctx.strokeStyle=typeof floorplanColors==='function'?floorplanColors().snap:'#008c85';ctx.setLineDash([5/canvas.getZoom(),3/canvas.getZoom()]);
      ctx.beginPath();points.forEach((point,index)=>index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));ctx.closePath();ctx.stroke();ctx.restore();
    }
    if(currentTool!=='stair')return;const ctx=canvas.contextTop;canvas.clearContext(ctx);
    ctx.save();ctx.transform(...canvas.viewportTransform);
    if(stairDraft){
      const r=stairRectangle(stairDraft.start,stairDraft.end);ctx.save();ctx.translate(r.left,r.top);ctx.rotate(r.angle*Math.PI/180);ctx.globalAlpha=.7;
      renderStairSymbol(ctx,{width:r.width,length:r.length,stairType:'straight',direction:'forward'});ctx.restore();
    }
    // Keep the click location visible both before the first click and over the
    // footprint preview. These rings use the same screen size as wall snapping.
    ctx.strokeStyle=typeof floorplanColors==='function'?floorplanColors().snap:'#008c85';ctx.lineWidth=2/canvas.getZoom();
    const markers=stairDraft?[stairDraft.start,stairPointer]:[stairPointer];
    markers.filter(Boolean).forEach(point=>{
      if(typeof drawFloorplanSnapMarker==='function')drawFloorplanSnapMarker(ctx,point);
      else {ctx.beginPath();ctx.arc(point.x,point.y,5/canvas.getZoom(),0,Math.PI*2);ctx.stroke();}
    });
    ctx.restore();
  });
}
