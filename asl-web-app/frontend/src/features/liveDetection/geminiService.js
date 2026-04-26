import { API_URL, COMMON_WORDS, GEMINI_MAX_RETRIES, GEMINI_RETRY_BASE_MS } from './constants';

function getApiErrorMessage(payload, fallbackMessage) {
  return payload?.error?.message || fallbackMessage;
}

async function postGeminiRequest({ endpoint, body, fallbackMessage }) {
  let lastError = null;

  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, fallbackMessage));
      }

      return payload;
    } catch (error) {
      lastError = error;
      if (attempt >= GEMINI_MAX_RETRIES) {
        break;
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, GEMINI_RETRY_BASE_MS * (attempt + 1));
      });
    }
  }

  throw lastError || new Error(fallbackMessage);
}

async function fetchBackendSuggestions(text) {
  const response = await fetch(`${API_URL}/predict-words`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, 'Backend suggestions failed.'));
  }

  return Array.isArray(payload?.predictions) ? payload.predictions : [];
}

export function getFallbackWordSuggestions(letters) {
  const normalized = String(letters || '').trim().toLowerCase();
  if (!normalized) {
    return COMMON_WORDS.slice(0, 3);
  }

  const matches = COMMON_WORDS.filter((word) => word.startsWith(normalized));
  const fuzzyMatches = COMMON_WORDS.filter(
    (word) => word.includes(normalized) && !matches.includes(word)
  );

  return [...matches, ...fuzzyMatches].slice(0, 3);
}

function levenshteinDistance(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  const matrix = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= right.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

export function getFallbackCorrectedWord(letters) {
  const normalized = String(letters || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  if (COMMON_WORDS.includes(normalized)) {
    return normalized;
  }

  const ranked = COMMON_WORDS
    .map((word) => ({
      word,
      score: levenshteinDistance(normalized, word)
    }))
    .sort((a, b) => a.score - b.score || a.word.length - b.word.length);

  return ranked[0]?.score <= 2 ? ranked[0].word : normalized;
}

// FEATURE 2: correct noisy letter sequences before suggestion lookup.
export async function correctNoisyWord(letters) {
  const normalized = String(letters || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  const payload = await postGeminiRequest({
    endpoint: '/gemini/correct',
    fallbackMessage: 'Gemini could not correct the noisy word input.',
    body: {
      text: normalized
    }
  });

  const corrected = String(payload?.corrected || '').trim().toLowerCase();
  return corrected || getFallbackCorrectedWord(normalized);
}

// FEATURE 1: Gemini autocomplete for the current signed word.
export async function fetchGeminiWordSuggestions(letters) {
  const normalized = String(letters || '').trim();
  if (!normalized) {
    return [];
  }

  try {
    const payload = await postGeminiRequest({
      endpoint: '/gemini/suggestions',
      fallbackMessage: 'Gemini could not return word suggestions.',
      body: {
        text: normalized
      }
    });

    const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
    return suggestions.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 3);
  } catch {
    const backendSuggestions = await fetchBackendSuggestions(normalized).catch(() => []);
    return backendSuggestions.length
      ? backendSuggestions.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 3)
      : getFallbackWordSuggestions(normalized);
  }
}

// FEATURE 5: Gemini Roman Urdu translation.
export async function translateSentenceToRomanUrdu(sentence) {
  const normalized = String(sentence || '').trim();
  if (!normalized) {
    return '';
  }

  const payload = await postGeminiRequest({
    endpoint: '/gemini/translate-urdu',
    fallbackMessage: 'Gemini could not translate this sentence.',
    body: {
      text: normalized
    }
  });

  return String(payload?.translation || '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
}
