import { TalkingHead } from "talkinghead";

// --- CONFIGURATION ---
const MY_AVATAR_URL = "https://models.readyplayer.me/6924973a1aa3af821a843170.glb?morphTargets=ARKit&textureAtlas=1024";

// --- GLOBAL STATE ---
const socket = io();
let head; 
let localStream = null; 
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
const btnMic = document.getElementById('btn-mic');
const btnCam = document.getElementById('btn-cam');

// Chat Elements
const btnChat = document.getElementById('btn-chat');
const chatPanel = document.getElementById('chat-panel');
const btnCloseChat = document.getElementById('close-chat');
const chatInput = document.getElementById('chat-input');
const btnSend = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');

// --- 1. INITIALIZE THE 3D AVATAR ---
async function initAvatar() {
    console.log("Initializing Avatar...");
    avatarNode.innerHTML = `
        <div id="loading-overlay" style="text-align:center; padding-top:20%;">
            <h2 style="color:white;">Loading Kai...</h2>
            <div id="loading-status" style="color:#ccc; font-size:14px; margin-top:10px;">Connecting...</div>
        </div>`;
    
    const statusText = document.getElementById('loading-status');
    const loadingOverlay = document.getElementById('loading-overlay');

    try {
        head = new TalkingHead(avatarNode, {
            ttsEndpoint: "https://eu-texttospeech.googleapis.com/v1beta1/text:synthesize", 
            cameraView: "upper", 
            cameraDistance: 0.3, 
            ambientLightIntensity: 1.0,
            cameraRotateEnable: true 
        });

        statusText.innerText = "Downloading Model...";

        await head.showAvatar({
            url: MY_AVATAR_URL,
            body: 'F',
            avatarMood: 'neutral', 
            lipsyncLang: 'en' 
        }, (progress) => {
            if (progress.lengthComputable) {
                const percent = Math.round((progress.loaded / progress.total) * 100);
                statusText.innerText = `Downloading: ${percent}%`;
            }
        });

        if (loadingOverlay) loadingOverlay.style.display = 'none';
        head.setMood('neutral'); 

    } catch (error) {
        console.error("AVATAR ERROR:", error);
        statusText.innerHTML = `<span style="color:red">Error: ${error.message}</span>`;
    }
}
initAvatar();

// --- 2. CONTROL BUTTONS LOGIC (UPDATED & VERIFIED) ---
let isMicOn = true;
let isCamOn = true;

btnMic.addEventListener('click', () => {
    if (!localStream) {
        console.warn("No stream to toggle mic");
        return;
    }
    isMicOn = !isMicOn;
    
    // Toggle actual audio track
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
        audioTracks[0].enabled = isMicOn;
    }

    // Update Button UI
    btnMic.innerHTML = isMicOn ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
    btnMic.style.backgroundColor = isMicOn ? '#4a4a4a' : '#e74c3c';
    console.log("Mic toggled:", isMicOn);
});

btnCam.addEventListener('click', () => {
    if (!localStream) {
        console.warn("No stream to toggle cam");
        return;
    }
    isCamOn = !isCamOn;
    
    // Toggle actual video track
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0) {
        videoTracks[0].enabled = isCamOn;
    }

    // Update Button UI and Local Video Feedback
    btnCam.innerHTML = isCamOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
    btnCam.style.backgroundColor = isCamOn ? '#4a4a4a' : '#e74c3c';
    videoElement.style.opacity = isCamOn ? "1" : "0"; // Hide local video if off
    
    console.log("Camera toggled:", isCamOn);
});

// --- NEW: CHAT LOGIC ---
function toggleChat() {
    chatPanel.classList.toggle('hidden');
    if (!chatPanel.classList.contains('hidden')) {
        btnChat.style.backgroundColor = '#008069'; 
    } else {
        btnChat.style.backgroundColor = '#4a4a4a'; 
    }
}

function appendMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');
    msgDiv.classList.add(sender === 'user' ? 'user-msg' : 'bot-msg');
    msgDiv.innerText = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight; 
}

function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage(text, 'user');
    chatInput.value = '';

    // Send to backend
    socket.emit('chat_message', { message: text });
}

btnChat.addEventListener('click', toggleChat);
btnCloseChat.addEventListener('click', toggleChat);

btnSend.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

// Listen for Chat Responses from Server (Text)
socket.on('chat_response', (data) => {
    appendMessage(data.response, 'bot');
});


// --- 3. LAYOUT & DRAG LOGIC ---
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


// --- 4. CORE LOGIC ---
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
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        videoElement.srcObject = localStream;
        
        // Start sending frames
        setInterval(sendFrameToBackend, 500); 
    } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Camera Access Denied or Error. Please check permissions.");
    }
}

function sendFrameToBackend() {
    // PREVENT sending frames if Camera is disabled to save resources
    if (isSpeaking || isDragging || !isCamOn) return; 
    
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