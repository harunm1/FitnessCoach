// The rest-end tone, made by an oscillator in the Web Audio API (D34): no audio file to
// download or license. Browsers start an AudioContext suspended until a user gesture, so
// `unlockAudio` is called from taps (a logged set, the settings test button).

type AudioContextCtor = new () => AudioContext;

const LOW_NOTE_HZ = 880;
const HIGH_NOTE_HZ = 1175;
const NOTE_HZ = [LOW_NOTE_HZ, HIGH_NOTE_HZ];
const NOTE_SECONDS = 0.16;
const GAP_SECONDS = 0.04;
const ATTACK_SECONDS = 0.01;
const FLOOR_GAIN = 0.0001;

let context: AudioContext | null = null;

function audioContextConstructor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const withWebkit = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return withWebkit.AudioContext ?? withWebkit.webkitAudioContext ?? null;
}

function getContext(): AudioContext | null {
  if (context) return context;
  const Ctor = audioContextConstructor();
  if (!Ctor) return null;
  context = new Ctor();
  return context;
}

// Creates or resumes the context. Call from inside a tap or click.
export function unlockAudio(): void {
  try {
    const audio = getContext();
    if (audio && audio.state === "suspended") void audio.resume();
  } catch {
    // No audio on this device: the alert is simply silent.
  }
}

// Two short notes at `volume` (0 to 1).
export function playTone(volume: number): void {
  const audio = getContext();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
  const level = Math.min(1, Math.max(0, volume));
  const start = audio.currentTime;
  NOTE_HZ.forEach((frequency, index) => {
    const from = start + index * (NOTE_SECONDS + GAP_SECONDS);
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(FLOOR_GAIN, from);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(FLOOR_GAIN, level),
      from + ATTACK_SECONDS,
    );
    gain.gain.exponentialRampToValueAtTime(FLOOR_GAIN, from + NOTE_SECONDS);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(from);
    oscillator.stop(from + NOTE_SECONDS);
  });
}
