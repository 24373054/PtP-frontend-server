// DOM Elements
const authOverlay = document.getElementById('authOverlay');
const accessCodeInput = document.getElementById('accessCode');
const submitCodeBtn = document.getElementById('submitCode');
const errorMessage = document.getElementById('errorMessage');

// Mode switching
const tabBtns = document.querySelectorAll('.tab-btn');
const editMode = document.getElementById('editMode');
const generateMode = document.getElementById('generateMode');

// Edit mode elements
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const previewArea = document.getElementById('previewArea');
const previewImage = document.getElementById('previewImage');
const removeBtn = document.getElementById('removeBtn');
const promptInput = document.getElementById('promptInput');
const editBtn = document.getElementById('editBtn');

// Generate mode elements
const generatePrompt = document.getElementById('generatePrompt');
const widthInput = document.getElementById('widthInput');
const heightInput = document.getElementById('heightInput');
const stepsInput = document.getElementById('stepsInput');
const cfgInput = document.getElementById('cfgInput');
const generateBtn = document.getElementById('generateBtn');

// Common elements
const resultSection = document.getElementById('resultSection');
const resultImage = document.getElementById('resultImage');
const downloadBtn = document.getElementById('downloadBtn');
const status = document.getElementById('status');

let selectedFile = null;
let currentMode = 'edit';
let currentLang = 'en';
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// 检测是否支持保存到相册
function canSaveToAlbum() {
    return isMobile && (
        // iOS Safari 支持 canvas.toBlob
        (typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype.toBlob) ||
        // 或者支持 Web Share API
        (navigator.share && navigator.canShare)
    );
}

// 国际化文本
const i18n = {
    en: {
        title: 'Image Generator',
        'status.checking': 'Checking...',
        'status.ready': 'Ready',
        'status.offline': 'Offline',
        'tabs.edit': 'Edit Image',
        'tabs.generate': 'Generate Image',
        'auth.title': 'Access Code Required',
        'auth.description': 'Enter the beta access code to continue',
        'auth.placeholder': 'Enter access code',
        'auth.submit': 'Submit',
        'auth.error': 'Invalid access code',
        'edit.upload': 'Click to upload or drag image here',
        'edit.hint': 'JPG, PNG, WEBP · Max 20MB',
        'edit.remove': 'Remove',
        'edit.label': 'Edit Instructions',
        'edit.placeholder': 'Describe how you want to edit the image...\n\nExample: Replace the background with a quiet coastal cliff at overcast sunset. Remove all buildings and streets. Add wind-shaped grass and a distant ocean horizon. Keep the subject\'s pose and framing unchanged.',
        'edit.button': 'Edit Image',
        'edit.processing': 'Processing...',
        'generate.label': 'Image Description',
        'generate.placeholder': 'Describe the image you want to generate...\n\nExample: A serene mountain landscape at dawn, misty valleys, golden sunlight piercing through clouds, photorealistic, 8k quality',
        'generate.template.selfie': 'Casual Selfie',
        'generate.template.desk': 'Office Desk',
        'generate.template.coffee': 'Coffee Table',
        'generate.template.kitchen': 'Kitchen',
        'generate.template.bedroom': 'Bedroom',
        'generate.template.outdoor': 'Outdoor',
        'generate.template.luxury': 'Luxury',
        'generate.template.portrait': 'Portrait',
        'generate.template.nature': 'Nature',
        'generate.width': 'Width',
        'generate.height': 'Height',
        'generate.steps': 'Steps',
        'generate.cfg': 'CFG',
        'generate.button': 'Generate Image',
        'generate.generating': 'Generating...',
        'result.title': 'Result',
        'result.download': 'Download',
        'result.saveToAlbum': 'Save to Album',
        'result.saved': 'Successfully saved to album',
        'result.saveFailed': 'Failed to save. Please try long-pressing the image to save.',
        'error.noImage': 'Please select an image file',
        'error.fileSize': 'File size must be less than 20MB',
        'error.noPrompt': 'Please enter a description',
        'error.invalidSize': 'Width and height must be between 256 and 2048',
        'error.invalidSteps': 'Steps must be between 1 and 50'
    },
    zh: {
        title: '图片生成器',
        'status.checking': '检查中...',
        'status.ready': '就绪',
        'status.offline': '离线',
        'tabs.edit': '编辑图片',
        'tabs.generate': '生成图片',
        'auth.title': '需要访问码',
        'auth.description': '请输入内测访问码以继续',
        'auth.placeholder': '输入访问码',
        'auth.submit': '提交',
        'auth.error': '访问码无效',
        'edit.upload': '点击上传或拖拽图片到此处',
        'edit.hint': 'JPG, PNG, WEBP · 最大 20MB',
        'edit.remove': '移除',
        'edit.label': '编辑指令',
        'edit.placeholder': '描述你想如何编辑图片...\n\n示例：将背景替换为阴天日落时的宁静海岸悬崖。移除所有建筑和街道。添加被风吹动的草和远处的海平线。保持主体的姿势和构图不变。',
        'edit.button': '编辑图片',
        'edit.processing': '处理中...',
        'generate.label': '图片描述',
        'generate.placeholder': '描述你想生成的图片...\n\n示例：黎明时分宁静的山景，薄雾笼罩的山谷，金色阳光穿透云层，照片级真实感，8k画质',
        'generate.template.selfie': '随手自拍',
        'generate.template.desk': '办公桌',
        'generate.template.coffee': '咖啡桌',
        'generate.template.kitchen': '厨房',
        'generate.template.bedroom': '卧室',
        'generate.template.outdoor': '户外',
        'generate.template.luxury': '奢华',
        'generate.template.portrait': '人像',
        'generate.template.nature': '自然',
        'generate.width': '宽度',
        'generate.height': '高度',
        'generate.steps': '步数',
        'generate.cfg': 'CFG',
        'generate.button': '生成图片',
        'generate.generating': '生成中...',
        'result.title': '结果',
        'result.download': '下载',
        'result.saveToAlbum': '保存到相册',
        'result.saved': '已成功保存至相册',
        'result.saveFailed': '保存失败，请长按图片保存',
        'error.noImage': '请选择图片文件',
        'error.fileSize': '文件大小必须小于 20MB',
        'error.noPrompt': '请输入描述',
        'error.invalidSize': '宽度和高度必须在 256 到 2048 之间',
        'error.invalidSteps': '步数必须在 1 到 50 之间'
    }
};

