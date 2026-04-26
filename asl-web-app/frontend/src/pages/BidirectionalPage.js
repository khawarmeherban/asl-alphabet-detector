import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Copy, Mic, MicOff, RefreshCcw, Volume2, Waves } from 'lucide-react';
import useLiveDetectionEngine from '../features/liveDetection/useLiveDetectionEngine';
import useSpeechSynthesis from '../features/liveDetection/useSpeechSynthesis';
import { saveConversationEntry } from '../services/firebaseSync';

const SPEECH_LANGUAGE_OPTIONS = [
  { value: 'ur-PK', label: 'Urdu (Pakistan)' },
  { value: 'ur-IN', label: 'Urdu (India)' },
  { value: 'en-US', label: 'English (US)' }
];

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function Panel({ title, eyebrow, children }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#07131c]/92 p-5 shadow-[0_18px_60px_rgba(2,8,12,0.28)]">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function createRecognition(onText, handlers, language) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = language || 'ur-PK';
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let finalTranscript = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (result.isFinal) {
        finalTranscript += `${result[0].transcript} `;
      }
    }

    if (finalTranscript) {
      onText((previous) => normalizeText(`${previous} ${finalTranscript}`));
    }
  };

  recognition.onerror = (event) => handlers.onError?.(event);
  recognition.onend = () => handlers.onEnd?.();
  return recognition;
}

