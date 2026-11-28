const SOUND_STORAGE_KEY = 'excelgym_sound_enabled';

let audioCtx: AudioContext | null = null;
const listeners = new Set<(enabled: boolean) => void>();

function readInitialEnabled(): boolean {
  try {
    const raw = localStorage.getItem(SOUND_STORAGE_KEY);
    if (raw === 'false') return false;
  } catch {
    // ignore storage access issues
  }
  return true;
}

let soundEnabled = readInitialEnabled();

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function setSoundEnabled(next: boolean): void {
  soundEnabled = next;
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, String(next));
  } catch {
    // ignore storage quota errors
  }
  listeners.forEach((fn) => fn(next));
  if (next) {
    playPrimaryClick();
  }
}

export function subscribeSoundEnabled(cb: (enabled: boolean) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  options: {
    freq: number;
    endFreq?: number;
    type?: OscillatorType;
    startOffset?: number;
    duration: number;
    gain: number;
    filterFreq?: number;
  }
) {
  const now = ctx.currentTime + (options.startOffset ?? 0);
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = options.type ?? 'sine';
  osc.frequency.setValueAtTime(options.freq, now);
  if (options.endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, options.endFreq),
      now + options.duration
    );
  }

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.linearRampToValueAtTime(options.gain, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);

  if (options.filterFreq) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(options.filterFreq, now);
    osc.connect(filter);
    filter.connect(gainNode);
  } else {
    osc.connect(gainNode);
  }

  gainNode.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + options.duration + 0.02);
}

/** Crisp, subtle tactile tap for standard buttons and navigation */
export function playClick(): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, {
    freq: 640,
    endFreq: 420,
    type: 'sine',
    duration: 0.045,
    gain: 0.055,
  });
}

/** Slightly richer confirmation tap for primary CTAs like Continue Learning */
export function playPrimaryClick(): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, {
    freq: 520,
    endFreq: 740,
    type: 'triangle',
    duration: 0.065,
    gain: 0.075,
    filterFreq: 2200,
  });
}

/** Soft curious bell chime when opening a hint */
export function playHint(): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, { freq: 659.25, type: 'sine', startOffset: 0, duration: 0.11, gain: 0.065 });
  playTone(ctx, { freq: 880, type: 'sine', startOffset: 0.07, duration: 0.16, gain: 0.06 });
}

/** Rewarding ascending major chime when an answer is correct */
export function playSuccess(): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, idx) => {
    playTone(ctx, {
      freq,
      type: idx === notes.length - 1 ? 'triangle' : 'sine',
      startOffset: idx * 0.065,
      duration: idx === notes.length - 1 ? 0.28 : 0.14,
      gain: 0.095,
      filterFreq: 3200,
    });
  });
}

/** Gentle, clear descending two-tone feedback when an answer is wrong */
export function playError(): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, {
    freq: 311.13, // Eb4
    endFreq: 277.18, // C#4
    type: 'triangle',
    startOffset: 0,
    duration: 0.14,
    gain: 0.095,
    filterFreq: 1100,
  });
  playTone(ctx, {
    freq: 246.94, // B3
    endFreq: 220.0, // A3
    type: 'triangle',
    startOffset: 0.12,
    duration: 0.22,
    gain: 0.095,
    filterFreq: 950,
  });
}

/** Uplifting fanfare when completing a stage, mixed test, or workplace simulation */
export function playCelebration(): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const notes = [523.25, 659.25, 783.99, 987.77, 1046.5]; // C5 E5 G5 B5 C6
  notes.forEach((freq, idx) => {
    playTone(ctx, {
      freq,
      type: 'triangle',
      startOffset: idx * 0.075,
      duration: idx === notes.length - 1 ? 0.42 : 0.18,
      gain: 0.105,
      filterFreq: 3600,
    });
  });
}

/**
 * Installs a single lightweight document-level click listener so every enabled
 * <button> in ExcelGym gives crisp tactile audio feedback automatically.
 * Buttons with data-sound="none" are skipped (used by Check Answer / Submit
 * buttons that immediately play dedicated success/failure audio).
 */
export function installGlobalButtonSounds(): () => void {
  const handleClick = (event: MouseEvent) => {
    if (!soundEnabled) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const button = target.closest('button') as HTMLButtonElement | null;
    if (!button || button.disabled) return;

    const soundAttr = button.getAttribute('data-sound');
    if (soundAttr === 'none') return;

    if (soundAttr === 'primary') {
      playPrimaryClick();
      return;
    }

    const cls = button.className || '';
    const isPrimaryCta =
      typeof cls === 'string' &&
      (cls.includes('bg-blue-600') ||
        cls.includes('bg-slate-900') ||
        cls.includes('bg-emerald-600'));

    if (isPrimaryCta) {
      playPrimaryClick();
    } else {
      playClick();
    }
  };

  document.addEventListener('click', handleClick, true);
  return () => {
    document.removeEventListener('click', handleClick, true);
  };
}
