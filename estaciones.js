import {Pelicula} from './pelicula.js';
import {WHEELS,DEPTHS,modulo,smooth} from './dinamica.js';
import {anniversaryState,rapidSeasonState,boostCamera,QUESTION_AT} from './aniversario.js';

export const SEASON_SECONDS=10;
export const PASS_SECONDS=.9;
export const ENTRY_SECONDS=PASS_SECONDS/2;
export const TERRAIN_SPEED=.085;
export const SEASONS=[
  {id:'primavera',name:'Primavera',sun:'255,239,209',ambient:'117,149,100',bounce:'133,192,92',road:'74,86,72',shadow:.42},
  {id:'verano',name:'Verano',sun:'255,209,122',ambient:'193,149,76',bounce:'233,190,110',road:'91,86,71',shadow:.62},
  {id:'otono',name:'Otoño',sun:'255,185,95',ambient:'165,109,65',bounce:'194,119,53',road:'87,65,46',shadow:.51},
  {id:'invierno',name:'Invierno',sun:'216,237,255',ambient:'96,140,174',bounce:'236,248,255',road:'64,81,95',shadow:.28},
];
export function seasonState(time){
  const t=Math.max(0,time),index=Math.floor(t/SEASON_SECONDS)%SEASONS.length;
  const boundary=Math.round(t/SEASON_SECONDS)*SEASON_SECONDS;
  const age=t-boundary;
  const pass=boundary>0&&Math.abs(age)<PASS_SECONDS/2?(age+PASS_SECONDS/2)/PASS_SECONDS:null;
  const to=pass===null?index:Math.round(boundary/SEASON_SECONDS)%SEASONS.length;
  const from=pass===null?index:modulo(to-1,SEASONS.length);
  // El cambio queda oculto por la parte opaca de la montaña.
  const mix=pass===null?0:age<0?0:1;
  return {index,season:SEASONS[index],pass,from,to,mix,boundary};
}
export function rockPlacement(width,height,pass){
  const scale=Math.max(height*1.05/1024,width*1.28/1132),w=1536*scale,h=1024*scale;
  return {x:width-(width+w)*pass,y:(height-h)/2,width:w,height:h,scale};
}
export const journeySpeed=time=>650-500*Math.exp(-Math.max(0,time)/1.1);
export const journeyDistance=time=>650*Math.max(0,time)-550*(1-Math.exp(-Math.max(0,time)/1.1));
const makeCanvas=(width,height)=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
const noise=seed=>modulo(Math.sin(seed*127.1+311.7)*43758.5453,1);
const blendRGB=(a,b,mix)=>a.split(',').map((value,i)=>Math.round(Number(value)*(1-mix)+Number(b.split(',')[i])*mix)).join(',');
const opaqueSurface=image=>{
  const c=makeCanvas(image.naturalWidth||image.width,image.naturalHeight||image.height),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const p=ctx.getImageData(0,0,c.width,c.height);for(let i=3;i<p.data.length;i+=4)if(p.data[i]>=240)p.data[i]=255;ctx.putImageData(p,0,0);c.naturalWidth=c.width;c.naturalHeight=c.height;return c;
};
export const snowCount=(width,height)=>Math.min(900,Math.max(420,Math.floor(width*height/1200)));
export function spritePair(image){
  const c=makeCanvas(image.naturalWidth||image.width,image.naturalHeight||image.height),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const {data}=ctx.getImageData(0,0,c.width,c.height);let best=0,run=0,cut=-1;
  for(let x=Math.floor(c.width*.4);x<c.width*.73;x++){
    let empty=true;for(let y=0;y<c.height;y++)if(data[(y*c.width+x)*4+3]>2){empty=false;break;}
    if(empty){run++;if(run>best){best=run;cut=x-Math.floor(run/2);}}else run=0;
  }
  if(best<4)throw Error('Los sprites necesitan un espacio transparente completo.');
  const bounds=(start,end)=>{let x0=end,y0=c.height,x1=start,y1=0;for(let y=0;y<c.height;y++)for(let x=start;x<end;x++)if(data[(y*c.width+x)*4+3]>2){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}return{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};};
  return {cut,sprites:[bounds(0,cut),bounds(cut,c.width)]};
}

