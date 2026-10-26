export type MusicMode = 'WAR' | 'PEACE' | 'VENGEANCE';

export function createMusicPlayer(getContext: () => AudioContext | null) {
  let context: AudioContext | null = null;
  let bus: GainNode | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let mode: MusicMode = 'PEACE';
  let volume = .28;
  let beat = 0;
  let next = 0;
  const sources = new Set<OscillatorNode>();
  const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

  function clearSources() {
    sources.forEach(source => { try { source.stop(); } catch { /* Already ended. */ } });
    sources.clear();
  }

  function voice(frequency: number, time: number, duration: number, amplitude: number, timbre: 'strings' | 'brass' | 'dark' | 'bell', attack = .025) {
    if (!context || !bus) return;
    const oscillator = context.createOscillator(), filter = context.createBiquadFilter(), gain = context.createGain();
    oscillator.type = timbre === 'brass' || timbre === 'dark' ? 'sawtooth' : timbre === 'bell' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, time);
    filter.type = 'lowpass';
    filter.frequency.value = timbre === 'dark' ? 460 : timbre === 'brass' ? 820 : timbre === 'bell' ? 6000 : 1450;
    filter.Q.value = timbre === 'dark' ? 1.4 : .65;
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(amplitude, time + Math.max(.006, Math.min(attack, duration * .3)));
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(filter); filter.connect(gain); gain.connect(bus);
    sources.add(oscillator);
    oscillator.onended = () => { sources.delete(oscillator); oscillator.disconnect(); filter.disconnect(); gain.disconnect(); };
    oscillator.start(time); oscillator.stop(time + duration + .04);
  }

  function drum(time: number, amplitude: number, high = false) {
    if (!context || !bus) return;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.frequency.setValueAtTime(high ? 150 : 90, time);
    oscillator.frequency.exponentialRampToValueAtTime(high ? 72 : 39, time + .16);
    gain.gain.setValueAtTime(amplitude, time);
    gain.gain.exponentialRampToValueAtTime(.0001, time + .30);
    oscillator.connect(gain); gain.connect(bus); sources.add(oscillator);
    oscillator.onended = () => { sources.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(time); oscillator.stop(time + .34);
  }

  function compose(time: number) {
    const war = mode === 'WAR', vengeance = mode === 'VENGEANCE';
    const unit = 60 / (war ? 108 : vengeance ? 66 : 56), length = war || vengeance ? 4 : 8;
    const roots = war ? [38, 38, 34, 36] : vengeance ? [38, 36, 37, 35] : [50, 46, 43, 45];
    const base = roots[Math.floor(beat / length) % roots.length];
    if (beat % length === 0) {
      (vengeance ? [0, 7, 12, 13] : [0, 7, 12, 15]).forEach((note, index) => {
        voice(midi(base + note), time, unit * length + .7, vengeance ? .065 : war ? .055 : .075,
          vengeance ? 'dark' : index === 0 ? 'strings' : war ? 'brass' : 'strings', war ? .065 : .7);
      });
    }
    if (war) {
      drum(time, beat % 4 === 0 ? .25 : .12);
      if (beat % 2) drum(time + unit * .5, .085, true);
      else voice(midi(base + 24 + (beat % 4 === 2 ? 3 : 0)), time, .38, .045, 'brass');
    } else if (vengeance) {
      drum(time, .26); drum(time + unit * .34, .115);
      if (beat % 4 === 2) {
        voice(midi(base + 24), time, 1.8, .065, 'dark', .25);
        voice(midi(base + 30), time + .12, 1.4, .035, 'bell', .04);
      }
    } else {
      const melody = [69, 67, 65, 64, 62, 65, 64, 60];
      if (beat % 2 === 0) voice(midi(melody[Math.floor(beat / 2) % melody.length]), time, unit * 2.1, .065, 'strings', .35);
      if (beat % 8 === 0) voice(midi(base + 24), time, 3, .025, 'bell');
    }
    beat++;
    return unit;
  }

  function schedule() {
    if (!context || !timer || document.hidden || String(context.state) !== 'running') return;
    // A throttled/background tab must not queue a backlog of old notes.
    if (next < context.currentTime) next = context.currentTime + .03;
    while (next < context.currentTime + .3) next += compose(next);
  }

  function setMode(nextMode: MusicMode) {
    if (mode === nextMode) return;
    mode = nextMode; beat = 0; clearSources();
    if (context) next = context.currentTime + .03;
    schedule();
  }

  function setVolume(value: number) {
    volume = Math.max(0, Math.min(.6, value));
    if (bus && context) bus.gain.setTargetAtTime(volume, context.currentTime, .08);
  }

  function start(nextMode: MusicMode, value: number) {
    if (document.hidden) return;
    const nextContext = getContext();
    if (!nextContext) return;
    if (context && context !== nextContext) { stop(); bus = null; }
    context = nextContext;
    if (!bus) {
      bus = context.createGain();
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -18; limiter.knee.value = 16; limiter.ratio.value = 4;
      bus.connect(limiter); limiter.connect(context.destination);
    }
    setVolume(value); setMode(nextMode);
    if (timer) return;
    beat = 0; next = context.currentTime + .04;
    timer = setInterval(schedule, 100); schedule();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null; clearSources();
  }
  return {start, stop, setMode, setVolume};
}
