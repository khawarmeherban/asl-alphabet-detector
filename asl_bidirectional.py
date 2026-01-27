"""
Bidirectional ASL Communication System
Features:
- ASL Signs → Text → Speech (for hearing people)
- Speech → Text (for ASL users to read what's being said)
- Two-way conversation mode
- Conversation history with speaker identification
- Real-time subtitles
"""

import cv2
import mediapipe as mp
import numpy as np
import pickle
import os
from collections import deque, Counter
import pyttsx3
import speech_recognition as sr
from datetime import datetime
import threading

# Initialize MediaPipe Hands
BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

HAND_CONNECTIONS = frozenset([
    (0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (5, 6), (6, 7), (7, 8),
    (0, 9), (9, 10), (10, 11), (11, 12), (0, 13), (13, 14), (14, 15), (15, 16),
    (0, 17), (17, 18), (18, 19), (19, 20), (5, 9), (9, 13), (13, 17)
])

def normalize_landmarks(hand_landmarks_list):
    """Normalize hand landmarks"""
    coords = [[lm.x, lm.y] for lm in hand_landmarks_list]
    coords = np.array(coords)
    wrist = coords[0]
    normalized = coords - wrist
    x_min, y_min = normalized.min(axis=0)
    x_max, y_max = normalized.max(axis=0)
    scale = max(x_max - x_min, y_max - y_min)
    if scale > 0:
        normalized = normalized / scale
    return normalized.flatten()

class BidirectionalASL:
    def __init__(self, model_path='data/asl_model.pkl'):
        """Initialize bidirectional communication system"""
        # Load ASL model
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found at {model_path}")
        
        with open(model_path, 'rb') as f:
            self.model = pickle.load(f)
        
        # Text-to-speech engine
        self.tts_engine = pyttsx3.init()
        self.tts_engine.setProperty('rate', 150)
        self.tts_engine.setProperty('volume', 0.9)
        
        # Speech recognition
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        
        # Adjust for ambient noise
        print("\n[SETUP] Calibrating microphone for ambient noise...")
        with self.microphone as source:
            self.recognizer.adjust_for_ambient_noise(source, duration=1)
        print("[OK] Microphone calibrated")
        
        # Conversation state
        self.asl_text = ""  # Text from ASL signs
        self.speech_text = ""  # Text from speech
        self.conversation_history = []
        self.prediction_buffer = deque(maxlen=5)
        self.last_added_char = None
        self.stable_frames = 0
        self.min_stable_frames = 8
        
        # Speech recognition state
        self.listening = False
        self.speech_thread = None
        self.last_speech_time = datetime.now()
        
        # Mode selection
        self.mode = "both"  # "asl", "speech", or "both"
        
        print("\n" + "="*70)
        print("BIDIRECTIONAL ASL COMMUNICATION SYSTEM")
        print("="*70)
        print("[OK] ASL Recognition ready")
        print("[OK] Text-to-Speech ready")
        print("[OK] Speech-to-Text ready")
        print("[OK] Mode: Two-way Communication")
        print("="*70)
    
    def add_to_asl_text(self, char):
        """Add character to ASL text"""
        if char == self.last_added_char:
            return False
        self.asl_text += char
        self.last_added_char = char
        self.stable_frames = 0
        return True
    
    def add_space_asl(self):
        """Add space to ASL text"""
        if self.asl_text and self.asl_text[-1] != ' ':
            self.asl_text += ' '
            self.last_added_char = ' '
    
    def backspace_asl(self):
        """Remove last character from ASL text"""
        if self.asl_text:
            self.asl_text = self.asl_text[:-1]
            self.last_added_char = None
    
    def clear_asl_text(self):
        """Clear ASL text and save to history"""
        if self.asl_text.strip():
            self.conversation_history.append({
                'time': datetime.now().strftime("%H:%M:%S"),
                'speaker': 'ASL User',
                'text': self.asl_text,
                'mode': 'ASL'
            })
        self.asl_text = ""
        self.last_added_char = None
        self.stable_frames = 0
    
    def speak_asl_text(self):
        """Convert ASL text to speech"""
        if self.asl_text.strip():
            print(f"\n[SPEAKING ASL TEXT]: {self.asl_text}")
            try:
                self.tts_engine.say(self.asl_text)
                self.tts_engine.runAndWait()
            except Exception as e:
                print(f"[!] Speech error: {e}")
    
    def listen_for_speech(self):
        """Listen for speech and convert to text (runs in background)"""
        while self.listening:
            try:
                with self.microphone as source:
                    print("\n[LISTENING] Speak now...")
                    audio = self.recognizer.listen(source, timeout=5, phrase_time_limit=10)
                
                try:
                    # Recognize speech using Google Speech Recognition
                    text = self.recognizer.recognize_google(audio)
                    if text:
                        self.speech_text = text
                        self.last_speech_time = datetime.now()
                        print(f"[HEARD]: {text}")
                        
                        # Save to conversation history
                        self.conversation_history.append({
                            'time': datetime.now().strftime("%H:%M:%S"),
                            'speaker': 'Voice User',
                            'text': text,
                            'mode': 'Speech'
                        })
                        
                except sr.UnknownValueError:
                    print("[!] Could not understand audio")
                except sr.RequestError as e:
                    print(f"[!] Speech recognition error: {e}")
                    
            except sr.WaitTimeoutError:
                continue
            except Exception as e:
                print(f"[!] Listening error: {e}")
                break
    
    def start_listening(self):
        """Start listening for speech in background thread"""
        if not self.listening:
            self.listening = True
            self.speech_thread = threading.Thread(target=self.listen_for_speech, daemon=True)
            self.speech_thread.start()
            print("\n[OK] Voice listening started")
    
    def stop_listening(self):
        """Stop listening for speech"""
        if self.listening:
            self.listening = False
            if self.speech_thread:
                self.speech_thread.join(timeout=2)
            print("\n[OK] Voice listening stopped")
    
    def draw_ui(self, frame):
        """Draw comprehensive UI"""
        h, w, _ = frame.shape
        
        # Top section - ASL Text
        cv2.rectangle(frame, (0, 0), (w, 100), (20, 20, 80), -1)
        cv2.rectangle(frame, (0, 0), (w, 100), (100, 100, 200), 2)
        
        cv2.putText(frame, "ASL -> TEXT:", (10, 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (100, 255, 100), 1)
        
        asl_display = self.asl_text if self.asl_text else "[Sign to type...]"
        if len(asl_display) > 60:
            asl_display = "..." + asl_display[-60:]
        cv2.putText(frame, asl_display, (10, 60),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        cv2.putText(frame, f"Len: {len(self.asl_text)}", (w-120, 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
        
        # Middle section - Speech Text
        cv2.rectangle(frame, (0, 110), (w, 210), (80, 20, 20), -1)
        cv2.rectangle(frame, (0, 110), (w, 210), (200, 100, 100), 2)
        
        status = "LISTENING..." if self.listening else "Press 'M' to listen"
        cv2.putText(frame, f"VOICE -> TEXT: ({status})", (10, 135),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 100, 100), 1)
        
        # Show speech text with timeout indicator
        if self.speech_text:
            time_diff = (datetime.now() - self.last_speech_time).seconds
            if time_diff < 5:
                speech_display = self.speech_text
                if len(speech_display) > 60:
                    speech_display = "..." + speech_display[-60:]
                cv2.putText(frame, speech_display, (10, 170),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                
                # Fade indicator
                cv2.putText(frame, f"({5-time_diff}s)", (10, 195),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, (150, 150, 150), 1)
            else:
                cv2.putText(frame, "[Waiting for voice input...]", (10, 170),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (120, 120, 120), 1)
        else:
            cv2.putText(frame, "[Waiting for voice input...]", (10, 170),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (120, 120, 120), 1)
        
        # Bottom section - Instructions
        cv2.rectangle(frame, (0, h-100), (w, h), (0, 0, 0), -1)
        cv2.rectangle(frame, (0, h-100), (w, h), (80, 80, 80), 2)
        
        instructions = [
            "ASL: [S]pace [B]ack [C]lear [V]Speak | VOICE: [M]Mic ON/OFF [R]Read",
            "      [H]istory [Q]uit | MODE: Both ASL & Speech Active"
        ]
        
        y_pos = h - 75
        for instruction in instructions:
            cv2.putText(frame, instruction, (10, y_pos),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)
            y_pos += 25
        
        return frame
    
    def draw_prediction(self, frame, prediction, confidence):
        """Draw ASL prediction on frame"""
        h, w, _ = frame.shape
        
        box_x = w - 180
        box_y = 230
        cv2.rectangle(frame, (box_x, box_y), (w-10, box_y+100), (40, 40, 40), -1)
        cv2.rectangle(frame, (box_x, box_y), (w-10, box_y+100), (100, 200, 100), 2)
        
        cv2.putText(frame, "ASL Sign:", (box_x+10, box_y+25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)
        
        cv2.putText(frame, str(prediction), (box_x+40, box_y+70),
                   cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 0), 3)
        
        bar_width = int(150 * confidence)
        cv2.rectangle(frame, (box_x+10, box_y+85), (box_x+160, box_y+95), (50, 50, 50), -1)
        cv2.rectangle(frame, (box_x+10, box_y+85), (box_x+10+bar_width, box_y+95), (0, 255, 0), -1)
        
        cv2.putText(frame, f"{confidence*100:.1f}%", (box_x+50, box_y+92),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1)
        
        return frame
    
    def show_history(self):
        """Display conversation history"""
        print("\n" + "="*70)
        print("CONVERSATION HISTORY")
        print("="*70)
        if not self.conversation_history:
            print("No conversation yet.")
        else:
            for i, entry in enumerate(self.conversation_history, 1):
                print(f"{i}. [{entry['time']}] {entry['speaker']} ({entry['mode']}): {entry['text']}")
        print("="*70)
    
    def read_speech_aloud(self):
        """Read the last speech text aloud (echo back)"""
        if self.speech_text.strip():
            print(f"\n[READING BACK]: {self.speech_text}")
            try:
                self.tts_engine.say(self.speech_text)
                self.tts_engine.runAndWait()
            except Exception as e:
                print(f"[!] Speech error: {e}")
    
    def run(self):
        """Run the bidirectional system"""
        options = HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path='hand_landmarker.task'),
            running_mode=VisionRunningMode.VIDEO,
            num_hands=1,
            min_hand_detection_confidence=0.7,
            min_hand_presence_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap = cv2.VideoCapture(0)
            if not cap.isOpened():
                print("[X] Error: Could not open webcam")
                return
        
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        
        print("\n[OK] Starting bidirectional communication...")
        print("\nSign with ASL or speak - both work simultaneously!")
        
        frame_count = 0
        current_prediction = None
        current_confidence = 0
        
        with HandLandmarker.create_from_options(options) as landmarker:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                frame = cv2.flip(frame, 1)
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
                
                timestamp_ms = frame_count
                frame_count += 1
                
                detection_result = landmarker.detect_for_video(mp_image, timestamp_ms)
                
                frame = self.draw_ui(frame)
                
                if detection_result.hand_landmarks:
                    hand_landmarks = detection_result.hand_landmarks[0]
                    h, w, _ = frame.shape
                    
                    # Draw hand landmarks
                    for lm in hand_landmarks:
                        cx, cy = int(lm.x * w), int(lm.y * h)
                        cv2.circle(frame, (cx, cy), 4, (0, 255, 0), -1)
                    
                    for connection in HAND_CONNECTIONS:
                        start_lm = hand_landmarks[connection[0]]
                        end_lm = hand_landmarks[connection[1]]
                        start_point = (int(start_lm.x * w), int(start_lm.y * h))
                        end_point = (int(end_lm.x * w), int(end_lm.y * h))
                        cv2.line(frame, start_point, end_point, (255, 0, 0), 2)
                    
                    # Predict ASL sign
                    normalized_landmarks = normalize_landmarks(hand_landmarks)
                    features = normalized_landmarks.reshape(1, -1)
                    prediction = self.model.predict(features)[0]
                    confidence = self.model.predict_proba(features).max()
                    
                    self.prediction_buffer.append(prediction)
                    
                    if len(self.prediction_buffer) >= 3:
                        most_common = Counter(self.prediction_buffer).most_common(1)[0][0]
                        current_prediction = most_common
                        current_confidence = confidence
                        
                        if confidence > 0.85:
                            if current_prediction == self.prediction_buffer[-1] == self.prediction_buffer[-2]:
                                self.stable_frames += 1
                                
                                if self.stable_frames >= self.min_stable_frames:
                                    if self.add_to_asl_text(current_prediction):
                                        cv2.circle(frame, (w//2, 220), 30, (0, 255, 0), 5)
                            else:
                                self.stable_frames = 0
                    
                    frame = self.draw_prediction(frame, current_prediction, current_confidence)
                else:
                    self.stable_frames = 0
                
                cv2.imshow('Bidirectional ASL Communication', frame)
                
                key = cv2.waitKey(1) & 0xFF
                
                if key == ord('q') or key == 27:
                    break
                elif key == ord('s'):
                    self.add_space_asl()
                elif key == ord('b'):
                    self.backspace_asl()
                elif key == ord('c'):
                    self.clear_asl_text()
                elif key == ord('v'):
                    self.speak_asl_text()
                elif key == ord('m'):
                    if self.listening:
                        self.stop_listening()
                    else:
                        self.start_listening()
                elif key == ord('r'):
                    self.read_speech_aloud()
                elif key == ord('h'):
                    self.show_history()
                
                if cv2.getWindowProperty('Bidirectional ASL Communication', cv2.WND_PROP_VISIBLE) < 1:
                    break
        
        self.stop_listening()
        if self.asl_text:
            self.clear_asl_text()
        
        cap.release()
        cv2.destroyAllWindows()
        
        print("\n" + "="*70)
        print("Bidirectional Communication Closed")
        print("="*70)
        self.show_history()

def main():
    try:
        system = BidirectionalASL()
        system.run()
    except FileNotFoundError as e:
        print(f"\n[X] Error: {e}")
        print("\nPlease run 'python inference_classifier.py' first.")
    except Exception as e:
        print(f"\n[X] Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
