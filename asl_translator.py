"""
ASL to Text Translation System with Speech Output
Features:
- Real-time ASL to text translation
- Text-to-speech output
- Multi-language translation
- Conversation mode with history
- Special gesture commands (space, clear, speak)
"""

import cv2
import mediapipe as mp
import numpy as np
import pickle
import os
from collections import deque, Counter
import pyttsx3
from datetime import datetime

# Initialize MediaPipe Hands using the tasks API
BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

# Hand connections for drawing
HAND_CONNECTIONS = frozenset([
    (0, 1), (1, 2), (2, 3), (3, 4),  # Thumb
    (0, 5), (5, 6), (6, 7), (7, 8),  # Index
    (0, 9), (9, 10), (10, 11), (11, 12),  # Middle
    (0, 13), (13, 14), (14, 15), (15, 16),  # Ring
    (0, 17), (17, 18), (18, 19), (19, 20),  # Pinky
    (5, 9), (9, 13), (13, 17)  # Palm
])

def normalize_landmarks(hand_landmarks_list):
    """Normalize hand landmarks relative to the wrist (landmark 0)."""
    coords = []
    for lm in hand_landmarks_list:
        coords.append([lm.x, lm.y])
    
    coords = np.array(coords)
    wrist = coords[0]
    normalized = coords - wrist
    
    x_min, y_min = normalized.min(axis=0)
    x_max, y_max = normalized.max(axis=0)
    scale = max(x_max - x_min, y_max - y_min)
    
    if scale > 0:
        normalized = normalized / scale
    
    return normalized.flatten()

