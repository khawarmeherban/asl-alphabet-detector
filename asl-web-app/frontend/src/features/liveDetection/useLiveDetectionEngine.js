import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Hands } from '@mediapipe/hands';
import {
  API_URL,
  FRAME_INTERVAL_MS,
  MIN_CLIENT_CONFIDENCE,
  PREDICTION_THROTTLE_MS
} from './constants';

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17]
];

const FINGER_COLORS = ['#ff7a59', '#00ff88', '#45c4ff', '#f9d65c', '#d17bff'];

function drawOverlay(canvas, landmarks, showLandmarks) {
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!showLandmarks || !landmarks?.length) {
    return;
  }

  HAND_CONNECTIONS.forEach(([start, end]) => {
    const startPoint = landmarks[start];
    const endPoint = landmarks[end];
    if (!startPoint || !endPoint) {
      return;
    }

    ctx.strokeStyle = FINGER_COLORS[Math.floor(start / 4)] || '#00ff88';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
    ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
    ctx.stroke();
  });

  landmarks.forEach((landmark, index) => {
    ctx.fillStyle = FINGER_COLORS[Math.floor(index / 4)] || '#00ff88';
    ctx.strokeStyle = '#03120c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

function normalizeLandmarks(landmarks, handedness = null) {
  const coords = landmarks.map((landmark) => [landmark.x, landmark.y]);
  const wrist = coords[0];
  let normalized = coords.map(([x, y]) => [x - wrist[0], y - wrist[1]]);

  if (String(handedness || '').toLowerCase() === 'left') {
    normalized = normalized.map(([x, y]) => [-x, y]);
  }

  const xs = normalized.map(([x]) => x);
  const ys = normalized.map(([, y]) => y);
  const scale = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));

  if (scale > 0) {
    return normalized.flat().map((value) => value / scale);
  }

  return normalized.flat();
}

