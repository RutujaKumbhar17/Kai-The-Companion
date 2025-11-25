from flask import Flask, render_template, url_for, request
from flask_socketio import SocketIO, emit
from camera_utils import analyze_emotion_from_frame 
from gtts import gTTS 
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
model = genai.GenerativeModel('gemini-2.5-pro') 

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
        files = glob.glob(os.path.join(AUDIO_DIR, "*.mp3"))
        for f in files:
            if current_time - os.path.getctime(f) > 30: # Remove files older than 30s
                os.remove(f)
    except Exception as e:
        print(f"Cleanup Error: {e}")

def generate_tts_audio(text):
    """Converts text to speech using Google TTS and returns the URL."""
    cleanup_audio_folder()
    filename = f"response_{int(time.time())}.mp3" 
    audio_path = os.path.join(AUDIO_DIR, filename)

    try:
        # Generate MP3
        tts = gTTS(text=text, lang='en', slow=False)
        tts.save(audio_path)
        return url_for('static', filename=f'audio/{filename}')
    except Exception as e:
        print(f"TTS Error: {e}")
        return None

def get_ai_response(text):
    """Queries the Gemini Model."""
    try:
        # Prompt engineering to ensure Kai behaves like a companion
        prompt = f"You are Kai, a helpful and empathetic AI video companion. Keep your response concise (under 2 sentences) and conversational. User says: {text}"
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"Gemini Error: {e}")
        return "I'm having trouble connecting to my brain right now."

def generate_static_response(emotion):
    """Returns a gentle, pre-set response based on emotion (fallback/visual reaction)."""
    responses = {
        'happy': "It warms my heart to see you smiling!",
        'sad': "I sense you are feeling down. I am here with you.",
        'angry': "Take a deep breath. Let's find some calm together.",
        'neutral': "I am listening.",
        'fear': "You are safe here. Take your time.",
        'surprise': "Oh! That looks unexpected."
    }
    return responses.get(emotion, "I see you.")

# --- SOCKET EVENTS ---

@socketio.on('video_frame')
def handle_frame(data_url):
    """Analyzes facial expressions from the video feed."""
    emotion = analyze_emotion_from_frame(data_url)
    
    if emotion:
        # We only trigger a static voice response for strong emotions if no chat is happening
        # For now, we just update the UI tag, and optionally speak if you want strict parity with the old version
        # To avoid spamming audio, we send the emotion to the client, but only send audio for specific triggers if needed.
        
        # Here we emit the emotion so the badge updates
        emit('ai_response', {'emotion': emotion, 'audio_url': None}) 
        
        # NOTE: If you want Kai to speak on *every* emotion detection like before, uncomment below:
        response_text = generate_static_response(emotion)
        audio_url = generate_tts_audio(response_text)
        emit('ai_response', {'emotion': emotion, 'audio_url': audio_url})

@socketio.on('chat_message')
def handle_chat(data):
    """Handles text chat using Gemini AI."""
    user_msg = data.get('message', '')
    if user_msg.strip():
        print(f"User says: {user_msg}")
        
        # 1. Get AI Text Response
        ai_reply = get_ai_response(user_msg)
        
        # 2. Convert to Audio
        audio_url = generate_tts_audio(ai_reply)
        
        # 3. Send Text to Chat Window
        emit('chat_response', {'response': ai_reply})
        
        # 4. Send Audio/Animation to Avatar
        # We set emotion to 'neutral' for general chat, or you could ask Gemini to predict the emotion.
        emit('ai_response', {'emotion': 'neutral', 'audio_url': audio_url})

if __name__ == '__main__':
    print("Starting Kai Server (Gemini AI Integrated)...")
    socketio.run(app, debug=True, port=5000)