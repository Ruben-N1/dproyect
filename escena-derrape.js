import {smooth} from './dinamica.js';

export const videoProfile = (width, height) => height >= width ? 'vertical' : 'horizontal';
const mediaURL = (profile, extension) => new URL(`assets/video/derrape-${profile}.${extension}`, import.meta.url).href;

export class EscenaDerrape {
  constructor(video, retry, reduced = false) {
    this.video = video;
    this.retry = retry;
    this.reduced = reduced;
    this.entered = false;
    this.prepared = false;
    this.profile = '';
    this.visible = !document.hidden;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.controls = false;
    video.addEventListener('playing', () => {
      video.dataset.state = 'playing';
      retry.hidden = true;
    });
    video.addEventListener('error', () => this.blocked());
    retry.addEventListener('click', () => {
      this.prepared = false;
      this.prepare();
      this.play();
    });
    this.resize = () => {
      if (this.prepared && videoProfile(innerWidth, innerHeight) !== this.profile) this.prepare();
    };
    addEventListener('resize', this.resize);
  }

  prepare() {
    if(this.finished)return;
    const profile = videoProfile(innerWidth, innerHeight);
    const previousTime = Number.isFinite(this.video.currentTime) ? this.video.currentTime : 0;
    if (this.prepared && this.profile === profile) return;
    this.profile = profile;
    this.prepared = true;
    this.video.poster = mediaURL(profile, 'jpg');
    this.video.dataset.profile = profile;
    this.video.dataset.state = 'preparing';
    if (this.reduced) {
      this.video.dataset.state = 'still';
      return;
    }
    const resume = this.entered && this.visible;
    this.video.pause();
    this.video.addEventListener('loadedmetadata', () => {
      if (previousTime > 0 && Number.isFinite(this.video.duration)) this.video.currentTime = previousTime % this.video.duration;
      if (resume) this.play();
    }, {once: true});
    this.video.preload = 'auto';
    this.video.src = mediaURL(profile, 'mp4');
    this.video.load();
  }

  show(age) {
    if(this.finished)return;
    if (!this.entered) {
      this.entered = true;
      this.prepare();
      this.video.hidden = false;
      this.video.dataset.state = this.reduced ? 'still' : 'starting';
      if (!this.reduced && this.visible) this.play();
    }
    if (age < .7) this.video.style.opacity = String(this.reduced ? 1 : smooth(age / .65));
    else if (this.video.style.opacity !== '1') this.video.style.opacity = '1';
  }

  play() {
    if (!this.entered || !this.visible || this.reduced) return;
    this.video.play().catch(error => {
      if (error.name !== 'AbortError' && this.visible) this.blocked();
    });
  }

  blocked() {
    this.video.dataset.state = 'waiting';
    if (this.entered && !this.reduced) this.retry.hidden = false;
  }

  pause(hidden) {
    this.visible = !hidden;
    if (hidden) this.video.pause(); else this.play();
  }

  setReducedMotion(value) {
    this.reduced = value;
    if (value) {
      this.video.pause();
      this.retry.hidden = true;
      this.video.dataset.state = 'still';
    } else {
      this.prepared = false;
      if (this.entered) {this.prepare(); this.play();}
    }
  }

  dispose() {
    this.video.pause();
    removeEventListener('resize', this.resize);
  }

  finish(){
    this.finished=true;this.entered=false;this.prepared=false;
    this.video.pause();this.video.hidden=true;this.retry.hidden=true;
  }
}
