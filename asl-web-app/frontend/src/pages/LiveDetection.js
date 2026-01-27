import React, { useRef, useEffect, useState } from 'react';
import axios from 'axios';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

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

  const initializeCamera = () => {
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
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await hands.send({ image: videoRef.current });
        },
        width: 1280,
        height: 720
      });
      camera.start();
      cameraRef.current = camera;
    }
  };

  const stopCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.stop();
    }
    if (handsRef.current) {
      handsRef.current.close();
    }
  };

  const onResults = async (results) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    canvas.width = results.image.width;
    canvas.height = results.image.height;
    
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      
      // Draw hand landmarks
      requestAnimationFrame(() => drawHandLandmarks(ctx, landmarks));
      
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
            <video ref={videoRef} className="hidden" />
            <canvas ref={canvasRef} className="w-full rounded-lg" />
            
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
