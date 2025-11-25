from flask import Flask, render_template, url_for, request
from flask_socketio import SocketIO, emit
from camera_utils import analyze_emotion_from_frame 
import pyttsx3 
import os 
import time
import glob 
import google.generativeai as genai
from config import apikey

# --- CONFIGURATION ---
app = Flask(__name__)
app.config['STATIC_FOLDER'] = 'static'
app.config['STATIC_URL_PATH'] = '/static'
app.config['SECRET_KEY'] = 'kai_secret_key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Configure Gemini AI
genai.configure(api_key=apikey)

# We use a system instruction to define Kai's personality permanently
safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
]

system_instruction = (
    "You are Kai, a helpful, charming, and empathetic AI video companion. "
    "Your responses should be conversational, concise (under 2 sentences), and natural. "
    "You have a visual avatar, so act like you are present with the user. "
    "Remember context from previous turns in this conversation."
)

# Using gemini-1.5-pro (closest to '2.5') for high intelligence and context
model = genai.GenerativeModel(
    model_name='gemini-2.5-pro',
    system_instruction=system_instruction,
    safety_settings=safety_settings
)

# Global dictionary to store Chat Sessions for each user (Context Memory)
chat_sessions = {}

AUDIO_DIR = os.path.join(app.root_path, 'static', 'audio')
if not os.path.exists(AUDIO_DIR):
    os.makedirs(AUDIO_DIR)

# --- ROUTES ---
@app.route('/')
def index():
    return render_template('call.html')

# --- HELPER FUNCTIONS ---
def cleanup_audio_folder():
    """Deletes old audio files to save space."""
    try:
        current_time = time.time()
        files = glob.glob(os.path.join(AUDIO_DIR, "*"))
        for f in files:
            if f.endswith(".mp3") or f.endswith(".wav"):
                if current_time - os.path.getctime(f) > 30: 
                    os.remove(f)
    except Exception as e:
        print(f"Cleanup Error: {e}")

def generate_tts_audio(text):
    """Converts text to speech using Offline pyttsx3."""
    cleanup_audio_folder()
    filename = f"response_{int(time.time())}.wav"
    audio_path = os.path.join(AUDIO_DIR, filename)

    try:
        # Re-initialize engine per call for thread safety in simple Flask apps
        engine = pyttsx3.init()
        engine.setProperty('rate', 175) # Speed of speech
        engine.save_to_file(text, audio_path)
        engine.runAndWait()
        
        return url_for('static', filename=f'audio/{filename}')
    except Exception as e:
        print(f"TTS Error: {e}")
        return None

# --- SOCKET EVENTS ---

@socketio.on('connect')
def handle_connect():
    """Starts a new chat history when a user connects."""
    sid = request.sid
    print(f"User connected: {sid}")
    # Start a new chat session with empty history for this user
    chat_sessions[sid] = model.start_chat(history=[])

@socketio.on('disconnect')
def handle_disconnect():
    """Cleans up memory when a user disconnects."""
    sid = request.sid
    if sid in chat_sessions:
        del chat_sessions[sid]
    print(f"User disconnected: {sid}")

@socketio.on('video_frame')
def handle_frame(data_url):
    """Analyzes facial expressions."""
    emotion = analyze_emotion_from_frame(data_url)
    if emotion:
        emit('ai_response', {'emotion': emotion, 'audio_url': None}) 

@socketio.on('chat_message')
def handle_chat(data):
    """Handles text chat using Gemini with History."""
    sid = request.sid
    user_msg = data.get('message', '')
    
    if user_msg.strip():
        print(f"User ({sid}): {user_msg}")
        
        # 1. Retrieve or Create Chat Session
        if sid not in chat_sessions:
            chat_sessions[sid] = model.start_chat(history=[])
        
        chat = chat_sessions[sid]
        
        try:
            # 2. Get AI Response (Gemini manages history internally in 'chat' object)
            response = chat.send_message(user_msg)
            ai_reply = response.text
        except Exception as e:
            print(f"Gemini Error: {e}")
            ai_reply = "I'm having trouble connecting to my thoughts."

        # 3. Send Text back IMMEDIATELY (Fast Response)
        emit('chat_response', {'response': ai_reply})
        
        # 4. Generate Audio in background
        audio_url = generate_tts_audio(ai_reply)
        
        # 5. Send Audio to Avatar
        emit('ai_response', {'emotion': 'neutral', 'audio_url': audio_url})

if __name__ == '__main__':
    print("Starting Kai Server (Gemini Context Aware)...")
    socketio.run(app, debug=True, port=5000)