import {ENGINE_START, EXHAUST_START, EXHAUST_DURATION, DEPARTURE_DURATION} from './dinamica.js';

export class Motor {
  constructor(song) {
    this.song = song;
  }

  async prepare() {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioEngine();
    this.context.addEventListener('statechange', () => {
      this.song.dataset.audioContext = this.context.state;
    });
    [this.buffer, this.exhaustBuffer, this.exhaustMix] = await Promise.all([
      this.loadSound('assets/audio/arranque-boxster.mp3', ENGINE_START),
      this.loadSound('assets/audio/aceleracion-cayman.mp3', EXHAUST_START),
      this.createExhaustMix(),
    ]);
    this.song.dataset.engineOffset = String(ENGINE_START);
    this.song.dataset.engineDuration = (this.buffer.duration - ENGINE_START).toFixed(3);
    this.gain = this.context.createGain();
    this.gain.gain.value = 0;
    this.context.createMediaElementSource(this.song).connect(this.gain);
    this.gain.connect(this.exhaustMix ?? this.context.destination);
  }

  async createExhaustMix() {
    if (!this.context.audioWorklet) return null;
    await this.context.audioWorklet.addModule(new URL('./mezcla-escape.js', import.meta.url));
    const mix = new AudioWorkletNode(this.context, 'mezcla-escape', {
      numberOfInputs: 2,
      outputChannelCount: [2],
    });
    mix.connect(this.context.destination);
    return mix;
  }

  async loadSound(path, offset) {
    const response = await fetch(path);
    if (!response.ok) throw Error('No se pudo cargar el sonido del motor.');
    const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
    if (buffer.duration <= offset + .1) throw Error('El sonido del motor está incompleto.');
    return buffer;
  }

  start() {
    const resumed = this.context.resume();
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    const gain = this.context.createGain();
    gain.gain.value = 1.5;
    source.connect(gain).connect(this.context.destination);
    source.onended = () => this.song.dataset.engineState = 'ended';
    source.start(0, ENGINE_START);
    this.song.dataset.engineState = 'playing';
    return resumed;
  }

  accelerate() {
    const duration = Math.min(EXHAUST_DURATION, this.exhaustBuffer.duration - EXHAUST_START);
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = this.exhaustBuffer;
    source.connect(gain);
    if (this.exhaustMix) gain.connect(this.exhaustMix, 0, 1);
    else gain.connect(this.context.destination);
    const exhaustGain = 1.12;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(exhaustGain, now + Math.min(.12, duration / 2));
    gain.gain.setValueAtTime(exhaustGain, now + Math.min(DEPARTURE_DURATION, duration * .7));
    gain.gain.linearRampToValueAtTime(0, now + duration);
    source.onended = () => this.song.dataset.exhaustState = 'ended';
    source.start(now, EXHAUST_START, duration);
    this.song.dataset.exhaustState = 'playing';
    this.song.dataset.exhaustOffset = String(EXHAUST_START);
    this.song.dataset.exhaustGain = String(exhaustGain);
  }

  level(value) {
    if (Math.abs(value - this.levelValue) < .002) return;
    this.levelValue = value;
    this.song.dataset.mix = value.toFixed(3);
    this.gain.gain.setTargetAtTime(value, this.context.currentTime, .08);
  }

  pause(value) {
    return value ? this.context.suspend() : this.context.resume();
  }

  dispose() {
    this.context?.close();
  }
}
