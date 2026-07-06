const socket = io();

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const btnSend = document.getElementById('send-btn');
const video = document.getElementById('local-video');
const canvas = document.getElementById('local-canvas');
const context = canvas.getContext('2d');

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 320, height: 240 }, 
            audio: false 
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            console.log("Chat Camera active.");
            setInterval(captureFrame, 2000); // Every 2 seconds for chat
        };
    } catch (err) {
        console.error("Chat Camera Access Error:", err);
    }
}

function captureFrame() {
    if (!video || !canvas || video.videoWidth === 0) return;
    canvas.width = 300;
    canvas.height = (video.videoHeight / video.videoWidth) * 300;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.5); 
    socket.emit('video_frame', dataUrl);
}

window.addEventListener('load', startCamera);

function appendMessage(text, sender) {
    const msgWrapper = document.createElement('div');
    msgWrapper.classList.add('flex', 'flex-col', 'gap-1', 'mb-6', sender === 'user' ? 'items-end' : 'items-start');
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('liquid-glass', sender === 'user' ? 'user-msg' : 'bot-msg');
    contentDiv.innerText = text;
    msgWrapper.appendChild(contentDiv);

    if (sender === 'bot') {
        const toggleDiv = document.createElement('div');
        toggleDiv.classList.add('audio-toggle');
        toggleDiv.style.display = 'none'; // Hidden until audio URL arrives
        toggleDiv.innerHTML = `<i class="fas fa-play text-[10px]"></i>`;
        toggleDiv.onclick = () => playMessageAudio(toggleDiv);
        msgWrapper.appendChild(toggleDiv);
    }

    chatMessages.appendChild(msgWrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight; 
}

let activeAudio = null;
let activeToggle = null;

function playMessageAudio(toggleBtn) {
    const audioUrl = toggleBtn.dataset.audio;
    if (!audioUrl) return;

    // If clicking the same button that is already playing
    if (activeToggle === toggleBtn && activeAudio) {
        if (!activeAudio.paused) {
            activeAudio.pause();
            updateToggleIcon(toggleBtn, false);
            return;
        } else {
            activeAudio.play();
            updateToggleIcon(toggleBtn, true);
            return;
        }
    }

    // Stop previous audio
    if (activeAudio) {
        activeAudio.pause();
        updateToggleIcon(activeToggle, false);
    }

    // Start new audio
    activeAudio = new Audio(audioUrl);
    activeToggle = toggleBtn;
    
    activeAudio.play();
    updateToggleIcon(toggleBtn, true);

    activeAudio.onended = () => {
        updateToggleIcon(toggleBtn, false);
        activeAudio = null;
        activeToggle = null;
    };
}

function updateToggleIcon(btn, isPlaying) {
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (isPlaying) {
        btn.classList.add('playing');
        icon.classList.replace('fa-play', 'fa-pause');
    } else {
        btn.classList.remove('playing');
        icon.classList.replace('fa-pause', 'fa-play');
    }
}

function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    appendMessage(text, 'user');
    chatInput.value = '';
    socket.emit('chat_message', { message: text });
}

if (btnSend) btnSend.addEventListener('click', sendChatMessage);
if (chatInput) {
    chatInput.addEventListener('keypress', (e) => { 
        if (e.key === 'Enter') sendChatMessage(); 
    });
}

socket.on('chat_response', (data) => {
    appendMessage(data.response, 'bot');
});

socket.on('ai_response', (data) => {
    if (data.audio_url) {
        // Find the last bot message toggle that hasn't been assigned an audio URL
        const toggles = document.querySelectorAll('.audio-toggle');
        for (let i = toggles.length - 1; i >= 0; i--) {
            if (!toggles[i].dataset.audio) {
                toggles[i].dataset.audio = data.audio_url;
                toggles[i].style.display = 'flex';
                break;
            }
        }
    }
});