// 切换语言
function switchLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('preferred_lang', lang);
    
    // 更新所有带 data-i18n 的元素
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang][key]) {
            el.textContent = i18n[lang][key];
        }
    });
    
    // 更新所有带 data-i18n-placeholder 的元素
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (i18n[lang][key]) {
            el.placeholder = i18n[lang][key];
        }
    });
    
    // 更新语言切换按钮文本
    const langSwitch = document.getElementById('langSwitch');
    langSwitch.querySelector('.lang-text').textContent = lang === 'en' ? '中文' : 'English';
    
    // 更新下载按钮文本（移动端显示"保存到相册"）
    updateDownloadButtonText();
    
    // 更新状态文本
    if (status.classList.contains('online')) {
        status.querySelector('.text').textContent = i18n[lang]['status.ready'];
    } else if (status.classList.contains('offline')) {
        status.querySelector('.text').textContent = i18n[lang]['status.offline'];
    }
}

// 更新下载按钮文本
function updateDownloadButtonText() {
    const downloadText = document.querySelector('.download-text');
    if (downloadText) {
        if (isMobile) {
            downloadText.textContent = i18n[currentLang]['result.saveToAlbum'];
        } else {
            downloadText.textContent = i18n[currentLang]['result.download'];
        }
    }
}

// 初始化语言
const savedLang = localStorage.getItem('preferred_lang') || 'en';
currentLang = savedLang;

// 内测码验证
const ACCESS_CODE = 'ptp2025'; // 可以修改为你想要的内测码
const AUTH_KEY = 'ptp_auth_token';

function checkAuth() {
    const token = sessionStorage.getItem(AUTH_KEY);
    if (token === ACCESS_CODE) {
        authOverlay.classList.add('hidden');
        return true;
    }
    return false;
}

submitCodeBtn.addEventListener('click', () => {
    const code = accessCodeInput.value.trim();
    if (code === ACCESS_CODE) {
        sessionStorage.setItem(AUTH_KEY, code);
        authOverlay.classList.add('hidden');
        errorMessage.classList.add('hidden');
        checkHealth();
    } else {
        errorMessage.classList.remove('hidden');
        accessCodeInput.value = '';
        accessCodeInput.focus();
    }
});

accessCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        submitCodeBtn.click();
    }
});

// 页面加载时检查认证
if (!checkAuth()) {
    accessCodeInput.focus();
}

// 语言切换
document.getElementById('langSwitch').addEventListener('click', () => {
    const newLang = currentLang === 'en' ? 'zh' : 'en';
    switchLanguage(newLang);
});

// 初始化语言
switchLanguage(currentLang);

