import React, { useRef, useEffect, useState } from 'react';
import axios from 'axios';
import { Hands } from '@mediapipe/hands';
import { Camera as MediaPipeCamera } from '@mediapipe/camera_utils';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:7860';
const QUICK_PHRASES = [
  'Hello',
  'How are you?',
  'I need help',
  'Please wait',
  'Thank you',
  'I need water',
  'Yes, please',
  'No, thank you'
];

function LiveDetection() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [prediction, setPrediction] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [translatedText, setTranslatedText] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [wordSuggestions, setWordSuggestions] = useState([]);
  const [phraseSuggestions, setPhraseSuggestions] = useState(() => QUICK_PHRASES.slice(0, 4));
  
  // ========================================
  // TEXT-TO-SPEECH Feature:
  // This allows the computer to READ OUT LOUD the detected ASL text
  // voiceEnabled: Controls if voice is ON or OFF (like a switch)
  // ========================================
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sentenceHistory, setSentenceHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('asl-word-builder-history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // ========================================
  // WORD BUILDER Feature:
  // This stores all detected letters to build complete words and sentences
  // builtSentence: The full sentence being created (stores all letters)
  // ========================================
  const [builtSentence, setBuiltSentence] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  const [stability, setStability] = useState({ hits: 0, ratio: 0, ready: false });
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const isActiveRef = useRef(false);
  const predictionBuffer = useRef([]);
  const stableCount = useRef(0);
  const lastPredictionTime = useRef(0);
  const inFlightPrediction = useRef(false);
  const lastAcceptedPrediction = useRef({ label: '', at: 0 });
  const sessionIdRef = useRef(`live-${Math.random().toString(36).slice(2, 10)}`);
  const PREDICTION_THROTTLE = 140; // ms
  const PREDICTION_BUFFER_SIZE = 5;
  const MIN_CONFIDENCE = 0.7;
  const MIN_MARGIN = 0.08;
  const REQUIRED_STABLE_HITS = 2;
  const LETTER_COOLDOWN_MS = 1100;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Check backend connection
    checkConnection();
    
    if (isDetecting) {
      initializeCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDetecting]);

  useEffect(() => {
    localStorage.setItem('asl-word-builder-history', JSON.stringify(sentenceHistory.slice(0, 8)));
  }, [sentenceHistory]);

  const checkConnection = async () => {
    try {
      await axios.get(`${API_URL}/health`, { timeout: 5000 });
      setConnectionStatus('connected');
      setError(null);
    } catch (err) {
      setConnectionStatus('disconnected');
      setError(`Cannot connect to backend. Make sure the Flask server is running at ${API_URL}.`);
    }
  };

  const initializeCamera = async () => {
    try {
      // Clean up existing instances first
      if (cameraRef.current) {
        try {
          cameraRef.current.stop();
        } catch (e) {
          console.warn('Error stopping existing camera:', e);
        }
        cameraRef.current = null;
      }
      
      if (handsRef.current) {
        try {
          handsRef.current.close();
        } catch (e) {
          console.warn('Error closing existing hands:', e);
        }
        // Set to null immediately after close
        handsRef.current = null;
      }

      // Check if camera API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera API not supported. Please use a modern browser (Chrome, Firefox, or Edge).');
        return;
      }

      // Request camera permissions first
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      });
      
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());

      // Set active flag
      isActiveRef.current = true;

      const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
      });

      hands.onResults(onResults);
      handsRef.current = hands;

      if (videoRef.current) {
        // Wait for video element to be ready
        await new Promise((resolve) => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            resolve();
          } else if (videoRef.current) {
            videoRef.current.addEventListener('loadedmetadata', resolve, { once: true });
            // Fallback timeout
            setTimeout(resolve, 2000);
          } else {
            resolve();
          }
        });

        if (!isActiveRef.current) return; // Check if still active after wait

        const camera = new MediaPipeCamera(videoRef.current, {
          onFrame: async () => {
            // Only send frames if still active
            if (isActiveRef.current && handsRef.current && videoRef.current) {
              try {
                // Only call send if handsRef.current is not null
                if (handsRef.current) {
                  await handsRef.current.send({ image: videoRef.current });
                }
              } catch (e) {
                // Silently ignore errors from closed instances
              }
            }
          },
          width: 1280,
          height: 720
        });
        
        try {
          await camera.start();
          cameraRef.current = camera;
          setError(null);
        } catch (e) {
          console.error('Camera start error:', e);
          throw new Error('Failed to start camera: ' + e.message);
        }
      }
    } catch (error) {
      console.error('Camera initialization error:', error);
      let errorMessage = 'Failed to access camera. ';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage += 'Please allow camera permissions in your browser settings.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage += 'No camera found. Please connect a camera and try again.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage += 'Camera is already in use by another application.';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      
      setError(errorMessage);
      setIsDetecting(false);
    }
  };

  const stopCamera = () => {
    // Set flag first to stop frame processing
    isActiveRef.current = false;
    
    try {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
    } catch (error) {
      console.warn('Error stopping camera:', error);
    }
    
    // Small delay to ensure camera callbacks finish
    setTimeout(() => {
      try {
        if (handsRef.current) {
          handsRef.current.close();
        }
        // Set to null immediately after close
        handsRef.current = null;
      } catch (error) {
        console.warn('Error closing hands:', error);
      }
    }, 100);
  };

  const onResults = async (results) => {
    // Check if still active
    if (!isActiveRef.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas || !results || !results.image) return;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    // Set canvas dimensions if they don't match
    if (canvas.width !== results.image.width || canvas.height !== results.image.height) {
      canvas.width = results.image.width;
      canvas.height = results.image.height;
    }
    
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    try {
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    } catch (e) {
      console.error('Draw image error:', e);
      ctx.restore();
      return;
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      
      // Draw hand landmarks immediately (no requestAnimationFrame)
      try {
        drawHandLandmarks(ctx, landmarks);
      } catch (e) {
        console.error('Draw landmarks error:', e);
      }
      
      // Throttle and prevent overlapping prediction requests
      const now = Date.now();
      if (inFlightPrediction.current || now - lastPredictionTime.current < PREDICTION_THROTTLE) {
        ctx.restore();
        return;
      }
      lastPredictionTime.current = now;
      
      const handedness = results.multiHandedness?.[0]?.label;
      const normalizedLandmarks = normalizeLandmarks(landmarks, handedness);
      
      try {
        inFlightPrediction.current = true;
        const response = await axios.post(`${API_URL}/predict`, {
          landmarks: normalizedLandmarks,
          sessionId: sessionIdRef.current
        });
        
        const {
          prediction: pred,
          raw_prediction: rawPred = '',
          confidence: conf,
          stable_confidence: stableConf = conf,
          confidence_margin: margin = 1,
          accepted = true,
          temporal_hits: temporalHits = 0,
          temporal_ratio: temporalRatio = 0,
          temporal_accepted: temporalAccepted = false
        } = response.data;
        setConfidence(temporalAccepted ? (stableConf || conf || 0) : (conf || 0));
        setStability({ hits: temporalHits, ratio: temporalRatio, ready: temporalAccepted });

        if (!accepted || !rawPred || conf < MIN_CONFIDENCE || margin < MIN_MARGIN) {
          predictionBuffer.current = [];
          stableCount.current = 0;
          setPrediction('');
          return;
        }

        if (!temporalAccepted || !pred) {
          predictionBuffer.current = [];
          stableCount.current = 0;
          setPrediction(rawPred);
          return;
        }
        
        predictionBuffer.current.push({ label: pred, confidence: stableConf || conf });
        if (predictionBuffer.current.length > PREDICTION_BUFFER_SIZE) {
          predictionBuffer.current.shift();
        }
        
        const labels = predictionBuffer.current.map(item => item.label);
        const mostCommon = getMostCommon(labels);
        const matches = predictionBuffer.current.filter(item => item.label === mostCommon);
        const averagedConfidence = matches.reduce((sum, item) => sum + item.confidence, 0) / matches.length;

        setPrediction(mostCommon);
        setConfidence(averagedConfidence);
        stableCount.current = Math.max(matches.length, temporalHits);
        
        if (stableCount.current >= REQUIRED_STABLE_HITS) {
          const isDuplicate =
            lastAcceptedPrediction.current.label === mostCommon &&
            now - lastAcceptedPrediction.current.at < LETTER_COOLDOWN_MS;

          if (!isDuplicate) {
            setTranslatedText(prev => {
              const newText = prev + mostCommon;
              const shouldAddSpace = /[a-z]{4}$/.test(newText.toLowerCase());
              const finalText = shouldAddSpace ? `${newText} ` : newText;
              fetchWordSuggestions(finalText);
              return finalText;
            });

            addLetterToSentence(mostCommon);
            lastAcceptedPrediction.current = { label: mostCommon, at: now };
          }
          
          stableCount.current = 0;
          predictionBuffer.current = predictionBuffer.current.slice(-2);
        }
      } catch (error) {
        console.error('Prediction error:', error);
        if (error.code === 'ECONNREFUSED') {
          setConnectionStatus('disconnected');
          setError('Lost connection to backend');
        }
      } finally {
        inFlightPrediction.current = false;
      }
    } else {
      predictionBuffer.current = [];
      stableCount.current = 0;
      setPrediction('');
      setConfidence(0);
      setStability({ hits: 0, ratio: 0, ready: false });
    }
    
    ctx.restore();
  };

  const drawHandLandmarks = (ctx, landmarks) => {
    ctx.fillStyle = 'red';
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 2;

    // Draw connections
    const connections = [
      [0,1],[1,2],[2,3],[3,4], // Thumb
      [0,5],[5,6],[6,7],[7,8], // Index
      [0,9],[9,10],[10,11],[11,12], // Middle
      [0,13],[13,14],[14,15],[15,16], // Ring
      [0,17],[17,18],[18,19],[19,20], // Pinky
      [5,9],[9,13],[13,17] // Palm
    ];

    connections.forEach(([start, end]) => {
      ctx.beginPath();
      ctx.moveTo(
        landmarks[start].x * canvasRef.current.width,
        landmarks[start].y * canvasRef.current.height
      );
      ctx.lineTo(
        landmarks[end].x * canvasRef.current.width,
        landmarks[end].y * canvasRef.current.height
      );
      ctx.stroke();
    });

    // Draw points
    landmarks.forEach(landmark => {
      ctx.beginPath();
      ctx.arc(
        landmark.x * canvasRef.current.width,
        landmark.y * canvasRef.current.height,
        5, 0, 2 * Math.PI
      );
      ctx.fill();
    });
  };

  const normalizeLandmarks = (landmarks, handedness = null) => {
    const coords = landmarks.map(lm => [lm.x, lm.y]);
    const wrist = coords[0];
    let normalized = coords.map(([x, y]) => [x - wrist[0], y - wrist[1]]);

    if (String(handedness || '').toLowerCase() === 'left') {
      normalized = normalized.map(([x, y]) => [-x, y]);
    }
    
    const xs = normalized.map(([x]) => x);
    const ys = normalized.map(([, y]) => y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const scale = Math.max(xMax - xMin, yMax - yMin);
    
    if (scale > 0) {
      return normalized.flat().map(v => v / scale);
    }
    return normalized.flat();
  };

  const getMostCommon = (arr) => {
    const counts = {};
    arr.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  };

  const fetchWordSuggestions = async (text) => {
    const normalizedText = String(text || '').trim();

    if (!normalizedText) {
      setWordSuggestions([]);
      setPhraseSuggestions(QUICK_PHRASES.slice(0, 4));
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/predict-words`, { text: normalizedText });
      setWordSuggestions(response.data.predictions || []);
      setPhraseSuggestions(response.data.phrases || QUICK_PHRASES.slice(0, 4));
    } catch (error) {
      console.error('Word prediction error:', error);
      setPhraseSuggestions(QUICK_PHRASES.slice(0, 4));
    }
  };

  // ========================================
  // TEXT-TO-SPEECH Function:
  // This function makes the browser READ the text OUT LOUD using the Web Speech API
  // How it works:
  // 1. Check if browser supports speech (speechSynthesis)
  // 2. Create a "speech" object with the text to speak
  // 3. Set voice speed (rate) - slower for students
  // 4. Set voice volume (0 to 1)
  // 5. Tell browser to speak the text
  // ========================================
  const handleSpeak = () => {
    // Check if voiceEnabled is OFF, don't speak
    if (!voiceEnabled) {
      alert('Voice is turned OFF. Please enable it first.');
      return;
    }
    
    // Use the Word Builder sentence if available, otherwise use translatedText
    const textToSpeak = builtSentence || translatedText;
    
    if (!textToSpeak) {
      alert('No text to speak. Start detecting ASL signs first!');
      return;
    }
    
    // Check if browser supports Text-to-Speech
    if ('speechSynthesis' in window) {
      // Stop any previous speech first
      window.speechSynthesis.cancel();
      
      // Create a new speech request
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      
      // Set voice properties for clarity (good for students)
      utterance.rate = 0.8;    // Speed: 0.8 = slower and clearer
      utterance.pitch = 1.0;   // Pitch: 1.0 = normal voice
      utterance.volume = 1.0;  // Volume: 1.0 = maximum
      utterance.lang = 'en-US'; // Language: English
      
      // When speech starts, update status
      utterance.onstart = () => {
        setIsSpeaking(true);
      };
      
      // When speech ends, update status
      utterance.onend = () => {
        setIsSpeaking(false);
      };
      
      // If error occurs, show message
      utterance.onerror = (event) => {
        console.error('Speech error:', event);
        setIsSpeaking(false);
        alert('Error speaking text. Please try again.');
      };
      
      // START SPEAKING!
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Your browser does not support Text-to-Speech. Try Chrome or Edge.');
    }
  };

  const handleSaveToHistory = async () => {
    const textToSave = (builtSentence || translatedText).trim();
    if (!textToSave) return;

    try {
      await axios.post(`${API_URL}/history`, {
        text: textToSave,
        speaker: 'User',
        mode: 'ASL'
      });
      alert('Saved to history!');
    } catch (error) {
      console.error('History error:', error);
    }
  };

  const applySuggestion = (word) => {
    const sourceText = builtSentence || translatedText;
    const trimmed = sourceText.trimEnd();
    const parts = trimmed ? trimmed.split(/\s+/) : [];
    if (parts.length === 0) {
      const next = `${word} `;
      setTranslatedText(next);
      setBuiltSentence(next);
      fetchWordSuggestions(next);
      return;
    }

    parts[parts.length - 1] = word;
    const next = `${parts.join(' ')} `;
    setTranslatedText(next);
    setBuiltSentence(next);
    fetchWordSuggestions(next);
  };

  const applyPhrase = (phrase) => {
    const cleanedPhrase = String(phrase || '').trim();
    if (!cleanedPhrase) return;

    const next = `${cleanedPhrase}${/[.!?]$/.test(cleanedPhrase) ? '' : ''} `;
    setTranslatedText(next);
    setBuiltSentence(next);
    fetchWordSuggestions(next);
  };
  
  // ========================================
  // WORD BUILDER Functions:
  // These functions help users build complete sentences from detected letters
  // ========================================
  
  // ADD SPACE Function:
  // How it works: Add a space character to the sentence (like pressing spacebar)
  // This separates words: "HELLO" + SPACE = "HELLO "
  const handleAddSpace = () => {
    const currentText = builtSentence || translatedText;
    const next = currentText.endsWith(' ') || !currentText ? currentText : `${currentText} `;
    setBuiltSentence(next);
    setTranslatedText(next);
    fetchWordSuggestions(next);
  };
  
  // BACKSPACE Function:
  // How it works: Remove the last character from the sentence
  // Example: "HELLO" -> Backspace -> "HELL"
  // Uses .slice(0, -1) which means "take all characters except the last one"
  const handleBackspace = () => {
    const currentText = builtSentence || translatedText;
    const next = currentText.slice(0, -1);
    setBuiltSentence(next);
    setTranslatedText(next);
    fetchWordSuggestions(next);
  };

  const handleDeleteLastWord = () => {
    const removeLastWord = (text) => text.replace(/\s*\S+\s*$/, '').replace(/\s+$/, ' ');
    const currentText = builtSentence || translatedText;
    const next = removeLastWord(currentText).trimStart();
    setBuiltSentence(next);
    setTranslatedText(next);
    fetchWordSuggestions(next);
  };
  
  // CLEAR TEXT Function:
  // How it works: Delete everything and start fresh
  // Sets builtSentence to empty string ''
  const handleClearText = () => {
    const finalSentence = (builtSentence || translatedText).trim();
    if (finalSentence) {
      setSentenceHistory(prev => [
        {
          text: finalSentence,
          createdAt: new Date().toISOString()
        },
        ...prev.filter(item => item.text !== finalSentence)
      ].slice(0, 8));
    }

    setBuiltSentence('');
    setTranslatedText('');
    setPrediction('');
    setConfidence(0);
    setWordSuggestions([]);
    setPhraseSuggestions(QUICK_PHRASES.slice(0, 4));
  };
  
  // ADD DETECTED LETTER to Word Builder:
  // This function is called when a new ASL sign is detected
  // It adds the letter to our sentence
  const addLetterToSentence = (letter) => {
    setBuiltSentence(prev => {
      const shouldAutoSpace = prev.length > 0 && !prev.endsWith(' ') && /[aeiou]/i.test(letter) && /[^aeiou\s]{3,}$/i.test(prev);
      return shouldAutoSpace ? `${prev} ${letter}` : `${prev}${letter}`;
    });
  };

  const restoreHistoryItem = (text) => {
    const next = `${text.trim()} `;
    setBuiltSentence(next);
    setTranslatedText(next);
    fetchWordSuggestions(next);
  };

  const getSmartSuggestions = () => {
    const currentText = (builtSentence || translatedText).trim().toLowerCase();
    const currentWord = currentText.split(/\s+/).pop() || '';
    const fallback = ['hello', 'help', 'thank', 'yes', 'no'];

    const combined = [...wordSuggestions, ...fallback].filter(Boolean);
    const unique = [...new Set(combined.map(item => item.toLowerCase()))];

    if (!currentWord) return unique.slice(0, 5);
    return unique
      .sort((a, b) => {
        const aStarts = a.startsWith(currentWord) ? 0 : 1;
        const bStarts = b.startsWith(currentWord) ? 0 : 1;
        return aStarts - bStarts || a.length - b.length;
      })
      .slice(0, 5);
  };

  const getSmartPhraseSuggestions = () => {
    const currentText = (builtSentence || translatedText).trim().toLowerCase();
    const combined = [...phraseSuggestions, ...QUICK_PHRASES].filter(Boolean);
    const unique = [...new Set(combined.map(item => item.trim()))];

    if (!currentText) return unique.slice(0, 6);
    return unique
      .sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        const aRank = aLower.startsWith(currentText) ? 0 : aLower.includes(currentText) ? 1 : 2;
        const bRank = bLower.startsWith(currentText) ? 0 : bLower.includes(currentText) ? 1 : 2;
        return aRank - bRank || a.length - b.length;
      })
      .slice(0, 6);
  };

  return (
    <div className="space-y-6">
      {/* Connection Status Banner */}
      {connectionStatus === 'disconnected' && error && (
        <div className="bg-red-500 text-white p-4 rounded-lg shadow-lg flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold">Backend Connection Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
          <button onClick={checkConnection} className="bg-white text-red-500 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100">
            Retry
          </button>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-3xl font-bold text-gray-800">Live ASL Detection</h2>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">{connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
        <p className="text-gray-600 mb-6">
          Use your webcam to detect ASL alphabet signs in real-time
        </p>

        <div className="space-y-6">
          {/* Camera Controls */}
          <div className="flex space-x-4">
            <button
              onClick={() => setIsDetecting(!isDetecting)}
              className={isDetecting ? 'bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold transition-all' : 'btn-primary'}
            >
              {isDetecting ? 'Stop Detection' : 'Start Detection'}
            </button>
            
            {/* TEXT-TO-SPEECH Toggle Button */}
            <button 
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={voiceEnabled ? 'bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-all' : 'bg-gray-400 hover:bg-gray-500 text-white px-6 py-3 rounded-lg font-semibold transition-all'}
              title="Toggle voice ON or OFF"
            >
              🔊 Voice {voiceEnabled ? 'ON' : 'OFF'}
            </button>
            
            {(translatedText || builtSentence) && (
              <>
                {/* Speak Button - uses Text-to-Speech */}
                <button 
                  onClick={handleSpeak} 
                  className={isSpeaking ? 'bg-purple-500 text-white px-6 py-3 rounded-lg font-semibold' : 'btn-secondary'}
                  disabled={isSpeaking}
                >
                  {isSpeaking ? '🔊 Speaking...' : '🎤 Speak Text'}
                </button>
                <button onClick={handleSaveToHistory} className="btn-secondary">
                  💾 Save to History
                </button>
              </>
            )}
          </div>

          {/* WORD BUILDER Controls */}
          <div className="card bg-blue-50">
            <h3 className="text-xl font-semibold mb-3 flex items-center">
              ✍️ Word Builder Controls
              <span className="ml-3 text-sm font-normal text-gray-600">
                (Build sentences by adding letters, spaces, and corrections)
              </span>
            </h3>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={handleAddSpace}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                title="Add a space between words"
              >
                ⎵ Add Space
              </button>
              <button 
                onClick={handleBackspace}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                title="Delete the last character"
              >
                ⌫ Backspace
              </button>
              <button 
                onClick={handleDeleteLastWord}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                title="Delete the last full word"
              >
                🧹 Delete Word
              </button>
              <button 
                onClick={handleClearText}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                title="Clear all text and start over"
              >
                🗑️ Clear All
              </button>
            </div>
          </div>

          {/* Video Feed */}
          <div className="video-container">
            <video ref={videoRef} className="hidden" autoPlay playsInline />
            <canvas ref={canvasRef} className="w-full rounded-lg bg-black" style={{ minHeight: '400px' }} />
            
            {!isDetecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 rounded-lg">
                <div className="text-center text-white">
                  <svg className="w-24 h-24 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xl font-semibold">Camera Off</p>
                  <p className="text-sm text-gray-400 mt-2">Click "Start Detection" to begin</p>
                </div>
              </div>
            )}
            
            {isDetecting && (
              <div className="prediction-box">
                <div className="text-2xl font-bold mb-2">Prediction: {prediction || '...'}</div>
                
                {/* ========================================
                     CONFIDENCE METER:
                     This shows HOW SURE the computer is about the detected sign
                     - Confidence Score: A number from 0 to 100 (like a test score!)
                     - 80-100% (Green) = Computer is very confident = HIGH accuracy
                     - 50-79% (Yellow) = Computer is somewhat confident = MEDIUM accuracy  
                     - 0-49% (Red) = Computer is unsure = LOW accuracy
                     
                     How it works:
                     1. ML model gives a confidence number (0.0 to 1.0)
                     2. We multiply by 100 to get percentage (0% to 100%)
                     3. We change the color based on the percentage
                     4. We show a progress bar that fills up based on confidence
                     ======================================== */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold">
                      Confidence Score 
                      <span className="text-xs text-gray-500 ml-2">
                        (How accurate is this prediction?)
                      </span>
                    </span>
                    <span className="text-lg font-bold">
                      {(confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  
                  {/* Progress bar background (gray) */}
                  <div className="w-full h-8 bg-gray-300 rounded-full overflow-hidden border-2 border-gray-400">
                    {/* Progress bar fill - changes color based on confidence */}
                    <div 
                      className="h-full transition-all duration-300 flex items-center justify-center text-white font-bold text-sm"
                      style={{ 
                        width: `${confidence * 100}%`,
                        // Green if confidence >= 80%, Yellow if >= 50%, Red if < 50%
                        backgroundColor: confidence >= 0.8 ? '#10b981' : confidence >= 0.5 ? '#fbbf24' : '#ef4444'
                      }}
                    >
                      {confidence > 0.15 && `${(confidence * 100).toFixed(0)}%`}
                    </div>
                  </div>
                  
                  {/* Confidence level text */}
                  <div className="text-center mt-1 text-sm font-semibold space-y-1">
                    <div>
                      {confidence >= 0.8 ? (
                        <span className="text-green-600">✓ High Confidence - Very Accurate!</span>
                      ) : confidence >= 0.5 ? (
                        <span className="text-yellow-600">⚠ Medium Confidence - Fairly Accurate</span>
                      ) : (
                        <span className="text-red-600">✗ Low Confidence - May Not Be Accurate</span>
                      )}
                    </div>
                    <div>
                      {stability.ready ? (
                        <span className="text-emerald-700">🧠 Stable across {stability.hits} frames</span>
                      ) : prediction ? (
                        <span className="text-blue-600">⏳ Stabilizing... {Math.round((stability.ratio || 0) * 100)}%</span>
                      ) : (
                        <span className="text-slate-500">Show a clear sign and hold briefly</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Translated Text - Enhanced Styling */}
          <div className="card bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-purple-800 flex items-center">
                <span className="mr-2">📄</span> Translated Text
              </h3>
              {translatedText && (
                <span className="text-sm bg-purple-200 text-purple-800 px-3 py-1 rounded-full font-semibold">
                  {translatedText.length} characters
                </span>
              )}
            </div>
            <div className="bg-white p-6 rounded-xl min-h-[120px] shadow-inner border-2 border-purple-100 relative overflow-auto max-h-[200px]">
              {translatedText ? (
                <p className="text-2xl font-medium leading-relaxed text-gray-800 tracking-wide break-words">
                  {translatedText}
                </p>
              ) : (
                <p className="text-xl text-gray-400 italic text-center mt-4">
                  ✋ Start detecting to see translations appear here...
                </p>
              )}
            </div>
            {translatedText && (
              <div className="mt-3 flex items-center justify-between text-sm text-purple-600">
                <span className="flex items-center">
                  <span className="mr-1">💬</span>
                  <span className="font-medium">Auto-detected letters are stored here</span>
                </span>
                <span className="text-gray-500">
                  Words: {translatedText.trim().split(/\s+/).filter(w => w.length > 0).length}
                </span>
              </div>
            )}
          </div>
          
          {/* ========================================
               WORD BUILDER Display:
               Shows the full sentence being built from detected letters
               This is where all the letters come together to form words!
               ======================================== */}
          <div className="card bg-gradient-to-br from-emerald-50 to-lime-50 border-4 border-emerald-300 shadow-lg">
            <h3 className="text-2xl font-bold mb-3 flex items-center text-emerald-900">
              📝 Word Builder - Your Complete Sentence
              <span className="ml-3 text-sm font-normal text-slate-600">
                (Each detected letter is added here automatically)
              </span>
            </h3>
            <div className="bg-white p-6 rounded-lg min-h-[120px] border-2 border-emerald-400 shadow-inner">
              {builtSentence ? (
                <p className="text-2xl font-mono font-semibold text-slate-900 tracking-wide break-words leading-relaxed">
                  {builtSentence}
                </p>
              ) : (
                <p className="text-xl font-medium text-emerald-800">
                  Start signing to build your sentence...
                </p>
              )}
            </div>
            <div className="mt-3 text-sm text-slate-800 bg-white p-3 rounded-lg">
              <strong>💡 How Word Builder Works:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Detected letters</strong> are automatically added to your sentence</li>
                <li>Use <strong>"Add Space"</strong> button to separate words</li>
                <li>Use <strong>"Backspace"</strong> to fix mistakes (removes last letter)</li>
                <li>Use <strong>"Clear All"</strong> to start over</li>
                <li>Click <strong>"Speak Text"</strong> to hear your sentence read aloud!</li>
              </ul>
            </div>
          </div>

          {/* Word Suggestions */}
          {getSmartSuggestions().length > 0 && (
            <div className="card bg-blue-50">
              <h3 className="text-xl font-semibold mb-3 text-blue-900">🧠 Smart Word Suggestions:</h3>
              <p className="text-sm text-slate-600 mb-3">Suggestions are prioritized based on your current partial word.</p>
              <div className="flex flex-wrap gap-2">
                {getSmartSuggestions().map((word, index) => (
                  <button
                    key={`${word}-${index}`}
                    onClick={() => applySuggestion(word)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors capitalize"
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          )}

          {getSmartPhraseSuggestions().length > 0 && (
            <div className="card bg-emerald-50 border border-emerald-200">
              <h3 className="text-xl font-semibold mb-3 text-emerald-900">⚡ Quick Phrases & Sentence Starters</h3>
              <p className="text-sm text-slate-600 mb-3">Tap a phrase to fill the sentence instantly and speed up communication.</p>
              <div className="flex flex-wrap gap-2">
                {getSmartPhraseSuggestions().map((phrase, index) => (
                  <button
                    key={`${phrase}-${index}`}
                    onClick={() => applyPhrase(phrase)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>
          )}

          {sentenceHistory.length > 0 && (
            <div className="card bg-slate-50 border border-slate-200">
              <h3 className="text-xl font-semibold mb-3 text-slate-800">🕘 Sentence History</h3>
              <div className="space-y-2">
                {sentenceHistory.map((item, index) => (
                  <button
                    key={`${item.createdAt}-${index}`}
                    onClick={() => restoreHistoryItem(item.text)}
                    className="w-full text-left bg-white hover:bg-slate-100 border border-slate-200 rounded-lg px-4 py-3 transition-colors"
                  >
                    <div className="font-medium text-slate-900 break-words">{item.text}</div>
                    <div className="text-xs text-slate-500 mt-1">Tap to restore</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="card bg-purple-50 border-2 border-purple-300">
            <h3 className="text-2xl font-bold mb-4 text-purple-800">📖 How to Use - Step-by-Step Guide</h3>
            
            {/* Main Instructions */}
            <div className="bg-white p-4 rounded-lg mb-4">
              <h4 className="font-bold text-lg mb-2">🎯 Basic Steps:</h4>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li><strong>Click "Start Detection"</strong> to turn on your webcam</li>
                <li><strong>Show ASL alphabet signs</strong> to your webcam (one at a time)</li>
                <li><strong>Hold each sign steady</strong> for 2-3 seconds for accurate detection</li>
                <li><strong>Watch the Confidence Meter</strong> - Green means good detection!</li>
                <li><strong>Letters automatically appear</strong> in the Word Builder</li>
              </ol>
            </div>
            
            {/* Text-to-Speech Instructions */}
            <div className="bg-blue-100 p-4 rounded-lg mb-4">
              <h4 className="font-bold text-lg mb-2">🔊 Text-to-Speech Feature:</h4>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li><strong>Turn ON Voice:</strong> Click the "Voice ON/OFF" button (it turns green when ON)</li>
                <li><strong>Build your sentence:</strong> Sign letters to create words</li>
                <li><strong>Click "Speak Text":</strong> The computer will read your sentence out loud!</li>
                <li><strong>Voice Speed:</strong> Set to slow and clear - perfect for students</li>
                <li><strong>Turn OFF anytime:</strong> Click voice button again to disable</li>
              </ul>
            </div>
            
            {/* Word Builder Instructions */}
            <div className="bg-green-100 p-4 rounded-lg mb-4">
              <h4 className="font-bold text-lg mb-2">✍️ Word Builder Feature:</h4>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li><strong>Auto-Build:</strong> Each detected letter is automatically added to your sentence</li>
                <li><strong>Add Space:</strong> Click "Add Space" to separate words, or let auto-spacing help while signing</li>
                <li><strong>Fix Mistakes:</strong> Click "Backspace" to delete one letter or "Delete Word" to remove the last word</li>
                <li><strong>History:</strong> Restore a previous sentence with one click from Sentence History</li>
                <li><strong>Smart Suggestions:</strong> Use the blue suggestion chips to complete words faster</li>
                <li><strong>Real-Time:</strong> See your sentence grow as you sign each letter!</li>
              </ul>
            </div>
            
            {/* Confidence Meter Instructions */}
            <div className="bg-yellow-100 p-4 rounded-lg">
              <h4 className="font-bold text-lg mb-2">📊 Confidence Meter Feature:</h4>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li><strong>What is it?</strong> A score (0-100%) showing how accurate the prediction is</li>
                <li><strong>Green (80-100%):</strong> High confidence = Very accurate! ✓</li>
                <li><strong>Yellow (50-79%):</strong> Medium confidence = Fairly accurate ⚠</li>
                <li><strong>Red (0-49%):</strong> Low confidence = May not be accurate ✗</li>
                <li><strong>Tip:</strong> Hold your hand steady and make clear signs for higher confidence!</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveDetection;
