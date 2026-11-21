import {smooth,modulo} from './dinamica.js';

export const GALAXY_PARTICLES=192,GALAXY_REVEAL_SECONDS=4.5;
const noise=seed=>modulo(Math.sin(seed*127.1+311.7)*43758.5453,1);
export function galaxyParticle(index,time){
  const radius=.24+.76*Math.sqrt(noise(index+41)),phase=noise(index+7)*Math.PI*2+time*(.035+.025/(radius+.3));
  const x=index<144?.5+Math.sin(phase)**3*.38*radius:noise(index+381)+Math.sin(time*.13+index)*.002;
  const heartY=13*Math.cos(phase)-5*Math.cos(phase*2)-2*Math.cos(phase*3)-Math.cos(phase*4);
  const y=index<144?.49-heartY/17*.47*radius:noise(index+631)+Math.cos(time*.11+index)*.002;
  return {x,y,size:1.7+noise(index+73)*5,alpha:.35+noise(index+93)*.5,delay:noise(index+117)*1.5,color:index%3};
}

export class GalaxyHeart {
  constructor(canvas,atmosphere=null){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.atmosphere=atmosphere;
    this.brushes=['#fff4fe','#ffb7e3','#c5d5ff'].map(color=>{const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'#fff');g.addColorStop(.12,color);g.addColorStop(.33,color+'99');g.addColorStop(1,color+'00');ctx.fillStyle=g;ctx.fillRect(0,0,32,32);return c;});
  }
  prepare(){
    if(this.image)return Promise.resolve();if(this.loading)return this.loading;
    this.loading=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{this.image=image;this.texture=this.lightTexture(image);resolve();};image.onerror=()=>{this.loading=null;reject(Error('No se pudo cargar el corazón de galaxia.'));};image.src=new URL('assets/runtime/corazon-galaxia.png',import.meta.url).href;});return this.loading;
  }
  lightTexture(image){
    const c=document.createElement('canvas');c.width=image.naturalWidth||image.width;c.height=image.naturalHeight||image.height;
    const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height);
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
      const at=(y*c.width+x)*4,brightness=Math.max(pixels.data[at],pixels.data[at+1],pixels.data[at+2]);
      const edge=Math.min(x/(c.width*.09),(c.width-1-x)/(c.width*.09),y/(c.height*.1),(c.height-1-y)/(c.height*.1));
      pixels.data[at+3]=Math.round(pixels.data[at+3]*smooth((brightness-35)/115)*smooth(edge));
    }ctx.putImageData(pixels,0,0);return c;
  }
  renderAtmosphere(age,reduced,reveal){
    if(!this.atmosphere)return;
    const cssWidth=this.atmosphere.clientWidth||1200,cssHeight=this.atmosphere.clientHeight||720,ratio=Math.min(1.25,1280/Math.max(cssWidth,cssHeight));
    const width=Math.round(cssWidth*ratio),height=Math.round(cssHeight*ratio);
    if(!this.atmosphereBase||this.atmosphere.width!==width||this.atmosphere.height!==height){
      this.atmosphere.width=width;this.atmosphere.height=height;
      const base=document.createElement('canvas');base.width=width;base.height=height;const p=base.getContext('2d');
      for(const [x,y,r,color] of [[.5,.65,.6,'255,137,205'],[.22,.71,.43,'117,144,244'],[.8,.56,.4,'176,113,213']]){
        const g=p.createRadialGradient(width*x,height*y,0,width*x,height*y,Math.max(width,height)*r);g.addColorStop(0,`rgba(${color},.065)`);g.addColorStop(1,`rgba(${color},0)`);p.fillStyle=g;p.fillRect(0,0,width,height);
      }this.atmosphereBase=base;
    }
    const ctx=this.atmosphere.getContext('2d');ctx.clearRect(0,0,width,height);if(age<0)return;
    ctx.save();ctx.globalAlpha=reveal;ctx.drawImage(this.atmosphereBase,0,0);ctx.globalCompositeOperation='screen';
    const time=reduced?0:age;
    for(let i=0;i<88;i++){
      const x=(noise(i+1003)+Math.sin(time*.022+i)*.0018)*width,y=(.08+noise(i+1207)*.9)*height,size=(.7+noise(i+1409)*1.5)*ratio;
      ctx.globalAlpha=reveal*(.08+noise(i+1613)*.2)*(y<height*.32?.5:1);ctx.drawImage(this.brushes[i%3],x-size,y-size,size*2,size*2);
    }ctx.restore();
  }
  render(age,reduced=false){
    const width=Math.max(1,Math.min(1200,Math.round((this.canvas.clientWidth||600)*Math.min(devicePixelRatio||1,1.5)))),height=Math.round(width*9/16);
    if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    const ctx=this.ctx,scale=width/1200,time=reduced?0:Math.max(0,age),reveal=reduced?1:smooth(age/GALAXY_REVEAL_SECONDS);
    this.renderAtmosphere(age,reduced,reveal);
    ctx.clearRect(0,0,width,height);if(age<0)return;
    if(this.image){if(!this.texture)this.texture=this.lightTexture(this.image);ctx.save();ctx.globalAlpha=reveal;ctx.drawImage(this.texture,0,0,width,height);ctx.restore();}
    ctx.save();ctx.globalCompositeOperation='screen';
    const glow=ctx.createRadialGradient(width*.5,height*.52,0,width*.5,height*.52,width*.17);glow.addColorStop(0,`rgba(255,222,247,${reveal*.07})`);glow.addColorStop(1,'#ff7ecb00');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    for(let i=0;i<GALAXY_PARTICLES;i++){
      const p=galaxyParticle(i,time),gather=reduced?1:smooth((age-p.delay)/2.7),angle=i*2.39996;
      const x=(p.x+(1-gather)*Math.cos(angle)*.3)*width,y=(p.y+(1-gather)*Math.sin(angle)*.38)*height,size=p.size*scale*(i%11===0?1.9:1);
      ctx.globalAlpha=p.alpha*gather*(i<144?.7:.5);ctx.drawImage(this.brushes[p.color],x-size,y-size,size*2,size*2);
      if(!reduced&&i<144){const before=galaxyParticle(i,time-.18);ctx.lineWidth=Math.max(.35,scale*.7);ctx.strokeStyle=['#fff6ff','#ffc2e9','#cad7ff'][p.color];ctx.globalAlpha*=.3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(before.x-p.x)*width,y+(before.y-p.y)*height);ctx.stroke();}
    }ctx.restore();
  }
}
