from flask import Flask, render_template, url_for, request
from flask_socketio import SocketIO, emit
from camera_utils import analyze_emotion_from_frame 
import pyttsx3 
import os 
import time
import glob 
import google.generativeai as genai
from config import apikey
import webbrowser
from collections import deque # Added for sliding window memory

# --- CONFIGURATION ---
app = Flask(__name__)
app.config['STATIC_FOLDER'] = 'static'
app.config['STATIC_URL_PATH'] = '/static'
app.config['SECRET_KEY'] = 'kai_secret_key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Configure Gemini AI
genai.configure(api_key=apikey)

# System Instructions
safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
]

system_instruction = (
    "You are Kai, a helpful, charming, and empathetic AI video companion. "
    "Your responses should be conversational, concise (under 2 sentences), and natural. "
    "Act like a real person present with the user. "
    "Use the provided conversation history to understand context."
)

model = genai.GenerativeModel(
    model_name='gemini-2.5-pro',
    system_instruction=system_instruction,
    safety_settings=safety_settings
)

# Global Dictionary to store sliding window history
# Format: { 'session_id': deque([...last 10 messages...]) }
conversation_history = {}

AUDIO_DIR = os.path.join(app.root_path, 'static', 'audio')
if not os.path.exists(AUDIO_DIR):
    os.makedirs(AUDIO_DIR)

# --- ROUTES ---
@app.route('/')
def index():
    return render_template('call.html')

# --- HELPER FUNCTIONS ---
def cleanup_audio_folder():
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
    """Checks for browser automation commands."""
    lower_text = text.lower()
    
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
            return f"Opening {command.replace('open ', '').title()}."

    if "search" in lower_text and "google" in lower_text:
        query = lower_text.replace("search", "").replace("on google", "").replace("for", "").strip()
        if query:
            webbrowser.open(f"https://www.google.com/search?q={query}")
            return f"Searching Google for {query}."

    if "play" in lower_text and "youtube" in lower_text:
        query = lower_text.replace("play", "").replace("on youtube", "").strip()
        if query:
            webbrowser.open(f"https://www.youtube.com/results?search_query={query}")
            return f"Playing {query} on YouTube."

    return None

# --- SOCKET EVENTS ---

@socketio.on('connect')
def handle_connect():
    sid = request.sid
    print(f"User connected: {sid}")
    # Initialize a deque with max length 10 (Stores last 5 interactions)
    conversation_history[sid] = deque(maxlen=10)

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    if sid in conversation_history:
        del conversation_history[sid]
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
        
        # 1. Automation Check
        command_reply = process_browser_command(user_msg)
        
        if command_reply:
            ai_reply = command_reply
        else:
            # 2. AI Chat with Sliding Window History
            if sid not in conversation_history:
                conversation_history[sid] = deque(maxlen=10)
            
            # Convert deque to list format expected by Gemini
            # history format: [{'role': 'user', 'parts': ['text']}, {'role': 'model', 'parts': ['text']}]
            current_history = list(conversation_history[sid])
            
            try:
                # Start a fresh chat with the accumulated history
                chat = model.start_chat(history=current_history)
                response = chat.send_message(user_msg)
                ai_reply = response.text
                
                # 3. Update History
                # Append correct format for Gemini history
                conversation_history[sid].append({'role': 'user', 'parts': [user_msg]})
                conversation_history[sid].append({'role': 'model', 'parts': [ai_reply]})
                
            except Exception as e:
                print(f"Gemini Error: {e}")
                ai_reply = "I'm having trouble thinking right now."

        # 4. Immediate Text Response
        emit('chat_response', {'response': ai_reply})
        
        # 5. Audio Generation
        audio_url = generate_tts_audio(ai_reply)
        emit('ai_response', {'emotion': 'neutral', 'audio_url': audio_url})

if __name__ == '__main__':
    print("Starting Kai Server (Sliding Window Memory Enabled)...")
    socketio.run(app, debug=True, port=5000)