from flask import Flask, render_template, url_for
from flask_socketio import SocketIO, emit
from camera_utils import analyze_emotion_from_frame 
from gtts import gTTS 
import os 
import time
import glob 

from google import genai
from google.genai.errors import APIError

# --- GEMINI SETUP ---
try:
    client = genai.Client()
except Exception as e:
    print("FATAL ERROR: Failed to initialize Gemini Client. Check your API Key setup.")
    client = None

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

def cleanup_audio_folder():
    """Deletes audio files older than 30 seconds to prevent storage buildup."""
    try:
        current_time = time.time()
        files = glob.glob(os.path.join(AUDIO_DIR, "*.mp3"))
        for f in files:
            if current_time - os.path.getctime(f) > 15:
                os.remove(f)
    except Exception as e:
        print(f"Cleanup Error: {e}")

def generate_llm_response(emotion):
    """(Existing) Video/Audio Response Logic"""
    if not client:
        return "Sorry, the AI is offline right now."
    
    if emotion == 'neutral':
        prompt_text = "You seem composed. I'm here, listening closely. What's on your mind today?"
    else:
        prompt_text = f"""
        Act as 'Kai', a highly compassionate, serene, and wise AI mental wellness companion. 
        The user is currently displaying the primary emotion: '{emotion.upper()}'.
        Your response must be extremely brief (max 2 sentences), empathetic, and encourage the user to share more. 
        Do not use complex jargon. Adopt a calm and gentle tone.
        """
        
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt_text],
            config={"temperature": 0.7}
        )
        return response.text
    except Exception as e:
        return "I'm here for you."

def generate_chat_response(user_text):
    """(NEW) Text Chat Logic"""
    if not client:
        return "System offline."
    
    prompt_text = f"""
    Act as 'Kai', a compassionate and wise AI companion.
    The user sent this message via text chat: "{user_text}"
    Reply directly to the user's text. Keep it conversational, helpful, and concise (max 3 sentences).
    Maintain a warm, supportive tone.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt_text],
            config={"temperature": 0.7}
        )
        return response.text
    except Exception as e:
        print(f"Chat API Error: {e}")
        return "I am having trouble processing that message."

def generate_tts_audio(text, emotion):
    """Converts LLM text response into a temporary MP3 file."""
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

@socketio.on('video_frame')
def handle_frame(data_url):
    emotion = analyze_emotion_from_frame(data_url)
    if emotion:
        llm_text = generate_llm_response(emotion)
        audio_url = generate_tts_audio(llm_text, emotion)
        emit('ai_response', {'emotion': emotion, 'audio_url': audio_url})

# --- NEW: Chat Message Handler ---
@socketio.on('chat_message')
def handle_chat(data):
    user_msg = data.get('message', '')
    if user_msg.strip():
        bot_reply = generate_chat_response(user_msg)
        # Emit back to the specific client
        emit('chat_response', {'response': bot_reply})

if __name__ == '__main__':
    print("Starting Kai Server (with Gemini Integration & Chat)...")
    socketio.run(app, debug=True, port=5000)