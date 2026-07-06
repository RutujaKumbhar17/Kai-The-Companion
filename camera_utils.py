import os
# --- FIX FOR OMP ERROR (CRITICAL) ---
# This prevents "Insufficient system resources" / "Cannot create thread" crashes
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import cv2
import numpy as np
import base64
import time
import csv
import glob
from PIL import Image
from transformers import pipeline

# --- CONFIGURATION ---
HF_MODEL_NAME = "dima806/facial_emotions_image_detection"

# Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CAPTURES_DIR = os.path.join(BASE_DIR, 'captured_frames')
LOGS_DIR = os.path.join(BASE_DIR, 'logs')
MODEL_DIR = os.path.join(BASE_DIR, 'model_cache') # Local folder for model
LOG_FILE = os.path.join(LOGS_DIR, 'emotion_logs.csv')

# Ensure directories exist
os.makedirs(CAPTURES_DIR, exist_ok=True)
os.makedirs(LOGS_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

# Initialize Log File
if not os.path.exists(LOG_FILE):
    with open(LOG_FILE, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Timestamp', 'Date', 'Time', 'Emotion', 'Score'])

# --- MODEL LOADING LOGIC ---
emotion_classifier = None

def load_model():
    global emotion_classifier
    print("Checking for local model...")
    
    try:
        # Check if we have the model saved locally
        config_path = os.path.join(MODEL_DIR, "config.json")
        if os.path.exists(config_path):
            print(f"Loading model from local cache: {MODEL_DIR} (FAST)...")
            try:
                emotion_classifier = pipeline("image-classification", model=MODEL_DIR, top_k=1)
                print("Model Loaded Successfully from Cache.")
                return
            except Exception as e:
                print(f"Cache Loading Error: {e}. Re-downloading...")
        
        print(f"Downloading model from Hugging Face: {HF_MODEL_NAME} (First run only)...")
        # Load from Hub
        emotion_classifier = pipeline("image-classification", model=HF_MODEL_NAME, top_k=1)
        # Save to local folder for next time
        print("Saving model locally for future fast startups...")
        emotion_classifier.save_pretrained(MODEL_DIR)
        print("Model Loaded and Saved Successfully.")

    except Exception as e:
        print(f"Error loading model: {e}")
        emotion_classifier = None

# Load the model immediately
load_model()

# Load Face Detector (Robust offline-first loading with multiple fallbacks)
face_cascade = None
cascade_name = 'haarcascade_frontalface_default.xml'
local_cascade_path = os.path.join(BASE_DIR, cascade_name)

print("DEBUG cv2 path:", getattr(cv2, "__file__", "unknown"))
print("Attempting to load face cascade classifier...")

try:
    if os.path.exists(local_cascade_path):
        print(f"Loading cascade from local path: {local_cascade_path}")
        face_cascade = cv2.CascadeClassifier(local_cascade_path)
    
    if face_cascade is None or face_cascade.empty():
        # Fallback to cv2.data.haarcascades if available
        if hasattr(cv2, 'data') and hasattr(cv2.data, 'haarcascades'):
            fallback_path = os.path.join(cv2.data.haarcascades, cascade_name)
            print(f"Local cascade failed/empty. Trying cv2.data fallback: {fallback_path}")
            face_cascade = cv2.CascadeClassifier(fallback_path)
            
    if face_cascade is None or face_cascade.empty():
        # Last resort: try just passing the filename
        print("Fallback to raw filename loading...")
        face_cascade = cv2.CascadeClassifier(cascade_name)
        
    if face_cascade is None or face_cascade.empty():
        print("WARNING: Face cascade classifier could not be loaded. Face detection will be disabled.")
    else:
        print("Face cascade classifier loaded successfully.")
except Exception as e:
    print(f"ERROR: Exception occurred while loading face cascade classifier: {e}")

# State
last_capture_time = 0

EMOTION_MAPPING = {
    'happiness': 'happy',
    'sadness': 'sad',
    'anger': 'angry',
    'fear': 'fear',
    'surprise': 'surprise',
    'disgust': 'disgust',
    'neutral': 'neutral'
}

def is_proper_frame(face_box, frame_shape):
    x, y, w, h = face_box
    height, width, _ = frame_shape
    if w < width * 0.10: return False  # Relaxed from 0.15
    face_center_x = x + w / 2
    face_center_y = y + h / 2
    margin_x = width * 0.15  # Relaxed from 0.20
    margin_y = height * 0.15 # Relaxed from 0.20
    if (face_center_x < margin_x or face_center_x > (width - margin_x)): return False
    if (face_center_y < margin_y or face_center_y > (height - margin_y)): return False
    return True

def maintain_photo_buffer():
    # Maintain 50 photos
    # This logic deletes the oldest photo if more than 50 exist
    files = sorted(glob.glob(os.path.join(CAPTURES_DIR, "*.jpg")), key=os.path.getmtime)
    while len(files) > 50:
        try:
            os.remove(files[0])
            files.pop(0)
        except Exception as e:
            print(f"Error deleting file: {e}")
            break

def log_emotion(emotion, score):
    now = time.time()
    date_str = time.strftime("%Y-%m-%d", time.localtime(now))
    time_str = time.strftime("%H:%M:%S", time.localtime(now))
    try:
        with open(LOG_FILE, 'a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([now, date_str, time_str, emotion, f"{score:.4f}"])
    except Exception as e:
        print(f"Logging Error: {e}")

def analyze_emotion_from_frame(data_url):
    global last_capture_time

    if not emotion_classifier or face_cascade is None:
        return None

    try:
        if ',' in data_url:
            encoded_data = data_url.split(',')[1]
        else:
            return None
        
        nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

        current_time = time.time()
        is_capture_ready = (current_time - last_capture_time >= 2.0)

        if len(faces) == 0:
            if is_capture_ready:
                # Save Full Frame as placeholder if no face detected
                timestamp = int(current_time * 1000)
                filename = os.path.join(CAPTURES_DIR, f"face_{timestamp}_searching.jpg")
                cv2.imwrite(filename, frame) 
                log_emotion("searching", 0.0)
                maintain_photo_buffer()
                last_capture_time = current_time
            return None

        # Face(s) Found
        (x, y, w, h) = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)[0]
        face_roi = frame[y:y+h, x:x+w]
        
        if is_proper_frame((x, y, w, h), frame.shape):
            # RGB conversion and resizing for faster model inference
            rgb_face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(rgb_face).resize((224, 224)) # standard ViT size for speed
            
            results = emotion_classifier(pil_image)
            
            if results:
                raw_emotion = results[0]['label']
                confidence = results[0]['score']
                final_emotion = EMOTION_MAPPING.get(raw_emotion, raw_emotion)

                log_emotion(final_emotion, confidence)

                if is_capture_ready:
                    timestamp = int(current_time * 1000)
                    filename = os.path.join(CAPTURES_DIR, f"face_{timestamp}_{final_emotion}.jpg")
                    cv2.imwrite(filename, face_roi)
                    maintain_photo_buffer()
                    last_capture_time = current_time

                return {'emotion': final_emotion, 'score': confidence}

        elif is_capture_ready:
            # Face found but not "proper" (too small or off-center)
            timestamp = int(current_time * 1000)
            filename = os.path.join(CAPTURES_DIR, f"face_{timestamp}_uncentered.jpg")
            cv2.imwrite(filename, frame)
            log_emotion("uncentered", 0.0)
            maintain_photo_buffer()
            last_capture_time = current_time

        return None
        
    except Exception as e:
        print(f"Analysis Error: {e}")
        return None