export function useLiveDetectionEngine({
  enabled,
  videoRef,
  overlayRef,
  showLandmarks,
  onControlGesture
}) {
  const [cameraStatus, setCameraStatus] = useState('idle');
  const [predictionState, setPredictionState] = useState({
    rawPrediction: '',
    stablePrediction: '',
    confidence: 0,
    topPredictions: [],
    stability: { hits: 0, ratio: 0, ready: false, window: 0 }
  });
  const [lastLandmarks, setLastLandmarks] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('unknown');
  const [error, setError] = useState('');
  const [visionQuality, setVisionQuality] = useState({
    handCount: 0,
    brightness: 0,
    lighting: 'unknown',
    occlusion: 'clear',
    hint: 'Show one clear hand sign to begin.'
  });

  const streamRef = useRef(null);
  const handsRef = useRef(null);
  const qualityCanvasRef = useRef(null);
  const activeRef = useRef(false);
  const animationFrameRef = useRef(null);
  const lastFrameAtRef = useRef(0);
  const lastPredictionAtRef = useRef(0);
  const lastLightingAtRef = useRef(0);
  const requestInFlightRef = useRef(false);
  const processingFrameRef = useRef(false);
  const controlGestureRef = useRef({ action: '', hits: 0, lastAcceptedAt: 0 });
  const sessionIdRef = useRef(`alphahand-${Math.random().toString(36).slice(2, 10)}`);
  const handRoleRef = useRef({
    signLabel: '',
    signCenterX: null,
    signCenterY: null
  });

  useEffect(() => {
    if (!enabled) {
      stopEngine();
      return undefined;
    }

    startEngine();
    return () => {
      stopEngine();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    drawOverlay(overlayRef.current, lastLandmarks, showLandmarks);
  }, [lastLandmarks, overlayRef, showLandmarks]);

  const resetPredictionState = () => {
    setPredictionState({
      rawPrediction: '',
      stablePrediction: '',
      confidence: 0,
      topPredictions: [],
      stability: { hits: 0, ratio: 0, ready: false, window: 0 }
    });
    setLastLandmarks([]);
  };

  const stopEngine = ({ preserveStatus = false } = {}) => {
    activeRef.current = false;
    if (!preserveStatus) {
      setCameraStatus('idle');
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (handsRef.current) {
      const currentHands = handsRef.current;
      handsRef.current = null;
      Promise.resolve(currentHands.close()).catch((closeError) => {
        console.warn('Unable to close MediaPipe Hands cleanly.', closeError);
      });
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    drawOverlay(overlayRef.current, [], false);
    resetPredictionState();
    setVisionQuality({
      handCount: 0,
      brightness: 0,
      lighting: 'unknown',
      occlusion: 'clear',
      hint: 'Show one clear hand sign to begin.'
    });
  };

  const getHandCenter = (landmarks) => {
    const box = getHandBoundingBox(landmarks);
    return {
      x: (box.minX + box.maxX) / 2,
      y: (box.minY + box.maxY) / 2,
      area: (box.maxX - box.minX) * (box.maxY - box.minY)
    };
  };

  const assignHandRoles = (hands, handednessList = []) => {
    if (!hands.length) {
      handRoleRef.current = {
        ...handRoleRef.current,
        signCenterX: null,
        signCenterY: null
      };
      return {
        primaryHand: [],
        secondaryHand: [],
        primaryHandedness: '',
        secondaryHandedness: ''
      };
    }

    const handEntries = hands.map((landmarks, index) => {
      const center = getHandCenter(landmarks);
      return {
        landmarks,
        handedness: handednessList[index]?.label || '',
        center
      };
    });

    let primaryEntry = handEntries[0];
    let secondaryEntry = handEntries[1] || null;

    if (handEntries.length > 1) {
      const stickyLabel = handRoleRef.current.signLabel;
      const stickyX = handRoleRef.current.signCenterX;
      const stickyY = handRoleRef.current.signCenterY;

      if (stickyLabel) {
        const matchingEntry = handEntries.find((entry) => entry.handedness === stickyLabel);
        if (matchingEntry) {
          primaryEntry = matchingEntry;
          secondaryEntry = handEntries.find((entry) => entry !== matchingEntry) || null;
        }
      } else if (stickyX !== null && stickyY !== null) {
        const sortedByDistance = [...handEntries].sort((left, right) => {
          const leftDistance = Math.hypot(left.center.x - stickyX, left.center.y - stickyY);
          const rightDistance = Math.hypot(right.center.x - stickyX, right.center.y - stickyY);
          return leftDistance - rightDistance;
        });
        primaryEntry = sortedByDistance[0];
        secondaryEntry = sortedByDistance[1] || null;
      } else {
        const sortedByArea = [...handEntries].sort((left, right) => right.center.area - left.center.area);
        primaryEntry = sortedByArea[0];
        secondaryEntry = sortedByArea[1] || null;
      }
    }

    handRoleRef.current = {
      signLabel: primaryEntry.handedness || handRoleRef.current.signLabel,
      signCenterX: primaryEntry.center.x,
      signCenterY: primaryEntry.center.y
    };

    return {
      primaryHand: primaryEntry.landmarks,
      secondaryHand: secondaryEntry?.landmarks || [],
      primaryHandedness: primaryEntry.handedness,
      secondaryHandedness: secondaryEntry?.handedness || ''
    };
  };

  const getHandBoundingBox = (landmarks) => {
    const xs = landmarks.map((point) => point.x);
    const ys = landmarks.map((point) => point.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
  };

  const estimateLighting = (video) => {
    if (!video?.videoWidth || !video?.videoHeight) {
      return 0;
    }

    if (!qualityCanvasRef.current) {
      qualityCanvasRef.current = document.createElement('canvas');
      qualityCanvasRef.current.width = 32;
      qualityCanvasRef.current.height = 24;
    }

    const canvas = qualityCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return 0;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let total = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      total += (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
    }

    return total / (pixels.length / 4);
  };

  const getRaisedFingers = (landmarks, handedness) => {
    const thumbExtended = String(handedness || '').toLowerCase() === 'left'
      ? landmarks[4].x < landmarks[3].x
      : landmarks[4].x > landmarks[3].x;
    const indexExtended = landmarks[8].y < landmarks[6].y;
    const middleExtended = landmarks[12].y < landmarks[10].y;
    const ringExtended = landmarks[16].y < landmarks[14].y;
    const pinkyExtended = landmarks[20].y < landmarks[18].y;

    return {
      thumb: thumbExtended,
      index: indexExtended,
      middle: middleExtended,
      ring: ringExtended,
      pinky: pinkyExtended
    };
  };

  const detectControlGesture = (landmarks, handedness) => {
    if (!landmarks?.length) {
      return '';
    }

    const fingers = getRaisedFingers(landmarks, handedness);
    const raisedCount = Object.values(fingers).filter(Boolean).length;

    if (raisedCount >= 4) {
      return 'space';
    }
    if (raisedCount === 0) {
      return 'clear';
    }
    if (fingers.thumb && !fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
      return 'speak';
    }

    return '';
  };

  const processControlGesture = (landmarks, handedness) => {
    const action = detectControlGesture(landmarks, handedness);
    if (!action) {
      controlGestureRef.current = { ...controlGestureRef.current, action: '', hits: 0 };
      return;
    }

    if (controlGestureRef.current.action === action) {
      controlGestureRef.current.hits += 1;
    } else {
      controlGestureRef.current = {
        ...controlGestureRef.current,
        action,
        hits: 1
      };
    }

    const now = Date.now();
    if (
      controlGestureRef.current.hits >= 6 &&
      now - controlGestureRef.current.lastAcceptedAt > 1600
    ) {
      controlGestureRef.current.lastAcceptedAt = now;
      if (typeof onControlGesture === 'function') {
        onControlGesture(action);
      }
    }
  };

  const updateVisionQuality = (hands, video) => {
    const handCount = hands.length;
    let hint = 'Show one clear hand sign to begin.';
    let occlusion = 'clear';
    const brightness = estimateLighting(video);
    const lighting = brightness < 55 ? 'low' : brightness < 95 ? 'dim' : 'good';

    if (handCount === 0) {
      hint = 'No hands detected. Center your signing hand in the frame.';
    } else {
      const primaryBox = getHandBoundingBox(hands[0]);
      const primaryArea = (primaryBox.maxX - primaryBox.minX) * (primaryBox.maxY - primaryBox.minY);
      if (primaryArea < 0.04) {
        occlusion = 'partial';
        hint = 'Move your hand closer to the camera for a larger signing window.';
      } else if (handCount > 1) {
        const secondaryBox = getHandBoundingBox(hands[1]);
        const overlapX = Math.max(0, Math.min(primaryBox.maxX, secondaryBox.maxX) - Math.max(primaryBox.minX, secondaryBox.minX));
        const overlapY = Math.max(0, Math.min(primaryBox.maxY, secondaryBox.maxY) - Math.max(primaryBox.minY, secondaryBox.minY));
        const overlapArea = overlapX * overlapY;
        if (overlapArea > 0.015) {
          occlusion = 'overlap';
          hint = 'Hands are overlapping. Separate them for cleaner control and recognition.';
        } else {
          hint = 'Two hands detected: primary signs, secondary hand can trigger controls.';
        }
      } else {
        hint = 'Primary hand locked. Hold the sign steady to confirm letters.';
      }
    }

    if (lighting === 'low') {
      hint = 'Low light detected. Add more light or face the light source.';
    }

    setVisionQuality({
      handCount,
      brightness: Math.round(brightness),
      lighting,
      occlusion,
      hint
    });
  };

  const handleResults = async (results) => {
    if (!activeRef.current) {
      return;
    }

    // Mark frame processing complete when entering handler
    processingFrameRef.current = false;

    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) {
      return;
    }

    if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
    }

    const hands = results.multiHandLandmarks || [];
    const {
      primaryHand,
      secondaryHand,
      primaryHandedness,
      secondaryHandedness
    } = assignHandRoles(hands, results.multiHandedness || []);
    setLastLandmarks(primaryHand);

    const now = performance.now();
    if (now - lastLightingAtRef.current > 900) {
      lastLightingAtRef.current = now;
      updateVisionQuality(hands, video);
    }

    if (secondaryHand.length) {
      processControlGesture(secondaryHand, secondaryHandedness);
    } else {
      controlGestureRef.current = { ...controlGestureRef.current, action: '', hits: 0 };
    }

    if (!primaryHand.length) {
      resetPredictionState();
      return;
    }

    const requestNow = Date.now();
    if (requestInFlightRef.current || requestNow - lastPredictionAtRef.current < PREDICTION_THROTTLE_MS) {
      return;
    }

    lastPredictionAtRef.current = requestNow;
    requestInFlightRef.current = true;

    try {
      const response = await axios.post(
        `${API_URL}/predict`,
        {
          landmarks: normalizeLandmarks(primaryHand, primaryHandedness),
          sessionId: sessionIdRef.current
        },
        { timeout: 5000 }
      );

      const payload = response.data || {};
      setConnectionStatus('connected');
      setError('');
      setPredictionState({
        rawPrediction: payload.raw_prediction || payload.prediction || '',
        stablePrediction: payload.stable_prediction || '',
        confidence: Number(payload.stable_confidence || payload.confidence || 0),
        topPredictions: (payload.top_predictions || []).slice(0, 3),
        stability: {
          hits: Number(payload.temporal_hits || 0),
          ratio: Number(payload.temporal_ratio || 0),
          ready: Boolean(payload.temporal_accepted),
          window: Number(payload.temporal_window || 0)
        }
      });
    } catch (predictError) {
      console.error('Prediction request failed.', predictError);
      setConnectionStatus('disconnected');
      setError(
        predictError.response?.data?.error ||
          'Prediction service unavailable. Detection UI is still running.'
      );
    } finally {
      requestInFlightRef.current = false;
    }
  };

  const startEngine = async () => {
    try {
      setCameraStatus('starting');
      setError('');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;
      activeRef.current = true;
      setCameraStatus('ready');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: MIN_CLIENT_CONFIDENCE,
        minTrackingConfidence: MIN_CLIENT_CONFIDENCE
      });
      hands.onResults(handleResults);
      handsRef.current = hands;

      const runFrame = async () => {
        if (!activeRef.current || !videoRef.current || !handsRef.current) {
          return;
        }

        const now = performance.now();
        if (
          videoRef.current.readyState >= 2 &&
          now - lastFrameAtRef.current >= FRAME_INTERVAL_MS
        ) {
          lastFrameAtRef.current = now;
          try {
            // Avoid awaiting MediaPipe send on the main loop to prevent jank.
            // Use a processing flag to avoid piling up frames.
            if (!processingFrameRef.current) {
              processingFrameRef.current = true;
              handsRef.current.send({ image: videoRef.current }).catch((err) => {
                console.error('MediaPipe send failed (async):', err);
                processingFrameRef.current = false;
              });
            }
          } catch (frameError) {
            console.error('MediaPipe frame processing failed.', frameError);
          }
        }

        animationFrameRef.current = requestAnimationFrame(runFrame);
      };

      animationFrameRef.current = requestAnimationFrame(runFrame);
    } catch (cameraError) {
      console.error('Unable to start camera.', cameraError);
      setCameraStatus('error');
      setError(cameraError.message || 'Camera permission was denied.');
      stopEngine({ preserveStatus: true });
    }
  };

  return {
    cameraStatus,
    predictionState,
    lastLandmarks,
    connectionStatus,
    error,
    visionQuality,
    sessionId: sessionIdRef.current
  };
}

export default useLiveDetectionEngine;
