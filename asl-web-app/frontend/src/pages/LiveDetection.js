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
                await handsRef.current.send({ image: videoRef.current });
              } catch (e) {
                // Ignore errors from closed instance
                console.debug('Frame send error (likely after stop):', e);
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
          console.log('Camera started successfully');
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
          handsRef.current = null;
        }
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
          setTranslatedText(prev => {
            const newText = prev + pred;
            // Auto-add space after punctuation or after 4 consecutive letters
            const shouldAddSpace = /[a-z]{4}$/.test(newText.toLowerCase());
            fetchWordSuggestions(shouldAddSpace ? newText + ' ' : newText);
            return shouldAddSpace ? newText + ' ' : newText;
          });
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

  const handleSpeak = async () => {
    try {
      await axios.post(`${API_URL}/speak`, { text: translatedText });
    } catch (error) {
      console.error('TTS error:', error);
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
            {translatedText && (
              <>
                <button onClick={handleSpeak} className="btn-secondary">
                  Speak Text
                </button>
                <button onClick={handleSaveToHistory} className="btn-secondary">
                  Save to History
                </button>
                <button onClick={() => setTranslatedText('')} className="btn-secondary">
                  Clear Text
                </button>
              </>
            )}
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
                <div>Prediction: {prediction || '...'}</div>
                <div className="confidence-bar">
                  <div 
                    className="confidence-fill" 
                    style={{ width: `${confidence * 100}%` }}
                  />
                </div>
                <div className="text-sm mt-1">Confidence: {(confidence * 100).toFixed(1)}%</div>
              </div>
            )}
          </div>

          {/* Translated Text */}
          <div className="card bg-gray-50">
            <h3 className="text-xl font-semibold mb-3">Translated Text:</h3>
            <div className="bg-white p-4 rounded-lg min-h-[100px] text-xl">
              {translatedText || 'Start detecting to see translations...'}
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
          <div className="card bg-purple-50">
            <h3 className="text-xl font-semibold mb-3">Instructions:</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Click "Start Detection" to begin</li>
              <li>Show ASL alphabet signs to your webcam</li>
              <li>Hold each sign steady for accurate detection</li>
              <li>Text will auto-complete as you sign</li>
              <li>Use word suggestions for faster typing</li>
              <li>Click "Speak Text" to hear your message</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveDetection;
