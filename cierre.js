import {Pelicula} from './pelicula.js';
import {CITY_CAMERA_START,smooth} from './dinamica.js';
import {GalaxyHeart,GALAXY_REVEAL_SECONDS} from './galaxia.js';

export const END_TITLE='Dia uno de nuestro segundo año';
export const END_SUBTITLE='Te amo muchisimo mi princesita hermosa jsj';

export class CiudadRegreso {
  constructor(source){this.source=source;}
  prepare(){
    if(this.painter)return;if(!this.source.ready)throw Error('La ciudad todavía no está lista.');
    const source=this.source,painter=Object.create(Pelicula.prototype);
    Object.assign(painter,{images:source.images,carBounds:source.carBounds,plants:source.plants,city:source.city,windows:source.windows,canvas:{dataset:{}},departureAt:Infinity,debug:false});
    if(source.wheelTextures){painter.wheelTextures=source.wheelTextures;painter.carBody=source.carBody;}else painter.prepareWheels();
    this.painter=painter;
  }
  draw(ctx,width,height,motion,reduced=false){
    this.prepare();const p=this.painter;
    Object.assign(p,{ctx,w:width,h:height,reduced,elapsed:CITY_CAMERA_START+9,ambient:motion.time,distance:reduced?0:motion.cityDistance*440/650,speed:reduced?0:motion.speed*440/650});
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#080d24';ctx.fillRect(0,0,width,height);
    const frame=p.layout();p.drawBackdrop(frame);p.drawCity(frame);p.drawRoad(frame);p.drawRailing(frame);p.drawCar(frame);p.drawPlants(frame);
    const car=JSON.parse(p.canvas.dataset.carBox);
    return {season:'ciudad',index:-1,car:{left:car.x,top:car.y,width:car.width,height:car.height},pass:null,time:motion.time,distance:motion.distance,speed:motion.speed,camera:{angle:0,zoom:1},snow:0};
  }
}

export class FinalAniversario {
  constructor(root,onAnnounce=()=>{}){
    this.root=root;this.title=root.querySelector('#ending-title');this.subtitle=root.querySelector('#ending-subtitle');this.heart=root.querySelector('#love-heart');this.onAnnounce=onAnnounce;
    this.galaxy=new GalaxyHeart(this.heart,root.querySelector('#ending-atmosphere'));
  }
  prepare(){return this.galaxy.prepare();}
  render(state,reduced=false){
    const age=state.endingAge;if(this.previousAge!==undefined&&age<this.previousAge)this.announced=false;this.previousAge=age;this.root.hidden=age<0;this.root.dataset.phase=state.phase;
    if(age<0)return;
    this.title.style.opacity=String(smooth(age/.9));this.subtitle.style.opacity=String(smooth((age-.65)/1));
    const heartAge=age-1.35;this.heart.style.opacity=heartAge<0?'0':'1';this.heart.style.transform='none';
    this.galaxy.render(heartAge,reduced);
    this.root.dataset.heartAge=Math.max(0,heartAge).toFixed(3);
    this.root.dataset.heartReady=String(heartAge>=GALAXY_REVEAL_SECONDS);
    if(!this.announced){this.announced=true;this.onAnnounce(`${END_TITLE}. ${END_SUBTITLE}`);}
  }
}
