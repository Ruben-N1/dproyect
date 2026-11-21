import {smooth} from './dinamica.js';

export const ANNIVERSARY_LINES=[
  'Son solo algunos de los muchos momentos que pasamos juntos',
  'Todo momento contigo lo atesoro como no tienes idea',
  'Poniendolo en perspectiva',
  'Dos años son poco comparandolos con los muchos que nos esperan juntos',
  'Claro, si es que me permites seguir contigo a tu lado jsj',
  'Vas a permitirme seguir a tu lado otro año más?',
];
export const TEXT_START=1.25,TEXT_SECONDS=4,TEXT_GAP=2;
export const QUESTION_AT=TEXT_START+5*(TEXT_SECONDS+TEXT_GAP);
export const BRAKE_SECONDS=.65,SCENERY_RAMP_SECONDS=6;
export const PEAK_LINE='Este es solo un año más comparado con la vida que nos espera juntos';
export const PEAK_AT=5.5,PEAK_SECONDS=5,COAST_AT=PEAK_AT+PEAK_SECONDS+4,COAST_SECONDS=5;
export const RETURN_AT=COAST_AT+COAST_SECONDS,RETURN_SECONDS=.9,RETURN_CUT=RETURN_AT+RETURN_SECONDS/2;
export const CITY_CLEAR_AT=RETURN_AT+RETURN_SECONDS,CITY_BRAKE_AT=CITY_CLEAR_AT+2,CITY_BRAKE_SECONDS=.8;
export const CITY_STOP_AT=Math.round((CITY_BRAKE_AT+CITY_BRAKE_SECONDS)*1000)/1000,FADE_AT=Math.round((CITY_STOP_AT+.5)*1000)/1000,FADE_SECONDS=3.6,ENDING_AT=Math.round((FADE_AT+FADE_SECONDS+.35)*1000)/1000;
const speedAt=time=>650-500*Math.exp(-Math.max(0,time)/1.1);
const distanceAt=time=>650*Math.max(0,time)-550*(1-Math.exp(-Math.max(0,time)/1.1));
const stoppedDistance=()=>distanceAt(QUESTION_AT)+speedAt(QUESTION_AT)*BRAKE_SECONDS/3;
const smoothIntegral=(age,duration)=>{const u=Math.min(1,Math.max(0,age/duration));return duration*(u**3-u**4/2)+Math.max(0,age-duration);};
export const boostSpeed=age=>1400*(1-Math.exp(-Math.max(0,age)/.22))+2600*smooth(age/5.5);
export const boostDistance=age=>1400*(age-.22*(1-Math.exp(-age/.22)))+2600*smoothIntegral(age,5.5);
export const boostSeasonTurns=age=>.1*age+15.9*smoothIntegral(age,SCENERY_RAMP_SECONDS);
export function closingMotion(age){
  const coast=Math.max(0,age-COAST_AT),coastMix=smooth(coast/COAST_SECONDS);
  const cruiseDistance=boostDistance(COAST_AT)+4000*coast-3350*smoothIntegral(coast,COAST_SECONDS);
  const distanceAtBrake=boostDistance(COAST_AT)+4000*(CITY_BRAKE_AT-COAST_AT)-3350*smoothIntegral(CITY_BRAKE_AT-COAST_AT,COAST_SECONDS);
  const braking=Math.max(0,age-CITY_BRAKE_AT);
  const distance=age<COAST_AT?boostDistance(age):age<CITY_BRAKE_AT?cruiseDistance:distanceAtBrake+650*(braking-smoothIntegral(braking,CITY_BRAKE_SECONDS));
  const speed=age<COAST_AT?boostSpeed(age):age<CITY_BRAKE_AT?4000-3350*coastMix:650*(1-smooth(braking/CITY_BRAKE_SECONDS));
  const turns=age<COAST_AT?boostSeasonTurns(age):boostSeasonTurns(COAST_AT)+16*coast-15.9*smoothIntegral(coast,COAST_SECONDS);
  const cameraAmount=1-coastMix;
  const returnPass=age>=RETURN_AT&&age<RETURN_AT+RETURN_SECONDS?(age-RETURN_AT)/RETURN_SECONDS:null;
  const cityDistance=distance-(boostDistance(COAST_AT)+4000*(RETURN_CUT-COAST_AT)-3350*smoothIntegral(RETURN_CUT-COAST_AT,COAST_SECONDS));
  return {distance,speed,turns,cameraAmount,returnPass,returnCity:age>=RETURN_CUT,cityDistance:Math.max(0,cityDistance),black:smooth((age-FADE_AT)/FADE_SECONDS),endingAge:age-ENDING_AT};
}

