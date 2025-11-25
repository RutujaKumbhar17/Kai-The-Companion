from flask import Flask, render_template, url_for, request
from flask_socketio import SocketIO, emit
from camera_utils import analyze_emotion_from_frame 
import pyttsx3 
import os 
import time
import glob 
import google.generativeai as genai
from config import apikey
import webbrowser  # Added for automation

# --- CONFIGURATION ---
app = Flask(__name__)
app.config['STATIC_FOLDER'] = 'static'
app.config['STATIC_URL_PATH'] = '/static'
app.config['SECRET_KEY'] = 'kai_secret_key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Configure Gemini AI
genai.configure(api_key=apikey)

# System Instructions for Personality
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

model = genai.GenerativeModel(
    model_name='gemini-2.5-pro',
    system_instruction=system_instruction,
    safety_settings=safety_settings
)

# Chat History Memory
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
    """Deletes old audio files."""
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
    """Converts text to speech (Offline & Fast)."""
    cleanup_audio_folder()
    filename = f"response_{int(time.time())}.wav"
    audio_path = os.path.join(AUDIO_DIR, filename)

    try:
        engine = pyttsx3.init()
        engine.setProperty('rate', 175) 
        engine.save_to_file(text, audio_path)
        engine.runAndWait()
        return url_for('static', filename=f'audio/{filename}')
    except Exception as e:
        print(f"TTS Error: {e}")
        return None

def process_browser_command(text):
    """Checks if the user wants to perform a browser task."""
    lower_text = text.lower()
    
    # 1. Direct Site Opening
    sites = {
        "open youtube": "https://www.youtube.com",
        "open google": "https://www.google.com",
        "open facebook": "https://www.facebook.com",
        "open instagram": "https://www.instagram.com",
        "open twitter": "https://twitter.com",
        "open github": "https://github.com",
        "open stackoverflow": "https://stackoverflow.com",
        "open reddit": "https://www.reddit.com",
        "open linkedin": "https://www.linkedin.com"
    }
    
    for command, url in sites.items():
        if command in lower_text:
            webbrowser.open(url)
            return f"Opening {command.replace('open ', '').title()} for you."

    # 2. Google Search (e.g., "search for cats on google")
    if "search" in lower_text and "google" in lower_text:
        # Extract query roughly
        query = lower_text.replace("search", "").replace("on google", "").replace("for", "").strip()
        if query:
            url = f"https://www.google.com/search?q={query}"
            webbrowser.open(url)
            return f"Searching Google for {query}."

    # 3. YouTube Play/Search (e.g., "play believer on youtube")
    if "play" in lower_text and "youtube" in lower_text:
        query = lower_text.replace("play", "").replace("on youtube", "").strip()
        if query:
            url = f"https://www.youtube.com/results?search_query={query}"
            webbrowser.open(url)
            return f"Playing {query} on YouTube."

    return None

# --- SOCKET EVENTS ---

@socketio.on('connect')
def handle_connect():
    sid = request.sid
    print(f"User connected: {sid}")
    chat_sessions[sid] = model.start_chat(history=[])

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    if sid in chat_sessions:
        del chat_sessions[sid]
    print(f"User disconnected: {sid}")

@socketio.on('video_frame')
def handle_frame(data_url):
    emotion = analyze_emotion_from_frame(data_url)
    if emotion:
        emit('ai_response', {'emotion': emotion, 'audio_url': None}) 

@socketio.on('chat_message')
def handle_chat(data):
    sid = request.sid
    user_msg = data.get('message', '')
    
    if user_msg.strip():
        print(f"User ({sid}): {user_msg}")
        
        # STEP 1: Check for Browser Commands (Fastest)
        command_reply = process_browser_command(user_msg)
        
        if command_reply:
            # If it was a command, we don't need to ask Gemini
            ai_reply = command_reply
        else:
            # STEP 2: Normal Chat (Ask Gemini)
            if sid not in chat_sessions:
                chat_sessions[sid] = model.start_chat(history=[])
            
            chat = chat_sessions[sid]
            try:
                response = chat.send_message(user_msg)
                ai_reply = response.text
            except Exception as e:
                print(f"Gemini Error: {e}")
                ai_reply = "I'm having trouble connecting right now."

        # STEP 3: Send Response Immediately (Text)
        emit('chat_response', {'response': ai_reply})
        
        # STEP 4: Generate Audio
        audio_url = generate_tts_audio(ai_reply)
        
        # STEP 5: Send Audio to Avatar
        emit('ai_response', {'emotion': 'neutral', 'audio_url': audio_url})

if __name__ == '__main__':
    print("Starting Kai Server (Automation Enabled)...")
    socketio.run(app, debug=True, port=5000)