export default function BidirectionalPage() {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastAcceptedAtRef = useRef({ label: '', at: 0 });
  const shouldKeepListeningRef = useRef(false);
  const restartTimeoutRef = useRef(null);

  const [isDetectionActive, setIsDetectionActive] = useState(false);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [aslText, setAslText] = useState('');
  const [voiceText, setVoiceText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [speechLanguage, setSpeechLanguage] = useState('ur-PK');

  const {
    predictionState,
    cameraStatus,
    connectionStatus,
    error,
    visionQuality
  } = useLiveDetectionEngine({
    enabled: isDetectionActive,
    videoRef,
    overlayRef,
    showLandmarks
  });

  const { supported: speechSupported, speakText, stopSpeaking, isSpeaking } = useSpeechSynthesis();
  const stableLetter = predictionState.stablePrediction;
  const confidence = Math.round((predictionState.confidence || 0) * 100);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    recognitionRef.current = createRecognition(
      setVoiceText,
      {
        onError: (event) => {
          const code = event?.error || '';
          if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
            shouldKeepListeningRef.current = false;
            setIsListening(false);
            return;
          }

          if (!shouldKeepListeningRef.current) {
            setIsListening(false);
          }
        },
        onEnd: () => {
          if (!shouldKeepListeningRef.current || !recognitionRef.current) {
            setIsListening(false);
            return;
          }

          if (restartTimeoutRef.current) {
            window.clearTimeout(restartTimeoutRef.current);
          }

          restartTimeoutRef.current = window.setTimeout(() => {
            if (!shouldKeepListeningRef.current || !recognitionRef.current) {
              setIsListening(false);
              return;
            }

            recognitionRef.current.start();
            setIsListening(true);
          }, 180);
        }
      },
      speechLanguage
    );

    return () => {
      shouldKeepListeningRef.current = false;
      if (restartTimeoutRef.current) {
        window.clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      recognitionRef.current?.stop();
    };
  }, [speechLanguage]);

  useEffect(() => {
    if (!stableLetter) return;

    const now = Date.now();
    const isDuplicate =
      lastAcceptedAtRef.current.label === stableLetter && now - lastAcceptedAtRef.current.at < 850;

    if (isDuplicate) return;

    lastAcceptedAtRef.current = { label: stableLetter, at: now };
    setAslText((previous) => `${previous}${stableLetter}`.toLowerCase());
  }, [stableLetter]);

  const transcriptLength = useMemo(() => normalizeText(voiceText).split(' ').filter(Boolean).length, [voiceText]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      shouldKeepListeningRef.current = false;
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    shouldKeepListeningRef.current = true;
    recognitionRef.current.start();
    setIsListening(true);
  }, [isListening]);

  const speakValue = useCallback((text) => {
    if (!speechSupported) return;
    const normalized = normalizeText(text);
    if (!normalized) return;
    if (isSpeaking) {
      stopSpeaking();
    }
    speakText(normalized);
  }, [isSpeaking, speakText, speechSupported, stopSpeaking]);

  const copyText = async (text) => {
    const normalized = normalizeText(text);
    if (!normalized) return;
    await navigator.clipboard.writeText(normalized).catch(() => {});
  };

  const saveConversation = useCallback(async () => {
    const entries = [
      normalizeText(aslText) && {
        text: normalizeText(aslText),
        sentenceSnapshot: normalizeText(aslText),
        mode: 'ASL',
        speaker: 'Signer'
      },
      normalizeText(voiceText) && {
        text: normalizeText(voiceText),
        sentenceSnapshot: normalizeText(voiceText),
        mode: 'Voice',
        speaker: 'Speaker',
        language: speechLanguage
      }
    ].filter(Boolean);

    if (!entries.length) {
      setSaveStatus('Nothing to save yet.');
      return;
    }

    const results = await Promise.all(
      entries.map((entry) =>
        saveConversationEntry({
          ...entry,
          timestamp: new Date().toISOString()
        })
      )
    );

    setSaveStatus(results.every(Boolean) ? 'Conversation synced to history.' : 'Some history entries could not be synced.');
  }, [aslText, speechLanguage, voiceText]);

  return (
    <div className="space-y-6 text-slate-100">
      <section className="overflow-hidden rounded-[2rem] border border-[#1fe0b1]/20 bg-[radial-gradient(circle_at_top_left,_rgba(31,224,177,0.12),_transparent_24%),linear-gradient(145deg,#071019,#091821_58%,#061018)] p-6 shadow-[0_24px_80px_rgba(2,8,12,0.42)]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <p className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
              Communication Suite
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">ASL to Text and Voice to Text, side by side</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              A polished communication board for live competition demos: stable ASL capture, browser speech transcription, and instant playback for both directions.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/10 bg-[#08141d]/90 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">ASL Engine</p>
              <p className="mt-2 text-2xl font-bold text-white">{connectionStatus}</p>
              <p className="mt-2 text-xs text-slate-400">Camera {cameraStatus}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-[#08141d]/90 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Speech Input</p>
              <p className="mt-2 text-2xl font-bold text-white">{isListening ? 'Listening' : 'Idle'}</p>
              <p className="mt-2 text-xs text-slate-400">{transcriptLength} spoken words captured</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="ASL to Text" eyebrow="Live Signing">
          <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-black">
            <video ref={videoRef} muted playsInline className="aspect-video w-full scale-x-[-1] object-cover" />
            <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]" />
            <div className="absolute left-4 top-4 rounded-2xl border border-white/10 bg-[#061018]/80 px-4 py-3 backdrop-blur-xl">
              <p className="text-[0.68rem] uppercase tracking-[0.25em] text-slate-500">Stable Letter</p>
              <p className="mt-1 text-4xl font-black text-white">{stableLetter || predictionState.rawPrediction || '...'}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setIsDetectionActive((value) => !value)}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#1fe0b1] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#52e8c1]"
            >
              <Camera size={16} />
              {isDetectionActive ? 'Stop ASL Detection' : 'Start ASL Detection'}
            </button>
            <button
              onClick={() => setShowLandmarks((value) => !value)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
            >
              Landmarks {showLandmarks ? 'On' : 'Off'}
            </button>
            <button
              onClick={() => setAslText('')}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
            >
              <RefreshCcw size={16} />
              Clear
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.25rem] border border-white/10 bg-[#091821] p-4">
              <p className="text-xs text-slate-500">Confidence</p>
              <p className="mt-1 text-xl font-bold text-white">{confidence}%</p>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-[#091821] p-4">
              <p className="text-xs text-slate-500">Stability</p>
              <p className="mt-1 text-xl font-bold text-white">{Math.round((predictionState.stability?.ratio || 0) * 100)}%</p>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-[#091821] p-4">
              <p className="text-xs text-slate-500">Vision Hint</p>
              <p className="mt-1 text-sm font-medium text-white">{visionQuality.hint}</p>
            </div>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[#091821] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">ASL Transcript</p>
            <p className="mt-2 min-h-[4rem] break-words text-2xl font-semibold text-white">{aslText || 'Detected letters will accumulate here.'}</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => speakValue(aslText)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
            >
              <Volume2 size={16} />
              Speak ASL Text
            </button>
            <button
              onClick={() => copyText(aslText)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
            >
              <Copy size={16} />
              Copy
            </button>
          </div>
        </Panel>

        <Panel title="Voice to Text" eyebrow="Speech Capture">
          <div className="rounded-[1.5rem] border border-white/10 bg-[#091821] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Microphone Status</p>
                <p className="mt-2 text-3xl font-black text-white">{isListening ? 'Listening' : 'Standby'}</p>
              </div>
              <div className={`rounded-full border px-4 py-2 text-sm ${isListening ? 'border-[#1fe0b1]/30 bg-[#1fe0b1]/10 text-[#b9fff1]' : 'border-white/10 bg-white/5 text-slate-300'}`}>
                {recognitionRef.current ? 'Supported' : 'Not supported'}
              </div>
            </div>

            <div className="mt-5 flex min-h-[220px] items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 bg-[#061018]">
              <div className="text-center">
                <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border ${isListening ? 'border-[#1fe0b1]/40 bg-[#1fe0b1]/10 text-[#b9fff1]' : 'border-white/10 bg-white/5 text-slate-400'}`}>
                  {isListening ? <Mic size={32} /> : <MicOff size={32} />}
                </div>
                <p className="mt-4 text-lg font-semibold text-white">{isListening ? 'Capturing live speech' : 'Ready for speech transcription'}</p>
                <p className="mt-2 text-sm text-slate-400">Recognition language is matched to the selected speech input profile.</p>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs uppercase tracking-[0.24em] text-slate-500" htmlFor="speech-language">
                Speech Language
              </label>
              <select
                id="speech-language"
                value={speechLanguage}
                onChange={(event) => {
                  const nextLanguage = event.target.value;
                  const wasListening = isListening;
                  if (wasListening && recognitionRef.current) {
                    shouldKeepListeningRef.current = false;
                    recognitionRef.current.stop();
                    setIsListening(false);
                  }
                  setSpeechLanguage(nextLanguage);
                }}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#061018] px-4 py-3 text-sm font-medium text-white outline-none transition focus:border-[#1fe0b1]/40"
              >
                {SPEECH_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={toggleListening}
                disabled={!recognitionRef.current}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#1fe0b1] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#52e8c1] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                {isListening ? 'Stop Listening' : 'Start Listening'}
              </button>
              <button
                onClick={() => setVoiceText('')}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
              >
                <RefreshCcw size={16} />
                Clear
              </button>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[#061018] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Voice Transcript</p>
              <p className="mt-2 min-h-[4rem] text-lg leading-8 text-white">{voiceText || 'Spoken words appear here once recognition starts.'}</p>
              <p className="mt-3 text-xs text-slate-500">
                Active recognition profile: {SPEECH_LANGUAGE_OPTIONS.find((option) => option.value === speechLanguage)?.label || speechLanguage}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => speakValue(voiceText)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
              >
                <Volume2 size={16} />
                Speak Voice Text
              </button>
              <button
                onClick={() => copyText(voiceText)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
              >
                <Copy size={16} />
                Copy
              </button>
            </div>
          </div>
        </Panel>
      </div>

      <section className="rounded-[2rem] border border-white/10 bg-[#07131c]/92 p-5 shadow-[0_18px_60px_rgba(2,8,12,0.28)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Session Actions</p>
            <h2 className="mt-2 text-2xl font-black text-white">Save the communication record</h2>
            <p className="mt-2 text-sm text-slate-400">Sync the current ASL and voice transcripts to the shared history feed for analytics and review.</p>
          </div>
          <button
            onClick={saveConversation}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#1fe0b1] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#52e8c1]"
          >
            <Waves size={16} />
            Save Conversation
          </button>
        </div>
        {saveStatus ? <p className="mt-4 text-sm text-[#b9fff1]">{saveStatus}</p> : null}
        {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
      </section>
    </div>
  );
}