export function anniversaryState(elapsed,acceptedAt=null){
  const time=Math.max(0,elapsed),questionAge=time-QUESTION_AT;
  const boost=acceptedAt!==null&&time>=acceptedAt,boostAge=boost?Math.round((time-acceptedAt)*1e9)/1e9:0;
  const brake=Math.min(BRAKE_SECONDS,Math.max(0,questionAge));
  const closing=boost?closingMotion(boostAge):null;
  const distance=boost?stoppedDistance()+closing.distance:questionAge<0?distanceAt(time):distanceAt(QUESTION_AT)+speedAt(QUESTION_AT)*(brake-brake*brake/BRAKE_SECONDS+brake**3/(3*BRAKE_SECONDS**2));
  const speed=boost?closing.speed:questionAge<0?speedAt(time):speedAt(QUESTION_AT)*(1-brake/BRAKE_SECONDS)**2;
  const driveTime=boost?QUESTION_AT+BRAKE_SECONDS+Math.min(boostAge,CITY_STOP_AT):Math.min(time,QUESTION_AT+BRAKE_SECONDS);
  const seasonTime=boost?QUESTION_AT+closing.turns*10:Math.min(time,QUESTION_AT);
  let index=questionAge>=0?5:Math.floor((time-TEXT_START)/(TEXT_SECONDS+TEXT_GAP));
  const age=time-TEXT_START-index*(TEXT_SECONDS+TEXT_GAP);
  const showing=index>=0&&index<5&&age<TEXT_SECONDS;
  let phrase=questionAge>=0?ANNIVERSARY_LINES[5]:showing?ANNIVERSARY_LINES[index]:'';
  let opacity=boost?1-smooth(boostAge/.35):questionAge>=0?smooth(questionAge/.35):showing?smooth(Math.min(age/.4,(TEXT_SECONDS-age)/.55)):0;
  if(boost&&boostAge>=.35){index=6;phrase='';opacity=0;if(boostAge>=PEAK_AT&&boostAge<PEAK_AT+PEAK_SECONDS){const age=boostAge-PEAK_AT;phrase=PEAK_LINE;opacity=smooth(Math.min(age/.4,(PEAK_SECONDS-age)/.55));}}
  const mixing=boost?smooth((boostAge-2.2)/3.4)*closing.cameraAmount:0;
  const launch=boost?smooth(boostAge/.12)*(1-smooth((boostAge-.45)/1.2)):0;
  let phase=boost?'boost':questionAge>=0?'question':'travel';
  if(boost){for(const [at,next] of [[COAST_AT,'decelerate'],[RETURN_AT,'return'],[CITY_CLEAR_AT,'city'],[CITY_STOP_AT,'stopped'],[FADE_AT,'fade'],[ENDING_AT,'ending']])if(boostAge>=at)phase=next;}
  return {phase,index,phrase,opacity,dots:questionAge<0?0:Math.min(3,Math.floor(questionAge)),choices:questionAge>=3&&!boost,waiting:questionAge>=0&&!boost,time,driveTime,seasonTime,distance,speed,boostAge,mixing,launch,carShift:boost?smooth(boostAge/.55)*.05*closing.cameraAmount:0,hideMountains:boost,fastScenery:boost,cameraAmount:closing?.cameraAmount??1,returnPass:closing?.returnPass??null,returnCity:closing?.returnCity??false,cityDistance:closing?.cityDistance??0,black:closing?.black??0,endingAge:closing?.endingAge??-1};
}

export function rapidSeasonState(seasonTime){
  const turn=seasonTime/10,index=Math.floor(turn)%4,fraction=turn-Math.floor(turn);
  const mix=smooth((fraction-.78)/.22);
  return {index:mix>.5?(index+1)%4:index,from:index,to:(index+1)%4,mix,pass:null};
}

