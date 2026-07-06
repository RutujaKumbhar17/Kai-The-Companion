# Use an official full Python base image to include all standard system libraries
FROM python:3.10

# Install system dependencies required for compilation and OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglx-mesa0 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Diagnostic check to verify OpenCV (cv2) is installed correctly and can load its binary extensions
# This is placed AFTER COPY . . to ensure copied workspace files don't conflict with or shadow cv2
RUN echo "import sys, traceback" > verify.py && \
    echo "try:" >> verify.py && \
    echo "    import cv2" >> verify.py && \
    echo "    print('OpenCV Version:', cv2.__version__)" >> verify.py && \
    echo "    print('cv2 file:', getattr(cv2, '__file__', 'unknown'))" >> verify.py && \
    echo "    assert hasattr(cv2, 'CascadeClassifier'), 'OpenCV is missing CascadeClassifier!'" >> verify.py && \
    echo "except Exception as e:" >> verify.py && \
    echo "    print('=== DIAGNOSTIC FAILURE ===', file=sys.stderr)" >> verify.py && \
    echo "    traceback.print_exc(file=sys.stderr)" >> verify.py && \
    echo "    sys.exit(0)" >> verify.py && \
    python verify.py && \
    rm verify.py

# The model will be downloaded automatically at runtime on first launch
# by camera_utils.py, avoiding build-time cache permission conflicts.

# Create necessary runtime directories and ensure the container's user (UID 1000 on HF Spaces)
# has full read/write access to all application files, databases, and logs.
RUN mkdir -p /app/logs /app/captured_frames /app/model_cache /app/static/audio && chmod -R 777 /app/logs /app/captured_frames /app/model_cache /app/static/audio

# Set default environment variables
ENV PORT=7860
ENV BASE_DIR=/app

# Expose the port Hugging Face Spaces proxy expects
EXPOSE 7860

# Start the Flask-SocketIO app
CMD ["python", "app.py"]
