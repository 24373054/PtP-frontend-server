// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const previewArea = document.getElementById('previewArea');
const previewImage = document.getElementById('previewImage');
const removeBtn = document.getElementById('removeBtn');
const promptInput = document.getElementById('promptInput');
const editBtn = document.getElementById('editBtn');
const resultSection = document.getElementById('resultSection');
const resultImage = document.getElementById('resultImage');
const downloadBtn = document.getElementById('downloadBtn');
const status = document.getElementById('status');

let selectedFile = null;

// Check server health
async function checkHealth() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        if (data.status === 'ok') {
            status.classList.add('online');
            status.classList.remove('offline');
            status.querySelector('.text').textContent = 'Ready';
        } else {
            throw new Error('Service unavailable');
        }
    } catch (error) {
        status.classList.add('offline');
        status.classList.remove('online');
        status.querySelector('.text').textContent = 'Offline';
    }
}

// File upload handlers
uploadArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
});

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        handleFile(file);
    }
});

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    
    if (file.size > 20 * 1024 * 1024) {
        alert('File size must be less than 20MB');
        return;
    }
    
    selectedFile = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        uploadArea.classList.add('hidden');
        previewArea.classList.remove('hidden');
        updateEditButton();
    };
    reader.readAsDataURL(file);
}

removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFile = null;
    fileInput.value = '';
    uploadArea.classList.remove('hidden');
    previewArea.classList.add('hidden');
    resultSection.classList.add('hidden');
    updateEditButton();
});

// Prompt input
promptInput.addEventListener('input', updateEditButton);

function updateEditButton() {
    const hasFile = selectedFile !== null;
    const hasPrompt = promptInput.value.trim() !== '';
    editBtn.disabled = !(hasFile && hasPrompt);
}

// Edit image
editBtn.addEventListener('click', async () => {
    if (!selectedFile || !promptInput.value.trim()) return;
    
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('prompt', promptInput.value.trim());
    
    // Show loading state
    editBtn.disabled = true;
    editBtn.querySelector('.btn-text').classList.add('hidden');
    editBtn.querySelector('.btn-loading').classList.remove('hidden');
    resultSection.classList.add('hidden');
    
    try {
        const response = await fetch('/api/edit', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to process image');
        }
        
        const data = await response.json();
        
        // Show result
        resultImage.src = data.image;
        resultSection.classList.remove('hidden');
        
        // Scroll to result
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        // Reset button state
        editBtn.disabled = false;
        editBtn.querySelector('.btn-text').classList.remove('hidden');
        editBtn.querySelector('.btn-loading').classList.add('hidden');
    }
});

// Download result
downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = resultImage.src;
    link.download = `edited-${Date.now()}.png`;
    link.click();
});

// Initialize
checkHealth();
setInterval(checkHealth, 30000); // Check every 30 seconds
