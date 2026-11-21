import {SONG_START} from './dinamica.js';
export class Musica{
  constructor(audio){this.audio=audio;this.enabled=true;this.started=false;this.paused=false;this.finished=false;this.audio.muted=true;this.audio.loop=false;this.audio.addEventListener('ended',()=>{this.finished=true;this.paused=true;this.audio.dataset.musicState='ended';});}
  async prepare(){if(this.audio.readyState<1)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(Error('La canción tardó demasiado en cargar.'));},20000);const cleanup=()=>{clearTimeout(timer);this.audio.removeEventListener('loadedmetadata',ok);this.audio.removeEventListener('error',fail);};const ok=()=>{cleanup();resolve();};const fail=()=>{cleanup();reject(Error('No se pudo abrir la canción.'));};this.audio.addEventListener('loadedmetadata',ok);this.audio.addEventListener('error',fail);this.audio.load();});if(!Number.isFinite(this.audio.duration)||this.audio.duration<=SONG_START)throw Error(`La canción no contiene el segundo ${SONG_START}.`);this.audio.currentTime=SONG_START;}
  start(enabled=true){this.enabled=enabled;this.started=true;this.paused=false;this.finished=false;this.audio.pause();this.audio.currentTime=SONG_START;this.audio.muted=!enabled;return this.audio.play();}
  cue(position=SONG_START){this.finished=false;this.audio.currentTime=position;this.audio.dataset.musicState='playing';}
  mute(value){this.enabled=!value;this.audio.muted=value;}
  pause(value){this.paused=value||this.finished;if(!this.started||this.finished)return Promise.resolve();if(value){this.audio.pause();return Promise.resolve();}return this.audio.play();}
  retry(elapsed){this.started=true;this.paused=false;this.finished=false;this.audio.currentTime=SONG_START+elapsed%Math.max(1,this.audio.duration-SONG_START);this.audio.muted=!this.enabled;return this.audio.play();}
  reset(){this.started=false;this.paused=false;this.finished=false;this.audio.pause();if(this.audio.readyState>=1)this.audio.currentTime=SONG_START;}
  dispose(){this.audio.pause();}
}
