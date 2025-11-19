from flask import Flask, render_template, url_for
from flask_socketio import SocketIO, emit
from camera_utils import analyze_emotion_from_frame 
from gtts import gTTS 
import os 
import time

# NEW: Import Gemini SDK
from google import genai
from google.genai.errors import APIError

# --- GEMINI SETUP ---
# Client initialization. It uses the GEMINI_API_KEY environment variable.
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


def generate_llm_response(emotion):
    """Calls the Gemini LLM for an emotional, contextual response."""
    if not client:
        return "Sorry, the AI is offline right now. I'm listening, though."
    
    # 1. Detailed Prompt based on Emotion and Role
    prompt = f"""
    Act as 'Kai', a highly compassionate, serene, and wise AI mental wellness companion. 
    The user is currently displaying the primary emotion: '{emotion.upper()}'.
    Your response must be extremely brief (max 2 sentences), empathetic, and encourage the user to share more. 
    Do not use complex jargon. Adopt a calm and gentle tone.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt],
            config={"temperature": 0.7}
        )
        return response.text
    except APIError as e:
        print(f"Gemini API Error: {e}")
        return "I'm having a technical issue, but I still want to hear what's on your mind."
    except Exception as e:
        return "I'm here for you."


def generate_tts_audio(text, emotion):
    """Converts LLM text response into a temporary MP3 file."""
    
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
        # Only respond if the emotion is stable and requires a response
        if emotion != 'neutral':
            
            # 1. Generate Intelligent Text from Gemini
            llm_text = generate_llm_response(emotion)
            
            # 2. Generate Audio from the LLM Text
            audio_url = generate_tts_audio(llm_text, emotion)
            
            if audio_url:
                # 3. Emit data to frontend
                emit('ai_response', {'emotion': emotion, 'audio_url': audio_url})

if __name__ == '__main__':
    print("Starting Kai Server (with Gemini Integration)...")
    socketio.run(app, debug=True, port=5000)