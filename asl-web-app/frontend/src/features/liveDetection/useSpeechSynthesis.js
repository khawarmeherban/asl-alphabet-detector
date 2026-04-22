import { useEffect, useMemo, useState } from 'react';

export function useSpeechSynthesis() {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const supported = Boolean(synth);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!supported) {
      return undefined;
    }

    const loadVoices = () => {
      const nextVoices = synth.getVoices();
      setVoices(nextVoices);

      if (!selectedVoiceURI && nextVoices.length > 0) {
        const englishVoice = nextVoices.find((voice) => voice.lang?.toLowerCase().startsWith('en'));
        setSelectedVoiceURI((englishVoice || nextVoices[0]).voiceURI);
      }
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;

    return () => {
      synth.onvoiceschanged = null;
      synth.cancel();
    };
  }, [selectedVoiceURI, supported, synth]);

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.voiceURI === selectedVoiceURI) || null,
    [selectedVoiceURI, voices]
  );

  const speakText = (text, options = {}) => {
    if (!supported) {
      throw new Error('Speech synthesis is not available in this browser.');
    }

    const normalized = String(text || '').trim();
    if (!normalized) {
      return;
    }

    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(normalized);
    const nextVoice =
      options.voice ||
      voices.find((voice) => voice.voiceURI === options.voiceURI) ||
      selectedVoice ||
      null;

    if (nextVoice) {
      utterance.voice = nextVoice;
      utterance.lang = nextVoice.lang;
    }

    utterance.pitch = options.pitch ?? 1;
    utterance.rate = options.rate ?? 0.95;
    utterance.volume = options.volume ?? 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synth.speak(utterance);
  };

  const stopSpeaking = () => {
    if (!supported) {
      return;
    }
    synth.cancel();
    setIsSpeaking(false);
  };

  return {
    supported,
    voices,
    selectedVoice,
    selectedVoiceURI,
    setSelectedVoiceURI,
    isSpeaking,
    speakText,
    stopSpeaking
  };
}

export default useSpeechSynthesis;
