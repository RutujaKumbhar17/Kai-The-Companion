const socket = io();

// Get the new container elements
const kaiContainer = document.getElementById('kai-video-container');
const userContainer = document.getElementById('user-video-container');

const videoElement = document.getElementById('userVideo');
const emotionTag = document.getElementById('emotionTag');
const toggleViewBtn = document.getElementById('toggleViewBtn');

// --- GLOBAL STATE ---
let isSpeaking = false;
let isDragging = false;
let dragOffsetX, dragOffsetY;

// --- TOGGLE LOGIC: Swaps the primary (full-screen) and secondary (PiP) views ---
function toggleVideoLayout() {
    // Determine the current state based on Kai's class
    const kaiIsPrimary = kaiContainer.classList.contains('primary-view');
    
    if (kaiIsPrimary) {
        // Switch to User Primary (Full) / Kai Secondary (PiP)
        
        // 1. Swap Kai to Secondary (PiP)
        kaiContainer.classList.remove('primary-view');
        kaiContainer.classList.add('secondary-pip');
        
        // 2. Swap User to Primary (Full) - Disable movement when full-screen
        userContainer.classList.remove('secondary-pip');
        userContainer.classList.remove('movable-pip'); 
        userContainer.classList.add('primary-view');
        
        // 3. Update button icon
        toggleViewBtn.innerHTML = '<i class="fas fa-compress-alt"></i>';
        
    } else {
        // Switch back to Kai Primary (Full) / User Secondary (PiP)
        
        // 1. Swap Kai back to Primary (Full)
        kaiContainer.classList.remove('secondary-pip');
        kaiContainer.classList.add('primary-view');
        
        // 2. Swap User back to Secondary (PiP) - Re-enable movement
        userContainer.classList.remove('primary-view');
        userContainer.classList.add('secondary-pip');
        userContainer.classList.add('movable-pip');
        
        // 3. Update button icon
        toggleViewBtn.innerHTML = '<i class="fas fa-expand-alt"></i>';
    }
    
    // Reset any inline positioning set by the drag function to default PiP position
    // This is important for smooth transition back to default layout
    kaiContainer.style.left = '';
    kaiContainer.style.top = '';
    kaiContainer.style.right = '30px';
    kaiContainer.style.bottom = '100px';

    userContainer.style.left = '';
    userContainer.style.top = '';
    userContainer.style.right = '30px';
    userContainer.style.bottom = '100px';
}

toggleViewBtn.addEventListener('click', toggleVideoLayout);


// --- DRAG LOGIC (Updated to only allow drag in PiP mode) ---
function startDragging(e) {
    // Only allow dragging if the user container is the PiP (secondary-pip) AND not clicking the toggle button
    if (!userContainer.classList.contains('secondary-pip') || isSpeaking || e.target.closest('#toggleViewBtn')) {
        return; 
    }
    
    isDragging = true;
    userContainer.style.cursor = 'grabbing';
    
    const piPRect = userContainer.getBoundingClientRect();
    dragOffsetX = e.clientX - piPRect.left;
    dragOffsetY = e.clientY - piPRect.top;
    
    // Must remove CSS transitions for smooth dragging
    userContainer.style.transition = 'none'; 
    // Ensure absolute positioning is explicit and override default positioning
    userContainer.style.position = 'absolute';
    userContainer.style.right = 'auto'; 
    userContainer.style.bottom = 'auto'; 

    document.addEventListener('mousemove', handleDragging);
    document.addEventListener('mouseup', stopDragging);
}

function handleDragging(e) {
    if (!isDragging) return;

    const bounds = document.body.getBoundingClientRect();
    const piPWidth = userContainer.offsetWidth;
    const piPHeight = userContainer.offsetHeight;

    let newLeft = e.clientX - dragOffsetX;
    let newTop = e.clientY - dragOffsetY;

    // Boundary limits
    if (newLeft < 0) newLeft = 0;
    if (newTop < 0) newTop = 0;
    if (newLeft + piPWidth > bounds.width) newLeft = bounds.width - piPWidth;
    if (newTop + piPHeight > bounds.height) newTop = bounds.height - piPHeight;


    // Apply new position
    userContainer.style.left = newLeft + 'px';
    userContainer.style.top = newTop + 'px';
}

function stopDragging() {
    isDragging = false;
    userContainer.style.cursor = 'grab';
    document.removeEventListener('mousemove', handleDragging);
    document.removeEventListener('mouseup', stopDragging);
    
    // Re-enable CSS transition after drag is finished (for future swaps/resets)
    userContainer.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
}

userContainer.addEventListener('mousedown', startDragging);


// --- CORE APPLICATION LOGIC (Camera & Voice) ---

function playAudioResponse(url, emotion) {
    if (isSpeaking) return;

    isSpeaking = true;
    const audio = new Audio(url);
    // Use the Kai container for the speaking class
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
    // Only send frames if Kai is not speaking AND the user is not dragging
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
    
    // Set emotion tag background color to match the new theme
    if (data.emotion === 'happy') emotionTag.style.backgroundColor = '#2ecc71'; 
    else if (data.emotion === 'sad') emotionTag.style.backgroundColor = '#3498db'; 
    else if (data.emotion === 'neutral') emotionTag.style.backgroundColor = '#5a5a5a'; // Dark gray for neutral
    else if (data.emotion === 'angry') emotionTag.style.backgroundColor = '#f39c12';
    else emotionTag.style.backgroundColor = '#9b59b6';
    
    if (data.audio_url) {
        playAudioResponse(data.audio_url, data.emotion);
    }
});

startCamera();