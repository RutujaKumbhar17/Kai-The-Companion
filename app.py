from flask import Flask, render_template, url_for, request
from flask_socketio import SocketIO, emit
from camera_utils import analyze_emotion_from_frame 
from gtts import gTTS 
import os 
import time
import glob 
import requests 

# --- CONFIGURATION ---
# 1. PASTE YOUR TELEGRAM BOT TOKEN
TELEGRAM_BOT_TOKEN = "8296293060:AAGdESaeO9smX57D5o3FVsiGJtNWX_zYMis"

# 2. PASTE YOUR PERSONAL TELEGRAM CHAT ID
# (Message @userinfobot on Telegram to get your numeric ID, e.g., "123456789")
TELEGRAM_CHAT_ID = "8296293060" 

TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"

# --- APP SETUP ---
app = Flask(__name__)
app.config['STATIC_FOLDER'] = 'static'
app.config['STATIC_URL_PATH'] = '/static'
socketio = SocketIO(app, cors_allowed_origins="*")

AUDIO_DIR = os.path.join(app.root_path, 'static', 'audio')
if not os.path.exists(AUDIO_DIR):
    os.makedirs(AUDIO_DIR)

@app.route('/')
def index():
    return render_template('call.html')

# --- HELPER FUNCTIONS ---
def cleanup_audio_folder():
    """Deletes old audio files."""
    try:
        current_time = time.time()
        files = glob.glob(os.path.join(AUDIO_DIR, "*.mp3"))
        for f in files:
            if current_time - os.path.getctime(f) > 30:
                os.remove(f)
    except Exception as e:
        print(f"Cleanup Error: {e}")

def send_telegram_message(text):
    """Sends a message to the Admin's Telegram."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("Telegram Configuration Missing!")
        return

    url = f"{TELEGRAM_API_URL}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": text}
    try:
        requests.post(url, json=payload)
    except Exception as e:
        print(f"Telegram Send Error: {e}")

def generate_static_response(emotion):
    """Returns a gentle, pre-set response based on emotion (No AI)."""
    responses = {
        'happy': "It warms my heart to see you smiling!",
        'sad': "I sense you are feeling down. I am here with you.",
        'angry': "Take a deep breath. Let's find some calm together.",
        'neutral': "I am listening. I am here.",
        'fear': "You are safe here. Take your time.",
        'surprise': "Oh! That looks unexpected."
    }
    return responses.get(emotion, "I am here for you.")

def generate_tts_audio(text):
    """Converts text to speech."""
    cleanup_audio_folder()
    filename = f"response_{time.time()}.mp3" 
    audio_path = os.path.join(AUDIO_DIR, filename)

    try:
        tts = gTTS(text=text, lang='en', slow=False)
        tts.save(audio_path)
        return url_for('static', filename=f'audio/{filename}')
    except Exception as e:
        print(f"TTS Error: {e}")
        return None

# --- WEBHOOK (TELEGRAM -> WEB) ---
@app.route('/telegram', methods=['POST'])
def telegram_webhook():
    """Receives replies from Telegram and sends them to the Web Interface."""
    data = request.json
    try:
        if "message" in data and "text" in data["message"]:
            sender_id = str(data["message"]["chat"]["id"])
            text = data["message"]["text"]
            
            # Verify the message is from the Admin
            if sender_id == TELEGRAM_CHAT_ID:
                print(f"Admin replied: {text}")
                # Send to Web UI
                socketio.emit('chat_response', {'response': text})
            else:
                print(f"Ignored message from unknown ID: {sender_id}")

    except Exception as e:
        print(f"Webhook Error: {e}")
        
    return "OK", 200

# --- SOCKET EVENTS (WEB -> SERVER -> TELEGRAM) ---

@socketio.on('video_frame')
def handle_frame(data_url):
    emotion = analyze_emotion_from_frame(data_url)
    
    if emotion:
        # 1. Generate Static Audio Response (No AI)
        response_text = generate_static_response(emotion)
        audio_url = generate_tts_audio(response_text)
        
        # 2. Emit to Web Client
        emit('ai_response', {'emotion': emotion, 'audio_url': audio_url})

@socketio.on('chat_message')
def handle_chat(data):
    user_msg = data.get('message', '')
    if user_msg.strip():
        print(f"User says: {user_msg}")
        
        # 1. Send user's message to Telegram
        send_telegram_message(f"👤 Web User: {user_msg}")
        
        # We do NOT emit a response here. 
        # We wait for the Telegram Webhook to send the reply.

if __name__ == '__main__':
    print("Starting Kai Server (Telegram Bridge Mode)...")
    print("Ensure you have updated your Webhook URL!")
    socketio.run(app, debug=True, port=5000)