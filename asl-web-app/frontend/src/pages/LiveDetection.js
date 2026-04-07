import React, { useRef, useEffect, useState } from 'react';
import axios from 'axios';
import { Hands } from '@mediapipe/hands';
import { Camera as MediaPipeCamera } from '@mediapipe/camera_utils';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function LiveDetection() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [prediction, setPrediction] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [translatedText, setTranslatedText] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [wordSuggestions, setWordSuggestions] = useState([]);
  
  // ========================================
  // TEXT-TO-SPEECH Feature:
  // This allows the computer to READ OUT LOUD the detected ASL text
  // voiceEnabled: Controls if voice is ON or OFF (like a switch)
  // ========================================
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // ========================================
  // WORD BUILDER Feature:
  // This stores all detected letters to build complete words and sentences
  // builtSentence: The full sentence being created (stores all letters)
  // ========================================
  const [builtSentence, setBuiltSentence] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const isActiveRef = useRef(false);
  const predictionBuffer = useRef([]);
  const stableCount = useRef(0);
  const lastPredictionTime = useRef(0);
  const PREDICTION_THROTTLE = 100; // ms

  useEffect(() => {
    // Check backend connection
    checkConnection();
    
    if (isDetecting) {
      initializeCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [isDetecting]);

  const checkConnection = async () => {
    try {
      await axios.get(`${API_URL}/health`, { timeout: 5000 });
      setConnectionStatus('connected');
      setError(null);
    } catch (err) {
      setConnectionStatus('disconnected');
      setError('Cannot connect to backend. Make sure Flask server is running on port 5000.');
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
      
      // Throttle predictions
      const now = Date.now();
      if (now - lastPredictionTime.current < PREDICTION_THROTTLE) {
        ctx.restore();
        return;
      }
      lastPredictionTime.current = now;
      
      // Normalize and predict
      const normalizedLandmarks = normalizeLandmarks(landmarks);
      
      try {
        const response = await axios.post(`${API_URL}/predict`, {
          landmarks: normalizedLandmarks
        });
        
        const { prediction: pred, confidence: conf } = response.data;
        
        // Add to buffer
        predictionBuffer.current.push(pred);
        if (predictionBuffer.current.length > 5) {
          predictionBuffer.current.shift();
        }
        
        // Check if prediction is stable
        const mostCommon = getMostCommon(predictionBuffer.current);
        if (mostCommon === pred) {
          stableCount.current++;
        } else {
          stableCount.current = 0;
        }
        
        setPrediction(pred);
        setConfidence(conf);
        
        // Add to text if stable
        if (stableCount.current >= 8) {
          // Add letter to both old system and Word Builder
          setTranslatedText(prev => {
            const newText = prev + pred;
            // Auto-add space after punctuation or after 4 consecutive letters
            const shouldAddSpace = /[a-z]{4}$/.test(newText.toLowerCase());
            fetchWordSuggestions(shouldAddSpace ? newText + ' ' : newText);
            return shouldAddSpace ? newText + ' ' : newText;
          });
          
          // ========================================
          // WORD BUILDER: Add detected letter to sentence
          // This automatically adds each detected letter to build words
          // ========================================
          addLetterToSentence(pred);
          
          stableCount.current = 0;
          predictionBuffer.current = [];
        }
      } catch (error) {
        console.error('Prediction error:', error);
        if (error.code === 'ECONNREFUSED') {
          setConnectionStatus('disconnected');
          setError('Lost connection to backend');
        }
      }
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

  const normalizeLandmarks = (landmarks) => {
    const coords = landmarks.map(lm => [lm.x, lm.y]);
    const wrist = coords[0];
    const normalized = coords.map(([x, y]) => [x - wrist[0], y - wrist[1]]);
    
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
    try {
      const response = await axios.post(`${API_URL}/predict-words`, { text });
      setWordSuggestions(response.data.predictions);
    } catch (error) {
      console.error('Word prediction error:', error);
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
    try {
      await axios.post(`${API_URL}/history`, {
        text: translatedText,
        speaker: 'User',
        mode: 'ASL'
      });
      alert('Saved to history!');
    } catch (error) {
      console.error('History error:', error);
    }
  };

  const applySuggestion = (word) => {
    const words = translatedText.split(' ');
    words[words.length - 1] = word;
    setTranslatedText(words.join(' ') + ' ');
  };
  
  // ========================================
  // WORD BUILDER Functions:
  // These functions help users build complete sentences from detected letters
  // ========================================
  
  // ADD SPACE Function:
  // How it works: Add a space character to the sentence (like pressing spacebar)
  // This separates words: "HELLO" + SPACE = "HELLO "
  const handleAddSpace = () => {
    setBuiltSentence(prev => prev + ' ');
  };
  
  // BACKSPACE Function:
  // How it works: Remove the last character from the sentence
  // Example: "HELLO" -> Backspace -> "HELL"
  // Uses .slice(0, -1) which means "take all characters except the last one"
  const handleBackspace = () => {
    setBuiltSentence(prev => prev.slice(0, -1));
  };
  
  // CLEAR TEXT Function:
  // How it works: Delete everything and start fresh
  // Sets builtSentence to empty string ''
  const handleClearText = () => {
    setBuiltSentence('');
    setTranslatedText('');
    setPrediction('');
    setConfidence(0);
  };
  
  // ADD DETECTED LETTER to Word Builder:
  // This function is called when a new ASL sign is detected
  // It adds the letter to our sentence
  const addLetterToSentence = (letter) => {
    setBuiltSentence(prev => prev + letter);
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
            <div className="flex space-x-3">
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
                  <div className="text-center mt-1 text-sm font-semibold">
                    {confidence >= 0.8 ? (
                      <span className="text-green-600">✓ High Confidence - Very Accurate!</span>
                    ) : confidence >= 0.5 ? (
                      <span className="text-yellow-600">⚠ Medium Confidence - Fairly Accurate</span>
                    ) : (
                      <span className="text-red-600">✗ Low Confidence - May Not Be Accurate</span>
                    )}
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
          <div className="card bg-green-50 border-4 border-green-300">
            <h3 className="text-2xl font-bold mb-3 flex items-center text-green-800">
              📝 Word Builder - Your Complete Sentence
              <span className="ml-3 text-sm font-normal text-gray-600">
                (Each detected letter is added here automatically)
              </span>
            </h3>
            <div className="bg-white p-6 rounded-lg min-h-[120px] text-2xl font-mono border-2 border-green-400">
              {builtSentence || 'Start signing to build your sentence...'}
            </div>
            <div className="mt-3 text-sm text-gray-700 bg-white p-3 rounded-lg">
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
          {wordSuggestions.length > 0 && (
            <div className="card bg-blue-50">
              <h3 className="text-xl font-semibold mb-3">Word Suggestions:</h3>
              <div className="flex flex-wrap gap-2">
                {wordSuggestions.map((word, index) => (
                  <button
                    key={index}
                    onClick={() => applySuggestion(word)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    {word}
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
                <li><strong>Add Space:</strong> Click "Add Space" to separate words (like: HELLO [space] WORLD)</li>
                <li><strong>Fix Mistakes:</strong> Click "Backspace" to delete the last letter</li>
                <li><strong>Start Over:</strong> Click "Clear All" to erase everything and begin fresh</li>
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
