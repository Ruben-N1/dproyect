import {Pelicula} from './pelicula.js';
import {Musica} from './musica.js';
import {Motor} from './motor.js';
import {EscenaDerrape} from './escena-derrape.js';
import {Momentos} from './momentos.js';
import {ViajeEstaciones} from './estaciones.js';
import {Aniversario} from './aniversario.js';
import {CiudadRegreso,FinalAniversario} from './cierre.js';
import {FRONT_DURATION,TUNNEL_DURATION,CITY_CAMERA_START,DEPARTURE_DURATION,MUSIC_DELAY,musicLevelAt,smooth} from './dinamica.js';
const $ = selector => document.querySelector(selector);
const caption = $('#city-caption');
const cityLines = [
  'Hola amor',
  'Ya por fin otro año más juntos eh',
  'Nadie se habría imaginado que llegaríamos tan lejos',
  'solo tu y yo, quizás',
  'Quisiera enseñarte algunos de mis momentos favoritos contigo',
  'Lista?',
  'Vamos a verlos entonces',
];
const captionDuration = 3;
const captionPause = 2;
const captionsStart = CITY_CAMERA_START + .5;
const departureAt = captionsStart + (cityLines.length - 1) * (captionDuration + captionPause) + captionDuration;
const film = new Pelicula($('#film'), departureAt);
const music = new Musica($('#song'));
const motor = new Motor($('#song'));
const drift = new EscenaDerrape($('#drift-video'), $('#video-retry'), film.reduced);
const story = new Aniversario($('#season-story'),{
  onQuestion:()=>music.pause(true).catch(blocked),
  onAccept:()=>{
    if(!seasons.accept())return false;
    music.cue(160);
    music.pause(document.hidden).catch(blocked);motor.pause(document.hidden).catch(blocked);
    motor.accelerate();$('#announcement').textContent='El Porsche acelera y el viaje continúa por las estaciones.';
    return true;
  },
  onAnnounce:phrase=>$('#announcement').textContent=phrase,
});
const finale = new FinalAniversario($('#anniversary-ending'),phrase=>$('#announcement').textContent=phrase);
const seasons = new ViajeEstaciones($('#season-film'),film.reduced,()=>drift.finish(),state=>{story.render(state);finale.render(state,film.reduced);});
seasons.returnRenderer=new CiudadRegreso(film);
let musicFocus = 1;
const moments = new Momentos($('#moments'), level => {
  musicFocus = level;
  $('#song').dataset.focus = level < 1 ? 'moment' : 'music';
  motor.level(musicLevelAt(film.sequenceElapsed) * musicFocus);
},()=>continueJourney());
let started=false,lastStage='welcome',failed=false,musicCued=false;
let exhaustCued = false;
let preparingJourney=false,seasonsPreloaded=false;

async function continueJourney(){
  if(preparingJourney||seasons.entered)return;
  preparingJourney=true;moments.next.disabled=true;moments.next.textContent='Preparando viaje';
  try{
    await seasons.prepare();seasons.returnRenderer.prepare();moments.finish();caption.hidden=true;
    document.body.dataset.stage='seasons';lastStage='seasons';
    $('#announcement').textContent='El viaje continúa de perfil por primavera, verano, otoño e invierno.';
    musicFocus=1;motor.level(musicLevelAt(film.sequenceElapsed));seasons.start();
    $('#season-film').focus({preventScroll:true});
  }catch(error){
    console.error(error);preparingJourney=false;moments.next.disabled=false;moments.next.textContent='Seguir el viaje';moments.message.textContent='No se pudo preparar el camino. Toca Seguir el viaje para intentarlo otra vez.';
  }
}

