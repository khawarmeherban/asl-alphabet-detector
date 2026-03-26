import React, { useRef, useEffect, useState } from 'react';
import axios from 'axios';
import { Hands } from '@mediapipe/hands';
import { Camera as MediaPipeCamera } from '@mediapipe/camera_utils';
import { Volume2, VolumeX, Play, Pause, Sun, Moon, Video, Monitor, Camera } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function GestureControl() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const isActiveRef = useRef(false);

  const [isActive, setIsActive] = useState(false);
  const [brightness, setBrightness] = useState(50);
  const [volume, setVolume] = useState(50);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentGesture, setCurrentGesture] = useState('None');
  const [gestureConfidence, setGestureConfidence] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [cameraError, setCameraError] = useState(null);
  const audioRef = useRef(null);
  const [currentTrack, setCurrentTrack] = useState(0);
  const youtubePlayerRef = useRef(null);
  const [isYouTubeReady, setIsYouTubeReady] = useState(false);
  const previousGestureRef = useRef('None');
  const gestureTimerRef = useRef(null);
  
  const playlist = [
    { title: 'Demo Track 1', artist: 'Sample Artist' },
    { title: 'Demo Track 2', artist: 'Sample Artist' },
    { title: 'Demo Track 3', artist: 'Sample Artist' }
  ];

  // YouTube video playlist - Add your video IDs here
  const youtubePlaylist = [
    { id: 'bDN7vV50rSs', title: 'Video 1', artist: 'Your Playlist' },
    { id: 'yAV5aZ0unag', title: 'Video 2', artist: 'Your Playlist' },
    { id: 'WGWsH_CD2D0', title: 'Video 3', artist: 'Your Playlist' },
    { id: 'Wn2eexjum6Q', title: 'Video 4', artist: 'Your Playlist' }
  ];

  // Check if camera API is available
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API not supported. Please use a modern browser (Chrome, Firefox, or Edge) and ensure you are on HTTPS or localhost.');
    }

    // Load YouTube IFrame API
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    // Initialize YouTube player when API is ready
    window.onYouTubeIframeAPIReady = () => {
      youtubePlayerRef.current = new window.YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: youtubePlaylist[0].id,
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0
        },
        events: {
          onReady: (event) => {
            setIsYouTubeReady(true);
            event.target.setVolume(volume);
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            }
          }
        }
      });
    };

    return () => {
      if (youtubePlayerRef.current && youtubePlayerRef.current.destroy) {
        youtubePlayerRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    checkConnection();
    
    if (isActive) {
      initializeCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [isActive]);

  // Sync audio volume and mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
      audioRef.current.muted = isMuted;
    }
    // Update YouTube player volume
    if (youtubePlayerRef.current && isYouTubeReady) {
      try {
        youtubePlayerRef.current.setVolume(volume);
        if (isMuted) {
          youtubePlayerRef.current.mute();
        } else {
          youtubePlayerRef.current.unMute();
        }
      } catch (e) {
        console.debug('YouTube volume update error:', e);
      }
    }
  }, [volume, isMuted, isYouTubeReady]);

  const checkConnection = async () => {
    try {
      await axios.get(`${API_URL}/health`, { timeout: 5000 });
      setConnectionStatus('connected');
    } catch (err) {
      setConnectionStatus('disconnected');
    }
  };

  const initializeCamera = async () => {
    try {
      setCameraError(null);
      
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser. Please use Chrome, Firefox, or Edge.');
      }
      
      // Clean up existing instances
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

      isActiveRef.current = true;

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
        const camera = new MediaPipeCamera(videoRef.current, {
          onFrame: async () => {
            if (isActiveRef.current && handsRef.current && videoRef.current) {
              try {
                await handsRef.current.send({ image: videoRef.current });
              } catch (e) {
                console.debug('Frame send error:', e);
              }
            }
          },
          width: 1280,
          height: 720
        });
        camera.start();
        cameraRef.current = camera;
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
      
      setCameraError(errorMessage);
      setIsActive(false);
    }
  };

  const stopCamera = () => {
    isActiveRef.current = false;
    
    try {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
    } catch (error) {
      console.warn('Error stopping camera:', error);
    }
    
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
      
      drawHandLandmarks(ctx, landmarks);
      
      const gesture = detectGesture(landmarks);
      setCurrentGesture(gesture.name);
      setGestureConfidence(gesture.confidence);
      
      executeGestureAction(gesture, landmarks);
    } else {
      setCurrentGesture('None');
      setGestureConfidence(0);
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

  const detectGesture = (landmarks) => {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const wrist = landmarks[0];
    
    const indexBase = landmarks[5];
    const middleBase = landmarks[9];
    const ringBase = landmarks[13];
    const pinkyBase = landmarks[17];

    // Calculate if fingers are extended
    const isIndexUp = indexTip.y < indexBase.y;
    const isMiddleUp = middleTip.y < middleBase.y;
    const isRingUp = ringTip.y < ringBase.y;
    const isPinkyUp = pinkyTip.y < pinkyBase.y;
    
    // Distance between thumb and index
    const thumbIndexDist = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) + 
      Math.pow(thumbTip.y - indexTip.y, 2)
    );

    // Hand height (for brightness control)
    const handHeight = Math.abs(wrist.y - indexTip.y);

    // Gesture detection logic - check from most specific to least specific
    if (thumbIndexDist < 0.05) {
      return { name: 'Pinch', confidence: 0.95, value: handHeight };
    } else if (!isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
      // All fingers down = Fist
      return { name: 'Fist', confidence: 0.9, value: 0 };
    } else if (isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
      return { name: 'One Finger', confidence: 0.9, value: indexTip.y };
    } else if (isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
      return { name: 'Two Fingers', confidence: 0.9, value: indexTip.x };
    } else if (isIndexUp && isMiddleUp && isRingUp && !isPinkyUp) {
      // Three fingers up (index, middle, ring), pinky down
      return { name: 'Three Fingers', confidence: 0.9, value: 0 };
    } else if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
      // All four fingers up = Open Hand (for brightness control)
      return { name: 'Open Hand', confidence: 0.9, value: wrist.y };
    }

    return { name: 'Unknown', confidence: 0, value: 0 };
  };

  const executeGestureAction = (gesture, landmarks) => {
    const prevGesture = previousGestureRef.current;
    
    switch (gesture.name) {
      case 'Open Hand':
        // Brightness control based on hand height with extended range
        const handY = gesture.value;
        // Larger buffer zones: if hand is in top 25% = 100%, bottom 25% = 0%
        let newBrightness;
        if (handY < 0.25) {
          newBrightness = 100;
        } else if (handY > 0.75) {
          newBrightness = 0;
        } else {
          // Map middle range (0.25 to 0.75) to (100 to 0)
          newBrightness = Math.round(((0.75 - handY) / 0.5) * 100);
        }
        newBrightness = Math.max(0, Math.min(100, newBrightness));
        setBrightness(newBrightness);
        break;
      
      case 'One Finger':
        // Volume control based on finger height with extended range
        const fingerY = gesture.value;
        // Larger buffer zones: if finger is in top 25% = 100%, bottom 25% = 0%
        let newVolume;
        if (fingerY < 0.25) {
          newVolume = 100;
        } else if (fingerY > 0.75) {
          newVolume = 0;
        } else {
          // Map middle range (0.25 to 0.75) to (100 to 0)
          newVolume = Math.round(((0.75 - fingerY) / 0.5) * 100);
        }
        newVolume = Math.max(0, Math.min(100, newVolume));
        setVolume(newVolume);
        break;
      
      case 'Fist':
        // Toggle play/pause with single fist gesture
        if (gesture.confidence > 0.8) {
          // Only trigger if we haven't seen Fist in the last gesture
          if (prevGesture !== 'Fist') {
            if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
            gestureTimerRef.current = setTimeout(() => {
              const newPlaying = !isPlaying;
              setIsPlaying(newPlaying);
              
              // Control audio
              if (audioRef.current) {
                if (newPlaying) {
                  audioRef.current.play().catch(() => {});
                } else {
                  audioRef.current.pause();
                }
              }
              
              // Control YouTube
              if (youtubePlayerRef.current && isYouTubeReady) {
                try {
                  if (newPlaying) {
                    youtubePlayerRef.current.playVideo();
                  } else {
                    youtubePlayerRef.current.pauseVideo();
                  }
                } catch (e) {
                  // YouTube control error
                }
              }
            }, 150);
          }
        }
        break;
      
      case 'Two Fingers':
        // Toggle mute based on horizontal position
        if (gesture.value < 0.3) {
          setIsMuted(true);
        } else if (gesture.value > 0.7) {
          setIsMuted(false);
        }
        break;
      
      case 'Three Fingers':
        // Next video - simplified logic
        if (gesture.confidence > 0.8 && youtubePlayerRef.current && isYouTubeReady) {
          if (prevGesture !== 'Three Fingers') {
            if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
            gestureTimerRef.current = setTimeout(() => {
              const nextTrack = (currentTrack + 1) % youtubePlaylist.length;
              setCurrentTrack(nextTrack);
              try {
                youtubePlayerRef.current.loadVideoById(youtubePlaylist[nextTrack].id);
                if (isPlaying) {
                  setTimeout(() => {
                    youtubePlayerRef.current.playVideo();
                  }, 500);
                }
              } catch (e) {
                // YouTube next error
              }
            }, 200);
          }
        }
        break;
      
      case 'Four Fingers':
        // Previous video - simplified logic
        if (gesture.confidence > 0.8 && youtubePlayerRef.current && isYouTubeReady) {
          if (prevGesture !== 'Four Fingers') {
            if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
            gestureTimerRef.current = setTimeout(() => {
              const prevTrack = currentTrack === 0 ? youtubePlaylist.length - 1 : currentTrack - 1;
              setCurrentTrack(prevTrack);
              try {
                youtubePlayerRef.current.loadVideoById(youtubePlaylist[prevTrack].id);
                if (isPlaying) {
                  setTimeout(() => {
                    youtubePlayerRef.current.playVideo();
                  }, 500);
                }
              } catch (e) {
                // YouTube prev error
              }
            }, 200);
          }
        }
        break;
      
      default:
        break;
    }
    
    // Update previous gesture
    previousGestureRef.current = gesture.name;
  };

  return (
    <div className="space-y-6">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      
      {/* Hidden audio element for music playback */}
      <audio 
        ref={audioRef} 
        loop
        preload="auto"
        crossOrigin="anonymous"
        style={{ display: 'none' }}
      >
        {/* Using a free demo track - replace with your own music */}
        <source src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" type="audio/mpeg" />
        <p>Your browser does not support the audio element.</p>
      </audio>
      
      {/* Volume Indicator Overlay */}
      {(currentGesture === 'One Finger' || currentGesture === 'Two Fingers') && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="bg-black bg-opacity-80 rounded-2xl p-8 shadow-2xl backdrop-blur-lg"
               style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="flex flex-col items-center space-y-4">
              {isMuted ? (
                <VolumeX className="text-red-500" size={64} />
              ) : (
                <Volume2 className="text-blue-500" size={64} />
              )}
              <div className="text-white text-4xl font-bold">
                {isMuted ? 'Muted' : `${volume}%`}
              </div>
              <div className="w-64 h-4 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-200"
                  style={{ width: `${volume}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Brightness Indicator Overlay */}
      {currentGesture === 'Open Hand' && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="bg-black bg-opacity-80 rounded-2xl p-8 shadow-2xl backdrop-blur-lg"
               style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="flex flex-col items-center space-y-4">
              <Sun className="text-yellow-500" size={64} />
              <div className="text-white text-4xl font-bold">
                {brightness}%
              </div>
              <div className="w-64 h-4 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-200"
                  style={{ width: `${brightness}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              🎮 Gesture Control System
            </h2>
            <p className="text-gray-600">
              Control your device using hand gestures
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">{connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        {/* Error Message */}
        {cameraError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="font-semibold">Camera Error</p>
            <p className="text-sm">{cameraError}</p>
          </div>
        )}

        {/* Control Button */}
        <div className="flex space-x-4">
          <button
            onClick={() => setIsActive(!isActive)}
            disabled={cameraError && !isActive}
            className={
              cameraError && !isActive
                ? 'bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold cursor-not-allowed'
                : isActive 
                  ? 'bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold transition-all' 
                  : 'btn-primary'
            }
            aria-label={isActive ? 'Stop gesture control' : 'Start gesture control'}
          >
            {isActive ? '⏹️ Stop Control' : '▶️ Start Control'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="main-content">
        {/* Video Feed */}
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">📹 Camera Feed</h3>
          {!isActive && (
            <div className="bg-gray-200 rounded-lg p-12 text-center">
              <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">Click "Start Control" to activate camera</p>
            </div>
          )}
          {isActive && (
            <div className="video-container">
              <video ref={videoRef} className="hidden" autoPlay playsInline />
              <canvas ref={canvasRef} className="w-full rounded-lg bg-black" style={{ minHeight: '400px' }} />
              
              <div className="prediction-box">
                <div className="text-lg">Gesture: {currentGesture}</div>
                <div className="confidence-bar">
                  <div 
                    className="confidence-fill" 
                    style={{ width: `${gestureConfidence * 100}%` }}
                  />
                </div>
                <div className="text-sm mt-1">Confidence: {(gestureConfidence * 100).toFixed(1)}%</div>
              </div>
            </div>
          )}
        </div>

        {/* Control Panels */}
        <div className="space-y-6">
          {/* Brightness Control */}
          <div className={`gesture-card ${currentGesture === 'Open Hand' ? 'border-4 border-yellow-400 shadow-2xl' : ''}`}
               style={{ 
                 transition: 'all 0.2s ease',
                 transform: currentGesture === 'Open Hand' ? 'scale(1.05)' : 'scale(1)',
                 backgroundColor: `rgba(254, 243, 199, ${brightness / 150})`,
                 opacity: Math.max(0.7, brightness / 100),
                 boxShadow: `0 0 ${brightness / 5}px rgba(251, 191, 36, ${brightness / 200})`,
                 filter: `brightness(${0.85 + brightness / 200})`
               }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <Sun className={`text-yellow-500 ${currentGesture === 'Open Hand' ? 'animate-pulse' : ''}`} 
                     size={currentGesture === 'Open Hand' ? 32 : 24}
                     style={{ 
                       transition: 'all 0.2s ease',
                       filter: `drop-shadow(0 0 ${brightness / 10}px rgba(251, 191, 36, ${brightness / 150}))`,
                       opacity: 0.6 + (brightness / 200)
                     }} />
                <h3 className="text-xl font-semibold">Brightness</h3>
                {currentGesture === 'Open Hand' && (
                  <span className="text-xs bg-yellow-400 text-white px-2 py-1 rounded-full animate-pulse">
                    Active
                  </span>
                )}
              </div>
              <span className="text-2xl font-bold text-purple-600"
                    style={{
                      fontSize: currentGesture === 'Open Hand' ? '2rem' : '1.5rem',
                      transition: 'font-size 0.2s ease'
                    }}>
                {brightness}%
              </span>
            </div>
            <div className="slider-container" 
                 style={{ 
                   height: currentGesture === 'Open Hand' ? '12px' : '8px',
                   transition: 'height 0.2s ease',
                   boxShadow: `inset 0 0 ${brightness / 8}px rgba(251, 191, 36, ${brightness / 300})`
                 }}>
              <div className="slider-fill" 
                   style={{ 
                     width: `${brightness}%`,
                     background: `linear-gradient(to right, #fbbf24, #f59e0b)`,
                     transition: 'width 0.1s ease, filter 0.15s ease, box-shadow 0.15s ease',
                     boxShadow: currentGesture === 'Open Hand' 
                       ? `0 0 20px rgba(251, 191, 36, 0.9), 0 0 ${brightness / 3}px rgba(251, 191, 36, 0.6)` 
                       : `0 0 ${brightness / 5}px rgba(251, 191, 36, ${brightness / 150})`,
                     filter: `brightness(${0.4 + brightness / 60})`,
                     transform: `scaleY(${1 + brightness / 300})`
                   }}>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Use <strong>Open Hand</strong> - Move hand up/down
            </p>
          </div>

          {/* Volume Control */}
          <div className={`gesture-card ${(currentGesture === 'One Finger' || currentGesture === 'Two Fingers') ? 'border-4 border-blue-400 shadow-2xl' : ''}`}
               style={{ 
                 transition: 'all 0.2s ease',
                 transform: (currentGesture === 'One Finger' || currentGesture === 'Two Fingers') ? 'scale(1.05)' : 'scale(1)',
                 backgroundColor: isMuted ? 'rgba(254, 202, 202, 0.3)' : `rgba(219, 234, 254, ${volume / 150})`,
                 boxShadow: isMuted ? 'none' : `0 0 ${volume / 5}px rgba(59, 130, 246, ${volume / 200})`,
                 filter: isMuted ? 'brightness(0.8)' : `brightness(${0.85 + volume / 200})`
               }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-1">
                {isMuted ? 
                  <VolumeX className={`text-red-500 ${currentGesture === 'Two Fingers' ? 'animate-pulse' : ''}`} 
                           size={(currentGesture === 'One Finger' || currentGesture === 'Two Fingers') ? 32 : 24}
                           style={{ 
                             transition: 'all 0.2s ease',
                             filter: 'drop-shadow(0 0 5px rgba(239, 68, 68, 0.5))'
                           }} /> : 
                  <Volume2 className={`text-blue-500 ${currentGesture === 'One Finger' ? 'animate-pulse' : ''}`} 
                           size={(currentGesture === 'One Finger' || currentGesture === 'Two Fingers') ? 32 : 24}
                           style={{ 
                             transition: 'all 0.2s ease',
                             filter: `drop-shadow(0 0 ${volume / 10}px rgba(59, 130, 246, ${volume / 150}))`,
                             opacity: 0.6 + (volume / 200)
                           }} />
                }
                <h3 className="text-xl font-semibold">Volume</h3>
                {(currentGesture === 'One Finger' || currentGesture === 'Two Fingers') && (
                  <span className="text-xs bg-blue-400 text-white px-2 py-1 rounded-full animate-pulse">
                    Active
                  </span>
                )}
              </div>
              <span className="text-lg font-bold text-purple-600"
                    style={{
                      fontSize: (currentGesture === 'One Finger' || currentGesture === 'Two Fingers') ? '2rem' : '1.5rem',
                      transition: 'font-size 0.2s ease',
                      color: isMuted ? '#ef4444' : '#9333ea'
                    }}>
                {isMuted ? 'Muted' : `${volume}%`}
              </span>
            </div>
            
            <div className="slider-container" 
                 style={{ 
                   height: (currentGesture === 'One Finger' || currentGesture === 'Two Fingers') ? '12px' : '8px',
                   transition: 'height 0.2s ease',
                   boxShadow: isMuted ? 'none' : `inset 0 0 ${volume / 8}px rgba(59, 130, 246, ${volume / 300})`
                 }}>
              <div className="slider-fill" 
                   style={{ 
                     width: `${volume}%`,
                     background: isMuted ? 'linear-gradient(to right, #ef4444, #dc2626)' : 'linear-gradient(to right, #3b82f6, #2563eb)',
                     transition: 'width 0.1s ease, background 0.3s ease, filter 0.15s ease, box-shadow 0.15s ease',
                     boxShadow: isMuted 
                       ? '0 0 5px rgba(239, 68, 68, 0.5)' 
                       : currentGesture === 'One Finger' 
                         ? `0 0 20px rgba(59, 130, 246, 0.9), 0 0 ${volume / 3}px rgba(59, 130, 246, 0.6)` 
                         : `0 0 ${volume / 5}px rgba(59, 130, 246, ${volume / 150})`,
                     filter: isMuted ? 'brightness(0.5)' : `brightness(${0.4 + volume / 60})`,
                     transform: isMuted ? 'scaleY(1)' : `scaleY(${1 + volume / 300})`
                   }}>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              <strong>One Finger</strong> - Up/down for volume | <strong>Two Fingers</strong> - Left for mute, right for unmute
            </p>
          </div>

          {/* Media Control - YouTube Player */}
          <div className={`gesture-card ${currentGesture === 'Fist' ? 'border-4 border-green-400 shadow-2xl' : ''}`}
               style={{ transition: 'all 0.3s ease' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                {isPlaying ? 
                  <Pause className={`text-green-500 ${isPlaying ? 'animate-pulse' : ''}`} size={24} /> : 
                  <Play className="text-green-500" size={24} />
                }
                <h3 className="text-xl font-semibold">YouTube Player</h3>
                {(currentGesture === 'Fist' || currentGesture === 'Three Fingers' || currentGesture === 'Four Fingers') && (
                  <span className="text-xs bg-green-400 text-white px-2 py-1 rounded-full animate-pulse">
                    Active
                  </span>
                )}
              </div>
              <span className="text-lg font-semibold text-purple-600">{isPlaying ? '▶️ Playing' : '⏸️ Paused'}</span>
            </div>
            
            {/* YouTube player */}
            <div className="relative rounded-lg overflow-hidden mb-3 bg-black" style={{ paddingBottom: '56.25%' }}>
              <div id="youtube-player" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}></div>
            </div>
            
            {/* Video info */}
            <div className="bg-gradient-to-r from-red-100 to-pink-100 rounded-lg overflow-hidden mb-2"
                 style={{
                   transform: isPlaying ? 'scale(1.02)' : 'scale(1)',
                   transition: 'transform 0.3s ease'
                 }}>
              <div className="p-4">
                <p className="font-semibold text-gray-800">{youtubePlaylist[currentTrack].title}</p>
                <p className="text-sm text-gray-600">{youtubePlaylist[currentTrack].artist}</p>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>Video {currentTrack + 1} of {youtubePlaylist.length}</span>
                  {isYouTubeReady ? (
                    <span className="text-green-600">✓ Ready</span>
                  ) : (
                    <span className="text-yellow-600">⏳ Loading...</span>
                  )}
                </div>
                {isPlaying && (
                  <div className="mt-2 flex space-x-1">
                    <div className="w-1 h-4 bg-red-500 animate-pulse" style={{ animationDelay: '0s' }}></div>
                    <div className="w-1 h-4 bg-red-500 animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-4 bg-red-500 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-1 h-4 bg-red-500 animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                  </div>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              <strong>👊 Fist</strong> - Play/Pause | <strong>🤟 Three Fingers</strong> (pinky down) - Next | <strong>✋ Open Hand</strong> (all up) - Brightness
            </p>
          </div>
        </div>
      </div>

      {/* Gesture Guide */}
      <div className="card bg-gradient-to-r from-purple-50 to-blue-50">
        <h3 className="text-2xl font-bold mb-4 text-gray-800">Gesture Guide</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-4xl mb-2">✋</div>
            <h4 className="font-semibold text-lg mb-1">Open Hand</h4>
            <p className="text-sm text-gray-600">Brightness control - Move up/down</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-4xl mb-2">☝️</div>
            <h4 className="font-semibold text-lg mb-1">One Finger</h4>
            <p className="text-sm text-gray-600">Volume control - Move up/down</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-4xl mb-2">✌️</div>
            <h4 className="font-semibold text-lg mb-1">Two Fingers</h4>
            <p className="text-sm text-gray-600">Mute toggle - Left/right</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-4xl mb-2">👊</div>
            <h4 className="font-semibold text-lg mb-1">Fist</h4>
            <p className="text-sm text-gray-600">Toggle Play/Pause video</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-4xl mb-2">🤟</div>
            <h4 className="font-semibold text-lg mb-1">Three Fingers</h4>
            <p className="text-sm text-gray-600">Next video (keep pinky down)</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-4xl mb-2">✋</div>
            <h4 className="font-semibold text-lg mb-1">Open Hand (All Up)</h4>
            <p className="text-sm text-gray-600">Brightness control + Previous video</p>
          </div>
        </div>
      </div>

      {/* Tips Section */}
      <div className="card bg-yellow-50">
        <h3 className="text-xl font-semibold mb-3 text-gray-800">💡 Tips for Best Results</h3>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Ensure good lighting for better hand detection</li>
          <li>Keep your hand centered in the camera frame</li>
          <li>Make clear, deliberate gestures</li>
          <li>Hold gestures steady for 1-2 seconds for recognition</li>
          <li>Avoid cluttered backgrounds</li>
          <li>� YouTube videos play in background - you can control them with gestures!</li>
          <li>📝 To add your own videos, replace video IDs in <code>youtubePlaylist</code> array</li>
        </ul>
      </div>
    </div>
  );
}

export default GestureControl;
