import { TalkingHead } from "talkinghead";

// --- CONFIGURATION ---
// FIX 1: Added 'morphTargets=ARKit' (REQUIRED for lip-sync/animation)
// FIX 2: Added 'textureAtlas=1024' to optimize download size
const MY_AVATAR_URL = "https://models.readyplayer.me/6924973a1aa3af821a843170.glb?morphTargets=ARKit&textureAtlas=1024";

// --- GLOBAL STATE ---
const socket = io();
let head; 
let isSpeaking = false;
let isDragging = false;
let activePip = null; 
let dragOffsetX, dragOffsetY;

// DOM Elements
const kaiContainer = document.getElementById('kai-video-container');
const userContainer = document.getElementById('user-video-container');
const videoElement = document.getElementById('userVideo');
const emotionTag = document.getElementById('emotionTag');
const avatarNode = document.getElementById('avatar-container');

// --- 1. INITIALIZE THE 3D AVATAR ---
async function initAvatar() {
    console.log("Initializing Avatar...");
    
    // Loading Text with ID for easy removal
    avatarNode.innerHTML = `
        <div id="loading-overlay" style="text-align:center; padding-top:20%;">
            <h2 style="color:white;">Loading Kai...</h2>
            <div id="loading-status" style="color:#ccc; font-size:14px; margin-top:10px;">Connecting...</div>
        </div>`;
    
    const statusText = document.getElementById('loading-status');
    const loadingOverlay = document.getElementById('loading-overlay');

    try {
        // Initialize Engine
        head = new TalkingHead(avatarNode, {
            ttsEndpoint: "https://eu-texttospeech.googleapis.com/v1beta1/text:synthesize", 
            cameraView: "upper", 
            cameraDistance: 1.6,
            ambientLightIntensity: 1.0,
            cameraRotateEnable: false 
        });

        statusText.innerText = "Downloading Model...";

        // Load Model
        await head.showAvatar({
            url: MY_AVATAR_URL,
            body: 'F',
            avatarMood: 'neutral', 
            lipsyncLang: 'en' 
        }, (progress) => {
            // FIX 3: Progress Callback to see real-time download status
            if (progress.lengthComputable) {
                const percent = Math.round((progress.loaded / progress.total) * 100);
                statusText.innerText = `Downloading: ${percent}%`;
            }
        });

        console.log("Avatar Loaded Successfully!");
        
        // FIX 4: Explicitly remove the loading text now that the avatar is ready
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        
        // Set state
        head.setMood('neutral'); 

    } catch (error) {
        console.error("AVATAR ERROR:", error);
        statusText.innerHTML = `<span style="color:red">Error: ${error.message}</span>`;
        // Suggest checking console if it's a CORS/Network error
        alert("Could not load Avatar. Check console (F12) for details.");
    }
}

// Start loading
initAvatar();


// --- 2. LAYOUT & DRAG LOGIC ---
function toggleVideoLayout() {
    const kaiIsPrimary = kaiContainer.classList.contains('primary-view');
    if (kaiIsPrimary) {
        kaiContainer.classList.replace('primary-view', 'secondary-pip');
        userContainer.classList.replace('secondary-pip', 'primary-view');
        userContainer.classList.remove('movable-pip'); 
    } else {
        kaiContainer.classList.replace('secondary-pip', 'primary-view');
        userContainer.classList.replace('primary-view', 'secondary-pip');
        userContainer.classList.add('movable-pip');
    }
    // Reset positions
    [kaiContainer, userContainer].forEach(el => {
        el.style.left = ''; el.style.top = ''; 
        el.style.right = '30px'; el.style.bottom = '100px';
    });
}
kaiContainer.addEventListener('dblclick', toggleVideoLayout);
userContainer.addEventListener('dblclick', toggleVideoLayout);

function startDragging(e) {
    const targetContainer = e.currentTarget;
    if (!targetContainer.classList.contains('secondary-pip')) return;
    isDragging = true;
    activePip = targetContainer;
    activePip.style.cursor = 'grabbing';
    activePip.style.transition = 'none';
    const rect = activePip.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    activePip.style.position = 'absolute';
    activePip.style.right = 'auto';
    activePip.style.bottom = 'auto';
    document.addEventListener('mousemove', handleDragging);
    document.addEventListener('mouseup', stopDragging);
}
function handleDragging(e) {
    if (!isDragging || !activePip) return;
    const bounds = document.body.getBoundingClientRect();
    let newLeft = e.clientX - dragOffsetX;
    let newTop = e.clientY - dragOffsetY;
    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    if (newLeft + activePip.offsetWidth > bounds.width) newLeft = bounds.width - activePip.offsetWidth;
    if (newTop + activePip.offsetHeight > bounds.height) newTop = bounds.height - activePip.offsetHeight;
    activePip.style.left = newLeft + 'px';
    activePip.style.top = newTop + 'px';
}
function stopDragging() {
    if (activePip) {
        activePip.style.cursor = 'grab';
        activePip.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
    }
    isDragging = false;
    activePip = null;
    document.removeEventListener('mousemove', handleDragging);
    document.removeEventListener('mouseup', stopDragging);
}
kaiContainer.addEventListener('mousedown', startDragging);
userContainer.addEventListener('mousedown', startDragging);


// --- 3. CORE LOGIC ---
function playAudioResponse(url, emotion) {
    if (isSpeaking || !head) return;
    isSpeaking = true;
    kaiContainer.classList.add('is-speaking'); 
    emotionTag.innerText = emotion.toUpperCase();
    
    head.speakAudio(url, { 
        audio: { 
            onended: () => {
                isSpeaking = false;
                kaiContainer.classList.remove('is-speaking');
                head.setMood('neutral'); 
            }
        },
        lipsync: { visemeFactor: 1.0 }
    });
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
    if (isSpeaking || isDragging) return; 
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
    const colors = { 'happy': '#2ecc71', 'sad': '#3498db', 'neutral': '#5a5a5a', 'angry': '#f39c12' };
    emotionTag.style.backgroundColor = colors[data.emotion] || '#5a5a5a';
    if (data.audio_url) playAudioResponse(data.audio_url, data.emotion);
});
startCamera();