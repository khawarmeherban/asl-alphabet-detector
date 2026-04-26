import React, { useCallback, useEffect, useRef, useState } from 'react';

const TIP_INDICES = [4, 8, 12, 16, 20];
const FINGER_NOTES = ['C4', 'D4', 'E4', 'G4', 'A4'];
const KEYBOARD_NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'];
const NOTE_FREQUENCIES = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88
};
const KEY_CLEAR_DELAY = 180;
const MOTION_THRESHOLD = 0.023;
const NOTE_COOLDOWN_MS = 190;

function createAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

export default function VirtualPiano({ lastLandmarks, enabled = true, mode = 'piano', onNote }) {
  const audioContextRef = useRef(null);
  const previousLandmarksRef = useRef(null);
  const cooldownRef = useRef(Array(TIP_INDICES.length).fill(0));
  const rafRef = useRef(null);
  const activeKeysRef = useRef({});
  const clearTimeoutsRef = useRef([]);
  const [activeKeys, setActiveKeys] = useState({});
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      clearTimeoutsRef.current = [];
      audioContextRef.current?.close?.();
    };
  }, []);

  const ensureAudio = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = createAudioContext();
    }

    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    const ready = Boolean(audioContextRef.current);
    setAudioReady(ready);
    return audioContextRef.current;
  }, []);

  const playTone = useCallback(async (note, velocity = 0.75, selectedMode = mode) => {
    const audioContext = await ensureAudio();
    if (!audioContext) return;

    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.connect(audioContext.destination);

    if (selectedMode === 'drum') {
      const oscillator = audioContext.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(145, now);
      oscillator.frequency.exponentialRampToValueAtTime(55, now + 0.12);
      gain.gain.setValueAtTime(Math.min(0.9, velocity), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      oscillator.connect(gain);
      oscillator.start(now);
      oscillator.stop(now + 0.2);
      return;
    }

    const oscillator = audioContext.createOscillator();
    oscillator.type = selectedMode === 'synth' ? 'sawtooth' : 'triangle';
    oscillator.frequency.setValueAtTime(NOTE_FREQUENCIES[note] || NOTE_FREQUENCIES.C4, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(Math.min(0.35, velocity * 0.35), now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    oscillator.connect(gain);
    oscillator.start(now);
    oscillator.stop(now + 0.34);
  }, [ensureAudio, mode]);

  const markActive = useCallback((note) => {
    activeKeysRef.current = { ...activeKeysRef.current, [note]: true };
    setActiveKeys(activeKeysRef.current);

    const timeoutId = setTimeout(() => {
      const nextKeys = { ...activeKeysRef.current };
      delete nextKeys[note];
      activeKeysRef.current = nextKeys;
      setActiveKeys(nextKeys);
    }, KEY_CLEAR_DELAY);
    clearTimeoutsRef.current.push(timeoutId);
  }, []);

  const triggerNote = useCallback((note, velocity = 0.8, meta = {}) => {
    playTone(note, velocity, meta.mode || mode);
    markActive(note);
    onNote?.(note, { velocity, mode, ...meta });
  }, [markActive, mode, onNote, playTone]);

  const processLandmarks = useCallback((landmarks) => {
    if (!enabled || !Array.isArray(landmarks) || landmarks.length < 21) {
      previousLandmarksRef.current = null;
      return;
    }

    if (!previousLandmarksRef.current) {
      previousLandmarksRef.current = landmarks.map((landmark) => ({
        x: landmark.x,
        y: landmark.y,
        z: landmark.z || 0
      }));
      return;
    }

    const now = performance.now();
    TIP_INDICES.forEach((landmarkIndex, fingerIndex) => {
      const current = landmarks[landmarkIndex];
      const previous = previousLandmarksRef.current[landmarkIndex];
      if (!current || !previous) return;

      const verticalMotion = previous.y - current.y;
      const depthMotion = (previous.z || 0) - (current.z || 0);
      const speed = Math.sqrt(verticalMotion * verticalMotion + depthMotion * depthMotion);

      if (speed > MOTION_THRESHOLD && now - cooldownRef.current[fingerIndex] > NOTE_COOLDOWN_MS) {
        const note = FINGER_NOTES[fingerIndex] || FINGER_NOTES[0];
        const velocity = Math.min(1, Math.max(0.18, speed * 11));
        cooldownRef.current[fingerIndex] = now;
        triggerNote(note, velocity, { finger: fingerIndex, source: 'gesture' });
      }
    });

    previousLandmarksRef.current = landmarks.map((landmark) => ({
      x: landmark.x,
      y: landmark.y,
      z: landmark.z || 0
    }));
  }, [enabled, triggerNote]);

  useEffect(() => {
    if (!enabled) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      previousLandmarksRef.current = null;
      setActiveKeys({});
      return undefined;
    }

    const tick = () => {
      processLandmarks(lastLandmarks);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled, lastLandmarks, processLandmarks]);

  return (
    <div className="w-full pointer-events-auto">
      <div className="mx-auto rounded-[1.75rem] border border-white/10 bg-[linear-gradient(145deg,#07131c,#0b1c26)] p-4 shadow-[0_18px_60px_rgba(2,8,12,0.28)] backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Gesture Instrument</p>
              <button
                type="button"
                onClick={ensureAudio}
                className="rounded-full border border-[#1fe0b1]/25 bg-[#1fe0b1]/10 px-3 py-1 text-xs font-semibold text-[#b9fff1] transition hover:bg-[#1fe0b1]/15"
              >
                {audioReady ? 'Audio Ready' : 'Enable Audio'}
              </button>
            </div>
            <div className="flex gap-2 justify-center overflow-x-auto pb-2">
              {KEYBOARD_NOTES.map((note) => (
                <button
                  type="button"
                  key={note}
                  className={`relative flex h-24 w-12 select-none items-end justify-center rounded-xl border text-center transition-all ${
                    activeKeys[note]
                      ? 'scale-105 border-[#1fe0b1]/40 bg-gradient-to-b from-[#93ffe0] to-[#1fe0b1] text-slate-950 shadow-[0_12px_30px_rgba(31,224,177,0.35)]'
                      : 'border-white/10 bg-white/[0.04] text-slate-100 hover:border-white/20'
                  }`}
                  onPointerDown={() => triggerNote(note, 0.9, { source: 'keyboard' })}
                >
                  <span className="mb-3 text-sm font-semibold">{note.replace(/4$/, '')}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 lg:w-48 lg:items-end">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Mode</div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {['piano', 'synth', 'drum'].map((item) => (
                <div
                  key={item}
                  className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${
                    mode === item ? 'bg-[#1fe0b1] text-slate-900' : 'bg-white/5 text-slate-300 border border-white/10'
                  }`}
                >
                  {item}
                </div>
              ))}
            </div>
            <p className="text-xs leading-5 text-slate-500 lg:text-right">
              Flick a fingertip upward or tap keys to play. Works without external audio packages.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