export class SeasonRenderer {
  constructor(images){
    const car=makeCanvas(images.car.naturalWidth||images.car.width,images.car.naturalHeight||images.car.height),carContext=car.getContext('2d',{willReadFrequently:true});
    carContext.drawImage(images.car,0,0);
    const coverage=carContext.getImageData(0,0,car.width,car.height);
    for(let i=3;i<coverage.data.length;i+=4)if(coverage.data[i]>=240)coverage.data[i]=255;
    carContext.putImageData(coverage,0,0);car.naturalWidth=car.width;car.naturalHeight=car.height;
    this.images={...images,car};
    this.images.montana=opaqueSurface(images.montana);
    for(const season of SEASONS)this.images['terreno-'+season.id]=opaqueSurface(images['terreno-'+season.id]);
    this.pairs=SEASONS.map(s=>spritePair(images['sprites-'+s.id]));
    this.treePaints=SEASONS.map((s,index)=>[.22,.07].map(amount=>{
      const b=this.pairs[index].sprites[0],c=makeCanvas(b.w,b.h),ctx=c.getContext('2d');
      ctx.drawImage(images['sprites-'+s.id],b.x,b.y,b.w,b.h,0,0,b.w,b.h);
      const haze=['174,207,181','192,211,199','221,179,130','194,216,232'][index];
      ctx.globalCompositeOperation='source-atop';ctx.fillStyle=`rgba(${haze},${amount})`;ctx.fillRect(0,0,b.w,b.h);ctx.globalCompositeOperation='source-over';return c;
    }));
    const sites=[
      [[.14,.704,.24],[.23,.72,.17],[.77,.70,.27]],
      [[.51,.70,.29],[.70,.66,.21],[.86,.71,.24]],
      [[.18,.72,.26],[.27,.725,.18],[.81,.717,.24]],
      [[.42,.72,.23],[.62,.71,.27],[.89,.725,.18]],
    ];
    this.groundPlants=SEASONS.map((season,index)=>{
      const image=this.images['terreno-'+season.id],context=image.getContext('2d');
      const definitions=sites[index].map((s,i)=>({kind:'tree',u:s[0],v:s[1],size:s[2],rootAt:.86,seed:i+index*17}));
      for(const [i,u] of (index===1?[.47,.59,.78,.92]:[.12,.35,.66,.91]).entries())definitions.push({kind:'shrub',u,v:.725,size:.055+noise(i+57)*.025,rootAt:.87,seed:i+61+index*17});
      return definitions.map(site=>{
        const source=this.pairs[index].sprites[site.kind==='tree'?0:1],h=image.height*site.size,w=h*source.w/source.h,x=site.u*image.width,y=site.v*image.height;
        if(context.getImageData(Math.round(x),Math.round(y),1,1).data[3]<250)throw Error('Una planta no tiene una superficie sólida de apoyo.');
        return {...site,x,y,w,h,source,mirror:site.seed%2===0};
      });
    });
    this.contactShadows=SEASONS.map((season,index)=>{
      const c=makeCanvas(128,32),ctx=c.getContext('2d');ctx.translate(64,16);ctx.scale(1,.22);const g=ctx.createRadialGradient(0,0,0,0,0,58);g.addColorStop(0,index===3?'#253d5930':'#332a2045');g.addColorStop(1,'#253d5900');ctx.fillStyle=g;ctx.fillRect(-64,-72,128,144);return c;
    });
    Pelicula.prototype.prepareWheels.call(this);
    this.carPaint=makeCanvas(900,375);
    this.snowBrushes=[0,1,2].map(i=>{
      const c=makeCanvas(32,32),ctx=c.getContext('2d'),g=ctx.createRadialGradient(14+i,14-i,1,16,16,14);
      g.addColorStop(0,'#ffffffee');g.addColorStop(.23,'#f5fbffcc');g.addColorStop(.57,'#eff8ff45');g.addColorStop(1,'#eff8ff00');ctx.fillStyle=g;ctx.fillRect(0,0,32,32);return c;
    });
    this.lights=SEASONS.map(s=>{
      const c=makeCanvas(900,375),ctx=c.getContext('2d');
      ctx.fillStyle=`rgba(${s.ambient},.07)`;ctx.fillRect(0,0,900,375);
      const sun=ctx.createLinearGradient(830,0,220,300);sun.addColorStop(0,`rgba(${s.sun},${s.id==='verano'?.2:.14})`);sun.addColorStop(.64,`rgba(${s.sun},.035)`);sun.addColorStop(1,`rgba(${s.sun},0)`);ctx.fillStyle=sun;ctx.fillRect(0,0,900,375);
      const bounce=ctx.createLinearGradient(0,375,0,150);bounce.addColorStop(0,`rgba(${s.bounce},${s.id==='invierno'?.2:.1})`);bounce.addColorStop(1,`rgba(${s.bounce},0)`);ctx.fillStyle=bounce;ctx.fillRect(0,0,900,375);
      return c;
    });
  }

