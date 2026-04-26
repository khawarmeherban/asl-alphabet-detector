import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Eraser,
  Languages,
  RefreshCcw,
  Sparkles,
  Volume2,
  Wand2
} from 'lucide-react';
import useLiveDetectionEngine from '../features/liveDetection/useLiveDetectionEngine';
import useSpeechSynthesis from '../features/liveDetection/useSpeechSynthesis';
import {
  API_URL,
  HOLD_CONFIRM_MS,
  LETTER_COOLDOWN_MS,
  MIN_CLIENT_CONFIDENCE
} from '../features/liveDetection/constants';
import {
  correctNoisyWord,
  fetchGeminiWordSuggestions,
  getFallbackCorrectedWord,
  getFallbackWordSuggestions,
  translateSentenceToRomanUrdu
} from '../features/liveDetection/geminiService';
import { saveConversationEntry } from '../services/firebaseSync';

function normalizeSignedText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function buildSentence(sentence, currentWord) {
  const parts = [normalizeSignedText(sentence), normalizeSignedText(currentWord)].filter(Boolean);
  return parts.join(' ').trim();
}

function getHealthTone(status) {
  if (status === 'healthy') return 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10';
  if (status === 'degraded') return 'text-amber-200 border-amber-400/30 bg-amber-400/10';
  if (status === 'offline') return 'text-rose-200 border-rose-400/30 bg-rose-400/10';
  return 'text-slate-300 border-white/10 bg-white/5';
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-[#08141d]/90 p-4 shadow-[0_16px_40px_rgba(4,12,18,0.24)]">
      <p className="text-[0.7rem] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-400">{hint}</p> : null}
    </div>
  );
}