function showCityCaption(driveTime) {
  const elapsed = driveTime - captionsStart;
  const interval = captionDuration + captionPause;
  const index = Math.floor(elapsed / interval);
  const age = elapsed - index * interval;
  const phrase = age < captionDuration ? cityLines[index] ?? '' : '';

  if (caption.textContent !== phrase) {
    caption.textContent = phrase;
    caption.hidden = !phrase;
    caption.classList.toggle('long-caption', phrase.length > 28);
    if (phrase) $('#announcement').textContent = phrase;
  }

  if (phrase) {
    const fade = Math.min(age / .4, (captionDuration - age) / .55);
    caption.style.opacity = film.reduced ? 1 : smooth(fade);
  }
}
function blocked(error){if(error?.name==='AbortError'&&document.hidden)return;$('#sound-retry').hidden=false;}
function start(){if(failed){location.reload();return;}if(started||!film.ready)return;started=true;drift.prepare();motor.start().catch(blocked);music.start(true).catch(blocked);$('#song').dataset.musicState='primed-silent';film.start();document.body.dataset.running='true';$('#intro').inert=true;$('#intro').setAttribute('aria-hidden','true');$('#film').focus({preventScroll:true});}
film.onTime = (driveTime, sequence) => {
  if(seasons.entered){motor.level(musicLevelAt(sequence));return;}
  const stage = driveTime >= departureAt + DEPARTURE_DURATION + .35 ? 'drift' : sequence < FRONT_DURATION ? 'headlights' : sequence < FRONT_DURATION + TUNNEL_DURATION ? 'tunnel' : 'city';
  if (lastStage !== stage) {
    lastStage = stage;
    document.body.dataset.stage = stage;
    $('#announcement').textContent = stage === 'drift' ? 'El Porsche derrapa en una curva urbana entre edificios de neón, visto de frente desde una cámara baja.' : stage === 'headlights' ? 'El motor arranca y solo se ven los faros encendidos de frente.' : stage === 'tunnel' ? 'Una vista cercana del Porsche saliendo del túnel oscuro.' : 'El viaje continúa por la ciudad.';
  }
  if (stage === 'drift') {
    const age = driveTime - departureAt - DEPARTURE_DURATION - .35;
    drift.show(age);
    moments.show(age);
    if(!seasonsPreloaded){seasonsPreloaded=true;seasons.prepare().catch(()=>{});}
  }
  if (!musicCued && sequence >= MUSIC_DELAY) {
    musicCued = true;
    music.cue();
    $('#song').dataset.musicCue = sequence.toFixed(3);
  }
  showCityCaption(driveTime);
  const departureAge = driveTime - departureAt;
  if (!exhaustCued && departureAge >= 0) {
    exhaustCued = true;
    motor.accelerate();
    $('#announcement').textContent = 'El Porsche acelera y sale de cuadro.';
  }
  motor.level(musicLevelAt(sequence) * musicFocus);
};
$('#start').addEventListener('click',start);
$('#sound-retry').addEventListener('click',()=>{Promise.all([motor.pause(false),seasons.entered?music.pause(seasons.waiting):music.retry(Math.max(0,film.sequenceElapsed-MUSIC_DELAY))]).then(()=>$('#sound-retry').hidden=true).catch(blocked);});
document.addEventListener('visibilitychange',()=>{film.hidden=document.hidden;film.setPaused(document.hidden);drift.pause(document.hidden);moments.pause(document.hidden);seasons.pause(document.hidden);if(started){music.pause(document.hidden||seasons.waiting).catch(blocked);motor.pause(document.hidden).catch(blocked);}});
addEventListener('music-blocked',blocked);
addEventListener('pagehide',()=>{film.dispose();music.dispose();moments.dispose();motor.dispose();drift.dispose();seasons.dispose();story.dispose();});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{film.reduced=event.matches;drift.setReducedMotion(event.matches);seasons.setReducedMotion(event.matches);film.render();});
try{await Promise.all([film.load(),music.prepare(),motor.prepare(),finale.prepare()]);$('#start').disabled=false;}catch(error){console.error(error);failed=true;$('#start').disabled=false;$('#start').textContent='Volver a cargar';$('#load-error').hidden=false;$('#load-error').textContent='No se pudo preparar el viaje. Abre la página con INICIAR.cmd y vuelve a intentarlo.';}