  strip(ctx,image,scale,top,offset,width,source={x:0,y:0,w:image.naturalWidth||image.width,h:image.naturalHeight||image.height}){
    const span=source.w*scale,phase=modulo(offset,span*2),margin=this.frameMargin||0;
    for(let tile=-Math.ceil(margin/span)-1;tile*span-phase<width+margin;tile++){
      const x=tile*span-phase;if(x+span<-margin)continue;
      const mirror=Math.abs(tile)%2===1;ctx.save();ctx.translate(x+(mirror?span:0),top);ctx.scale(mirror?-1:1,1);ctx.drawImage(image,source.x,source.y,source.w,source.h,0,0,span,source.h*scale);ctx.restore();
    }
  }

  terrainLayout(width,height,distance,index){
    const image=this.images['terreno-'+SEASONS[index].id],scale=Math.max(width/image.width,height/image.height),span=image.width*scale,phase=modulo(distance*TERRAIN_SPEED,span*2),top=height*.745-image.height*scale*.74,tiles=[],margin=this.frameMargin||0;
    for(let tile=-Math.ceil(margin/span)-1;tile*span-phase<width+margin;tile++){const x=tile*span-phase;if(x+span<-margin)continue;tiles.push({id:tile,x,mirror:Math.abs(tile)%2===1});}
    return {image,scale,span,top,tiles};
  }

  trees(width,height,time,distance,index,reduced){
    const plane=this.terrainLayout(width,height,distance,index),trees=[];
    for(const tile of plane.tiles)for(const site of this.groundPlants[index]){
      if(site.kind!=='tree')continue;
      const rootX=tile.x+(tile.mirror?plane.image.width-site.x:site.x)*plane.scale,base=plane.top+site.y*plane.scale,h=site.h*plane.scale,w=site.w*plane.scale;
      trees.push({key:`${tile.id}:${site.seed}`,x:rootX-w/2,rootX,base,top:base-site.rootAt*h,w,h,sourceX:site.x,sourceY:site.y,rootAt:site.rootAt,mirror:tile.mirror!==site.mirror});
    }
    return trees;
  }

  drawClouds(ctx,width,height,time,reduced){
    const image=this.images.nubes,ratio=image.width/image.height;
    for(let i=0;i<3;i++){
      const h=height*[.11,.17,.085][i],w=h*ratio,span=width+w*2;
      const x=modulo([.17,.29,.76][i]*span-(reduced?0:time*[5,9,3][i]),span)-w;
      ctx.save();ctx.globalAlpha*=[.28,.2,.34][i];ctx.drawImage(image,x,height*[.018,.047,.01][i],w,h);ctx.restore();
    }
  }

  coverRoots(ctx,ground,site){
    const half=site.w*.58,top=site.y-site.h*.025,bottom=Math.min(ground.height,site.y+site.h*(1-site.rootAt+.055));
    const left=Math.max(0,site.x-half),right=Math.min(ground.width,site.x+half);
    ctx.save();ctx.beginPath();ctx.moveTo(left,bottom);ctx.lineTo(left,site.y);
    for(let i=0;i<=12;i++){const x=left+(right-left)*i/12,y=site.y-site.h*(.014+.004*Math.sin(i*1.9+site.seed));ctx.lineTo(x,y);}
    ctx.lineTo(right,bottom);ctx.closePath();ctx.clip();ctx.drawImage(ground,left,top,right-left,bottom-top,left,top,right-left,bottom-top);ctx.restore();
    ctx.drawImage(this.contactShadows[site.season],site.x-site.w*.16,site.y-site.h*.008,site.w*.32,site.h*.035);
  }

