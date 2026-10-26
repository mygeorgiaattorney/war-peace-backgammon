import { useEffect, useRef } from 'react';

type Props = {
  open: boolean; onClose: () => void;
  soundEnabled: boolean; onSoundToggle: () => void;
  onSoundTest: () => void;
  narrationEnabled: boolean; onNarrationToggle: () => void;
  musicEnabled: boolean; onMusicToggle: () => void;
  volume: number; onVolumeChange: (value: number) => void;
};

export default function SoundSettings(props: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!props.open) { if (dialog.open) dialog.close(); return; }
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); previous?.focus(); };
  }, [props.open]);
  return <dialog ref={ref} className="sound-settings" aria-labelledby="sound-title"
    onCancel={event => { event.preventDefault(); props.onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) props.onClose(); }}>
    <header><h2 id="sound-title">Sound &amp; messages</h2><button type="button" onClick={props.onClose} aria-label="Close sound settings">×</button></header>
    <div className="sound-options">
      <button type="button" aria-pressed={props.musicEnabled} onClick={props.onMusicToggle}>{props.musicEnabled ? 'Pause music' : 'Play music'}</button>
      <label>Music volume <span>{Math.round(props.volume * 100)}%</span><input aria-label="Music volume" type="range" min="0" max="60" value={Math.round(props.volume * 100)} onChange={event => props.onVolumeChange(Number(event.target.value) / 100)} /></label>
      <button type="button" aria-pressed={props.soundEnabled} onClick={props.onSoundToggle}>Sound {props.soundEnabled ? 'on' : 'off'}</button>
      <button type="button" aria-pressed={props.narrationEnabled} onClick={props.onNarrationToggle}>Messages {props.narrationEnabled ? 'on' : 'off'}</button>
      <button type="button" onClick={props.onSoundTest}>Test sound</button>
    </div>
    <p>WAR: drums and low brass. PEACE: solemn minor chords. VENGEANCE: a dark drone and slow heartbeat.</p>
    <p>Music and capture effects have separate switches. Music pauses when you leave the game or hide this tab; tap the game to resume.</p>
    <p>Messages shows or hides the illustrated announcements and turn notices in the center of the board. You can also switch them above the board.</p>
    <p>These choices are saved separately on each device. Test sound enables effects and unlocks audio on this device.</p>
    <button type="button" onClick={props.onClose}>Done</button>
  </dialog>;
}
