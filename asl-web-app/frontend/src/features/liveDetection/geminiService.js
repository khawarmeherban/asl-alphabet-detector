import {
  COMMON_WORDS,
  GEMINI_API_ENDPOINT,
  GEMINI_MAX_RETRIES,
  GEMINI_RETRY_BASE_MS
} from './constants';

function getResponseText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((part) => part?.text || '')
    .join('')
    .trim();
}

function getApiErrorMessage(payload, fallbackMessage) {
  return payload?.error?.message || fallbackMessage;
}

async function postGeminiRequest({ apiKey, body, fallbackMessage }) {
  let lastError = null;

  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(GEMINI_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
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
export async function correctNoisyWord(letters, apiKey) {
  const normalized = String(letters || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  if (!apiKey) {
    return getFallbackCorrectedWord(normalized);
  }

  const payload = await postGeminiRequest({
    apiKey,
    fallbackMessage: 'Gemini could not correct the noisy word input.',
    body: {
      contents: [
        {
          parts: [
            {
              text: `Fix this possibly noisy ASL letter sequence into the most likely English word. Return ONLY JSON with one key named corrected. Input: '${normalized}'`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 40,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            corrected: { type: 'string' }
          },
          required: ['corrected']
        }
      }
    }
  });

  const text = getResponseText(payload);
  const parsed = JSON.parse(text);
  return String(parsed?.corrected || normalized).trim().toLowerCase();
}

// FEATURE 1: Gemini autocomplete for the current signed word.
export async function fetchGeminiWordSuggestions(letters, apiKey) {
  const normalized = String(letters || '').trim();
  if (!normalized || !apiKey) {
    return [];
  }

  const payload = await postGeminiRequest({
    apiKey,
    fallbackMessage: 'Gemini could not return word suggestions.',
    body: {
      contents: [
        {
          parts: [
            {
              text: `Return ONLY a JSON array of 3 likely English words based on: '${normalized}'`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 96,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'array',
          items: { type: 'string' },
          minItems: 3,
          maxItems: 3
        }
      }
    }
  });

  const text = getResponseText(payload);
  const parsed = JSON.parse(text);
  return Array.isArray(parsed)
    ? parsed.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 3)
    : [];
}

// FEATURE 5: Gemini Roman Urdu translation.
export async function translateSentenceToRomanUrdu(sentence, apiKey) {
  const normalized = String(sentence || '').trim();
  if (!normalized || !apiKey) {
    return '';
  }

  const payload = await postGeminiRequest({
    apiKey,
    fallbackMessage: 'Gemini could not translate this sentence.',
    body: {
      contents: [
        {
          parts: [
            {
              text: `Translate to Roman Urdu only: '${normalized}'`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 120
      }
    }
  });

  return getResponseText(payload)
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
}
