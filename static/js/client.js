const socket = io();

// Camera Setup
const video = document.getElementById('local-video');
const canvas = document.getElementById('local-canvas');
const context = canvas.getContext('2d');

async function startCamera() {
    try {
        // We request camera access. Note: The Trugen iframe also requests it.
        // On many modern browsers, multiple consumers can share the same stream if they are on the same page.
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 }
            }, 
            audio: false 
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            console.log("Camera stream active for local Emotion Engine.");
            // Capture every exactly 2 seconds as requested
            setInterval(captureFrame, 2000); 
        };
    } catch (err) {
        console.error("Camera Access Error (Local Engine):", err);
    }
}

function captureFrame() {
    if (!video || !canvas || video.videoWidth === 0) return;
    
    // Use a fixed smaller size for analysis to save bandwidth
    const targetWidth = 400;
    const targetHeight = (video.videoHeight / video.videoWidth) * targetWidth;
    
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    context.drawImage(video, 0, 0, targetWidth, targetHeight);
    
    // Convert to Base64
    const dataUrl = canvas.toDataURL('image/jpeg', 0.5); 
    socket.emit('video_frame', dataUrl);
}

// Initialize on load
window.addEventListener('load', startCamera);

// Handle AI response (optional: log detected emotion in console for debug)
socket.on('ai_response', (data) => {
    if (data.emotion) {
        console.log(`Detected Emotion: ${data.emotion}`);
    }
});