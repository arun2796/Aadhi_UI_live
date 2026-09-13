/**
 * Sound effects utility using the Web Audio API.
 * Synthesizes crisp button click/tap sounds and festive firecracker explosion sounds
 * with 0 external network dependencies, 0 latency, and 100% offline reliability.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Plays a clean, subtle UI tap/click sound.
 * Perfect for button clicks, toggles, and navigation.
 */
export function playClickSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Short crisp pop/tick
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Rapid pitch drop gives a satisfying tactile "tap" feel
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.035);

    // Snappy envelope
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  } catch {
    // Gracefully ignore audio failures (e.g. strict browser policy)
  }
}

/**
 * Plays a realistic procedural firecracker pop / burst sound.
 * Combines a punchy low-end thud with crackling noise bursts.
 */
export function playCrackerSound(volume = 0.4): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Explosive thud (low-frequency punch)
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = 'triangle';
    thudOsc.frequency.setValueAtTime(160 + Math.random() * 40, now);
    thudOsc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

    thudGain.gain.setValueAtTime(volume * 0.7, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    thudOsc.connect(thudGain);
    thudGain.connect(ctx.destination);

    thudOsc.start(now);
    thudOsc.stop(now + 0.13);

    // 2. White noise burst (the sharp "crack" and sizzle)
    const bufferSize = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // White noise with random spark crackles
      const decay = Math.exp(-i / (ctx.sampleRate * 0.05));
      data[i] = (Math.random() * 2 - 1) * decay;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;

    // Filter to make it sound like gunpowder/paper burst
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200 + Math.random() * 800, now);
    filter.Q.setValueAtTime(1.2, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noiseSource.start(now);
    noiseSource.stop(now + 0.25);
  } catch {
    // Ignore audio failures
  }
}

/**
 * Plays a sequence of celebratory Diwali firecrackers (staggered pops and bursts)
 * mimicking a garland / lad of crackers exploding to celebrate a successful order!
 */
export function playCrackersBurstSequence(bursts = 8): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    for (let i = 0; i < bursts; i++) {
      // Stagger crackers with slight random jitter
      const delayMs = i * 220 + Math.random() * 120;
      setTimeout(() => {
        playCrackerSound(0.35 + Math.random() * 0.25);
      }, delayMs);
    }

    // Grand finale double burst at the end
    setTimeout(() => {
      playCrackerSound(0.55);
      setTimeout(() => playCrackerSound(0.5), 90);
    }, bursts * 220 + 200);
  } catch {
    // Ignore
  }
}