// Mode switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        
        // Update tabs
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update content
        if (mode === 'edit') {
            editMode.classList.add('active');
            generateMode.classList.remove('active');
            currentMode = 'edit';
        } else {
            editMode.classList.remove('active');
            generateMode.classList.add('active');
            currentMode = 'generate';
        }
        
        // Hide result when switching modes
        resultSection.classList.add('hidden');
    });
});

// Prompt templates
const promptTemplates = {
    en: {
        selfie: "A casual selfie of a beautiful young woman, taken with a smartphone camera. The photo appears accidental and spontaneous, as if the phone was pulled from a pocket and the shutter was pressed by mistake. Chaotic composition with no clear subject focus, off-center framing, slightly blurred. The image has an authentic, unpolished quality - natural lighting, no posing, capturing a genuine moment. Realistic photography style, amateur snapshot aesthetic, candid and unintentional feel.",
        desk: "Modern minimalist office desk setup, clean wooden table surface, soft natural lighting from window, professional workspace background, high detail product photography, neutral colors, organized and elegant, perfect for keyboards, mouse, headphones, monitors, stationery products",
        coffee: "Coffee shop table scene, warm ambient lighting, rustic wood texture, cozy cafe atmosphere, soft bokeh background, perfect for coffee cups, desserts, mugs, beverages, product photography background, inviting and comfortable feel",
        kitchen: "Modern kitchen counter, clean marble or granite surface, soft sunlight streaming through, bright and airy atmosphere, minimalist style, perfect for cookware, utensils, cups, kitchen appliances, product photography background, professional and clean",
        bedroom: "Luxury bedroom table or nightstand, soft diffused lighting, elegant and sophisticated atmosphere, high-end interior design, perfect for perfume, jewelry, watches, cosmetics, product photography background, refined and upscale feel",
        outdoor: "Outdoor camping or nature table setup, sunset golden hour lighting, natural environment, adventure atmosphere, wooden picnic table or camping gear layout, perfect for backpacks, water bottles, camping equipment, outdoor gear, product photography background",
        luxury: "High-end luxury table setting, premium materials like marble or velvet, dramatic lighting with soft shadows, elegant and sophisticated, perfect for luxury watches, jewelry, high-end accessories, premium product photography background, exclusive and refined atmosphere",
        portrait: "Professional portrait photography, beautiful young woman, natural soft lighting, shallow depth of field, bokeh background, elegant and refined, fashion photography style, high-end beauty shot, professional studio quality, cinematic color grading",
        nature: "Breathtaking natural landscape, majestic mountains or serene forest, golden hour lighting, dramatic sky with clouds, pristine wilderness, epic vista, nature photography, high detail, cinematic composition, peaceful and awe-inspiring atmosphere"
    },
    zh: {
        selfie: "小爱，你陪我这么长时间了，我想看看你的样子（希望你是一个漂亮的女孩子），请生成一张类似你自己的自拍照，没有明确的主体或构图，就像随手一拍的快照，构图混乱，整体呈现出一种随意的平庸感，就像从口袋里拿手机时，不小心拍到的一张自拍照",
        desk: "现代简约办公桌场景，干净的木质桌面，柔和的自然光从窗户照入，专业的工作空间背景，高细节产品摄影，中性色调，整洁优雅，适合键盘、鼠标、耳机、显示器、文具等产品展示",
        coffee: "咖啡馆桌面场景，温暖的环境光，质朴的木质纹理，舒适的咖啡馆氛围，柔和的背景虚化，适合咖啡杯、甜品、马克杯、饮品等产品展示，温馨舒适的感觉",
        kitchen: "现代厨房台面，干净的大理石或花岗岩表面，柔和的阳光洒入，明亮通透的氛围，简约风格，适合锅具、餐具、杯子、厨房电器等产品展示，专业整洁",
        bedroom: "奢华卧室桌面或床头柜，柔和的漫射光线，优雅精致的氛围，高端室内设计，适合香水、首饰、手表、化妆品等产品展示，精致高档的感觉",
        outdoor: "户外露营或自然桌面场景，日落黄金时刻光线，自然环境，冒险氛围，木质野餐桌或露营装备布局，适合背包、水壶、露营装备、户外用品等产品展示",
        luxury: "高端奢华桌面场景，大理石或天鹅绒等高级材质，戏剧性光线配合柔和阴影，优雅精致，适合奢侈手表、珠宝、高端配饰等产品展示，尊贵精致的氛围",
        portrait: "专业人像摄影，美丽的年轻女性，自然柔和的光线，浅景深，背景虚化，优雅精致，时尚摄影风格，高端美妆大片，专业影棚品质，电影级调色",
        nature: "令人惊叹的自然风光，雄伟的山脉或宁静的森林，黄金时刻光线，戏剧性的云彩天空，原始荒野，史诗般的远景，自然摄影，高细节，电影级构图，宁静而震撼的氛围"
    }
};