class ASLTranslator:
    def __init__(self, model_path='data/asl_model.pkl'):
        """Initialize the ASL Translator"""
        # Load trained model
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found at {model_path}. Run inference_classifier.py first.")
        
        with open(model_path, 'rb') as f:
            self.model = pickle.load(f)
        
        # Text-to-speech engine
        self.tts_engine = pyttsx3.init()
        self.tts_engine.setProperty('rate', 150)  # Speed
        self.tts_engine.setProperty('volume', 0.9)  # Volume
        
        # Translation settings
        self.current_language = 'en'
        self.languages = {
            'en': 'English',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese',
            'hi': 'Hindi',
            'zh': 'Chinese'
        }
        
        # Conversation state
        self.current_text = ""
        self.conversation_history = []
        self.prediction_buffer = deque(maxlen=7)
        self.last_added_char = None
        self.stable_frames = 0
        self.min_stable_frames = 5  # Lower delay while keeping output stable
        
        # Special commands
        self.command_mode = False
        self.command_buffer = deque(maxlen=3)
        
        print("\n" + "="*70)
        print("ASL to Text Translation System Initialized")
        print("="*70)
        print(f"[OK] Model loaded from {model_path}")
        print(f"[OK] Text-to-speech engine ready")
        print(f"[OK] Language: {self.languages[self.current_language]}")
        print("="*70)
    
    def add_to_text(self, char):
        """Add character to current text with debouncing"""
        if char == self.last_added_char:
            return False
        
        self.current_text += char
        self.last_added_char = char
        self.stable_frames = 0
        return True
    
    def add_space(self):
        """Add space to text"""
        if self.current_text and self.current_text[-1] != ' ':
            self.current_text += ' '
            self.last_added_char = ' '
    
    def backspace(self):
        """Remove last character"""
        if self.current_text:
            self.current_text = self.current_text[:-1]
            self.last_added_char = None
    
    def clear_text(self):
        """Clear current text"""
        if self.current_text:
            self.conversation_history.append({
                'time': datetime.now().strftime("%H:%M:%S"),
                'text': self.current_text,
                'language': self.current_language
            })
        self.current_text = ""
        self.last_added_char = None
        self.stable_frames = 0
    
    def speak_text(self):
        """Convert current text to speech"""
        if self.current_text.strip():
            print(f"\n[SPEAKING]: {self.current_text}")
            try:
                self.tts_engine.say(self.current_text)
                self.tts_engine.runAndWait()
            except Exception as e:
                print(f"[!] Speech error: {e}")
    
    def translate_text(self, target_lang='es'):
        """Translate current text to another language"""
        if not self.current_text.strip():
            return ""
        
        try:
            # Note: For production, use googletrans library
            # from googletrans import Translator
            # translator = Translator()
            # result = translator.translate(self.current_text, dest=target_lang)
            # return result.text
            
            # For now, return original with language marker
            return f"[{target_lang.upper()}] {self.current_text}"
        except Exception as e:
            print(f"[!] Translation error: {e}")
            return self.current_text
    
    def draw_ui(self, frame):
        """Draw comprehensive UI on frame"""
        h, w, _ = frame.shape
        
        # Create dark overlay panels
        # Top panel - Current text
        cv2.rectangle(frame, (0, 0), (w, 120), (0, 0, 0), -1)
        cv2.rectangle(frame, (0, 0), (w, 120), (50, 50, 50), 2)
        
        # Bottom panel - Instructions
        cv2.rectangle(frame, (0, h-100), (w, h), (0, 0, 0), -1)
        cv2.rectangle(frame, (0, h-100), (w, h), (50, 50, 50), 2)
        
        # Current text display
        cv2.putText(frame, "ASL Translation:", (10, 25), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (100, 255, 100), 1)
        
        # Display text with word wrap
        text_to_display = self.current_text if self.current_text else "[No text yet]"
        y_offset = 55
        max_chars = 70
        
        if len(text_to_display) > max_chars:
            lines = [text_to_display[i:i+max_chars] for i in range(0, len(text_to_display), max_chars)]
            for line in lines[-2:]:  # Show last 2 lines
                cv2.putText(frame, line, (10, y_offset), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
                y_offset += 30
        else:
            cv2.putText(frame, text_to_display, (10, y_offset), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        
        # Character count
        cv2.putText(frame, f"Length: {len(self.current_text)}", (w-150, 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)
        
        # Language indicator
        cv2.putText(frame, f"Lang: {self.languages[self.current_language]}", (w-150, 50),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)
        
        # Instructions
        instructions = [
            "KEYBOARD: [S]pace | [B]ackspace | [C]lear | [V]oice | [Q]uit",
            "          [L]anguage | [H]istory | [T]ranslate",
        ]
        
        y_pos = h - 70
        for instruction in instructions:
            cv2.putText(frame, instruction, (10, y_pos),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1)
            y_pos += 25
        
        return frame
    
    def draw_prediction(self, frame, prediction, confidence):
        """Draw prediction and confidence on frame"""
        h, w, _ = frame.shape
        
        # Prediction box (right side, middle)
        box_x = w - 180
        box_y = 140
        cv2.rectangle(frame, (box_x, box_y), (w-10, box_y+100), (40, 40, 40), -1)
        cv2.rectangle(frame, (box_x, box_y), (w-10, box_y+100), (100, 100, 100), 2)
        
        # Current prediction
        cv2.putText(frame, "Detected:", (box_x+10, box_y+25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)
        
        cv2.putText(frame, str(prediction), (box_x+40, box_y+70),
                   cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 0), 3)
        
        # Confidence bar
        bar_width = int(150 * confidence)
        cv2.rectangle(frame, (box_x+10, box_y+85), (box_x+160, box_y+95), (50, 50, 50), -1)
        cv2.rectangle(frame, (box_x+10, box_y+85), (box_x+10+bar_width, box_y+95), (0, 255, 0), -1)
        
        cv2.putText(frame, f"{confidence*100:.1f}%", (box_x+50, box_y+92),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1)
        
        return frame
    
    def show_history(self):
        """Print conversation history"""
        print("\n" + "="*70)
        print("CONVERSATION HISTORY")
        print("="*70)
        if not self.conversation_history:
            print("No history yet.")
        else:
            for i, entry in enumerate(self.conversation_history, 1):
                print(f"{i}. [{entry['time']}] {entry['text']}")
        print("="*70)
    
    def run(self):
        """Run the ASL translator with faster frame handling."""
        import threading
        from queue import Queue

        FRAME_SKIP = 1
        CONFIDENCE_THRESHOLD = 0.80

        def capture_frames(queue, cap):
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                if queue.qsize() < 2:
                    queue.put(frame)

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
        cap.set(cv2.CAP_PROP_FPS, 30)

        print("\n[OK] Webcam opened successfully")
        print("[OK] Starting ASL translation...")
        print("\nShow ASL signs to translate them to text!")

        frame_queue = Queue()
        capture_thread = threading.Thread(target=capture_frames, args=(frame_queue, cap), daemon=True)
        capture_thread.start()

        frame_count = 0
        current_prediction = None
        current_confidence = 0

        with HandLandmarker.create_from_options(options) as landmarker:
            while True:
                if frame_queue.empty():
                    continue

                frame = frame_queue.get()
                frame_count += 1
                if frame_count % (FRAME_SKIP + 1) != 0:
                    continue

                frame = cv2.flip(frame, 1)
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
                detection_result = landmarker.detect_for_video(mp_image, frame_count)

                frame = self.draw_ui(frame)

                if detection_result.hand_landmarks:
                    hand_landmarks = detection_result.hand_landmarks[0]
                    h, w, _ = frame.shape

                    for lm in hand_landmarks:
                        cx, cy = int(lm.x * w), int(lm.y * h)
                        cv2.circle(frame, (cx, cy), 4, (0, 255, 0), -1)

                    for connection in HAND_CONNECTIONS:
                        start_lm = hand_landmarks[connection[0]]
                        end_lm = hand_landmarks[connection[1]]
                        start_point = (int(start_lm.x * w), int(start_lm.y * h))
                        end_point = (int(end_lm.x * w), int(end_lm.y * h))
                        cv2.line(frame, start_point, end_point, (255, 0, 0), 2)

                    normalized_landmarks = normalize_landmarks(hand_landmarks)
                    features = normalized_landmarks.reshape(1, -1)
                    probabilities = self.model.predict_proba(features)[0]
                    best_index = int(np.argmax(probabilities))
                    confidence = float(probabilities[best_index])
                    prediction = self.model.classes_[best_index]

                    if confidence >= CONFIDENCE_THRESHOLD:
                        self.prediction_buffer.append(prediction)

                    if len(self.prediction_buffer) >= 3:
                        most_common = Counter(self.prediction_buffer).most_common(1)[0][0]
                        current_prediction = most_common
                        current_confidence = confidence

                        if confidence >= CONFIDENCE_THRESHOLD and current_prediction == self.prediction_buffer[-1] == self.prediction_buffer[-2]:
                            self.stable_frames += 1
                            if self.stable_frames >= self.min_stable_frames:
                                if self.add_to_text(current_prediction):
                                    cv2.circle(frame, (w // 2, h // 2), 50, (0, 255, 0), 5)
                        else:
                            self.stable_frames = 0

                    frame = self.draw_prediction(frame, current_prediction, current_confidence)
                else:
                    cv2.putText(frame, "No hand detected", (frame.shape[1] - 250, 200),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                    self.stable_frames = 0

                cv2.imshow('ASL Translator', frame)

                key = cv2.waitKey(1) & 0xFF
                if key == ord('q') or key == 27:
                    break
                elif key == ord('s'):
                    self.add_space()
                elif key == ord('b'):
                    self.backspace()
                elif key == ord('c'):
                    self.clear_text()
                elif key == ord('v'):
                    self.speak_text()
                elif key == ord('h'):
                    self.show_history()
                elif key == ord('t'):
                    translated = self.translate_text('es')
                    print(f"\n[TRANSLATED]: {translated}")
                elif key == ord('l'):
                    langs = list(self.languages.keys())
                    current_idx = langs.index(self.current_language)
                    self.current_language = langs[(current_idx + 1) % len(langs)]
                    print(f"\n[LANGUAGE CHANGED]: {self.languages[self.current_language]}")

                if cv2.getWindowProperty('ASL Translator', cv2.WND_PROP_VISIBLE) < 1:
                    break

        if self.current_text:
            self.clear_text()

        cap.release()
        cv2.destroyAllWindows()

        print("\n" + "=" * 70)
        print("ASL Translator Closed")
        print("=" * 70)
        self.show_history()

def main():
    try:
        translator = ASLTranslator()
        translator.run()
    except FileNotFoundError as e:
        print(f"\n[X] Error: {e}")
        print("\nPlease run 'python inference_classifier.py' first to train the model.")
    except Exception as e:
        print(f"\n[X] Unexpected error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
