import React, {
  useCallback,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  AlertTriangle,
  Bot,
  Camera,
  Gauge,
  Hand,
  Languages,
  Mic,
  MicOff,
  Pause,
  Play,
  RefreshCcw,
  Sparkles,
  Volume2,
  VolumeX
} from 'lucide-react';
import FeatureBoundary from '../features/liveDetection/FeatureBoundary';
import getReferenceCard from '../features/liveDetection/aslReferenceData';
import {
  API_URL,
  ALL_PRACTICE_LETTERS,
  DEFAULT_REVERSE_SPEED,
  EASY_PRACTICE_LETTERS,
  GEMINI_SESSION_KEY,
  HOLD_CONFIRM_MS,
  LETTER_COOLDOWN_MS,
  MAX_REVERSE_SPEED,
  MIN_CLIENT_CONFIDENCE,
  MIN_REVERSE_SPEED,
  QUICK_PHRASES,
  TOAST_TIMEOUT_MS
} from '../features/liveDetection/constants';
import {
  correctNoisyWord,
  fetchGeminiWordSuggestions,
  getFallbackCorrectedWord,
  getFallbackWordSuggestions,
  translateSentenceToRomanUrdu
} from '../features/liveDetection/geminiService';
import liveFeatureToggles from '../features/liveDetection/featureToggles';
import useLiveDetectionEngine from '../features/liveDetection/useLiveDetectionEngine';
import useSpeechSynthesis from '../features/liveDetection/useSpeechSynthesis';
import { saveConversationEntry, savePracticeSnapshot } from '../services/firebaseSync';