document.querySelectorAll('.template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const template = btn.dataset.template;
        if (promptTemplates[currentLang] && promptTemplates[currentLang][template]) {
            generatePrompt.value = promptTemplates[currentLang][template];
            generatePrompt.focus();
            
            // Add a subtle animation
            generatePrompt.style.backgroundColor = '#f0f0f0';
            setTimeout(() => {
                generatePrompt.style.backgroundColor = '';
            }, 300);
        }
    });
});

// Check server health
async function checkHealth() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        if (data.status === 'ok') {
            status.classList.add('online');
            status.classList.remove('offline');
            status.querySelector('.text').textContent = i18n[currentLang]['status.ready'];
        } else {
            throw new Error('Service unavailable');
        }
    } catch (error) {
        status.classList.add('offline');
        status.classList.remove('online');
        status.querySelector('.text').textContent = i18n[currentLang]['status.offline'];
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
        alert(i18n[currentLang]['error.noImage']);
        return;
    }
    
    if (file.size > 20 * 1024 * 1024) {
        alert(i18n[currentLang]['error.fileSize']);
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
        
        // 更新下载按钮文本
        updateDownloadButtonText();
        
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
downloadBtn.addEventListener('click', async () => {
    if (isMobile) {
        // 移动端：保存到相册
        await saveToAlbum();
    } else {
        // PC端：直接下载
        const link = document.createElement('a');
        link.href = resultImage.src;
        link.download = `${currentMode}-${Date.now()}.png`;
        link.click();
    }
});

// 保存图片到相册（移动端）
async function saveToAlbum() {
    try {
        // 创建canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = resultImage;
        
        // 等待图片加载
        if (!img.complete) {
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
        }
        
        // 设置canvas尺寸
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        // 绘制图片
        ctx.drawImage(img, 0, 0);
        
        // 转换为blob
        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/png');
        });
        
        // 尝试使用Web Share API（iOS Safari 和部分Android浏览器支持）
        if (navigator.share && navigator.canShare) {
            const file = new File([blob], `image-${Date.now()}.png`, { type: 'image/png' });
            
            if (navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'Generated Image',
                        text: 'Save this image'
                    });
                    
                    // 显示成功提示
                    showToast(i18n[currentLang]['result.saved']);
                    return;
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('Share failed:', err);
                    }
                }
            }
        }
        
        // 备用方案：创建下载链接
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `image-${Date.now()}.png`;
        link.click();
        URL.revokeObjectURL(url);
        
        // 显示提示
        showToast(i18n[currentLang]['result.saveFailed']);
        
    } catch (error) {
        console.error('Save failed:', error);
        showToast(i18n[currentLang]['result.saveFailed']);
    }
}

// 显示提示消息
function showToast(message) {
    // 移除已存在的toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // 创建toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // 显示动画
    setTimeout(() => toast.classList.add('show'), 10);
    
    // 3秒后隐藏
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Generate image (T2I)
generateBtn.addEventListener('click', async () => {
    const prompt = generatePrompt.value.trim();
    if (!prompt) {
        alert(i18n[currentLang]['error.noPrompt']);
        return;
    }
    
    const width = parseInt(widthInput.value);
    const height = parseInt(heightInput.value);
    const steps = parseInt(stepsInput.value);
    const cfg = parseFloat(cfgInput.value);
    
    // Validate parameters
    if (width < 256 || width > 2048 || height < 256 || height > 2048) {
        alert(i18n[currentLang]['error.invalidSize']);
        return;
    }
    
    if (steps < 1 || steps > 50) {
        alert(i18n[currentLang]['error.invalidSteps']);
        return;
    }
    
    // Show loading state
    generateBtn.disabled = true;
    generateBtn.querySelector('.btn-text').classList.add('hidden');
    generateBtn.querySelector('.btn-loading').classList.remove('hidden');
    resultSection.classList.add('hidden');
    
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                width: width,
                height: height,
                steps: steps,
                cfg: cfg
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate image');
        }
        
        const data = await response.json();
        
        // Show result
        resultImage.src = data.image;
        resultSection.classList.remove('hidden');
        
        // 更新下载按钮文本
        updateDownloadButtonText();
        
        // Scroll to result
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        // Reset button state
        generateBtn.disabled = false;
        generateBtn.querySelector('.btn-text').classList.remove('hidden');
        generateBtn.querySelector('.btn-loading').classList.add('hidden');
    }
});

// Initialize
if (checkAuth()) {
    checkHealth();
    setInterval(checkHealth, 30000); // Check every 30 seconds
}