  drawGroundedPlant(ctx,ground,site,index,time,reduced){
    ctx.save();ctx.translate(site.x,site.y);ctx.rotate(reduced?0:Math.sin(Math.floor(time*12)/12*(1.15+noise(site.seed+5)*.5)+site.seed)*.007);if(site.mirror)ctx.scale(-1,1);
    if(site.kind==='tree')ctx.drawImage(this.treePaints[index][site.size<.23?0:1],-site.w/2,-site.h*site.rootAt,site.w,site.h);
    else{const source=site.source;ctx.drawImage(this.images['sprites-'+SEASONS[index].id],source.x,source.y,source.w,source.h,-site.w/2,-site.h*site.rootAt,site.w,site.h);}
    ctx.restore();this.coverRoots(ctx,ground,{...site,season:index});
  }

  drawTerrain(ctx,width,height,time,distance,index,reduced){
    const plane=this.terrainLayout(width,height,distance,index);
    for(const tile of plane.tiles){
      ctx.save();ctx.translate(tile.x+(tile.mirror?plane.span:0),plane.top);ctx.scale(tile.mirror?-plane.scale:plane.scale,plane.scale);ctx.drawImage(plane.image,0,0);
      for(const site of this.groundPlants[index])this.drawGroundedPlant(ctx,plane.image,site,index,time,reduced);
      ctx.restore();
    }
    return this.trees(width,height,time,distance,index,reduced);
  }

  drawDepthMist(ctx,width,height,index){
    const color=['191,222,209','194,222,224','234,196,151','211,225,234'][index],gradient=ctx.createLinearGradient(0,height*.18,0,height*.75);
    gradient.addColorStop(0,`rgba(${color},0)`);gradient.addColorStop(.55,`rgba(${color},${index===3?.3:.13})`);gradient.addColorStop(1,`rgba(${color},0)`);
    ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
  }

