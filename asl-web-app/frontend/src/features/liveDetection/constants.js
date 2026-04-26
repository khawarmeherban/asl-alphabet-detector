function normalizeApiUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function getDefaultApiUrl() {
  if (typeof window === 'undefined') {
    return 'http://localhost:7860';
  }

  const { protocol, hostname } = window.location;
  const normalizedHost = String(hostname || '').trim().toLowerCase();
  const isLocalHost =
    normalizedHost === 'localhost' ||
    normalizedHost === '127.0.0.1' ||
    normalizedHost === '::1';

  if (isLocalHost) {
    return `${protocol}//${hostname}:7860`;
  }

  return `${protocol}//${hostname}:7860`;
}

export const API_URL = normalizeApiUrl(process.env.REACT_APP_API_URL) || getDefaultApiUrl();

// FEATURE 1: hold time before a stable sign becomes a confirmed character.
export const HOLD_CONFIRM_MS = 900;
export const LETTER_COOLDOWN_MS = 900;
export const TARGET_FPS = 20;
export const FRAME_INTERVAL_MS = Math.round(1000 / TARGET_FPS);
export const PREDICTION_THROTTLE_MS = 220;
export const MIN_CLIENT_CONFIDENCE = 0.55;
export const TOAST_TIMEOUT_MS = 4200;
export const DEFAULT_REVERSE_SPEED = 1.2;
export const MIN_REVERSE_SPEED = 0.5;
export const MAX_REVERSE_SPEED = 2.5;
export const GEMINI_MAX_RETRIES = 2;
export const GEMINI_RETRY_BASE_MS = 700;

export const COMMON_WORDS = [
  'hello',
  'help',
  'hearing',
  'deaf',
  'please',
  'thanks',
  'thank',
  'water',
  'doctor',
  'family',
  'yes',
  'no',
  'good',
  'name',
  'need',
  'want',
  'sorry',
  'fine',
  'call',
  'friend',
  'school',
  'home',
  'food',
  'bathroom',
  'love',
  'learn'
];

export const QUICK_PHRASES = [
  'Hello there',
  'How are you',
  'I need help',
  'Please wait',
  'Thank you',
  'I need water',
  'Call my family',
  'Nice to meet you'
];

export const EASY_PRACTICE_LETTERS = ['A', 'B', 'C', 'D', 'L', 'O', 'Y'];
export const ALL_PRACTICE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const LETTER_REFERENCE_HINTS = {
  A: 'ASL reference card',
  B: 'ASL reference card',
  C: 'ASL reference card',
  D: 'ASL reference card',
  E: 'ASL reference card',
  F: 'ASL reference card',
  G: 'ASL reference card',
  H: 'ASL reference card',
  I: 'ASL reference card',
  J: 'ASL reference card',
  K: 'ASL reference card',
  L: 'ASL reference card',
  M: 'ASL reference card',
  N: 'ASL reference card',
  O: 'ASL reference card',
  P: 'ASL reference card',
  Q: 'ASL reference card',
  R: 'ASL reference card',
  S: 'ASL reference card',
  T: 'ASL reference card',
  U: 'ASL reference card',
  V: 'ASL reference card',
  W: 'ASL reference card',
  X: 'ASL reference card',
  Y: 'ASL reference card',
  Z: 'ASL reference card'
};
