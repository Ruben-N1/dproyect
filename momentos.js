export const MOMENT_MUSIC_LEVEL = .3;
export const MOMENTS = [
  {type:'image',file:'foto-01.png',description:'Una de nuestras conversaciones.',caption:'Tú presumiendome carne cara del costco'},
  {type:'image',file:'foto-02.png',description:'Una videollamada contigo.',caption:'Nuestra primer videollamada (Taba nervioso)'},
  {type:'video',file:'video-01.mp4',poster:'video-01.jpg',description:'Un recuerdo jugando Roblox.',caption:'Tú intentando grabar un video lindo y yo no colaboraba JAJAJ'},
  {type:'video',file:'video-02.mp4',poster:'video-02.jpg',description:'Otro de nuestros recuerdos en vídeo.',caption:'Suprice! Im here :D'},
  {type:'image',file:'foto-05.png',description:'La conversación de cuando nos hicimos novios.',caption:'Cuando por fin nos hicimos novios por primera vez'},
];
const asset = file => new URL(`assets/moments/${file}`, import.meta.url).href;

export class Momentos {
  constructor(root, onFocus = () => {}, onContinue = null) {
    this.root = root;
    this.onFocus = onFocus;
    this.onContinue = onContinue;
    this.index = 0;
    this.entered = false;
    this.visible = !document.hidden;
    this.focused = false;
    this.version = 0;
    this.image = root.querySelector('#moment-image');
    this.video = root.querySelector('#moment-video');
    this.caption = root.querySelector('#moment-caption');
    this.previous = root.querySelector('#moment-previous');
    this.next = root.querySelector('#moment-next');
    this.toggle = root.querySelector('#moment-toggle');
    this.sound = root.querySelector('#moment-sound');
    this.controls = root.querySelector('#moment-controls');
    this.message = root.querySelector('#moment-message');
    this.video.playsInline = true;
    this.video.loop = false;
    this.video.controls = false;
    this.video.volume = 1;
    this.previous.addEventListener('click', () => this.select(this.index - 1, true));
    this.next.addEventListener('click', () => {
      if(this.index===MOMENTS.length-1&&this.onContinue)this.onContinue();
      else this.select((this.index + 1) % MOMENTS.length, true);
    });
    this.toggle.addEventListener('click', () => this.video.paused || this.video.ended ? this.play() : this.video.pause());
    this.sound.addEventListener('click', () => {
      this.video.muted = !this.video.muted;
      this.update();
    });
    this.image.addEventListener('error', () => {
      if (MOMENTS[this.index].type === 'image') this.message.textContent = 'No se pudo abrir este recuerdo.';
    });
    this.video.addEventListener('playing', () => {this.buffering = false;this.message.textContent = '';this.update();});
    this.video.addEventListener('waiting', () => {this.buffering = true;this.update();});
    this.video.addEventListener('seeking', () => {this.buffering = true;this.update();});
    this.video.addEventListener('seeked', () => {this.buffering = false;this.update();});
    for (const event of ['pause','ended','volumechange','canplay']) this.video.addEventListener(event, () => this.update());
    this.video.addEventListener('error', () => {
      if (MOMENTS[this.index].type !== 'video') return;
      this.message.textContent = 'No se pudo abrir el vídeo. Puedes volver a intentarlo.';
      this.buffering = true;
      this.update();
    });
    root.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'ArrowRight') {event.preventDefault();this.next.click();}
      if (event.key === 'ArrowLeft' && !this.previous.disabled) {event.preventDefault();this.previous.click();}
    });
  }

  show(age) {
    if (this.finished || this.entered || age < .9) return;
    this.entered = true;
    this.root.hidden = false;
    this.root.inert = false;
    this.select(0, false);
  }

  select(index, autoplay = false) {
    if (index < 0 || index >= MOMENTS.length) return;
    const item = MOMENTS[index];
    this.index = index;
    this.version++;
    this.buffering = false;
    this.resumeAfterHidden = false;
    this.setFocused(false);
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    this.video.hidden = item.type !== 'video';
    this.image.hidden = item.type !== 'image';
    this.controls.hidden = item.type !== 'video';
    this.message.textContent = '';
    this.root.dataset.type = item.type;
    this.root.dataset.index = String(index);
    this.root.dataset.state = item.type === 'image' ? 'photo' : 'paused';
    this.caption.textContent = item.caption;
    this.previous.disabled = index === 0;
    this.next.textContent = index === MOMENTS.length - 1 ? (this.onContinue?'Seguir el viaje':'Volver al primero') : 'Siguiente';
    if (item.type === 'image') {
      this.image.alt = item.description;
      this.image.src = asset(item.file);
      this.video.removeAttribute('poster');
    } else {
      this.image.removeAttribute('src');
      this.video.setAttribute('aria-label', item.description);
      this.video.poster = asset(item.poster);
      this.video.src = asset(item.file);
      this.video.muted = false;
      this.update();
      if (autoplay && this.visible) this.play();
    }
  }

  async play() {
    if (!this.entered || !this.visible || MOMENTS[this.index].type !== 'video') return;
    const version = this.version;
    if (this.video.error) this.video.load();
    if (this.video.ended) this.video.currentTime = 0;
    try {
      await this.video.play();
    } catch (error) {
      if (version !== this.version || !this.visible || error.name === 'AbortError') return;
      this.message.textContent = 'Toca Reproducir para ver este momento con sonido.';
      this.update();
    }
  }

  update() {
    const isVideo = MOMENTS[this.index].type === 'video';
    const playing = isVideo && !this.video.paused && !this.video.ended && !this.video.error;
    this.toggle.textContent = this.video.ended ? 'Ver otra vez' : playing ? 'Pausar' : 'Reproducir';
    this.sound.textContent = this.video.muted ? 'Activar audio' : 'Silenciar';
    this.sound.setAttribute('aria-pressed', String(this.video.muted));
    if (isVideo) this.root.dataset.state = this.video.ended ? 'ended' : playing ? 'playing' : 'paused';
    this.setFocused(this.entered && this.visible && playing && !this.video.muted && this.video.volume > 0 && this.video.readyState >= 3 && !this.buffering);
  }

  setFocused(value) {
    this.root.dataset.audioFocus = String(value);
    if (this.focused === value) return;
    this.focused = value;
    this.onFocus(value ? MOMENT_MUSIC_LEVEL : 1);
  }

  pause(hidden) {
    this.visible = !hidden;
    if(this.finished)return;
    if (hidden) {
      this.resumeAfterHidden = !this.video.paused && !this.video.ended;
      this.video.pause();
      this.setFocused(false);
    } else if (this.resumeAfterHidden) {
      this.resumeAfterHidden = false;
      this.play();
    }
  }

  dispose() {
    this.entered = false;
    this.video.pause();
    this.setFocused(false);
  }

  finish(){
    this.finished=true;this.entered=false;this.version++;this.resumeAfterHidden=false;
    this.video.pause();this.video.removeAttribute('src');this.video.load();this.setFocused(false);
    this.root.hidden=true;this.root.inert=true;
  }
}