  drawWater(ctx,width,height,time,index,reduced){
    if(reduced)return;
    ctx.save();const opacity=ctx.globalAlpha;ctx.lineWidth=1;ctx.strokeStyle=index===2?'#ffe1ae55':'#e6fbff55';
    for(let i=0;i<30;i++){
      const x=modulo(i*107.7-time*(index===3?2:16),width),y=height*(.55+(i%9)*.015);
      ctx.globalAlpha=opacity*(.5+.5*Math.sin(time*1.4+i))*(index===3?.18:.35);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+9+i%21,y);ctx.stroke();
    }ctx.restore();
  }

  drawRoad(ctx,width,height,distance,index,light={from:index,to:index,mix:0}){
    const top=height*.745,image=this.images.asphalt,tile=Math.max(240,Math.min(450,width*.7)),scale=tile/image.width,margin=this.frameMargin||0;
    ctx.save();ctx.beginPath();ctx.rect(-margin,top,width+margin*2,height-top+margin);ctx.clip();ctx.fillStyle=`rgb(${blendRGB(SEASONS[light.from].road,SEASONS[light.to].road,light.mix)})`;ctx.fillRect(-margin,top,width+margin*2,height-top+margin);ctx.globalAlpha=.4;
    for(let row=0;row<(height-top+margin)/tile;row++)this.strip(ctx,image,scale,top+row*tile,distance,width);
    ctx.globalAlpha=1;
    const shade=ctx.createLinearGradient(0,top,0,height);shade.addColorStop(0,'#07101944');shade.addColorStop(1,'#07101980');ctx.fillStyle=shade;ctx.fillRect(-margin,top,width+margin*2,height-top+margin);
    const step=Math.max(160,width*.28),phase=modulo(distance,step);ctx.fillStyle=`rgba(${blendRGB(light.from===3?'220,231,237':'244,232,194',light.to===3?'220,231,237':'244,232,194',light.mix)},.76)`;
    for(let x=-step-Math.ceil(margin/step)*step;x<width+step+margin;x+=step)ctx.fillRect(x-phase,height*.91,step*.38,Math.max(2,height*.004));
    ctx.restore();
    ctx.fillStyle=`rgb(${blendRGB(light.from===3?'228,239,244':'202,191,165',light.to===3?'228,239,244':'202,191,165',light.mix)})`;ctx.fillRect(-margin,top,width+margin*2,Math.max(2,height*.004));
  }

  carPlacement(width,height,time,reduced){
    const w=Math.min(width*.48,height*.82),scale=w/900;
    const center=width*(reduced?.46:.36+.1*smooth(time/3.2));
    const bob=reduced?0:Math.sin(Math.floor(time*12)/12*8)*.45;
    const ground=height*.805+bob;
    return {left:center-w/2,top:ground-328*scale,width:w,height:375*scale,scale,ground};
  }

  drawCar(ctx,width,height,time,distance,index,reduced,light={from:index,to:index,mix:0},speed=journeySpeed(time),motion=null){
    const p=this.carPlacement(width,height,time,reduced),paint=this.carPaint.getContext('2d');
    if(!reduced){p.left+=width*(motion?.carShift||0);p.top+=Math.min(2,height*.003)*(motion?.launch||0);}
    paint.clearRect(0,0,900,375);paint.drawImage(reduced?this.images.car:this.carBody,0,0);
    this.ctx=paint;this.distance=distance/(p.scale*DEPTHS.road);this.speed=reduced?0:speed/(p.scale*DEPTHS.road);
    if(!reduced)WHEELS.forEach((wheel,i)=>Pelicula.prototype.drawRollingWheel.call(this,i,{x:wheel.x,y:wheel.y,radius:wheel.radius},{scale:1},0,0));
    const mixed=reduced?0:motion?.mixing||0;
    paint.globalCompositeOperation='source-atop';paint.globalAlpha=(1-light.mix)*(1-mixed);paint.drawImage(this.lights[light.from],0,0);if(light.mix>0){paint.globalAlpha=light.mix*(1-mixed);paint.drawImage(this.lights[light.to],0,0);}
    if(mixed>0)for(const lighting of this.lights){paint.globalAlpha=mixed/4;paint.drawImage(lighting,0,0);}paint.globalAlpha=1;paint.globalCompositeOperation='source-over';
    const shadowLevel=(SEASONS[light.from].shadow*(1-light.mix)+SEASONS[light.to].shadow*light.mix)*(1-mixed)+SEASONS.reduce((sum,s)=>sum+s.shadow,0)/4*mixed;
    const shadowPosition=(light.from*(1-light.mix)+light.to*light.mix)*(1-mixed)+1.5*mixed;
    ctx.save();ctx.translate(p.left+p.width*.5+shadowPosition*2,p.ground+2);ctx.scale(1,.06);const shadow=ctx.createRadialGradient(0,0,0,0,0,p.width*.5);shadow.addColorStop(0,`rgba(7,13,20,${shadowLevel})`);shadow.addColorStop(1,'rgba(7,13,20,0)');ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(0,0,p.width*.5,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.drawImage(this.carPaint,p.left,p.top,p.width,p.height);
    return p;
  }

  drawSnow(ctx,width,height,time,front){
    const count=snowCount(width,height),start=front?Math.floor(count*.85):0,end=front?count:Math.floor(count*.85);
    ctx.save();const opacity=ctx.globalAlpha;ctx.fillStyle=front?'#f6faffcc':'#eff7ffad';ctx.beginPath();
    for(let i=start;i<end;i++){
      const depth=front?.75+noise(i+7)*.25:.15+noise(i+7)*.55,fall=32+depth*105,wind=17+depth*95+journeySpeed(time)*.18*depth;
      const x=modulo(noise(i+13)*(width+80)-time*wind+Math.sin(time*(.3+noise(i+77)*.3)+i)*height*.035,width+80)-40;
      const y=modulo(noise(i+193)*(height+40)+time*fall,height+40)-20,r=(front?2: .55)+depth*(front?2.6:1.7)*(.7+noise(i+83)*.6);
      if(front){ctx.globalAlpha=opacity*(.35+noise(i+37)*.5);const size=r*(2.3+noise(i+83)*.7);ctx.drawImage(this.snowBrushes[i%3],x-size/2,y-size/2,size,size);}
      else{ctx.moveTo(x+r,y);ctx.ellipse(x,y,r,r*(1.05+depth*.45),.35+noise(i+23)*.45,0,Math.PI*2);}
    }if(!front)ctx.fill();ctx.restore();
  }

  drawParticles(ctx,width,height,time,distance,index,trees,reduced){
    if(reduced||index===1)return;
    if(index===3){this.drawSnow(ctx,width,height,time,true);return;}
    for(let treeIndex=0;treeIndex<trees.length;treeIndex++)for(let i=0;i<8;i++){
      const tree=trees[treeIndex],life=modulo(time*.22+i*.127+treeIndex*.173,1),fall=life*life;
      const x=tree.x+tree.w*(.2+(i%4)*.18)-fall*width*.17+Math.sin(life*9+i)*15,y=tree.top+tree.h*(.1+(i%3)*.12)+fall*tree.h*1.4;
      ctx.save();ctx.translate(x,y);ctx.rotate(time*(1.5+i%3)+i);ctx.globalAlpha*=Math.min(1,life*12,(1-life)*7);ctx.fillStyle=index===2?['#d86c26','#bd3e20','#e2a634'][i%3]:['#f4b8c9','#f8e4e8','#eab1c7'][i%3];ctx.beginPath();ctx.ellipse(0,0,index===2?4.2:3,1.5+Math.abs(Math.cos(time*2+i))*1.6,0,0,Math.PI*2);ctx.fill();ctx.restore();
    }
  }

  drawScenery(ctx,width,height,time,distance,index,reduced,local=modulo(time,SEASON_SECONDS)/SEASON_SECONDS){
    const image=this.images[SEASONS[index].id],margin=this.frameMargin||0,scale=Math.max(width*1.12/image.width,(width+2*margin)/image.width,(height+2*margin)/image.height),excess=image.width*scale-width,travel=Math.max(0,Math.min(excess*.8,width*.15,excess-2*margin)),offset=(excess-travel)/2+travel*(reduced?.5:local),top=Math.max(height+margin-image.height*scale,Math.min(-margin,(height-image.height*scale)*.32));
    ctx.drawImage(image,-offset,top,image.width*scale,image.height*scale);
    this.drawClouds(ctx,width,height,time,reduced);this.drawWater(ctx,width,height,time,index,reduced);this.drawDepthMist(ctx,width,height,index);
    return this.drawTerrain(ctx,width,height,time,distance,index,reduced);
  }

  drawMountain(ctx,width,height,pass){
    const p=rockPlacement(width,height,pass);
    ctx.drawImage(this.images.montana,p.x,p.y,p.width,p.height);
  }

  drawBlendedScenery(ctx,width,height,time,distance,state,reduced,clock){
    this.drawScenery(ctx,width,height,time,distance,state.from,reduced,modulo(clock,SEASON_SECONDS)/SEASON_SECONDS);
    if(state.from!==state.to&&state.mix>0){ctx.save();ctx.globalAlpha=state.mix;this.drawScenery(ctx,width,height,time,distance,state.to,reduced,modulo(clock,SEASON_SECONDS)/SEASON_SECONDS);ctx.restore();}
  }

  drawMotionBackdrop(ctx,width,height,time,distance,state,reduced,clock,motion){
    const intensity=reduced?0:motion?.mixing||0;
    if(intensity<.001){this.backdropAge=null;this.drawBlendedScenery(ctx,width,height,time,distance,state,reduced,clock);return;}
    const padding=Math.ceil(Math.max(width,height)*.65+40),scale=Math.min(.5,1000/(width+padding*2));
    const w=Math.ceil((width+padding*2)*scale),h=Math.ceil((height+padding*2)*scale);
    if(!this.motionFrames||this.motionFrames[0].width!==w||this.motionFrames[0].height!==h){this.motionFrames=[makeCanvas(w,h),makeCanvas(w,h)];this.backdropAge=null;}
    const [incoming,history]=this.motionFrames,paint=incoming.getContext('2d');
    paint.setTransform(scale,0,0,scale,padding*scale,padding*scale);paint.fillStyle=`rgb(${SEASONS[state.index].ambient})`;paint.fillRect(-padding,-padding,width+2*padding,height+2*padding);
    this.drawBlendedScenery(paint,width,height,time,distance,state,reduced,clock);
    const trail=history.getContext('2d'),reset=this.backdropAge===null||motion.boostAge<this.backdropAge||motion.boostAge-this.backdropAge>.25;
    const dt=reset?1/60:Math.max(1/120,motion.boostAge-this.backdropAge);
    trail.save();trail.filter=`blur(${9*scale*intensity}px)`;trail.globalAlpha=reset?1:1-Math.pow(.93*intensity,dt*60);trail.drawImage(incoming,0,0);trail.restore();this.backdropAge=motion.boostAge;
    ctx.drawImage(history,-padding,-padding,width+padding*2,height+padding*2);
  }

  drawSpeedLines(ctx,width,height,time,level=1){
    const strength=smooth(time/.6)*level,margin=this.frameMargin||0;ctx.save();ctx.lineWidth=1;ctx.strokeStyle='#f7f6ee';
    for(let i=0;i<30;i++){
      const y=noise(i+19)*(height+margin*2)-margin,x=modulo(noise(i+31)*width-time*(900+noise(i+57)*1300),width*1.4+margin*2)-width*.2-margin;
      ctx.globalAlpha=strength*(.08+noise(i+77)*.22);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+width*(.09+noise(i+89)*.18),y);ctx.stroke();
    }ctx.restore();
  }

  draw(ctx,width,height,elapsed,reduced=false,motion=null){
    ctx.clearRect(0,0,width,height);
    const time=Math.max(0,elapsed),driveTime=motion?.driveTime??time,clock=motion?.seasonTime??time;
    const state=motion?.fastScenery&&!reduced?rapidSeasonState(clock):seasonState(reduced&&motion?.fastScenery?QUESTION_AT:clock);
    const distance=reduced?0:motion?.distance??journeyDistance(driveTime),speed=reduced?0:motion?.speed??journeySpeed(driveTime),light={from:state.from,to:state.to,mix:state.mix};
    const focusCar=this.carPlacement(width,height,driveTime,reduced);if(!reduced)focusCar.left+=width*(motion?.carShift||0);
    const camera=boostCamera(width,height,focusCar,motion?.boostAge??0,reduced,motion?.cameraAmount??1);
    this.frameMargin=camera.margin;ctx.save();ctx.translate(camera.screenX,camera.screenY);ctx.rotate(camera.angle);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.pivotX,-camera.pivotY);
    this.drawMotionBackdrop(ctx,width,height,time,distance,state,reduced,clock,motion);
    this.drawRoad(ctx,width,height,distance,state.index,light);
    if(motion?.fastScenery&&!reduced)this.drawSpeedLines(ctx,width,height,motion.boostAge,smooth((speed-650)/3350));
    const weather=motion?.mixing>0?SEASONS.map((season,index)=>[index,((index===state.from?1-state.mix:0)+(index===state.to?state.mix:0))*(1-motion.mixing)+motion.mixing/4]):state.from===state.to?[[state.index,1]]:[[state.from,1-state.mix],[state.to,state.mix]];
    if(!reduced)for(const [index,opacity] of weather)if(index===3&&opacity>0){ctx.save();ctx.globalAlpha=opacity;this.drawSnow(ctx,width,height,time,false);ctx.restore();}
    const car=this.drawCar(ctx,width,height,driveTime,distance,state.index,reduced,light,speed,motion);
    for(const [index,opacity] of weather)if(opacity>0){ctx.save();ctx.globalAlpha=opacity;this.drawParticles(ctx,width,height,time,distance,index,this.trees(width,height,time,distance,index,reduced),reduced);ctx.restore();}
    const pass=reduced||motion?.hideMountains?null:clock<ENTRY_SECONDS?.5+clock/PASS_SECONDS:state.pass;
    if(pass!==null)this.drawMountain(ctx,width,height,pass);
    ctx.restore();
    return {season:SEASONS[state.index].id,index:state.index,car,pass,time,distance,speed,camera,snow:!reduced&&weather.some(([index,opacity])=>index===3&&opacity>0)?snowCount(width,height):0};
  }
}

