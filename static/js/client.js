const socket = io();

const videoElement = document.getElementById('userVideo');
const emotionTag = document.getElementById('emotionTag');
const aiContainer = document.getElementById('ai-video-box'); 
const userPiP = document.getElementById('user-video-box'); 

// --- GLOBAL STATE ---
let isSpeaking = false;
let isDragging = false;
let dragOffsetX, dragOffsetY;

// --- DRAG LOGIC (Working Implementation) ---
function startDragging(e) {
    if (e.target.tagName === 'VIDEO' || e.target.id === 'emotionTag' || isSpeaking) {
        return; 
    }
    
    isDragging = true;
    userPiP.style.cursor = 'grabbing';
    
    const piPRect = userPiP.getBoundingClientRect();
    dragOffsetX = e.clientX - piPRect.left;
    dragOffsetY = e.clientY - piPRect.top;
    
    userPiP.style.position = 'absolute';
    userPiP.style.transition = 'none'; 
    userPiP.style.right = 'auto'; 
    userPiP.style.bottom = 'auto'; 

    document.addEventListener('mousemove', handleDragging);
    document.addEventListener('mouseup', stopDragging);
}

function handleDragging(e) {
    if (!isDragging) return;

    const bounds = document.body.getBoundingClientRect();
    const piPWidth = userPiP.offsetWidth;
    const piPHeight = userPiP.offsetHeight;

    let newLeft = e.clientX - dragOffsetX;
    let newTop = e.clientY - dragOffsetY;

    // Boundary limits
    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    if (newLeft + piPWidth > bounds.width) newLeft = bounds.width - piPWidth;
    if (newTop + piPHeight > bounds.height) newTop = bounds.height - piPHeight;


    // Apply new position
    userPiP.style.left = newLeft + 'px';
    userPiP.style.top = newTop + 'px';
}

function stopDragging() {
    isDragging = false;
    userPiP.style.cursor = 'grab';
    document.removeEventListener('mousemove', handleDragging);
    document.removeEventListener('mouseup', stopDragging);
}

userPiP.addEventListener('mousedown', startDragging);

// --- CORE APPLICATION LOGIC (Camera & Voice) ---

function playAudioResponse(url, emotion) {
    if (isSpeaking) return;

    isSpeaking = true;
    const audio = new Audio(url);
    aiContainer.classList.add('is-speaking'); 
    
    audio.play();

    audio.onended = () => {
        isSpeaking = false;
        aiContainer.classList.remove('is-speaking');
    };
    
    emotionTag.innerText = emotion.toUpperCase();
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;
        setInterval(sendFrameToBackend, 500); 
    } catch (err) {
        console.error("Error accessing camera:", err);
    }
}

function sendFrameToBackend() {
    if (isSpeaking || isDragging) {
        return; 
    }
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0);
    
    const dataURL = canvas.toDataURL('image/jpeg', 0.5); 
    socket.emit('video_frame', dataURL);
}

socket.on('ai_response', (data) => {
    emotionTag.innerText = data.emotion.toUpperCase();
    
    if (data.emotion === 'happy') emotionTag.style.backgroundColor = '#2ecc71'; 
    else if (data.emotion === 'sad') emotionTag.style.backgroundColor = '#e74c3c'; 
    else if (data.emotion === 'neutral') emotionTag.style.backgroundColor = '#3498db'; 
    else if (data.emotion === 'angry') emotionTag.style.backgroundColor = '#f39c12';
    else emotionTag.style.backgroundColor = '#9b59b6';
    
    if (data.audio_url) {
        playAudioResponse(data.audio_url, data.emotion);
    }
});

startCamera();