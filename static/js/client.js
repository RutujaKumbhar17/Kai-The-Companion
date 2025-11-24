import { TalkingHead } from "talkinghead";

// --- CONFIGURATION ---
// YOUR NEW AVATAR URL (With ARKit suffix added for lip-sync)
const MY_AVATAR_URL = "https://models.readyplayer.me/6924973a1aa3af821a843170.glb";

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
    
    // Loading Text
    avatarNode.innerHTML = "<h2 style='color:white; text-align:center; padding-top:20%;'>Loading Kai...<br><span style='font-size:12px'>Please wait...</span></h2>";

    try {
        // 2. Initialize Engine
        head = new TalkingHead(avatarNode, {
            // FIX: This dummy URL prevents the "Google-compliant TTS" error crash
            ttsEndpoint: "https://eu-texttospeech.googleapis.com/v1beta1/text:synthesize", 
            
            cameraView: "upper", // Sitting view (Head & Shoulders)
            cameraDistance: 1.6,
            ambientLightIntensity: 1.0,
            cameraRotateEnable: false 
        });

        console.log("Engine started. Downloading model...");

        // 3. Load Your Specific Model
        await head.showAvatar({
            url: MY_AVATAR_URL,
            body: 'F', // Feminine (Matches your avatar)
            avatarMood: 'neutral', 
            lipsyncLang: 'en' 
        });

        console.log("Avatar Loaded Successfully!");
        
        // Remove loading text and set state
        head.setMood('neutral'); 

    } catch (error) {
        console.error("AVATAR ERROR:", error);
        
        // Visual Error Handler
        alert("Avatar Failed to Load!\n\nReason: " + error.message);
        avatarNode.innerHTML = `
            <div style='color:red; text-align:center; padding-top:20%;'>
                <h2>⚠️ Error Loading Kai</h2>
                <p>${error.message}</p>
            </div>`;
    }
}

// Start loading
initAvatar();


// --- 2. LAYOUT & DRAG LOGIC (Standard) ---
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


// --- 3. CORE LOGIC (With Lip Sync) ---
function playAudioResponse(url, emotion) {
    if (isSpeaking || !head) return;
    isSpeaking = true;
    kaiContainer.classList.add('is-speaking'); 
    emotionTag.innerText = emotion.toUpperCase();
    
    // Speak using the downloaded audio buffer (Lip-syncs automatically)
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