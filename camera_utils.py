import cv2
import numpy as np
import base64
from deepface import DeepFace

def analyze_emotion_from_frame(data_url):
    try:
        if ',' in data_url:
            encoded_data = data_url.split(',')[1]
        else:
            return None
        
        nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Analyze with DeepFace (Emotion only)
        # Setting enforce_detection=False prevents crashing if the face is not fully visible
        result = DeepFace.analyze(frame, actions=['emotion'], enforce_detection=False)
        
        # FIX: Check if the result is a non-empty list before accessing the element
        if isinstance(result, list) and result:
            return result[0]['dominant_emotion']
        
        return None # Return None if DeepFace runs but doesn't find a face
        
    except Exception as e:
        # Pass silently if no face is detected or if an error occurs
        return None