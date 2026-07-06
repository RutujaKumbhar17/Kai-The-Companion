from google import genai
from config import apikey, model_name
import traceback

def test_model():
    print(f"--- Gemini Diagnostic (New SDK) ---")
    print(f"Model: {model_name}")
    print(f"API Key prefix: {apikey[:7]}...")
    
    if apikey.startswith("sk-or-"):
        print("WARNING: This appears to be an OpenRouter API Key, not a Google API Key.")
        print("Google SDK (genai.Client) requires a key starting with 'AIza'.")
        return False

    client = genai.Client(api_key=apikey)
    try:
        print("Attempting to generate content...")
        response = client.models.generate_content(
            model=model_name,
            contents="Hello, this is a diagnostic test."
        )
        print(f"SUCCESS: {response.text}")
        return True
    except Exception as e:
        print(f"FAILED with error: {e}")
        # print(traceback.format_exc())
        return False

if __name__ == '__main__':
    test_model()