function loadSessionValue(key, fallback = '') {
  try {
    return sessionStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function loadLocalArray(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getConfidenceTone(confidence) {
  if (confidence >= 0.8) {
    return { label: 'High', color: '#00ff88' };
  }
  if (confidence >= 0.55) {
    return { label: 'Medium', color: '#ffd166' };
  }
  return { label: 'Low', color: '#ff6b6b' };
}

function normalizeSignedText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function buildSentence(sentence, currentWord) {
  const parts = [normalizeSignedText(sentence), normalizeSignedText(currentWord)].filter(Boolean);
  return parts.join(' ').trim();
}

function sanitizeTextToLetters(text) {
  return String(text || '')
    .toUpperCase()
    .split('')
    .filter((character) => /[A-Z ]/.test(character));
}

function choosePracticeLetter(difficulty, completedLetters) {
  const pool = difficulty === 'easy' ? EASY_PRACTICE_LETTERS : ALL_PRACTICE_LETTERS;
  const remaining = pool.filter((letter) => !completedLetters.has(letter));
  const source = remaining.length ? remaining : pool;
  return source[Math.floor(Math.random() * source.length)];
}

function ToastStack({ toasts }) {
  return (
    <div className="fixed right-4 top-4 z-50 flex w-[min(92vw,22rem)] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${
            toast.type === 'error'
              ? 'border-red-400/40 bg-red-500/15 text-red-50'
              : toast.type === 'success'
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-50'
                : 'border-[#00ff88]/30 bg-slate-900/90 text-slate-100'
          }`}
        >
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      ))}
    </div>
  );
}

function PillButton({ active, children, ...props }) {
  return (
    <button
      {...props}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'border-[#00ff88] bg-[#00ff88] text-slate-950 shadow-[0_0_22px_rgba(0,255,136,0.25)]'
          : 'border-slate-700 bg-slate-900/80 text-slate-200 hover:border-slate-500'
      } ${props.className || ''}`}
    >
      {children}
    </button>
  );
}

function LiveDetection() {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const letterHoldRef = useRef({ letter: '', since: 0, confirmedAt: 0 });
  const recognitionRef = useRef(null);
  const controlActionHandlerRef = useRef(null);
  const practiceSessionIdRef = useRef(`practice-${Math.random().toString(36).slice(2, 10)}`);
  const suggestionRequestIdRef = useRef(0);

  const [activeTab, setActiveTab] = useState('sign');
  const [isDetecting, setIsDetecting] = useState(false);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState(() => loadSessionValue(GEMINI_SESSION_KEY));
  const [currentWord, setCurrentWord] = useState('');
  const [correctedWord, setCorrectedWord] = useState('');
  const [sentenceText, setSentenceText] = useState('');
  const [wordSuggestions, setWordSuggestions] = useState([]);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [isCorrectionLoading, setIsCorrectionLoading] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [letterHistory, setLetterHistory] = useState(() => loadLocalArray('alphahand-letter-history'));
  const [sentenceHistory, setSentenceHistory] = useState(() => loadLocalArray('alphahand-sentence-history'));
  const [toasts, setToasts] = useState([]);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(false);
  const [urduTranslation, setUrduTranslation] = useState('');
  const [isUrduLoading, setIsUrduLoading] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [practiceDifficulty, setPracticeDifficulty] = useState('medium');
  const [practiceLetter, setPracticeLetter] = useState('A');
  const [practiceScore, setPracticeScore] = useState(0);
  const [practiceStreak, setPracticeStreak] = useState(0);
  const [practiceCompleted, setPracticeCompleted] = useState(() => new Set());
  const [practiceTimer, setPracticeTimer] = useState(5);
  const [practiceBurst, setPracticeBurst] = useState(false);
  const [reverseInput, setReverseInput] = useState('');
  const [reverseListening, setReverseListening] = useState(false);
  const [reversePlaying, setReversePlaying] = useState(false);
  const [reverseSpeed, setReverseSpeed] = useState(DEFAULT_REVERSE_SPEED);
  const [reverseIndex, setReverseIndex] = useState(0);
  const [backendHealth, setBackendHealth] = useState({
    status: 'checking',
    message: 'Checking prediction backend...',
    checkedAt: ''
  });

  const {
    supported: speechSupported,
    voices,
    selectedVoice,
    selectedVoiceURI,
    setSelectedVoiceURI,
    isSpeaking,
    speakText,
    stopSpeaking
  } = useSpeechSynthesis();

  const {
    cameraStatus,
    predictionState,
    lastLandmarks,
    connectionStatus,
    error: detectionError,
    visionQuality,
    sessionId
  } = useLiveDetectionEngine({
    enabled: isDetecting,
    videoRef,
    overlayRef,
    showLandmarks,
    onControlGesture: (action) => controlActionHandlerRef.current?.(action)
  });

  const deferredReverseInput = useDeferredValue(reverseInput);
  const reverseSequence = useMemo(
    () => sanitizeTextToLetters(deferredReverseInput),
    [deferredReverseInput]
  );
  const displayedWord = correctedWord || currentWord;
  const currentSentence = buildSentence(sentenceText, displayedWord);
  const referenceCard = getReferenceCard(
    activeTab === 'reverse'
      ? reverseSequence[reverseIndex] && reverseSequence[reverseIndex] !== ' '
        ? reverseSequence[reverseIndex]
        : 'A'
      : practiceLetter
  );
  const confidenceTone = getConfidenceTone(predictionState.confidence);
  const topPredictions = predictionState.topPredictions || [];

  const pushToast = (message, type = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, TOAST_TIMEOUT_MS);
  };

  const checkBackendHealth = useCallback(async () => {
    setBackendHealth({
      status: 'checking',
      message: 'Checking prediction backend...',
      checkedAt: new Date().toISOString()
    });

    try {
      const response = await fetch(`${API_URL}/health`, {
        method: 'GET'
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Health endpoint returned a non-OK response.');
      }

      setBackendHealth({
        status: payload?.model_loaded ? 'healthy' : 'degraded',
        message: payload?.model_loaded
          ? 'Backend reachable and model loaded.'
          : 'Backend reachable, but the model is not loaded.',
        checkedAt: new Date().toISOString()
      });
    } catch (error) {
      setBackendHealth({
        status: 'offline',
        message: error.message || 'Prediction backend is unreachable.',
        checkedAt: new Date().toISOString()
      });
    }
  }, []);

  const requestSuggestions = useCallback(async (letters) => {
    const normalized = normalizeSignedText(letters);
    const requestId = suggestionRequestIdRef.current + 1;
    suggestionRequestIdRef.current = requestId;

    if (!normalized) {
      startTransition(() => {
        if (suggestionRequestIdRef.current === requestId) {
          setWordSuggestions([]);
          setCorrectedWord('');
        }
      });
      return;
    }

    if (suggestionRequestIdRef.current === requestId) {
      setIsCorrectionLoading(true);
    }
    let corrected = normalized.toLowerCase();
    try {
      corrected = await correctNoisyWord(normalized, geminiApiKey);
    } catch (error) {
      console.error('Gemini correction failed.', error);
      corrected = getFallbackCorrectedWord(normalized);
      pushToast(error.message || 'AI correction failed. Using local fallback.', 'error');
    } finally {
      if (suggestionRequestIdRef.current === requestId) {
        setIsCorrectionLoading(false);
      }
    }

    if (suggestionRequestIdRef.current !== requestId) {
      return;
    }

    startTransition(() => setCorrectedWord(corrected));

    if (!geminiApiKey) {
      startTransition(() => {
        if (suggestionRequestIdRef.current === requestId) {
          setWordSuggestions(getFallbackWordSuggestions(corrected));
        }
      });
      return;
    }

    if (suggestionRequestIdRef.current === requestId) {
      setIsSuggestionLoading(true);
    }
    try {
      const suggestions = await fetchGeminiWordSuggestions(corrected, geminiApiKey);
      if (suggestionRequestIdRef.current !== requestId) {
        return;
      }
      startTransition(() => {
        if (suggestionRequestIdRef.current === requestId) {
          setWordSuggestions(suggestions.length ? suggestions : getFallbackWordSuggestions(corrected));
        }
      });
    } catch (error) {
      console.error('Gemini autocomplete failed.', error);
      pushToast(error.message || 'Gemini suggestions failed. Using local fallback.', 'error');
      if (suggestionRequestIdRef.current !== requestId) {
        return;
      }
      startTransition(() => {
        if (suggestionRequestIdRef.current === requestId) {
          setWordSuggestions(getFallbackWordSuggestions(corrected));
        }
      });
    } finally {
      if (suggestionRequestIdRef.current === requestId) {
        setIsSuggestionLoading(false);
      }
    }
  }, [geminiApiKey]);

  // FEATURE 1: confirm stable letters after 1.5s without changing the underlying detector.
  useEffect(() => {
    if (!isDetecting || !predictionState.stablePrediction || predictionState.confidence < MIN_CLIENT_CONFIDENCE) {
      letterHoldRef.current = { letter: '', since: 0, confirmedAt: 0 };
      setHoldProgress(0);
      return undefined;
    }

    const nextLetter = predictionState.stablePrediction;
    if (letterHoldRef.current.letter !== nextLetter) {
      letterHoldRef.current = { letter: nextLetter, since: Date.now(), confirmedAt: 0 };
      setHoldProgress(0);
    }

    const interval = window.setInterval(() => {
      if (letterHoldRef.current.letter !== nextLetter) {
        return;
      }

      const elapsed = Date.now() - letterHoldRef.current.since;
      setHoldProgress(Math.min(elapsed / HOLD_CONFIRM_MS, 1));

      if (
        elapsed >= HOLD_CONFIRM_MS &&
        Date.now() - letterHoldRef.current.confirmedAt > LETTER_COOLDOWN_MS
      ) {
        letterHoldRef.current.confirmedAt = Date.now();
        const confirmedLetter = nextLetter;

        if (isPracticeMode) {
          if (confirmedLetter === practiceLetter) {
            setPracticeScore((prev) => prev + 10);
            setPracticeStreak((prev) => prev + 1);
            setPracticeCompleted((prev) => new Set([...prev, confirmedLetter]));
            pushToast(`Correct: ${confirmedLetter} (+10)`, 'success');
          } else {
            setPracticeStreak(0);
          }
        } else {
          setCurrentWord((prev) => {
            const nextWord = `${prev}${confirmedLetter}`.toLowerCase();
            requestSuggestions(nextWord);
            return nextWord;
          });

          setLetterHistory((prev) => [
            {
              letter: confirmedLetter,
              confidence: predictionState.confidence,
              createdAt: new Date().toISOString()
            },
            ...prev
          ].slice(0, 24));
        }
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [
    isDetecting,
    isPracticeMode,
    practiceLetter,
    predictionState.confidence,
    predictionState.stablePrediction,
    requestSuggestions
  ]);

  useEffect(() => {
    localStorage.setItem('alphahand-letter-history', JSON.stringify(letterHistory.slice(0, 24)));
  }, [letterHistory]);

  useEffect(() => {
    localStorage.setItem('alphahand-sentence-history', JSON.stringify(sentenceHistory.slice(0, 10)));
  }, [sentenceHistory]);

  useEffect(() => {
    try {
      sessionStorage.setItem(GEMINI_SESSION_KEY, geminiApiKey);
    } catch {
      // Ignore storage errors in restricted browser modes.
    }
  }, [geminiApiKey]);

  useEffect(() => {
    checkBackendHealth();
  }, [checkBackendHealth]);

  useEffect(() => {
    if (!isPracticeMode) {
      return undefined;
    }

    setPracticeLetter((prev) => prev || choosePracticeLetter(practiceDifficulty, practiceCompleted));
    if (practiceDifficulty !== 'hard') {
      return undefined;
    }

    setPracticeTimer(5);
    const interval = window.setInterval(() => {
      setPracticeTimer((prev) => {
        if (prev <= 1) {
          setPracticeStreak(0);
          setPracticeLetter(choosePracticeLetter(practiceDifficulty, practiceCompleted));
          pushToast('Practice timer expired. New challenge loaded.', 'info');
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isPracticeMode, practiceCompleted, practiceDifficulty]);

  useEffect(() => {
    if (!isPracticeMode) {
      return;
    }

    if (practiceStreak > 0 && practiceStreak % 5 === 0) {
      setPracticeBurst(true);
      pushToast('Five correct signs in a row.', 'success');
      window.setTimeout(() => setPracticeBurst(false), 1800);
    }

    if (practiceCompleted.has(practiceLetter)) {
      setPracticeLetter(choosePracticeLetter(practiceDifficulty, practiceCompleted));
      if (practiceDifficulty === 'hard') {
        setPracticeTimer(5);
      }
    }
  }, [isPracticeMode, practiceCompleted, practiceDifficulty, practiceLetter, practiceStreak]);

  useEffect(() => {
    if (!isPracticeMode && practiceScore === 0 && practiceStreak === 0) {
      return;
    }

    savePracticeSnapshot(practiceSessionIdRef.current, {
      score: practiceScore,
      streak: practiceStreak,
      difficulty: practiceDifficulty,
      practiceMode: isPracticeMode,
      completedLetters: Array.from(practiceCompleted),
      updatedClientAt: new Date().toISOString()
    });
  }, [isPracticeMode, practiceCompleted, practiceDifficulty, practiceScore, practiceStreak]);

  // FEATURE 6: browser-native speech recognition for reverse mode input.
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return undefined;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      let nextText = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        nextText += event.results[index][0].transcript;
      }
      startTransition(() => setReverseInput(nextText));
    };
    recognition.onerror = () => {
      setReverseListening(false);
      pushToast('Speech recognition stopped unexpectedly.', 'error');
    };
    recognition.onend = () => {
      setReverseListening(false);
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.stop();
    };
  }, []);

  useEffect(() => {
    if (!reversePlaying || reverseSequence.length === 0) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setReverseIndex((prev) => {
        if (prev >= reverseSequence.length - 1) {
          return 0;
        }
        return prev + 1;
      });
    }, 1000 / reverseSpeed);

    return () => window.clearTimeout(timeout);
  }, [reverseIndex, reversePlaying, reverseSequence, reverseSpeed]);

  useEffect(() => {
    setReverseIndex(0);
  }, [reverseSequence]);

  const handleCommitWord = async () => {
    const normalizedWord = normalizeSignedText(displayedWord);
    if (!normalizedWord) {
      pushToast('No current word to commit.', 'info');
      return;
    }

    const nextSentence = normalizeSignedText(
      sentenceText ? `${sentenceText} ${normalizedWord}` : normalizedWord
    );
    setSentenceText(nextSentence);
    setSentenceHistory((prev) => [
      { text: nextSentence, createdAt: new Date().toISOString() },
      ...prev
    ].slice(0, 10));
    setCurrentWord('');
    setCorrectedWord('');
    setWordSuggestions([]);
    setUrduTranslation('');

    saveConversationEntry({
      text: normalizedWord,
      sentenceSnapshot: nextSentence,
      speaker: 'Signer',
      mode: 'ASL',
      entryType: 'word_commit',
      timestamp: new Date().toISOString()
    });

    if (autoSpeakEnabled && speechSupported) {
      try {
        speakText(normalizedWord, { rate: 0.9 });
      } catch (error) {
        pushToast(error.message, 'error');
      }
    }
  };

  const handleClearWord = () => {
    setCurrentWord('');
    setCorrectedWord('');
    setWordSuggestions([]);
  };

  const handleBackspace = () => {
    if (currentWord) {
      const nextWord = currentWord.slice(0, -1);
      setCurrentWord(nextWord);
      requestSuggestions(nextWord);
      return;
    }

    if (sentenceText) {
      setSentenceText((prev) => prev.slice(0, -1).trimEnd());
    }
  };

  const handleApplySuggestion = (suggestion) => {
    const normalizedSuggestion = normalizeSignedText(suggestion).toLowerCase();
    setCurrentWord(normalizedSuggestion);
    setCorrectedWord(normalizedSuggestion);
    requestSuggestions(normalizedSuggestion);
  };

  const handleSpeak = () => {
    const textToSpeak = displayedWord || currentSentence;
    if (!speechSupported) {
      pushToast('Speech synthesis is not available in this browser.', 'error');
      return;
    }
    if (!textToSpeak) {
      pushToast('Nothing to speak yet.', 'info');
      return;
    }

    try {
      speakText(textToSpeak);
    } catch (error) {
      pushToast(error.message, 'error');
    }
  };

  const handleTranslateUrdu = async () => {
    const sourceSentence = normalizeSignedText(currentSentence);
    if (!sourceSentence) {
      pushToast('Build a sentence before translating.', 'info');
      return;
    }

    if (!geminiApiKey) {
      pushToast('Enter a Gemini API key to enable Roman Urdu translation.', 'error');
      return;
    }

    setIsUrduLoading(true);
    try {
      const translation = await translateSentenceToRomanUrdu(sourceSentence, geminiApiKey);
      startTransition(() => setUrduTranslation(translation));
    } catch (error) {
      console.error('Roman Urdu translation failed.', error);
      pushToast(error.message || 'Roman Urdu translation failed.', 'error');
      startTransition(() => setUrduTranslation(''));
    } finally {
      setIsUrduLoading(false);
    }
  };

  const handleSpeakUrdu = () => {
    if (!urduTranslation) {
      pushToast('No Roman Urdu translation available.', 'info');
      return;
    }

    const urduVoice =
      voices.find((voice) => voice.lang?.toLowerCase().includes('ur')) ||
      voices.find((voice) => voice.name?.toLowerCase().includes('pakistan'));

    try {
      speakText(urduTranslation, { voice: urduVoice || selectedVoice, rate: 0.88 });
    } catch (error) {
      pushToast(error.message, 'error');
    }
  };

  const handleToggleRecognition = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      pushToast('Speech recognition is not available in this browser.', 'error');
      return;
    }

    if (reverseListening) {
      recognition.stop();
      setReverseListening(false);
      return;
    }

    recognition.start();
    setReverseListening(true);
  };

  useEffect(() => {
    controlActionHandlerRef.current = (action) => {
      if (action === 'space') {
        handleCommitWord();
        pushToast('Secondary hand gesture: SPACE', 'success');
      } else if (action === 'clear') {
        handleClearWord();
        pushToast('Secondary hand gesture: CLEAR', 'info');
      } else if (action === 'speak') {
        handleSpeak();
        pushToast('Secondary hand gesture: SPEAK', 'info');
      }
    };
  });

  const renderReverseCard = (letter, index) => {
    if (letter === ' ') {
      return (
        <div
          key={`space-${index}`}
          className={`flex h-40 items-center justify-center rounded-3xl border border-dashed ${
            index === reverseIndex && reversePlaying
              ? 'border-[#00ff88] bg-[#00ff88]/10 text-[#00ff88]'
              : 'border-slate-700 bg-slate-900/60 text-slate-400'
          }`}
        >
          SPACE
        </div>
      );
    }

    const card = getReferenceCard(letter);
    const isActive = index === reverseIndex;
    return (
      <div
        key={`${letter}-${index}`}
        className={`rounded-3xl border p-3 transition ${
          isActive
            ? 'border-[#00ff88] bg-[#00ff88]/10 shadow-[0_0_28px_rgba(0,255,136,0.18)]'
            : 'border-slate-800 bg-slate-950/80'
        }`}
      >
        <img
          src={card.image}
          alt={`ASL sign card for ${letter}`}
          className="h-40 w-full rounded-2xl object-cover"
        />
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="font-semibold text-white">{letter}</span>
          <span className={isActive ? 'text-[#00ff88]' : 'text-slate-400'}>
            {isActive ? 'Active' : 'Queued'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 text-slate-100">
      <ToastStack toasts={toasts} />

      <section className="overflow-hidden rounded-[2rem] border border-[#00ff88]/20 bg-[radial-gradient(circle_at_top_left,_rgba(0,255,136,0.14),_transparent_28%),linear-gradient(145deg,#020617,#08130f_55%,#03120c)] p-6 shadow-2xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#00ff88]/30 bg-[#00ff88]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#8fffc7]">
              <Sparkles size={14} />
              AlphaHand Live Communication
            </div>
            <h2 className="text-4xl font-black tracking-tight text-white md:text-5xl">
              Real-time ASL detection with word building, speech, practice, Urdu, and reverse playback.
            </h2>
            <p className="max-w-2xl text-sm text-slate-300 md:text-base">
              The webcam stays central, prediction logic stays intact, and AI helpers remain optional with graceful fallback.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[28rem]">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Prediction Service</p>
              <p className={`mt-2 text-lg font-semibold ${connectionStatus === 'connected' ? 'text-[#00ff88]' : 'text-red-300'}`}>
                {connectionStatus === 'connected' ? 'Connected' : 'Offline'}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Session</p>
              <p className="mt-2 truncate font-mono text-sm text-slate-200">{sessionId}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 sm:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Backend Health</p>
                  <p className={`mt-2 text-lg font-semibold ${
                    backendHealth.status === 'healthy'
                      ? 'text-[#00ff88]'
                      : backendHealth.status === 'degraded'
                        ? 'text-amber-300'
                        : backendHealth.status === 'checking'
                          ? 'text-sky-300'
                          : 'text-red-300'
                  }`}>
                    {backendHealth.status}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">{backendHealth.message}</p>
                  <p className="mt-2 break-all font-mono text-xs text-slate-500">{API_URL}</p>
                </div>
                <button
                  onClick={checkBackendHealth}
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500"
                >
                  Recheck Backend
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <PillButton active={activeTab === 'sign'} onClick={() => setActiveTab('sign')}>
          Sign to Speech
        </PillButton>
        {liveFeatureToggles.reverseMode && (
          <PillButton active={activeTab === 'reverse'} onClick={() => setActiveTab('reverse')}>
            Text to Sign
          </PillButton>
        )}
      </div>

      {activeTab === 'sign' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.9fr)]">
          <FeatureBoundary title="Live Camera">
            <section className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-5 shadow-xl">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Camera Surface</p>
                  <h3 className="mt-1 text-2xl font-bold text-white">ASL detection viewport</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PillButton active={showLandmarks} onClick={() => setShowLandmarks((prev) => !prev)}>
                    <Hand size={14} className="mr-1 inline" />
                    Landmarks
                  </PillButton>
                  {liveFeatureToggles.debugPanel && (
                    <PillButton active={showDebugPanel} onClick={() => setShowDebugPanel((prev) => !prev)}>
                      <Bot size={14} className="mr-1 inline" />
                      Debug
                    </PillButton>
                  )}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-800 bg-black">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="aspect-video w-full scale-x-[-1] object-cover"
                />
                <canvas
                  ref={overlayRef}
                  className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]"
                />

                <div className="absolute left-4 top-4 max-w-xs rounded-3xl border border-slate-700/80 bg-slate-950/85 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Current Prediction</p>
                  <div className="mt-2 flex items-end gap-3">
                    <span className="text-5xl font-black text-white">
                      {predictionState.stablePrediction || predictionState.rawPrediction || '...'}
                    </span>
                    <span className="pb-2 text-sm font-semibold" style={{ color: confidenceTone.color }}>
                      {confidenceTone.label}
                    </span>
                  </div>

                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(0, Math.min(predictionState.confidence * 100, 100))}%`,
                        background: `linear-gradient(90deg, ${confidenceTone.color}, #69ffbe)`
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                    <span>{Math.round(predictionState.confidence * 100)}%</span>
                    <span>
                      Hold {Math.round(holdProgress * 100)}% of {HOLD_CONFIRM_MS / 1000}s
                    </span>
                  </div>
                </div>

                {isPracticeMode && liveFeatureToggles.practiceMode && (
                  <div className="absolute bottom-4 left-4 right-4 rounded-[1.5rem] border border-[#00ff88]/30 bg-slate-950/90 p-4 backdrop-blur">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-[#6cffb0]">Practice Mode</p>
                        <h4 className="text-3xl font-black text-white">{practiceLetter}</h4>
                        <p className="text-sm text-slate-300">Match the target sign and hold for confirmation.</p>
                      </div>
                      <div className="flex gap-5 text-sm">
                        <div>
                          <p className="text-slate-500">Score</p>
                          <p className="text-xl font-bold text-white">{practiceScore}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Streak</p>
                          <p className="text-xl font-bold text-white">{practiceStreak}</p>
                        </div>
                        {practiceDifficulty === 'hard' && (
                          <div>
                            <p className="text-slate-500">Timer</p>
                            <p className={`text-xl font-bold ${practiceTimer <= 2 ? 'text-red-300' : 'text-white'}`}>
                              {practiceTimer}s
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {practiceBurst && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#00ff88]/10">
                    <div className="rounded-full border border-[#00ff88]/40 bg-[#00ff88]/20 px-8 py-4 text-2xl font-black text-[#b8ffda] shadow-[0_0_36px_rgba(0,255,136,0.35)] animate-pulse">
                      5 Sign Streak
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => setIsDetecting((prev) => !prev)}
                  className={`rounded-2xl px-5 py-3 font-semibold transition ${
                    isDetecting
                      ? 'bg-red-500 text-white hover:bg-red-400'
                      : 'bg-[#00ff88] text-slate-950 hover:bg-[#5cffaf]'
                  }`}
                >
                  <Camera size={18} className="mr-2 inline" />
                  {isDetecting ? 'Stop Detection' : 'Start Detection'}
                </button>
                <button
                  onClick={() => {
                    setSentenceText('');
                    setCurrentWord('');
                    setCorrectedWord('');
                    setWordSuggestions([]);
                    setUrduTranslation('');
                  }}
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 font-semibold text-slate-100 hover:border-slate-500"
                >
                  <RefreshCcw size={18} className="mr-2 inline" />
                  Reset Session
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Camera Status</p>
                  <p className="mt-2 text-lg font-semibold capitalize text-white">{cameraStatus}</p>
                </div>
                <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Stability</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {predictionState.stability.ready
                      ? `${predictionState.stability.hits}/${Math.max(
                          predictionState.stability.window,
                          predictionState.stability.hits
                        )} stable`
                      : `${Math.round((predictionState.stability.ratio || 0) * 100)}%`}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Confidence</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {(predictionState.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              {liveFeatureToggles.qualityWarnings && (
                <>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Lighting</p>
                      <p className={`mt-2 text-lg font-semibold ${visionQuality.lighting === 'low' ? 'text-amber-300' : 'text-white'}`}>
                        {visionQuality.lighting} ({visionQuality.brightness})
                      </p>
                    </div>
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Hands</p>
                      <p className="mt-2 text-lg font-semibold text-white">{visionQuality.handCount}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Occlusion</p>
                      <p className="mt-2 text-lg font-semibold capitalize text-white">{visionQuality.occlusion}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                    <AlertTriangle size={16} className="mr-2 inline" />
                    {visionQuality.hint}
                  </div>
                </>
              )}

              {detectionError && (
                <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {detectionError}
                </div>
              )}
            </section>
          </FeatureBoundary>

          <div className="space-y-6">
            {liveFeatureToggles.wordBuilder && (
              <FeatureBoundary title="Word Builder">
                <section className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-5 shadow-xl">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Feature 1</p>
                      <h3 className="mt-1 text-2xl font-bold text-white">Word builder</h3>
                    </div>
                    <div className="w-full max-w-sm">
                      <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-500">
                        Gemini API Key
                      </label>
                      <input
                        type="password"
                        value={geminiApiKey}
                        onChange={(event) => setGeminiApiKey(event.target.value)}
                        placeholder="Stored in sessionStorage"
                        className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-[#00ff88]"
                      />
                    </div>
                  </div>

                  <div className="mt-5 rounded-[1.75rem] border border-[#00ff88]/20 bg-[linear-gradient(180deg,rgba(0,255,136,0.10),rgba(2,6,23,0.3))] p-5">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#8fffc7]">Current Word</p>
                    <p className="mt-3 min-h-[4rem] break-words text-4xl font-black tracking-[0.2em] text-white">
                      {displayedWord || '_'}
                    </p>
                    {currentWord && correctedWord && currentWord !== correctedWord && (
                      <p className="mt-2 text-sm text-[#8fffc7]">
                        Auto-corrected from <span className="font-mono text-slate-400">{currentWord}</span> to <span className="font-mono text-white">{correctedWord}</span>
                      </p>
                    )}
                  </div>

                  <div className="mt-4 rounded-[1.75rem] border border-slate-800 bg-slate-900/80 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Sentence Output</p>
                        <p className="mt-2 min-h-[3rem] break-words text-lg font-medium text-slate-100">
                          {currentSentence || 'Committed words appear here.'}
                        </p>
                      </div>
                      <div className="text-right text-sm text-slate-400">
                        <div>{currentSentence ? currentSentence.split(/\s+/).filter(Boolean).length : 0} words</div>
                        <div>{currentSentence.length} chars</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={handleCommitWord}
                      className="rounded-2xl bg-[#00ff88] px-4 py-3 font-semibold text-slate-950 hover:bg-[#5cffaf]"
                    >
                      SPACE
                    </button>
                    <button
                      onClick={handleClearWord}
                      className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 font-semibold text-slate-100 hover:border-slate-500"
                    >
                      CLEAR
                    </button>
                    <button
                      onClick={handleBackspace}
                      className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 font-semibold text-slate-100 hover:border-slate-500"
                    >
                      Backspace
                    </button>
                  </div>

                  <div className="mt-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Sparkles size={16} className="text-[#00ff88]" />
                      <p className="text-sm font-semibold text-white">Smart autocomplete</p>
                      {isCorrectionLoading && (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#45c4ff] border-t-transparent" />
                      )}
                      {isSuggestionLoading && (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#00ff88] border-t-transparent" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(wordSuggestions.length ? wordSuggestions : QUICK_PHRASES.slice(0, 3)).map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => handleApplySuggestion(suggestion)}
                          className="rounded-full border border-[#00ff88]/25 bg-[#00ff88]/10 px-4 py-2 text-sm font-semibold capitalize text-[#b8ffda] hover:border-[#00ff88]/50 hover:bg-[#00ff88]/20"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              </FeatureBoundary>
            )}

            {liveFeatureToggles.textToSpeech && (
              <FeatureBoundary title="Text To Speech">
                <section className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-5 shadow-xl">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Feature 2</p>
                  <h3 className="mt-1 text-2xl font-bold text-white">Text-to-speech</h3>

                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-500">
                        Voice Selector
                      </label>
                      <select
                        value={selectedVoiceURI}
                        onChange={(event) => setSelectedVoiceURI(event.target.value)}
                        className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-[#00ff88]"
                      >
                        {voices.map((voice) => (
                          <option key={voice.voiceURI} value={voice.voiceURI}>
                            {voice.name} ({voice.lang})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={isSpeaking ? stopSpeaking : handleSpeak}
                        className="rounded-2xl bg-[#00ff88] px-4 py-3 font-semibold text-slate-950 hover:bg-[#5cffaf]"
                      >
                        {isSpeaking ? <VolumeX size={18} className="mr-2 inline" /> : <Volume2 size={18} className="mr-2 inline" />}
                        {isSpeaking ? 'Stop' : 'Speak'}
                      </button>
                      <PillButton active={autoSpeakEnabled} onClick={() => setAutoSpeakEnabled((prev) => !prev)}>
                        Auto-speak on SPACE
                      </PillButton>
                    </div>

                    {!speechSupported && (
                      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                        Your browser does not expose `speechSynthesis`.
                      </div>
                    )}
                  </div>
                </section>
              </FeatureBoundary>
            )}

            {liveFeatureToggles.confidencePanel && (
              <FeatureBoundary title="Confidence Panel">
                <section className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-5 shadow-xl">
                  <div className="flex items-center gap-2">
                    <Gauge size={18} className="text-[#00ff88]" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Feature 3</p>
                      <h3 className="text-2xl font-bold text-white">Confidence and predictions</h3>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {topPredictions.length > 0 ? (
                      topPredictions.map((item, index) => {
                        const label = item.label || item.prediction || '?';
                        const score = Number(item.confidence || 0);
                        return (
                          <div key={`${label}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                            <div className="mb-2 flex items-center justify-between text-sm">
                              <span className="font-semibold text-white">{label}</span>
                              <span className="text-slate-400">{(score * 100).toFixed(0)}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(0, Math.min(score * 100, 100))}%`,
                                  background: index === 0 ? '#00ff88' : index === 1 ? '#45c4ff' : '#f9d65c'
                                }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
                        Top predictions will appear once the detector receives a confident hand sign.
                      </div>
                    )}
                  </div>

                  {showDebugPanel && liveFeatureToggles.debugPanel && (
                    <div className="mt-5 rounded-2xl border border-slate-800 bg-black/70 p-4 font-mono text-xs text-[#9df6cb]">
                      <p className="mb-2 text-sm font-semibold text-white">Debug Coordinates</p>
                      <p className="mb-3 text-slate-400">Showing the first five landmarks.</p>
                      <pre className="overflow-auto whitespace-pre-wrap">
                        {JSON.stringify(lastLandmarks.slice(0, 5), null, 2)}
                      </pre>
                    </div>
                  )}
                </section>
              </FeatureBoundary>
            )}

            {liveFeatureToggles.practiceMode && (
              <FeatureBoundary title="Practice Mode">
                <section className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-5 shadow-xl">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Feature 4</p>
                      <h3 className="text-2xl font-bold text-white">Practice mode</h3>
                    </div>
                    <PillButton active={isPracticeMode} onClick={() => setIsPracticeMode((prev) => !prev)}>
                      {isPracticeMode ? 'Enabled' : 'Disabled'}
                    </PillButton>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)]">
                    <img
                      src={referenceCard.image}
                      alt={`Reference card for ${practiceLetter}`}
                      className="h-40 w-full rounded-3xl border border-slate-800 object-cover"
                    />
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <PillButton
                          active={practiceDifficulty === 'easy'}
                          onClick={() => setPracticeDifficulty('easy')}
                        >
                          Easy
                        </PillButton>
                        <PillButton
                          active={practiceDifficulty === 'medium'}
                          onClick={() => setPracticeDifficulty('medium')}
                        >
                          Medium
                        </PillButton>
                        <PillButton
                          active={practiceDifficulty === 'hard'}
                          onClick={() => setPracticeDifficulty('hard')}
                        >
                          Hard (5s)
                        </PillButton>
                      </div>
                      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm text-slate-400">Target Letter</p>
                            <p className="text-4xl font-black text-white">{practiceLetter}</p>
                          </div>
                          <button
                            onClick={() => setPracticeLetter(choosePracticeLetter(practiceDifficulty, practiceCompleted))}
                            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500"
                          >
                            New Challenge
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </FeatureBoundary>
            )}

            {liveFeatureToggles.urduMode && (
              <FeatureBoundary title="Urdu Mode">
                <section className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-5 shadow-xl">
                  <div className="flex items-center gap-2">
                    <Languages size={18} className="text-[#00ff88]" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Feature 5</p>
                      <h3 className="text-2xl font-bold text-white">Roman Urdu mode</h3>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={handleTranslateUrdu}
                      className="rounded-2xl bg-[#00ff88] px-4 py-3 font-semibold text-slate-950 hover:bg-[#5cffaf]"
                    >
                      Translate to Urdu (Roman Urdu)
                    </button>
                    <button
                      onClick={handleSpeakUrdu}
                      className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 font-semibold text-slate-100 hover:border-slate-500"
                    >
                      Speak Urdu
                    </button>
                  </div>

                  <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                    {isUrduLoading ? (
                      <div className="flex items-center gap-3 text-sm text-slate-300">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#00ff88] border-t-transparent" />
                        Translating with Gemini...
                      </div>
                    ) : (
                      <p className="min-h-[3rem] text-lg text-slate-100">
                        {urduTranslation || 'Roman Urdu translation will appear here.'}
                      </p>
                    )}
                  </div>
                </section>
              </FeatureBoundary>
            )}

            <FeatureBoundary title="History">
              <section className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-5 shadow-xl">
                <h3 className="text-xl font-bold text-white">Recent letters and sentences</h3>

                <div className="mt-4 flex flex-wrap gap-2">
                  {letterHistory.length > 0 ? (
                    letterHistory.slice(0, 12).map((item, index) => (
                      <span
                        key={`${item.createdAt}-${index}`}
                        className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                      >
                        {item.letter} · {Math.round((item.confidence || 0) * 100)}%
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">No confirmed letters yet.</span>
                  )}
                </div>

                <div className="mt-5 space-y-3">
                  {sentenceHistory.length > 0 ? (
                    sentenceHistory.slice(0, 4).map((item) => (
                      <button
                        key={item.createdAt}
                        onClick={() => {
                          setSentenceText(item.text);
                          setCurrentWord('');
                          setUrduTranslation('');
                        }}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-left text-sm text-slate-200 hover:border-slate-600"
                      >
                        {item.text}
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Committed sentences will appear here.</p>
                  )}
                </div>
              </section>
            </FeatureBoundary>
          </div>
        </div>
      ) : (
        <FeatureBoundary title="Reverse Mode">
          <section className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-5 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Feature 6</p>
                <h3 className="text-3xl font-bold text-white">Reverse mode: text to sign</h3>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  Type or dictate a sentence, then play the sign cards letter-by-letter.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleToggleRecognition}
                  className={`rounded-2xl px-4 py-3 font-semibold transition ${
                    reverseListening
                      ? 'bg-red-500 text-white hover:bg-red-400'
                      : 'bg-[#00ff88] text-slate-950 hover:bg-[#5cffaf]'
                  }`}
                >
                  {reverseListening ? <MicOff size={18} className="mr-2 inline" /> : <Mic size={18} className="mr-2 inline" />}
                  {reverseListening ? 'Stop Mic' : 'Speech Input'}
                </button>
                <button
                  onClick={() => setReversePlaying((prev) => !prev)}
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 font-semibold text-slate-100 hover:border-slate-500"
                >
                  {reversePlaying ? <Pause size={18} className="mr-2 inline" /> : <Play size={18} className="mr-2 inline" />}
                  {reversePlaying ? 'Pause' : 'Play'}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-500">
                    Input Text
                  </label>
                  <textarea
                    value={reverseInput}
                    onChange={(event) => setReverseInput(event.target.value)}
                    rows={6}
                    placeholder="Type a sentence for ASL playback"
                    className="w-full rounded-[1.5rem] border border-slate-700 bg-slate-900 px-4 py-4 text-base text-slate-100 outline-none transition focus:border-[#00ff88]"
                  />
                </div>

                <div className="rounded-[1.5rem] border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Playback Speed</p>
                      <p className="mt-1 text-xl font-semibold text-white">{reverseSpeed.toFixed(1)}x</p>
                    </div>
                    <input
                      type="range"
                      min={MIN_REVERSE_SPEED}
                      max={MAX_REVERSE_SPEED}
                      step="0.1"
                      value={reverseSpeed}
                      onChange={(event) => setReverseSpeed(Number(event.target.value))}
                      className="w-full max-w-xs accent-[#00ff88]"
                    />
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-slate-800 bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Active Letter</p>
                  <div className="mt-4 flex items-center gap-4">
                    <img
                      src={referenceCard.image}
                      alt={`Reference card for ${referenceCard.letter}`}
                      className="h-40 w-40 rounded-3xl border border-slate-800 object-cover"
                    />
                    <div>
                      <p className="text-5xl font-black text-white">
                        {reverseSequence[reverseIndex] || '-'}
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        Letters are highlighted in sequence while playback runs.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {reverseSequence.length > 0 ? (
                  reverseSequence.map((letter, index) => renderReverseCard(letter, index))
                ) : (
                  <div className="col-span-full rounded-[1.5rem] border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center text-slate-400">
                    Enter text to generate the ASL playback queue.
                  </div>
                )}
              </div>
            </div>
          </section>
        </FeatureBoundary>
      )}

      <section className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-5 text-sm text-slate-300 shadow-xl">
        <h3 className="text-lg font-bold text-white">Detection notes</h3>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          <li>The current prediction adapter still uses the existing `/predict` contract, isolated behind a hook for later TF.js replacement.</li>
          <li>Gemini API usage is optional. If the key is missing or a request fails, local fallback suggestions keep the UI stable.</li>
          <li>Secondary-hand gestures now map to `SPACE`, `CLEAR`, and `SPEAK` with smoothing to reduce accidental triggers.</li>
          <li>Speech, speech recognition, and camera features depend on browser support and user permission.</li>
          <li>Practice reference cards are generated SVG placeholders and can be swapped for curated sign stills without changing UI code.</li>
        </ul>
      </section>
    </div>
  );
}

export default LiveDetection;