const asset=file=>new URL(`assets/runtime/estaciones/${file}`,import.meta.url).href;
const loadImage=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('No se pudo cargar el paisaje.'));image.src=src;});
export class ViajeEstaciones {
  constructor(canvas,reduced=false,onEnter=()=>{},onFrame=()=>{}){
    this.canvas=canvas;this.context=canvas.getContext('2d');this.reduced=reduced;this.onEnter=onEnter;this.onFrame=onFrame;this.entered=false;this.elapsed=0;this.acceptedAt=null;this.hidden=document.hidden;
    this.resize=()=>{this.width=innerWidth;this.height=innerHeight;const dpr=Math.min(devicePixelRatio,2);canvas.width=Math.round(this.width*dpr);canvas.height=Math.round(this.height*dpr);this.context.setTransform(dpr,0,0,dpr,0,0);if(this.entered)this.render();};
    addEventListener('resize',this.resize);this.resize();
  }
  prepare(){
    if(this.renderer)return Promise.resolve();if(this.loading)return this.loading;
    const files=Object.fromEntries(SEASONS.flatMap(s=>[[s.id,asset(s.id+'.jpg')],['sprites-'+s.id,asset('sprites-'+s.id+'.webp')],['terreno-'+s.id,asset('terreno-'+s.id+'.webp')]]));
    Object.assign(files,{nubes:asset('nubes.webp'),montana:asset('montana.webp'),car:new URL('assets/runtime/porsche-pintado.png',import.meta.url).href,asphalt:new URL('assets/runtime/derrape/asfalto.jpg',import.meta.url).href});
    this.loading=Promise.all(Object.entries(files).map(async([key,url])=>[key,await loadImage(url)])).then(entries=>{this.renderer=new SeasonRenderer(Object.fromEntries(entries));this.canvas.dataset.ready='true';}).catch(error=>{this.loading=null;throw error;});
    return this.loading;
  }
  start(){this.entered=true;this.canvas.hidden=false;this.canvas.inert=false;this.previous=performance.now();this.frame=this.frame.bind(this);this.render();this.raf=requestAnimationFrame(this.frame);}
  frame(now){const dt=Math.min(.1,(now-this.previous)/1000);this.previous=now;if(!this.hidden){this.elapsed+=dt;this.render();}this.raf=requestAnimationFrame(this.frame);}
  render(){
    if(!this.renderer)return;
    const story=anniversaryState(this.elapsed,this.acceptedAt);let state;
    if(story.phase==='ending'){
      this.context.fillStyle='#000';this.context.fillRect(0,0,this.width,this.height);state={...this.lastFrame,index:-1,car:this.lastFrame?.car??{left:0,top:0,width:0,height:0},camera:{angle:0,zoom:1},snow:0,season:'ciudad',pass:null,speed:0,distance:story.distance};
    }else if(story.returnCity&&this.returnRenderer){state=this.returnRenderer.draw(this.context,this.width,this.height,story,this.reduced);}
    else state=this.renderer.draw(this.context,this.width,this.height,this.elapsed,this.reduced,story);
    if(story.returnPass!==null&&!this.reduced)this.renderer.drawMountain(this.context,this.width,this.height,story.returnPass);
    if(story.returnPass!==null&&!this.reduced)state.pass=story.returnPass;
    if(story.black>0){this.context.save();this.context.globalAlpha=story.black;this.context.fillStyle='#000';this.context.fillRect(0,0,this.width,this.height);this.context.restore();}
    if(story.returnCity&&!this.returnReleased){this.renderer.motionFrames=null;this.returnReleased=true;}
    this.lastFrame=state;this.waiting=story.waiting;
    if(!this.enteredSignaled){this.enteredSignaled=true;this.onEnter();}
    this.canvas.dataset.season=state.season;this.canvas.dataset.elapsed=this.elapsed.toFixed(3);this.canvas.dataset.pass=state.pass===null?'none':state.pass.toFixed(3);this.canvas.dataset.car=JSON.stringify(state.car);
    this.canvas.dataset.snow=String(state.snow);
    this.canvas.dataset.phase=story.phase;this.canvas.dataset.speed=state.speed.toFixed(3);this.canvas.dataset.distance=state.distance.toFixed(3);this.canvas.dataset.cameraAngle=(state.camera.angle*180/Math.PI).toFixed(2);this.canvas.dataset.cameraZoom=state.camera.zoom.toFixed(3);
    this.canvas.dataset.backgroundMix=story.mixing.toFixed(3);this.canvas.dataset.boostAge=story.boostAge.toFixed(3);
    this.canvas.dataset.black=story.black.toFixed(3);this.canvas.dataset.returnCity=String(story.returnCity);
    this.onFrame(story);
    if(this.lastSeason!==state.index){this.lastSeason=state.index;this.canvas.setAttribute('aria-label',state.index===-1?'El Porsche rosa regresa a la ciudad del inicio.':`El Porsche rosa avanza de perfil por un paisaje de ${SEASONS[state.index].name.toLowerCase()}.`);}
  }
  accept(){if(!this.entered||this.acceptedAt!==null||!anniversaryState(this.elapsed).choices)return false;this.acceptedAt=this.elapsed;this.waiting=false;this.render();return true;}
  pause(hidden){this.hidden=hidden;this.previous=performance.now();}
  setReducedMotion(value){this.reduced=value;if(this.entered)this.render();}
  dispose(){cancelAnimationFrame(this.raf);removeEventListener('resize',this.resize);}
}
