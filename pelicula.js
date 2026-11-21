import {PAINT_FPS,INK_FPS,WHEELS,DEPTHS,cameraZoom,speedAt,smooth,modulo,wheelPlacement,rollingAngle,openingAt,FRONT_DURATION,TUNNEL_DURATION,TUNNEL_ZOOM,CITY_CAMERA_START,DEPARTURE_DURATION} from './dinamica.js';
function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error(`No se pudo abrir ${src}`));image.src=src;});}
function pixelsOf(image){const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);return{w:c.width,h:c.height,data:ctx.getImageData(0,0,c.width,c.height).data};}
function boundsOf(pixels,start=0,end=pixels.w){let x0=end,y0=pixels.h,x1=start,y1=0;for(let y=0;y<pixels.h;y++)for(let x=start;x<end;x++)if(pixels.data[(y*pixels.w+x)*4+3]>2){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}if(x1<=x0)throw Error('Ilustración vacía');return{x:Math.max(start,x0-1),y:Math.max(0,y0-1),w:Math.min(end,x1+2)-Math.max(start,x0-1),h:Math.min(pixels.h,y1+2)-Math.max(0,y0-1)};}
export function wholePlants(pixels){
  const columns=new Uint32Array(pixels.w);for(let x=0;x<pixels.w;x++)for(let y=0;y<pixels.h;y++)if(pixels.data[(y*pixels.w+x)*4+3]>2)columns[x]++;
  const gap=(lo,hi)=>{let bestStart=-1,bestLength=0,run=-1;for(let x=Math.floor(lo*pixels.w);x<=Math.floor(hi*pixels.w);x++){if(columns[x]===0){if(run<0)run=x;if(x-run+1>bestLength){bestLength=x-run+1;bestStart=run;}}else run=-1;}if(bestLength<2)throw Error('Las plantas necesitan un margen transparente completo.');return bestStart+Math.floor(bestLength/2);};
  const a=gap(.28,.39),b=gap(.59,.72);return{cuts:[a,b],sprites:[boundsOf(pixels,0,a),boundsOf(pixels,a,b),boundsOf(pixels,b,pixels.w)]};
}
export function skylineRows(pixels){
  const gap=(lo,hi)=>{let start=-1,best=0,cut=-1;for(let y=Math.floor(lo*pixels.h);y<hi*pixels.h;y++){let empty=true;for(let x=0;x<pixels.w;x++)if(pixels.data[(y*pixels.w+x)*4+3]>2){empty=false;break;}if(empty){if(start<0)start=y;if(y-start+1>best){best=y-start+1;cut=start+Math.floor(best/2);}}else start=-1;}if(best<4)throw Error('Los planos de ciudad deben estar separados por transparencia.');return cut;};
  const cuts=[gap(.28,.35),gap(.68,.75)],ranges=[[0,cuts[0]],[cuts[0],cuts[1]],[cuts[1],pixels.h]];
  return{cuts,sprites:ranges.map(([a,b])=>{let top=b,bottom=a;for(let y=a;y<b;y++)for(let x=0;x<pixels.w;x++)if(pixels.data[(y*pixels.w+x)*4+3]>2){top=Math.min(top,y);bottom=Math.max(bottom,y);}return{x:0,y:top,w:pixels.w,h:bottom-top+1};})};
}
export class Pelicula{
  constructor(canvas,departureAt=Infinity){this.canvas=canvas;this.departureAt=departureAt;this.ctx=canvas.getContext('2d',{alpha:false});this.ready=false;this.started=false;this.paused=false;this.hidden=false;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.elapsed=0;this.sequenceElapsed=0;this.ambient=0;this.distance=0;this.speed=0;this.paintClock=0;this.debug=new URLSearchParams(location.search).has('guias');this.resize=()=>{this.w=innerWidth;this.h=innerHeight;const dpr=Math.min(devicePixelRatio,2);canvas.width=Math.round(this.w*dpr);canvas.height=Math.round(this.h*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);this.render();};this.resize();addEventListener('resize',this.resize);this.previous=performance.now();this.frame=this.frame.bind(this);this.raf=requestAnimationFrame(this.frame);}
  async load(){const entries=await Promise.all(Object.entries({background:'assets/art/fondo-parallax.jpg',city:'assets/runtime/ciudad-tres-planos.png',car:'assets/runtime/porsche-pintado.png',plants:'assets/runtime/plantas-completas.png'}).map(async([key,url])=>[key,await loadImage(url)]));this.images=Object.fromEntries(entries);this.carBounds=boundsOf(pixelsOf(this.images.car));
    const plants=wholePlants(pixelsOf(this.images.plants));this.plants=plants.sprites;this.canvas.dataset.plantCuts=plants.cuts.join(',');const pixels=pixelsOf(this.images.city),city=skylineRows(pixels);this.city=city.sprites;this.windows=this.city.map(p=>{const points=[];for(let y=p.y+4;y<p.y+p.h-3;y+=5)for(let x=4;x<p.w-3;x+=5){const at=(y*pixels.w+x)*4,[r,g,b,a]=pixels.data.slice(at,at+4);if(a>240&&Math.max(r,g,b)>180)points.push({x,y:y-p.y,r,g,b,phase:(x*7+y*11)%97});}return points.filter((_,i)=>i%Math.max(1,Math.floor(points.length/45))===0).slice(0,45);});this.canvas.dataset.cityCuts=city.cuts.join(',');this.ready=true;this.canvas.dataset.ready='true';this.render();}
  start(){this.started=true;this.elapsed=0;this.sequenceElapsed=0;this.distance=0;this.speed=0;this.paintClock=1;this.canvas.dataset.running='true';}
  reset(){this.started=false;this.elapsed=0;this.sequenceElapsed=0;this.speed=0;this.distance=0;this.canvas.dataset.running='false';this.render();}
  frame(now) {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(.25, (now - this.previous) / 1000);
    this.previous = now;
    if (!this.ready || this.paused || this.hidden) return;

    this.ambient += dt;
    if (this.started) {
      this.sequenceElapsed += dt;
      this.elapsed = openingAt(this.sequenceElapsed).driveTime;
      const departureAge = this.elapsed - this.departureAt;
      const boost = 570 * smooth(departureAge / .7);
      const coast = 1 - smooth((departureAge - DEPARTURE_DURATION) / 2.2);
      this.speed = this.reduced ? 0 : (speedAt(this.elapsed) + boost) * coast;
      this.distance += this.speed * dt;
    }

    this.paintClock += dt;
    if (this.paintClock >= 1 / PAINT_FPS - .001) {
      this.paintClock = Math.max(0, (this.paintClock - 1 / PAINT_FPS) % (1 / PAINT_FPS));
      this.render();
    }
    if (this.started) this.onTime?.(this.elapsed, this.sequenceElapsed);
  }
  layout(){const image=this.images.background,zoom=this.reduced?1:cameraZoom(this.elapsed),baseScale=Math.max(this.w/image.naturalWidth,this.h/image.naturalHeight),scale=baseScale*zoom,w=image.naturalWidth*scale,h=image.naturalHeight*scale;const ground=this.h*(this.w/this.h>1.25?.76:.742);return{x:(this.w-w)/2,y:ground-h*.742,w,h,scale,zoom,baseScale};}
  tiles(image,source,scale,y,offset,paint){const width=source.w*scale,phase=modulo(offset,width*2);for(let n=-2;n*width-phase<this.w+width;n++){const x=n*width-phase,flip=Math.abs(n)%2===1;if(x+width<0||x>this.w)continue;this.ctx.save();this.ctx.translate(x+(flip?width:0),y);this.ctx.scale(flip?-1:1,1);this.ctx.drawImage(image,source.x,source.y,source.w,source.h,0,0,width,source.h*scale);paint?.();this.ctx.restore();}}
  drawFront(){
    const ctx=this.ctx,t=this.sequenceElapsed,state=openingAt(t),scale=Math.min(this.w*1.18,1050)/1536*(this.reduced?1:1+.018*smooth(t/3)),width=1536*scale,height=1024*scale,x=(this.w-width)/2,y=this.h*.73-height*.9,fade=1-smooth((t-3.05)/.35),on=state.headlights;
    ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=fade;
    for(const mirror of [false,true]){
      const at=(px,py)=>[x+(mirror?1536-px:px)*scale,y+py*scale],center=at(350,493),glow=ctx.createRadialGradient(...center,0,...center,230*scale);
      glow.addColorStop(0,'rgba(243,249,255,'+on*.92+')');glow.addColorStop(.16,'rgba(212,231,255,'+on*.5+')');glow.addColorStop(.42,'rgba(150,192,244,'+on*.16+')');glow.addColorStop(1,'rgba(124,160,220,0)');
      ctx.fillStyle=glow;ctx.fillRect(center[0]-230*scale,center[1]-230*scale,460*scale,460*scale);
      ctx.save();ctx.translate(...center);ctx.scale(1,.66);const core=ctx.createRadialGradient(0,0,0,0,0,78*scale);core.addColorStop(0,'rgba(255,255,255,'+on*.85+')');core.addColorStop(.55,'rgba(228,242,255,'+on*.38+')');core.addColorStop(1,'rgba(201,224,255,0)');ctx.fillStyle=core;ctx.beginPath();ctx.arc(0,0,78*scale,0,Math.PI*2);ctx.fill();ctx.restore();
      ctx.save();ctx.shadowColor='rgba(202,226,255,'+on+')';ctx.lineCap='round';ctx.strokeStyle='rgba(255,255,255,'+on+')';
      for(const [blur,lineWidth] of [[64,14],[22,11],[0,9]]){ctx.shadowBlur=blur*scale;ctx.lineWidth=lineWidth*scale;for(const [ax,ay,bx,by] of [[305,453,346,459],[374,470,394,477],[309,513,349,515],[374,513,413,518]]){ctx.beginPath();ctx.moveTo(...at(ax,ay));ctx.lineTo(...at(bx,by));ctx.stroke();}}
      ctx.restore();
      const flare=ctx.createLinearGradient(center[0]-190*scale,0,center[0]+190*scale,0);flare.addColorStop(0,'rgba(174,212,255,0)');flare.addColorStop(.5,'rgba(230,245,255,'+on*.8+')');flare.addColorStop(1,'rgba(174,212,255,0)');ctx.fillStyle=flare;ctx.fillRect(center[0]-190*scale,center[1]-.6,380*scale,1.2);
      const beam=ctx.createLinearGradient(center[0],center[1],center[0],this.h*.96);beam.addColorStop(0,'rgba(205,225,255,'+on*.11+')');beam.addColorStop(1,'rgba(130,165,210,0)');ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(center[0]-17*scale,center[1]);ctx.lineTo(center[0]+17*scale,center[1]);ctx.lineTo(center[0]+310*scale,this.h);ctx.lineTo(center[0]-310*scale,this.h);ctx.closePath();ctx.fill();
    }
    ctx.restore();this.canvas.dataset.headlights=on.toFixed(3);this.canvas.dataset.frontView='head-on';this.canvas.dataset.frontBody='hidden';
  }
  drawTunnel(f){
    if(this.elapsed>=TUNNEL_DURATION||this.reduced)return;
    const ctx=this.ctx,progress=smooth(this.elapsed/TUNNEL_DURATION),edge=this.w*(1.06-1.35*progress),feather=this.w*.13,ground=f.y+f.h*.742;
    ctx.save();const shadow=ctx.createLinearGradient(edge-feather,0,edge+feather,0);shadow.addColorStop(0,'rgba(0,1,4,.995)');shadow.addColorStop(.65,'rgba(2,3,8,.96)');shadow.addColorStop(1,'rgba(2,3,9,0)');ctx.fillStyle=shadow;ctx.fillRect(0,0,Math.max(0,edge+feather),this.h);
    const slab=ctx.createLinearGradient(edge-16,0,edge+7,0);slab.addColorStop(0,'rgba(12,14,24,.02)');slab.addColorStop(.8,'rgba(26,28,44,.65)');slab.addColorStop(1,'rgba(89,84,112,.18)');ctx.fillStyle=slab;ctx.fillRect(edge-16,0,23,ground+2);
    const arch=()=>{ctx.beginPath();ctx.moveTo(edge-this.w*.55,-35);ctx.bezierCurveTo(edge-this.w*.08,this.h*.04,edge+8,this.h*.32,edge+8,ground+4);};ctx.lineCap='butt';ctx.strokeStyle='rgba(18,21,34,.95)';ctx.lineWidth=Math.max(17,this.w*.045);arch();ctx.stroke();ctx.strokeStyle='rgba(99,94,124,.22)';ctx.lineWidth=2;arch();ctx.stroke();
    ctx.strokeStyle='rgba(112,113,142,.1)';ctx.lineWidth=1.5;for(let i=0;i<4;i++){const px=edge-65-i*125;ctx.beginPath();ctx.moveTo(px,this.h*.12);ctx.lineTo(px,this.h*.69);ctx.stroke();}
    const car=JSON.parse(this.canvas.dataset.carBox),lampX=car.x+car.width*.97,lampY=car.y+car.height*.72,beam=ctx.createLinearGradient(lampX,lampY,lampX+this.w*.65,lampY);beam.addColorStop(0,'rgba(239,226,185,.22)');beam.addColorStop(1,'rgba(232,217,184,0)');ctx.globalCompositeOperation='screen';ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(lampX,lampY-2);ctx.lineTo(lampX+this.w*.65,lampY-this.h*.04);ctx.lineTo(lampX+this.w*.65,ground+this.h*.06);ctx.closePath();ctx.fill();ctx.restore();
  }
  drawBackdrop(f){const ctx=this.ctx,image=this.images.background,horizon=f.y+f.h*.567,shore=f.y+f.h*.712,skyScale=Math.max(this.w/image.naturalWidth,horizon/(image.naturalHeight*.505));ctx.drawImage(image,(this.w-image.naturalWidth*skyScale)/2,horizon-image.naturalHeight*.505*skyScale,image.naturalWidth*skyScale,image.naturalHeight*skyScale);
    const water={x:0,y:Math.floor(image.naturalHeight*.506),w:image.naturalWidth,h:Math.ceil(image.naturalHeight*.208)};
    ctx.save();ctx.beginPath();ctx.rect(0,horizon,this.w,shore-horizon);ctx.clip();this.tiles(image,water,f.scale,horizon,this.distance*f.scale*DEPTHS.water);ctx.restore();
  }
  drawCity(f){const ctx=this.ctx,baseline=f.y+f.h*.567,t=this.reduced?0:this.ambient,offsets={};for(const [i,name,factor] of [[0,'far',1.55],[1,'middle',1.08],[2,'near',1.04]]){const p=this.city[i],scale=f.scale*factor,height=p.h*scale,offset=this.distance*f.scale*DEPTHS[name];offsets[name]=+offset.toFixed(3);
      ctx.save();ctx.globalAlpha=i===0?.78:1;this.tiles(this.images.city,p,scale,baseline-height,offset,this.reduced?undefined:()=>{ctx.save();ctx.globalCompositeOperation='screen';for(const p of this.windows[i]){const alpha=.12+(.5+.5*Math.sin(t*.65+p.phase))*.31;ctx.fillStyle=`rgba(${p.r},${p.g},${p.b},${alpha})`;ctx.fillRect(p.x*scale,p.y*scale,Math.max(.6,1.6*scale),Math.max(.7,2*scale));}ctx.restore();});ctx.restore();
      ctx.save();ctx.beginPath();ctx.rect(0,baseline,this.w,f.h*.143);ctx.clip();ctx.translate(0,baseline);ctx.scale(1,-.42);ctx.globalAlpha=.11+(i*.035)+Math.sin(t*.6+i)*.008;this.tiles(this.images.city,p,scale,-height,offset);ctx.restore();
    }this.canvas.dataset.layerOffsets=JSON.stringify(offsets);
    const bottom=f.y+f.h*.712;ctx.save();ctx.beginPath();ctx.rect(0,baseline,this.w,bottom-baseline);ctx.clip();for(let i=0;i<74;i++){const row=i%19,phase=i*43.71,y=baseline+(row/19)*(bottom-baseline),x=modulo(phase-this.distance*f.scale*(.12+row*.007)+Math.sin(t*1.3+i)*6,this.w+70)-40;ctx.strokeStyle=`rgba(${i%3===0?'235,178,213':'155,179,234'},${.07+(i%4)*.025})`;ctx.lineWidth=.7+(i%3)*.45;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+9+i%23,y);ctx.stroke();}ctx.restore();}
  drawRoad(f){const ctx=this.ctx,image=this.images.background,source={x:0,y:Math.floor(image.naturalHeight*.73),w:image.naturalWidth,h:Math.floor(image.naturalHeight*.27)},top=f.y+f.h*.73,period=280*f.scale,offset=modulo(this.distance*f.scale*DEPTHS.road,period);ctx.save();ctx.beginPath();ctx.rect(0,top,this.w,this.h-top);ctx.clip();for(let row=0,y=top;y<this.h;row++,y+=source.h*f.scale){ctx.save();ctx.translate(0,y+(row%2?source.h*f.scale:0));ctx.scale(1,row%2?-1:1);this.tiles(image,source,f.scale,0,this.distance*f.scale*DEPTHS.road);ctx.restore();}ctx.lineCap='round';const laneY=f.y+f.h*.788;for(let x=-period-offset;x<this.w+period;x+=period){ctx.strokeStyle='rgba(210,200,230,.34)';ctx.lineWidth=Math.max(1,3*f.scale);ctx.beginPath();ctx.moveTo(x,laneY);ctx.lineTo(x+155*f.scale,laneY);ctx.stroke();}ctx.restore();
    const curbY=f.y+f.h*.713,curbH=f.h*.017;ctx.fillStyle='#353951';ctx.fillRect(0,curbY,this.w,curbH);ctx.fillStyle='#68627d';ctx.fillRect(0,curbY,this.w,Math.max(1,2*f.scale));const step=72*f.scale,shift=modulo(this.distance*f.scale*DEPTHS.railing,step);ctx.strokeStyle='#252c48';ctx.lineWidth=1;for(let x=-shift;x<this.w+step;x+=step){ctx.beginPath();ctx.moveTo(x,curbY+1);ctx.lineTo(x-5*f.scale,curbY+curbH);ctx.stroke();}}
  drawRailing(f){const ctx=this.ctx,bottom=f.y+f.h*.713,top=bottom-77*f.scale,step=93*f.scale,shift=modulo(this.distance*f.scale*DEPTHS.railing,step);ctx.save();ctx.strokeStyle='#222c48';ctx.lineWidth=Math.max(1.3,4*f.scale);for(const y of [top,top+25*f.scale,bottom-5*f.scale]){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(this.w,y);ctx.stroke();}for(let x=-shift;x<this.w+step;x+=step){ctx.lineWidth=Math.max(1.2,4*f.scale);ctx.beginPath();ctx.moveTo(x,top-4*f.scale);ctx.lineTo(x,bottom);ctx.stroke();ctx.strokeStyle='#8287a260';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x+1,top);ctx.lineTo(x+1,bottom);ctx.stroke();ctx.strokeStyle='#222c48';for(let j=1;j<4;j++){ctx.lineWidth=Math.max(.8,2*f.scale);ctx.beginPath();ctx.moveTo(x+step*j/4,top+25*f.scale);ctx.lineTo(x+step*j/4,bottom);ctx.stroke();}}ctx.restore();}
  drawSpeedLines(f){
    if(this.reduced)return;
    const ctx=this.ctx,intensity=smooth((this.speed-45)/350);if(intensity<=0)return;
    const roadY=f.y+f.h*.742;ctx.save();ctx.lineCap='round';
    for(let i=0;i<36;i++){
      const length=(70+(i*47%185))*intensity*(1+.55*smooth((this.speed-440)/570));
      const x=modulo(i*127.71-this.distance*f.scale*(.8+(i%4)*.24),this.w+length*2)-length;
      const y=roadY+((i*37%121)/121-.64)*this.h*.19;
      const gradient=ctx.createLinearGradient(x,y,x+length,y);
      gradient.addColorStop(0,'rgba(190,202,244,0)');
      gradient.addColorStop(.8,`rgba(232,228,253,${(.5+(i%3)*.12)*intensity})`);
      gradient.addColorStop(1,'rgba(237,224,250,0)');
      ctx.strokeStyle=gradient;ctx.lineWidth=i%3===0?2.3:1.25;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+length,y);ctx.stroke();
    }
    ctx.restore();
  }
  prepareWheels(){const image=this.images.car,bodyPixels=pixelsOf(image);this.carBody=document.createElement('canvas');this.carBody.width=bodyPixels.w;this.carBody.height=bodyPixels.h;this.wheelTextures=WHEELS.map(wheel=>{const size=wheel.radius*2,make=()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=size;return canvas;},mask=make(),texture=make(),motion=make(),maskCtx=mask.getContext('2d',{willReadFrequently:true});maskCtx.drawImage(image,wheel.x-wheel.radius,wheel.y-wheel.radius,size,size,0,0,size,size);const pixels=maskCtx.getImageData(0,0,size,size);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const at=(y*size+x)*4,[r,g]=pixels.data.slice(at,at+2);if(Math.hypot(x+.5-wheel.radius,y+.5-wheel.radius)>wheel.radius||(r>85&&r>g*1.2))pixels.data[at+3]=0;else if(pixels.data[at+3]>0)bodyPixels.data[((y+wheel.y-wheel.radius)*bodyPixels.w+x+wheel.x-wheel.radius)*4+3]=0;}maskCtx.putImageData(pixels,0,0);const source=texture.getContext('2d');source.fillStyle='#17192d';source.fillRect(0,0,size,size);source.drawImage(mask,0,0);return{mask,texture,motion,ctx:motion.getContext('2d')};});this.carBody.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(bodyPixels.data),bodyPixels.w,bodyPixels.h),0,0);}
  drawRollingWheel(index,p,f,travel,travelSpeed){const wheel=WHEELS[index],sprite=this.wheelTextures[index],ctx=sprite.ctx,size=wheel.radius*2,angle=rollingAngle(this.distance,f.scale,p.radius)+travel/p.radius,angularSpeed=rollingAngle(this.speed,f.scale,p.radius)+travelSpeed/p.radius,exposure=Math.min(.35,angularSpeed/PAINT_FPS*.85);ctx.clearRect(0,0,size,size);ctx.save();ctx.translate(wheel.radius,wheel.radius);ctx.globalCompositeOperation='lighter';const samples=this.speed>80?4:1;for(let i=0;i<samples;i++){ctx.save();ctx.rotate(angle-exposure*i/Math.max(1,samples-1));ctx.globalAlpha=1/samples;ctx.drawImage(sprite.texture,-wheel.radius,-wheel.radius);ctx.restore();}ctx.restore();ctx.globalCompositeOperation='destination-in';ctx.drawImage(sprite.mask,0,0);ctx.globalCompositeOperation='source-over';this.ctx.drawImage(sprite.motion,p.x-p.radius,p.y-p.radius,p.radius*2,p.radius*2);return angle;}
  drawCar(f) {
    const progress = Math.max(0, (this.elapsed - this.departureAt) / DEPARTURE_DURATION);
    const exited = progress >= 1;
    this.canvas.dataset.carExited = String(exited);
    if (exited) {
      delete this.canvas.dataset.carBox;
      delete this.canvas.dataset.wheels;
      return;
    }

    const ctx = this.ctx, b = this.carBounds, image = this.images.car;
    const width = Math.min(this.images.background.naturalWidth * f.baseScale * .448, this.w * (this.w / this.h > 1.25 ? .34 : .68)) * f.zoom;
    const scale = width / b.w, height = b.h * scale, roadY = f.y + f.h * .742;
    const bob = this.reduced || this.speed < 10 ? 0 : Math.sin(Math.floor(this.ambient * INK_FPS) / INK_FPS * 8) * .38;
    const center = this.w * (.49 - .18 * smooth((f.zoom - 1) / (TUNNEL_ZOOM - 1)));
    const exitDistance = this.w * 1.03 - center + width / 2;
    const travel = this.reduced ? 0 : exitDistance * progress ** 2.4;
    const travelSpeed = this.reduced ? 0 : exitDistance * 2.4 * progress ** 1.4 / DEPARTURE_DURATION;
    const anchorX = center + travel, left = anchorX - width / 2, top = roadY - height + bob;
    if(!this.wheelTextures)this.prepareWheels();ctx.save();ctx.translate(anchorX,roadY+1);ctx.scale(1,.065);const shade=ctx.createRadialGradient(0,0,1,0,0,width*.56);shade.addColorStop(0,'rgba(17,18,41,.40)');shade.addColorStop(1,'rgba(17,18,41,0)');ctx.fillStyle=shade;ctx.beginPath();ctx.arc(0,0,width*.56,0,Math.PI*2);ctx.fill();ctx.restore();ctx.drawImage(this.speed>.1&&!this.reduced?this.carBody:image,b.x,b.y,b.w,b.h,left,top,width,height);
    const wheelInfo=[];for(const [index,wheel] of WHEELS.entries()){const p=wheelPlacement(wheel,b,left,top,scale);let angle=0;if(this.speed>.1&&!this.reduced)angle=this.drawRollingWheel(index,p,f,travel,travelSpeed);wheelInfo.push({x:+p.x.toFixed(2),y:+p.y.toFixed(2),radius:+p.radius.toFixed(2),angle:+angle.toFixed(4)});if(this.debug){ctx.save();ctx.strokeStyle='#84f5d0';ctx.lineWidth=.7;ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.moveTo(p.x-3,p.y);ctx.lineTo(p.x+3,p.y);ctx.moveTo(p.x,p.y-3);ctx.lineTo(p.x,p.y+3);const pointer=angle-Math.PI/2;ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+Math.cos(pointer)*p.radius,p.y+Math.sin(pointer)*p.radius);ctx.stroke();ctx.restore();}}
    this.canvas.dataset.wheels=JSON.stringify(wheelInfo);this.canvas.dataset.carBox=JSON.stringify({x:left,y:top,width,height});}
  drawPlants(f){const ctx=this.ctx,image=this.images.plants,t=Math.floor(this.ambient*INK_FPS)/INK_FPS;const maxHeight=this.h*(this.w/this.h>1.25?.34:.235)*Math.min(f.zoom,1.1),base=this.h+maxHeight*.11;const plantWidth=Math.max(...this.plants.map(p=>p.w/p.h*maxHeight)),margin=plantWidth+20,cycle=this.w+2*margin;
    for(let i=0;i<8;i++){const p=this.plants[i%this.plants.length],height=maxHeight*(.75+(i%3)*.12),width=height*p.w/p.h;const x=modulo(i*cycle/8-this.distance*f.scale*DEPTHS.plants,cycle)-margin;const angle=this.reduced?0:Math.sin(t*(.62+(i%3)*.05)+i*1.8)*.012;ctx.save();ctx.translate(x,base+(i%2)*11);ctx.rotate(angle);ctx.globalAlpha=.88+(i%2)*.1;ctx.drawImage(image,p.x,p.y,p.w,p.h,-width/2,-height,width,height);ctx.restore();}}
  render() {
    const ctx = this.ctx;
    if (!this.videoPlaceholderPainted) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.w || 1, this.h || 1);
    }
    if (!this.ready || !this.started) {
      this.canvas.dataset.phase = 'welcome';
      return;
    }

    const driftAge = this.elapsed - this.departureAt - DEPARTURE_DURATION;
    const opening = openingAt(this.sequenceElapsed);
    if (driftAge >= .35) {
      if (!this.videoPlaceholderPainted) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.w, this.h);
        this.videoPlaceholderPainted = true;
      }
      this.canvas.dataset.phase = 'drift-video';
      this.canvas.dataset.carExited = 'false';
      this.canvas.dataset.renderer = 'video';
    } else if (opening.front) {
      this.drawFront();
      this.canvas.dataset.phase = 'front';
    } else {
      const frame = this.layout();
      this.drawBackdrop(frame);
      this.drawCity(frame);
      this.drawRoad(frame);
      this.drawRailing(frame);
      this.drawSpeedLines(frame);
      this.drawCar(frame);
      this.drawPlants(frame);
      this.drawTunnel(frame);
      this.canvas.dataset.phase = this.elapsed < TUNNEL_DURATION ? 'tunnel' : 'city';
      this.canvas.dataset.cameraStage = this.elapsed < TUNNEL_DURATION ? 'close-exit' : this.elapsed < CITY_CAMERA_START ? 'pull-back' : 'journey';
      this.canvas.dataset.zoom = frame.zoom.toFixed(4);
      if (driftAge >= 0) {
        ctx.fillStyle = 'rgba(0,0,0,' + smooth(driftAge / .35) + ')';
        ctx.fillRect(0, 0, this.w, this.h);
      }
    }
    this.canvas.dataset.elapsed = this.elapsed.toFixed(3);
    this.canvas.dataset.sequence = this.sequenceElapsed.toFixed(3);
    this.canvas.dataset.speed = this.speed.toFixed(3);
    this.canvas.dataset.distance = this.distance.toFixed(3);
    this.canvas.dataset.frames = String(this.paintCount = (this.paintCount || 0) + 1);
  }
  setPaused(value){this.paused=value;}
  dispose(){cancelAnimationFrame(this.raf);removeEventListener('resize',this.resize);}
}