function ActionButton({ icon: Icon, children, ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
        props.className || ''
      }`}
    >
      <Icon size={16} />
      {children}
    </button>
  );
}

export default function LiveDetection() {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const letterHoldRef = useRef({ letter: '', since: 0, confirmedAt: 0 });
  const suggestionRequestIdRef = useRef(0);

  const [isDetecting, setIsDetecting] = useState(false);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [currentWord, setCurrentWord] = useState('');
  const [correctedWord, setCorrectedWord] = useState('');
  const [sentenceText, setSentenceText] = useState('');
  const [wordSuggestions, setWordSuggestions] = useState([]);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [isCorrectionLoading, setIsCorrectionLoading] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [urduTranslation, setUrduTranslation] = useState('');
  const [isUrduLoading, setIsUrduLoading] = useState(false);
  const [backendHealth, setBackendHealth] = useState({ status: 'checking', message: 'Checking backend...' });
  const [saveStatus, setSaveStatus] = useState('');

  const {
    cameraStatus,
    predictionState,
    connectionStatus,
    error: detectionError,
    visionQuality,
    lastControlAction
  } = useLiveDetectionEngine({
    enabled: isDetecting,
    videoRef,
    overlayRef,
    showLandmarks
  });

  const { supported: speechSupported, isSpeaking, speakText, stopSpeaking } = useSpeechSynthesis();
  const displayedWord = correctedWord || currentWord;
  const currentSentence = useMemo(() => buildSentence(sentenceText, displayedWord), [sentenceText, displayedWord]);
  const detectedLetter = predictionState.stablePrediction || predictionState.rawPrediction || '...';

  const checkBackendHealth = useCallback(async () => {
    setBackendHealth({ status: 'checking', message: 'Checking backend...' });
    try {
      const response = await fetch(`${API_URL}/health`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Health endpoint failed');
      const predictorReady = Boolean(payload?.predictor_available || payload?.model_loaded);
      setBackendHealth({
        status: predictorReady ? 'healthy' : 'degraded',
        message: predictorReady
          ? (
              payload?.fallback_enabled
                ? 'Backend connected in demo fallback mode. Add asl_model.pkl for full A-Z ML accuracy.'
                : 'Backend connected and model is ready for ASL inference.'
            )
          : (payload?.setup_hint || 'Backend is online, but the ASL model is not loaded.')
      });
    } catch (error) {
      setBackendHealth({
        status: 'offline',
        message: error.message || 'Backend unreachable'
      });
    }
  }, []);

  useEffect(() => {
    checkBackendHealth();
  }, [checkBackendHealth]);

  const requestSuggestions = useCallback(async (letters) => {
    const normalized = normalizeSignedText(letters);
    const requestId = suggestionRequestIdRef.current + 1;
    suggestionRequestIdRef.current = requestId;

    if (!normalized) {
      setCorrectedWord('');
      setWordSuggestions([]);
      return;
    }

    setIsCorrectionLoading(true);
    let corrected = normalized.toLowerCase();
    try {
      corrected = await correctNoisyWord(normalized);
    } catch {
      corrected = getFallbackCorrectedWord(normalized);
    } finally {
      if (suggestionRequestIdRef.current === requestId) setIsCorrectionLoading(false);
    }

    if (suggestionRequestIdRef.current !== requestId) return;
    setCorrectedWord(corrected);

    setIsSuggestionLoading(true);
    try {
      const suggestions = await fetchGeminiWordSuggestions(corrected);
      if (suggestionRequestIdRef.current !== requestId) return;
      setWordSuggestions(suggestions.length ? suggestions : getFallbackWordSuggestions(corrected));
    } catch {
      if (suggestionRequestIdRef.current !== requestId) return;
      setWordSuggestions(getFallbackWordSuggestions(corrected));
    } finally {
      if (suggestionRequestIdRef.current === requestId) setIsSuggestionLoading(false);
    }
  }, []);

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

    const timer = window.setInterval(() => {
      if (letterHoldRef.current.letter !== nextLetter) return;

      const elapsed = Date.now() - letterHoldRef.current.since;
      setHoldProgress(Math.min(elapsed / HOLD_CONFIRM_MS, 1));

      if (elapsed >= HOLD_CONFIRM_MS && Date.now() - letterHoldRef.current.confirmedAt > LETTER_COOLDOWN_MS) {
        letterHoldRef.current.confirmedAt = Date.now();
        setCurrentWord((prev) => {
          const nextWord = `${prev}${nextLetter}`.toLowerCase();
          requestSuggestions(nextWord);
          return nextWord;
        });
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [isDetecting, predictionState.stablePrediction, predictionState.confidence, requestSuggestions]);

  const resetWordState = useCallback(() => {
    setCurrentWord('');
    setCorrectedWord('');
    setWordSuggestions([]);
    setHoldProgress(0);
  }, []);

  const handleCommitWord = useCallback(async () => {
    const normalizedWord = normalizeSignedText(displayedWord);
    if (!normalizedWord) return;

    const nextSentence = normalizeSignedText(sentenceText ? `${sentenceText} ${normalizedWord}` : normalizedWord);
    setSentenceText(nextSentence);
    resetWordState();

    const saved = await saveConversationEntry({
      text: normalizedWord,
      sentenceSnapshot: nextSentence,
      committedWord: normalizedWord,
      mode: 'ASL',
      speaker: 'Signer',
      timestamp: new Date().toISOString()
    });
    setSaveStatus(saved ? 'Synced to history.' : 'History sync unavailable.');
  }, [displayedWord, resetWordState, sentenceText]);

  const handleBackspace = useCallback(() => {
    if (!currentWord) return;
    const nextWord = currentWord.slice(0, -1);
    setCurrentWord(nextWord);
    requestSuggestions(nextWord);
  }, [currentWord, requestSuggestions]);

  const handleClearAll = useCallback(() => {
    resetWordState();
    setSentenceText('');
    setUrduTranslation('');
    setSaveStatus('');
  }, [resetWordState]);

  const handleTranslateUrdu = useCallback(async () => {
    const sourceSentence = normalizeSignedText(currentSentence);
    if (!sourceSentence) return;
    setIsUrduLoading(true);
    try {
      const translated = await translateSentenceToRomanUrdu(sourceSentence);
      setUrduTranslation(translated);
    } catch {
      setUrduTranslation('');
    } finally {
      setIsUrduLoading(false);
    }
  }, [currentSentence]);

  const handleSpeak = useCallback(() => {
    if (!speechSupported) return;
    if (isSpeaking) {
      stopSpeaking();
      return;
    }

    const source = normalizeSignedText(currentSentence);
    if (source) {
      speakText(source);
    }
  }, [currentSentence, isSpeaking, speakText, speechSupported, stopSpeaking]);

  useEffect(() => {
    if (lastControlAction === 'space') {
      handleCommitWord();
    } else if (lastControlAction === 'clear') {
      handleClearAll();
    } else if (lastControlAction === 'speak') {
      handleSpeak();
    }
  }, [handleClearAll, handleCommitWord, handleSpeak, lastControlAction]);

  return (
    <div className="space-y-6 text-slate-100">
      <section className="overflow-hidden rounded-[2rem] border border-[#1fe0b1]/20 bg-[radial-gradient(circle_at_top_left,_rgba(31,224,177,0.12),_transparent_24%),linear-gradient(145deg,#071019,#091821_58%,#061018)] p-6 shadow-[0_24px_80px_rgba(2,8,12,0.42)]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${getHealthTone(backendHealth.status)}`}>
              <Sparkles size={12} />
              {backendHealth.message}
            </div>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">Real-time ASL Alphabet Detection</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              A focused live signing workspace with temporal confirmation, intelligent word correction, and presentation-ready communication output.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <ActionButton
              onClick={() => setShowLandmarks((value) => !value)}
              icon={Wand2}
              className="border border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10"
            >
              Landmarks {showLandmarks ? 'On' : 'Off'}
            </ActionButton>
            <ActionButton
              onClick={() => setIsDetecting((value) => !value)}
              icon={Camera}
              className="bg-[#1fe0b1] text-slate-950 hover:bg-[#52e8c1]"
            >
              {isDetecting ? 'Stop Detection' : 'Start Detection'}
            </ActionButton>
            <ActionButton
              onClick={handleClearAll}
              icon={RefreshCcw}
              className="border border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10"
            >
              Reset Session
            </ActionButton>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-[#07131c]/92 p-5 shadow-[0_18px_60px_rgba(2,8,12,0.28)]">
            <div className="relative overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/80">
              <video ref={videoRef} muted playsInline className="aspect-video w-full scale-x-[-1] object-cover" />
              <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]" />
              <div className="absolute left-4 top-4 rounded-2xl border border-white/10 bg-[#061018]/80 px-4 py-3 backdrop-blur-xl">
                <p className="text-[0.68rem] uppercase tracking-[0.25em] text-slate-500">Detected Letter</p>
                <p className="mt-1 text-4xl font-black text-white">{detectedLetter}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <MetricCard label="Camera" value={cameraStatus} hint="Webcam stream and MediaPipe input status." />
              <MetricCard label="API" value={connectionStatus} hint="Prediction service connectivity." />
              <MetricCard
                label="Confidence"
                value={`${Math.round((predictionState.confidence || 0) * 100)}%`}
                hint={`Stability ${Math.round((predictionState.stability?.ratio || 0) * 100)}%`}
              />
              <MetricCard label="Lighting" value={visionQuality.lighting} hint={visionQuality.hint} />
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[#091821] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Hold To Confirm</p>
                  <p className="mt-1 text-sm text-slate-300">
                    Hold a stable letter for {Math.round(HOLD_CONFIRM_MS / 100) / 10}s to append it.
                  </p>
                </div>
                <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                  {Math.round(holdProgress * 100)}%
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#1fe0b1,#7dd3fc)] transition-all"
                  style={{ width: `${Math.round(holdProgress * 100)}%` }}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[1.5rem] border border-white/10 bg-[#091821] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Top Predictions</p>
                <div className="mt-3 space-y-3">
                  {(predictionState.topPredictions?.length ? predictionState.topPredictions : [{ label: 'Waiting', confidence: 0 }]).map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold text-white">{item.label}</span>
                        <span className="text-sm text-slate-300">{Math.round((item.confidence || 0) * 100)}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#1fe0b1,#38bdf8)]"
                          style={{ width: `${Math.round((item.confidence || 0) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-[#091821] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Input Quality</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-xs text-slate-500">Hands</p>
                    <p className="mt-1 text-xl font-bold text-white">{visionQuality.handCount}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-xs text-slate-500">Brightness</p>
                    <p className="mt-1 text-xl font-bold text-white">{visionQuality.brightness}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-xs text-slate-500">Occlusion</p>
                    <p className="mt-1 text-xl font-bold capitalize text-white">{visionQuality.occlusion}</p>
                  </div>
                </div>
                {lastControlAction ? (
                  <div className="mt-3 rounded-2xl border border-[#1fe0b1]/20 bg-[#1fe0b1]/10 px-3 py-2 text-sm text-[#b9fff1]">
                    Secondary-hand control detected: <strong className="capitalize">{lastControlAction}</strong>
                  </div>
                ) : null}
              </div>
            </div>

            {detectionError ? (
              <div className="mt-4 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">
                {detectionError}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-[#07131c]/92 p-5 shadow-[0_18px_60px_rgba(2,8,12,0.28)]">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Word Builder</p>
            <div className="mt-3 rounded-[1.5rem] border border-[#1fe0b1]/20 bg-[#0a1b21] p-4">
              <p className="text-xs text-slate-500">Current Word</p>
              <p className="mt-2 min-h-[3rem] break-words text-4xl font-black text-white">{displayedWord || '_'}</p>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[#091821] p-4">
              <p className="text-xs text-slate-500">Sentence Canvas</p>
              <p className="mt-2 min-h-[4rem] text-sm leading-7 text-slate-100">
                {currentSentence || 'Committed words build here for speech and translation.'}
              </p>
              {saveStatus ? <p className="mt-2 text-xs text-[#9aeed9]">{saveStatus}</p> : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton
                onClick={handleCommitWord}
                icon={CheckCircle2}
                className="bg-[#1fe0b1] text-slate-950 hover:bg-[#52e8c1]"
              >
                Commit Word
              </ActionButton>
              <ActionButton
                onClick={handleBackspace}
                icon={Eraser}
                className="border border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10"
              >
                Backspace
              </ActionButton>
              <ActionButton
                onClick={handleSpeak}
                icon={Volume2}
                disabled={!speechSupported}
                className="border border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSpeaking ? 'Stop Speech' : 'Speak Sentence'}
              </ActionButton>
            </div>

            <div className="mt-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Sparkles size={15} className="text-[#1fe0b1]" />
                Word Suggestions
                {(isCorrectionLoading || isSuggestionLoading) ? (
                  <span className="text-xs font-normal text-slate-400">Refreshing...</span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(wordSuggestions.length ? wordSuggestions : getFallbackWordSuggestions(displayedWord || currentWord)).map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      const value = normalizeSignedText(suggestion).toLowerCase();
                      setCurrentWord(value);
                      setCorrectedWord(value);
                      requestSuggestions(value);
                    }}
                    className="rounded-full border border-[#1fe0b1]/25 bg-[#1fe0b1]/10 px-3 py-2 text-xs font-medium text-[#d4fff5] transition hover:border-[#1fe0b1]/40 hover:bg-[#1fe0b1]/15"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#07131c]/92 p-5 shadow-[0_18px_60px_rgba(2,8,12,0.28)]">
            <div className="flex items-center gap-2">
              <Languages size={16} className="text-[#7dd3fc]" />
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Roman Urdu Translation</p>
            </div>
            <button
              onClick={handleTranslateUrdu}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
            >
              <Languages size={16} />
              {isUrduLoading ? 'Translating...' : 'Translate Sentence'}
            </button>
            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[#091821] p-4">
              <p className="text-sm leading-7 text-slate-200">
                {urduTranslation || 'Roman Urdu output appears here once a sentence is ready.'}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
