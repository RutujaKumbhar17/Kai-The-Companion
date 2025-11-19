const socket = io();

// Containers
const kaiContainer = document.getElementById('kai-video-container');
const userContainer = document.getElementById('user-video-container');

const videoElement = document.getElementById('userVideo');
const emotionTag = document.getElementById('emotionTag');

// --- GLOBAL STATE ---
let isSpeaking = false;
let isDragging = false;
let activePip = null; // Reference to the currently draggable element (User or Kai)
let dragOffsetX, dragOffsetY;

// --- TOGGLE LOGIC (Double Click) ---
function toggleVideoLayout() {
    // Determine the current state based on Kai's class
    const kaiIsPrimary = kaiContainer.classList.contains('primary-view');
    
    if (kaiIsPrimary) {
        // SWITCH: Kai Primary -> User Primary (Full) / Kai Secondary (PiP)
        
        // 1. Kai becomes PiP
        kaiContainer.classList.remove('primary-view');
        kaiContainer.classList.add('secondary-pip');
        
        // 2. User becomes Full Screen
        userContainer.classList.remove('secondary-pip');
        userContainer.classList.remove('movable-pip'); 
        userContainer.classList.add('primary-view');
        
    } else {
        // SWITCH: User Primary -> Kai Primary (Full) / User Secondary (PiP)
        
        // 1. Kai becomes Full Screen
        kaiContainer.classList.remove('secondary-pip');
        kaiContainer.classList.add('primary-view');
        
        // 2. User becomes PiP
        userContainer.classList.remove('primary-view');
        userContainer.classList.add('secondary-pip');
        userContainer.classList.add('movable-pip');
    }
    
    // RESET POSITIONS: Ensure the new PiP snaps to the default corner
    kaiContainer.style.left = '';
    kaiContainer.style.top = '';
    kaiContainer.style.right = '30px';
    kaiContainer.style.bottom = '100px';

    userContainer.style.left = '';
    userContainer.style.top = '';
    userContainer.style.right = '30px';
    userContainer.style.bottom = '100px';
}

// Attach Double Click to BOTH containers so you can toggle from anywhere
kaiContainer.addEventListener('dblclick', toggleVideoLayout);
userContainer.addEventListener('dblclick', toggleVideoLayout);


// --- GENERIC DRAG LOGIC (Works for whichever window is PiP) ---
function startDragging(e) {
    // Determine which container was clicked
    const targetContainer = e.currentTarget;

    // VALIDATION:
    // 1. Can only drag the element that currently has the 'secondary-pip' class
    // 2. Cannot drag if Kai is speaking (prevents jitter)
    if (!targetContainer.classList.contains('secondary-pip') || isSpeaking) {
        return;
    }

    isDragging = true;
    activePip = targetContainer; // Set the active draggable element
    
    activePip.style.cursor = 'grabbing';
    activePip.style.transition = 'none'; // Disable transition for smooth direct movement

    // Calculate offset relative to the specific container being dragged
    const rect = activePip.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    // Switch to absolute positioning logic
    activePip.style.position = 'absolute';
    activePip.style.right = 'auto';
    activePip.style.bottom = 'auto';

    document.addEventListener('mousemove', handleDragging);
    document.addEventListener('mouseup', stopDragging);
}

function handleDragging(e) {
    if (!isDragging || !activePip) return;

    const bounds = document.body.getBoundingClientRect();
    const elWidth = activePip.offsetWidth;
    const elHeight = activePip.offsetHeight;

    let newLeft = e.clientX - dragOffsetX;
    let newTop = e.clientY - dragOffsetY;

    // Boundary Checks (Keep window inside screen)
    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    if (newLeft + elWidth > bounds.width) newLeft = bounds.width - elWidth;
    if (newTop + elHeight > bounds.height) newTop = bounds.height - elHeight;

    activePip.style.left = newLeft + 'px';
    activePip.style.top = newTop + 'px';
}

function stopDragging() {
    if (activePip) {
        activePip.style.cursor = 'grab';
        // Re-enable smooth transitions for future toggles
        activePip.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
    }
    
    isDragging = false;
    activePip = null; // Clear active reference
    
    document.removeEventListener('mousemove', handleDragging);
    document.removeEventListener('mouseup', stopDragging);
}

// Attach Drag Listeners to BOTH containers
kaiContainer.addEventListener('mousedown', startDragging);
userContainer.addEventListener('mousedown', startDragging);


// --- CORE APPLICATION LOGIC (Camera & Voice) ---

function playAudioResponse(url, emotion) {
    if (isSpeaking) return;

    isSpeaking = true;
    const audio = new Audio(url);
    kaiContainer.classList.add('is-speaking'); 
    
    audio.play();

    audio.onended = () => {
        isSpeaking = false;
        kaiContainer.classList.remove('is-speaking');
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
    else if (data.emotion === 'sad') emotionTag.style.backgroundColor = '#3498db'; 
    else if (data.emotion === 'neutral') emotionTag.style.backgroundColor = '#5a5a5a';
    else if (data.emotion === 'angry') emotionTag.style.backgroundColor = '#f39c12';
    else emotionTag.style.backgroundColor = '#9b59b6';
    
    if (data.audio_url) {
        playAudioResponse(data.audio_url, data.emotion);
    }
});

startCamera();