export function boostCamera(width,height,car,age,reduced=false,envelope=1){
  const amount=reduced?0:smooth(age/2.4)*envelope,angle=0;
  const zoom=1+(width>height? .25:1.05)*amount;
  const pivotX=width/2+(car.left+car.width*.52-width/2)*amount;
  const pivotY=height/2+(car.top+car.height*.55-height/2)*amount;
  const shake=reduced?0:smooth(age/.08)*(1-smooth(age/1.1));
  const screenX=width/2+Math.sin(age*61)*shake*1.6,screenY=height/2+Math.sin(age*47)*shake;
  let margin=0;
  for(const x of [0,width])for(const y of [0,height]){
    const dx=(x-screenX)/zoom,dy=(y-screenY)/zoom;
    const wx=pivotX+Math.cos(angle)*dx+Math.sin(angle)*dy,wy=pivotY-Math.sin(angle)*dx+Math.cos(angle)*dy;
    margin=Math.max(margin,-wx,wx-width,-wy,wy-height);
  }
  return {angle,zoom,pivotX,pivotY,screenX,screenY,margin:Math.max(0,margin)+amount*3};
}

const overlaps=(a,b,pad=0)=>a.x<b.x+b.width+pad&&a.x+a.width>b.x-pad&&a.y<b.y+b.height+pad&&a.y+a.height>b.y-pad;
export function nextNoPosition(width,height,size,yes,text,previous,attempt){
  const inset=20,minY=Math.min(height-size.height-inset,Math.max(text.y+text.height+22,height*.48));
  const maxY=Math.max(minY,height-size.height-inset),maxX=Math.max(inset,width-size.width-inset);
  const candidates=[];
  for(let i=0;i<48;i++){
    const x=inset+(maxX-inset)*((i*.61803398875+attempt*.371)%1);
    const y=minY+(maxY-minY)*((i*.41421356237+attempt*.237)%1);
    const rect={x,y,...size};if(overlaps(rect,yes,22)||overlaps(rect,text,14))continue;
    candidates.push({...rect,score:Math.hypot(x-previous.x,y-previous.y)});
  }
  candidates.sort((a,b)=>b.score-a.score);
  return candidates[attempt%Math.min(4,candidates.length)]??{x:inset,y:maxY,...size};
}

export class Aniversario {
  constructor(root,{onQuestion=()=>{},onAccept=()=>false,onAnnounce=()=>{}}={}){
    this.root=root;this.line=root.querySelector('#season-line');this.caption=root.querySelector('#season-caption');this.dots=[...root.querySelectorAll('#season-dots span')];this.choices=root.querySelector('#season-choices');this.yes=root.querySelector('#answer-yes');this.no=root.querySelector('#answer-no');
    this.onQuestion=onQuestion;this.onAccept=onAccept;this.onAnnounce=onAnnounce;this.attempt=0;
    this.accept=()=>{if(!this.state?.choices||this.accepted)return;if(this.onAccept()===false)return;this.accepted=true;this.choices.hidden=true;this.no.hidden=true;};
    this.evade=()=>{if(!this.state?.choices||this.accepted)return;this.moveNo();};
    this.resize=()=>{if(this.attempt&&this.state?.choices)this.moveNo();};
    this.yes.addEventListener('click',this.accept);this.no.addEventListener('click',this.evade);addEventListener('resize',this.resize);
  }
  moveNo(){
    const rect=element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
    const current=rect(this.no),position=nextNoPosition(innerWidth,innerHeight,{width:current.width,height:current.height},rect(this.yes),rect(this.caption),current,++this.attempt);
    this.no.classList.add('escaped');this.no.style.left=`${position.x}px`;this.no.style.top=`${position.y}px`;this.no.dataset.moves=String(this.attempt);
  }
  render(state){
    this.state=state;this.root.hidden=!state.phrase||state.opacity<=0;this.root.style.opacity=String(state.opacity);this.root.dataset.phase=state.phase;this.root.dataset.index=String(state.index);this.root.dataset.dots=String(state.dots);
    if(this.line.textContent!==state.phrase){this.line.textContent=state.phrase;if(state.phrase)this.onAnnounce(state.phrase);}
    this.dots.forEach((dot,i)=>{dot.style.opacity=state.index===5&&i<state.dots?'1':'0';});this.root.querySelector('#season-dots').hidden=state.index!==5;
    this.choices.hidden=!state.choices||this.accepted;
    if(state.waiting&&!this.questionSignaled){this.questionSignaled=true;this.onQuestion();}
  }
  dispose(){this.yes.removeEventListener('click',this.accept);this.no.removeEventListener('click',this.evade);removeEventListener('resize',this.resize);}
}
