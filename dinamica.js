export const SONG_START = 5;
export const PAINT_FPS = 60;
export const INK_FPS = 12;
export const FRONT_DURATION = 3.4;
export const TUNNEL_DURATION = 2.8;
export const TUNNEL_ZOOM = 2.35;
export const TUNNEL_SETTLE = 2.4;
export const CITY_CAMERA_START = TUNNEL_DURATION+TUNNEL_SETTLE;
export const ENGINE_START = 3.8;
export const EXHAUST_START = 26;
export const EXHAUST_DURATION = 4.4;
export const DEPARTURE_DURATION = 2.1;
export const ENGINE_AUDIBLE_AT = .32;
export const MUSIC_DELAY = ENGINE_AUDIBLE_AT+2;
export function musicLevelAt(seconds){return .9*smooth((seconds-MUSIC_DELAY)/4.2);}
export function openingAt(seconds){return{front:seconds<FRONT_DURATION,driveTime:Math.max(0,seconds-FRONT_DURATION),headlights:smooth((seconds-.75)/.45),tunnel:1-smooth((seconds-FRONT_DURATION)/TUNNEL_DURATION)};}
export const DEPTHS = Object.freeze({far:.035,middle:.11,near:.25,water:.16,railing:.9,road:1.35,plants:1.8});
export function cameraZoom(seconds){if(seconds<CITY_CAMERA_START)return TUNNEL_ZOOM-(TUNNEL_ZOOM-1)*smooth((seconds-TUNNEL_DURATION)/TUNNEL_SETTLE);return 1-.27*smooth((seconds-CITY_CAMERA_START-10)/8);}
export const WHEELS = Object.freeze([{x:202,y:256,radius:72},{x:700,y:256,radius:72}]);
export function smooth(value){const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);}
export function speedAt(seconds){return 240*smooth(seconds/1.6)+200*smooth((seconds-.5)/3.5);}
// El giro horario hace avanzar el neumático hacia la derecha.
export function rollingAngle(distance,groundScale,screenRadius){return distance*groundScale*DEPTHS.road/screenRadius;}
export function modulo(value,period){return ((value%period)+period)%period;}
export function wheelPlacement(wheel,bounds,left,top,scale){return{x:left+(wheel.x-bounds.x)*scale,y:top+(wheel.y-bounds.y)*scale,radius:wheel.radius*scale};}
export function rotateAround(point,center,angle){const x=point.x-center.x,y=point.y-center.y;return{x:center.x+x*Math.cos(angle)-y*Math.sin(angle),y:center.y+x*Math.sin(angle)+y*Math.cos(angle)};}
