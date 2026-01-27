import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function BidirectionalPage() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [aslText, setAslText] = useState('');
  const [voiceText, setVoiceText] = useState('');
  const [isASLActive, setIsASLActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [prediction, setPrediction] = useState('');
  const [confidence, setConfidence] = useState(0);
  const recognitionRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const predictionBuffer = useRef([]);
  const stableCount = useRef(0);

  useEffect(() => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        setVoiceText(prev => prev + finalTranscript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      stopASLDetection();
    };
  }, []);

  useEffect(() => {
    if (isASLActive) {
      initializeASL();
    } else {
      stopASLDetection();
    }
  }, [isASLActive]);

  const initializeASL = () => {
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    hands.onResults(onASLResults);
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

  const stopASLDetection = () => {
    if (cameraRef.current) {
      cameraRef.current.stop();
    }
    if (handsRef.current) {
      handsRef.current.close();
    }
  };

  const onASLResults = async (results) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = results.image.width;
    canvas.height = results.image.height;
    
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      drawHandLandmarks(ctx, landmarks);
      
      const normalizedLandmarks = normalizeLandmarks(landmarks);
      
      try {
        const response = await axios.post(`${API_URL}/predict`, {
          landmarks: normalizedLandmarks
        });
        
        const { prediction: pred, confidence: conf } = response.data;
        
        predictionBuffer.current.push(pred);
        if (predictionBuffer.current.length > 5) {
          predictionBuffer.current.shift();
        }
        
        const mostCommon = getMostCommon(predictionBuffer.current);
        if (mostCommon === pred) {
          stableCount.current++;
        } else {
          stableCount.current = 0;
        }
        
        setPrediction(pred);
        setConfidence(conf);
        
        if (stableCount.current >= 8) {
          setAslText(prev => prev + pred);
          stableCount.current = 0;
          predictionBuffer.current = [];
        }
      } catch (error) {
        console.error('Prediction error:', error);
      }
    }
    
    ctx.restore();
  };

  const drawHandLandmarks = (ctx, landmarks) => {
    ctx.fillStyle = 'red';
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 2;

    const connections = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [0,9],[9,10],[10,11],[11,12],
      [0,13],[13,14],[14,15],[15,16],
      [0,17],[17,18],[18,19],[19,20],
      [5,9],[9,13],[13,17]
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

  const toggleVoiceRecognition = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const speakASLText = async () => {
    try {
      await axios.post(`${API_URL}/speak`, { text: aslText });
    } catch (error) {
      console.error('TTS error:', error);
    }
  };

  const speakVoiceText = async () => {
    try {
      await axios.post(`${API_URL}/speak`, { text: voiceText });
    } catch (error) {
      console.error('TTS error:', error);
    }
  };

  const saveConversation = async () => {
    try {
      if (aslText) {
        await axios.post(`${API_URL}/history`, {
          text: aslText,
          speaker: 'User',
          mode: 'ASL'
        });
      }
      if (voiceText) {
        await axios.post(`${API_URL}/history`, {
          text: voiceText,
          speaker: 'User',
          mode: 'Voice'
        });
      }
      alert('Conversation saved to history!');
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-3xl font-bold mb-4 text-gray-800">Bidirectional Communication</h2>
        <p className="text-gray-600 mb-6">
          Communicate using ASL and voice simultaneously
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ASL Panel */}
          <div className="space-y-4">
            <div className="card bg-blue-50">
              <h3 className="text-2xl font-semibold mb-4 flex items-center">
                <span className="text-3xl mr-2">🤟</span>
                ASL to Text
              </h3>
              
              <div className="video-container mb-4">
                <video ref={videoRef} className="hidden" />
                <canvas ref={canvasRef} className="w-full rounded-lg" />
                
                {isASLActive && (
                  <div className="prediction-box text-lg">
                    <div>Sign: {prediction || '...'}</div>
                    <div className="confidence-bar">
                      <div 
                        className="confidence-fill" 
                        style={{ width: `${confidence * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsASLActive(!isASLActive)}
                className={isASLActive ? 'bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold w-full transition-all' : 'btn-primary w-full'}
              >
                {isASLActive ? 'Stop ASL Detection' : 'Start ASL Detection'}
              </button>

              <div className="bg-white p-4 rounded-lg min-h-[150px] mt-4">
                <p className="text-gray-500 text-sm mb-2">ASL Text:</p>
                <p className="text-xl">{aslText || 'Start signing...'}</p>
              </div>

              <div className="flex space-x-2 mt-4">
                <button onClick={speakASLText} className="btn-secondary flex-1 flex items-center justify-center space-x-2">
                  <Volume2 size={20} />
                  <span>Speak</span>
                </button>
                <button onClick={() => setAslText('')} className="btn-secondary flex-1">
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Voice Panel */}
          <div className="space-y-4">
            <div className="card bg-green-50">
              <h3 className="text-2xl font-semibold mb-4 flex items-center">
                <span className="text-3xl mr-2">🎤</span>
                Voice to Text
              </h3>

              <div className="bg-white p-8 rounded-lg mb-4 flex items-center justify-center min-h-[200px]">
                {isListening ? (
                  <div className="text-center">
                    <div className="animate-pulse">
                      <Mic size={64} className="text-green-500 mx-auto mb-4" />
                    </div>
                    <p className="text-xl font-semibold text-green-600">Listening...</p>
                  </div>
                ) : (
                  <div className="text-center text-gray-400">
                    <MicOff size={64} className="mx-auto mb-4" />
                    <p className="text-xl">Click to start voice recognition</p>
                  </div>
                )}
              </div>

              <button
                onClick={toggleVoiceRecognition}
                className={isListening 
                  ? 'bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold w-full transition-all flex items-center justify-center space-x-2' 
                  : 'btn-primary w-full flex items-center justify-center space-x-2'}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                <span>{isListening ? 'Stop Listening' : 'Start Listening'}</span>
              </button>

              <div className="bg-white p-4 rounded-lg min-h-[150px] mt-4">
                <p className="text-gray-500 text-sm mb-2">Voice Text:</p>
                <p className="text-xl">{voiceText || 'Start speaking...'}</p>
              </div>

              <div className="flex space-x-2 mt-4">
                <button onClick={speakVoiceText} className="btn-secondary flex-1 flex items-center justify-center space-x-2">
                  <Volume2 size={20} />
                  <span>Speak</span>
                </button>
                <button onClick={() => setVoiceText('')} className="btn-secondary flex-1">
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Save Conversation */}
        <div className="mt-6">
          <button onClick={saveConversation} className="btn-primary w-full">
            Save Conversation to History
          </button>
        </div>

        {/* Instructions */}
        <div className="card bg-purple-50 mt-6">
          <h3 className="text-xl font-semibold mb-3">How to Use:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">ASL Mode:</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Click "Start ASL Detection"</li>
                <li>Show hand signs to camera</li>
                <li>Text appears automatically</li>
                <li>Click "Speak" to hear it</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Voice Mode:</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Click "Start Listening"</li>
                <li>Speak clearly into mic</li>
                <li>Text transcribes live</li>
                <li>Click "Speak" to play back</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BidirectionalPage;
