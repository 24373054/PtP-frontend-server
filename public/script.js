// DOM Elements
const authOverlay = document.getElementById('authOverlay');
const accessCodeInput = document.getElementById('accessCode');
const submitCodeBtn = document.getElementById('submitCode');
const errorMessage = document.getElementById('errorMessage');
const cookieConsentOverlay = document.getElementById('cookieConsentOverlay');
const cookieConsentAccept = document.getElementById('cookieConsentAccept');
const logoutBtn = document.getElementById('logoutBtn');

// Custom alert elements
const customAlertOverlay = document.getElementById('customAlertOverlay');
const customAlertContent = document.getElementById('customAlertContent');
const customAlertBtn = document.getElementById('customAlertBtn');

// User info elements
const userInfo = document.getElementById('userInfo');
const userName = document.getElementById('userName');
const userPlan = document.getElementById('userPlan');
const creditsCount = document.getElementById('creditsCount');
const editBtnCredit = document.getElementById('editBtnCredit');
const generateBtnCredit = document.getElementById('generateBtnCredit');
const plansSection = document.getElementById('plansSection');
const plansGrid = document.getElementById('plansGrid');

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
const gridModeCheckbox = document.getElementById('gridModeCheckbox');
const generateBtn = document.getElementById('generateBtn');

// Common elements
const resultSection = document.getElementById('resultSection');
const resultImage = document.getElementById('resultImage');
const downloadBtn = document.getElementById('downloadBtn');
const status = document.getElementById('status');
const loadingOverlay = document.getElementById('loadingOverlay');

const negativePrompt = document.getElementById('negativePrompt');
const editPresetBar = document.getElementById('editPresetBar');
const resultMetaSummary = document.getElementById('resultMetaSummary');
const compareBox = document.getElementById('compareBox');
const compareImgBefore = document.getElementById('compareImgBefore');
const compareImgAfter = document.getElementById('compareImgAfter');
const cancelTaskBtn = document.getElementById('cancelTaskBtn');
const regenerateBtn = document.getElementById('regenerateBtn');
const historyList = document.getElementById('historyList');
const historyEmpty = document.getElementById('historyEmpty');
const forgeNav = document.getElementById('forgeNav');
const navBtnAdmin = document.getElementById('navAdmin');
const btnAdminRefresh = document.getElementById('btnAdminRefresh');
/** 登录表单意图：user | admin */
let authPortalIntent = 'user';
let currentAuthPortal = 'user';
let sessionIsAdmin = false;
/** 管理端：userId -> 账号摘要（不含密码） */
const adminUserMap = new Map();
const historyModal = document.getElementById('historyModal');
const historyModalMeta = document.getElementById('historyModalMeta');
const historyModalBefore = document.getElementById('historyModalBefore');
const historyModalAfter = document.getElementById('historyModalAfter');
const historyModalOpenEditor = document.getElementById('historyModalOpenEditor');
const historyModalClose = document.getElementById('historyModalClose');
const btnRefreshHealth = document.getElementById('btnRefreshHealth');
const settingsHealthOut = document.getElementById('settingsHealthOut');
const settingsVersionOut = document.getElementById('settingsVersionOut');
const btnClearHistory = document.getElementById('btnClearHistory');

/**
 * BFF 根地址。默认与页面同源（须通过 node server.js 提供整站）。
 * 静态页与 API 分离时：在 index.html 设置 meta name="ptp-api-base" content="http://主机:38024"
 * 或在任意脚本前执行 window.PTP_API_BASE = 'http://...'。
 */
function getPtpApiBase() {
    if (
        typeof window !== 'undefined' &&
        window.PTP_API_BASE != null &&
        String(window.PTP_API_BASE).trim() !== ''
    ) {
        return String(window.PTP_API_BASE).trim().replace(/\/$/, '');
    }
    const meta = document.querySelector('meta[name="ptp-api-base"]');
    if (meta && meta.content && String(meta.content).trim() !== '') {
        return String(meta.content).trim().replace(/\/$/, '');
    }
    return '';
}

function apiUrl(path) {
    const p = path.startsWith('/') ? path : `/${path}`;
    const b = getPtpApiBase();
    if (!b) return p;
    return `${b.replace(/\/$/, '')}${p}`;
}

/** 携带 Cookie 会话（邮箱登录）；与 apiUrl 同域时使用 */
function apiFetch(url, options = {}) {
    return fetch(url, { ...options, credentials: 'include' });
}

/**
 * API 未就绪或返回缺字段时，珠宝导出/品类/提示仍可用（与 workflows/presets.json 对齐的子集）。
 */
const JEWELRY_UI_PRESETS_FALLBACK = {
    editPresets: {
        upscale_main: {
            name: { en: 'HD enhance (prompt)', zh: '高清增强' },
            prompt: {
                en: 'Enhance clarity and micro-detail: sharper edges, reduce noise, preserve original composition and content, avoid hallucinated new objects.',
                zh: '提升清晰度与细节：边缘更锐利、降噪，保持原构图与内容，不要凭空增加物体。'
            }
        },
        background_main: {
            name: { en: 'Background repaint (prompt)', zh: '背景重绘' },
            prompt: {
                en: 'Replace or repaint ONLY the background; keep the foreground subject pixel-accurate with clean edges; seamless blend.',
                zh: '仅替换或重绘背景，前景主体边缘干净、与背景自然融合，不改变主体形状。'
            }
        },
        jewelry_metal_fire: {
            name: { en: 'Metal & fire polish', zh: '金属火彩' },
            prompt: {
                en: 'Polish precious metal reflections and gemstone fire; micro-contrast on facets; no geometry change.',
                zh: '强化贵金属反光与宝石火彩，刻面微对比，不改变几何外形。'
            }
        },
        jewelry_white_pure: {
            name: { en: 'Pure white catalog', zh: '纯白目录' },
            prompt: {
                en: 'Isolate product on pure white #FFFFFF seamless background; crisp edge; soft contact shadow only.',
                zh: '纯白无缝背景商品隔离；边缘利落，仅保留极轻接触阴影。'
            }
        }
    },
    exportPresets: [
        {
            id: 'square_800',
            name: { en: 'Square 800 (main)', zh: '主图 800×800' },
            width: 800,
            height: 800
        },
        {
            id: 'square_1000',
            name: { en: 'Square 1000', zh: '主图 1000×1000' },
            width: 1000,
            height: 1000
        },
        {
            id: 'taobao_detail',
            name: { en: 'Detail 750×1000', zh: '详情竖图 750×1000' },
            width: 750,
            height: 1000
        }
    ],
    jewelryProductCategories: [
        {
            id: 'ring',
            name: { en: 'Ring', zh: '戒指' },
            promptHint: {
                en: 'Top-down or 3/4 hero angle; band and stone centered; even reflections.',
                zh: '俯视或四分之三主图角；戒圈与主石居中，反射均匀。'
            }
        },
        {
            id: 'necklace',
            name: { en: 'Necklace', zh: '项链' },
            promptHint: {
                en: 'Gentle S-curve lay flat; clasp hidden; chain links readable.',
                zh: '柔和 S 形平铺；链节清晰，扣件尽量不抢眼。'
            }
        },
        {
            id: 'earring',
            name: { en: 'Earrings', zh: '耳饰' },
            promptHint: {
                en: 'Symmetric pair layout or single stud macro; ear post not distorted.',
                zh: '对称耳对或单颗耳钉微距；针脚不畸变。'
            }
        },
        {
            id: 'bracelet',
            name: { en: 'Bracelet / bangle', zh: '手镯手链' },
            promptHint: {
                en: 'Soft oval loop; inner shine visible; clasp area clean.',
                zh: '柔和椭圆环状；内壁高光可见，扣合区干净。'
            }
        },
        {
            id: 'jade',
            name: { en: 'Jade / stone', zh: '玉石文玩' },
            promptHint: {
                en: 'Subsurface glow, gentle translucency, no oversharpened veins.',
                zh: '体现温润通透感，纹理不过锐。'
            }
        },
        {
            id: 'watch',
            name: { en: 'Watch', zh: '腕表' },
            promptHint: {
                en: 'Dial legible; crystal reflections controlled; crown detail preserved.',
                zh: '表盘可读，表镜反光克制，表冠细节保留。'
            }
        },
        {
            id: 'pendant',
            name: { en: 'Pendant', zh: '吊坠' },
            promptHint: {
                en: 'Bail and chain entry visible; pendant faces camera; avoid twisted links.',
                zh: '扣头与链节入口清晰，坠体正面朝向镜头，链节尽量不绞在一起。'
            }
        },
        {
            id: 'brooch',
            name: { en: 'Brooch / pin', zh: '胸针' },
            promptHint: {
                en: 'Pin mechanism discreet; frontal or slight 3/4; stones and enamel read clearly.',
                zh: '针背结构尽量不抢眼，正面或略四分之三角，宝石与珐琅层次可读。'
            }
        },
        {
            id: 'pearls',
            name: { en: 'Pearl strand', zh: '珍珠串珠' },
            promptHint: {
                en: 'Luster gradient along each pearl; knot spacing even; no plastic chalky look.',
                zh: '每颗珍珠体现光泽渐变，打结间距均匀，避免塑料发闷感。'
            }
        },
        {
            id: 'cufflinks',
            name: { en: 'Cufflinks', zh: '袖扣' },
            promptHint: {
                en: 'Pair aligned symmetrically; face detail sharp; backs minimal in frame.',
                zh: '成对对称摆放，正面细节清晰，背面尽量少入画。'
            }
        },
        {
            id: 'generic',
            name: { en: 'General jewelry', zh: '通用珠宝' },
            promptHint: {
                en: 'Premium product photo; neutral composition bias.',
                zh: '通用高级商拍构图。'
            }
        }
    ],
    jewelryScenePacks: [
        {
            id: 'velvet_navy',
            name: { en: 'Navy velvet', zh: '深蓝绒布' },
            prompt: {
                en: 'Place on deep navy velvet with soft studio light, subtle gradient, premium catalog look.',
                zh: '深蓝丝绒衬底，柔和棚拍光，轻微渐变，高级目录风。'
            }
        },
        {
            id: 'marble_gold',
            name: { en: 'Marble & gold', zh: '大理石金边' },
            prompt: {
                en: 'Elegant white marble surface with thin gold trim reflections, soft daylight window.',
                zh: '白色大理石台面与细金边反射感，柔和日光窗光。'
            }
        },
        {
            id: 'bokeh_rose',
            name: { en: 'Rose bokeh', zh: '玫瑰散景' },
            prompt: {
                en: 'Warm rose-gold bokeh background, shallow depth of field, jewelry hero framing.',
                zh: '暖玫瑰金散景背景，浅景深，珠宝主图构图。'
            }
        },
        {
            id: 'minimal_360',
            name: { en: 'Minimal 360 pad', zh: '极简转盘' },
            prompt: {
                en: 'Minimal gray seamless cyclorama, soft top light, e-commerce 360-style pad.',
                zh: '极简灰色无缝弧面，顶柔光，电商转盘台风格。'
            }
        },
        {
            id: 'jade_wood',
            name: { en: 'Wood + jade mood', zh: '木座文玩' },
            prompt: {
                en: 'Dark walnut display stand, soft side light, cultural luxury still life.',
                zh: '深色胡桃木座，侧柔光，文玩静物质感。'
            }
        },
        {
            id: 'satin_champagne',
            name: { en: 'Champagne satin', zh: '香槟缎面' },
            prompt: {
                en: 'Soft champagne satin drape, gentle folds, warm key light, high-end boutique still life.',
                zh: '香槟色缎面衬布，柔和褶皱纹理，暖主光，精品店静物感。'
            }
        },
        {
            id: 'black_lucite',
            name: { en: 'Black lucite riser', zh: '黑亚克力展台' },
            prompt: {
                en: 'Sleek black acrylic riser, crisp reflections, controlled studio rim light, modern catalog.',
                zh: '黑色亚克力几何展台，克制反光与轮廓光，现代目录棚拍。'
            }
        },
        {
            id: 'frost_glass',
            name: { en: 'Frosted glass', zh: '磨砂玻璃台' },
            prompt: {
                en: 'Frosted glass surface with soft diffusion, cool-neutral fill, minimal luxury tabletop.',
                zh: '磨砂玻璃台面，柔和漫反射，冷中性补光，极简轻奢台面。'
            }
        },
        {
            id: 'golden_hour_soft',
            name: { en: 'Warm sunset glow', zh: '暖金夕阳光' },
            prompt: {
                en: 'Warm late-afternoon sunlight, long soft shadows, editorial jewelry hero without harsh hotspots.',
                zh: '暖色夕阳光感，长而柔和的阴影，杂志主图光比，避免过曝高光斑。'
            }
        },
        {
            id: 'cool_teal_studio',
            name: { en: 'Cool teal gradient', zh: '青绿渐变棚' },
            prompt: {
                en: 'Seamless cool teal-to-graphite gradient cyclorama, softbox key, subtle edge light on metal.',
                zh: '青绿至石墨灰无缝渐变背景，柔光箱主光，金属边缘略提亮。'
            }
        }
    ]
};

function clonePresetsJson(o) {
    try {
        return typeof structuredClone === 'function'
            ? structuredClone(o)
            : JSON.parse(JSON.stringify(o));
    } catch (_) {
        return o;
    }
}

function mergeJewelryUiPresets(server) {
    const fb = JEWELRY_UI_PRESETS_FALLBACK;
    if (!server || typeof server !== 'object') {
        return clonePresetsJson(fb);
    }
    const out = clonePresetsJson(server);
    out.editPresets = { ...fb.editPresets, ...(server.editPresets || {}) };
    if (!Array.isArray(server.exportPresets) || server.exportPresets.length === 0) {
        out.exportPresets = clonePresetsJson(fb.exportPresets);
    }
    if (
        !Array.isArray(server.jewelryProductCategories) ||
        server.jewelryProductCategories.length === 0
    ) {
        out.jewelryProductCategories = clonePresetsJson(fb.jewelryProductCategories);
    }
    if (!Array.isArray(server.jewelryScenePacks) || server.jewelryScenePacks.length === 0) {
        out.jewelryScenePacks = clonePresetsJson(fb.jewelryScenePacks);
    }
    return out;
}

const HISTORY_STORAGE_KEY = 'imageforge_history_v1';
const HISTORY_LIMIT = 40;
const TASK_CLIENT_TIMEOUT_MS = 600000;

let selectedFile = null;
let currentMode = 'edit';
let currentLang = 'en';
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let progressInterval = null;
/** 结果图完整下载 URL（相对路径 /outputs/...） */
let currentOriginalImage = null;
let currentUser = null;
let currentAccessCode = null;
let editIntentTask = 'style';
let forgePresets = mergeJewelryUiPresets(null);
let activeAbortController = null;
let compareBeforeDataUrl = null;
let lastResultSummary = {};
let forgeUserCancelled = false;
/** 批量队列（顺序调用 /api/edit-stream） */
let batchQueue = [];
/** 最近一次成功任务（用于结果页「发布到话题」） */
let lastCompletedHistoryEntry = null;
/** 话题详情页当前 topicId */
let communityTopicId = null;
let communityPostSort = 'latest';
let communityPublishTargetItem = null;
let communityViewingPostId = null;

/** 与 server.js normalizeEditTemplate 对齐 */
const EDIT_WORKFLOW_TEMPLATE = {
    style: 'img2img_style',
    upscale: 'image_upscale',
    background: 'background_repaint',
    jewelry_retouch: 'jewelry_retouch',
    jewelry_cutout: 'jewelry_product_cutout',
    jewelry_scene: 'jewelry_scene',
    jewelry_macro: 'jewelry_macro_detail'
};

/** 珠宝一键流：品类芯片、场景句由程序拼装，用户不必写长提示词 */
let jewelryCategoryId = 'generic';
let jewelrySceneSnippet = '';
let jewelrySelectedSceneId = '';

function isJewelryIntent() {
    return ['jewelry_retouch', 'jewelry_cutout', 'jewelry_scene', 'jewelry_macro'].includes(
        editIntentTask
    );
}

function getActiveNegativeEl() {
    return isJewelryIntent()
        ? document.getElementById('jewelryNegativePrompt')
        : negativePrompt;
}

function getNegativeForEdit() {
    const el = getActiveNegativeEl();
    return el && el.value ? el.value.trim() : '';
}

// 自定义弹窗函数
function showAlert(message) {
    customAlertContent.textContent = message;
    customAlertOverlay.classList.remove('hidden');
}

// 关闭自定义弹窗
customAlertBtn.addEventListener('click', () => {
    customAlertOverlay.classList.add('hidden');
});

// 点击遮罩层关闭弹窗
customAlertOverlay.addEventListener('click', (e) => {
    if (e.target === customAlertOverlay) {
        customAlertOverlay.classList.add('hidden');
    }
});

// 检测是否支持保存到相册
function canSaveToAlbum() {
    return isMobile && (
        // iOS Safari 支持 canvas.toBlob
        (typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype.toBlob) ||
        // 或者支持 Web Share API
        (navigator.share && navigator.canShare)
    );
}

// 显示加载进度（仅显示UI，不模拟进度）
function showLoadingProgress() {
    // 显示结果区域
    resultSection.classList.remove('hidden');
    
    // 如果图片还没有src，设置一个占位符确保容器有尺寸
    if (!resultImage.src || resultImage.src === window.location.href) {
        // 创建一个透明占位图
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        resultImage.src = canvas.toDataURL();
    }
    
    // 显示遮罩
    loadingOverlay.classList.remove('hidden');
    if (cancelTaskBtn) cancelTaskBtn.classList.remove('hidden');

    const progressNumber = document.querySelector('.progress-number');
    
    // 清除之前的定时器
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    
    // 初始化进度为0
    progressNumber.textContent = '0';
}

// 更新真实进度（由SSE事件调用）
function updateRealProgress(progress) {
    const progressNumber = document.querySelector('.progress-number');
    progressNumber.textContent = Math.floor(progress);
}

// 隐藏加载进度
function hideLoadingProgress() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    
    // 快速跳到100%
    const progressNumber = document.querySelector('.progress-number');
    progressNumber.textContent = '100';
    
    // 短暂延迟后隐藏遮罩
    setTimeout(() => {
        loadingOverlay.classList.add('hidden');
        if (cancelTaskBtn) cancelTaskBtn.classList.add('hidden');
        // 重置进度
        setTimeout(() => {
            progressNumber.textContent = '0';
        }, 300);
    }, 200);
}

// 国际化文本
const i18n = {
    en: {
        title: 'ImageForge Web',
        'status.checking': 'Checking...',
        'status.ready': 'Ready',
        'status.offline': 'Offline',
        'tabs.edit': 'Edit Image',
        'tabs.generate': 'Generate Image',
        'auth.title': 'Sign in',
        'auth.lead': 'Register or sign in with email. Password or verification code.',
        'auth.tabLogin': 'Sign in',
        'auth.tabRegister': 'Register',
        'auth.tabForgot': 'Reset password',
        'auth.email': 'Email',
        'auth.username': 'Username',
        'auth.password': 'Password',
        'auth.newPassword': 'New password',
        'auth.code': 'Verification code',
        'auth.modePassword': 'Password',
        'auth.modeCode': 'Email code',
        'auth.sendCode': 'Send login code',
        'auth.sendRegCode': 'Send registration code',
        'auth.sendResetCode': 'Send reset code',
        'auth.login': 'Sign in',
        'auth.register': 'Create account',
        'auth.resetPassword': 'Reset password',
        'auth.registerBonus': 'New accounts receive 30 credits.',
        'auth.logout': 'Log out',
        'auth.legacyToggle': 'Legacy invite code',
        'auth.legacyCode': 'Invite code',
        'auth.legacySubmit': 'Submit code',
        'auth.placeholder': 'Invite code',
        'auth.submit': 'Submit',
        'auth.error': 'Something went wrong',
        'auth.needEmail': 'Please enter a valid email address first.',
        'auth.serverHtmlError':
            'API returned HTML (route missing). Use the same host:port as this page, run `node server.js` from the latest PtP-frontend-server, then restart the process.',
        'cookies.title': 'Cookies & session',
        'cookies.body':
            'We use a session cookie to keep you signed in. By continuing you accept this use.',
        'cookies.accept': 'Accept and continue',
        'credits.cost': 'Cost:',
        'credits.unit': 'credits',
        'credits.insufficient': 'Insufficient credits. Please upgrade your plan.',
        'plans.title': 'Subscription Plans',
        'plans.current': 'Current Plan',
        'plans.upgrade': 'Upgrade',
        'plans.perMonth': '/month',
        'plans.creditsPerMonth': 'credits/month',
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
        'generate.gridMode': 'Grid Mode (4 GPU Parallel)',
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
        'error.invalidSteps': 'Steps must be between 1 and 50',
        'nav.home': 'Home',
        'nav.editor': 'Create',
        'nav.history': 'History',
        'nav.topics': 'Challenges',
        'nav.admin': 'Admin',
        'nav.settings': 'Settings',
        'auth.portalUser': 'User sign-in',
        'auth.portalAdmin': 'Admin sign-in',
        'admin.title': 'Admin console',
        'admin.hint':
            'Use “Admin sign-in” with an administrator account, or use API clients with X-Admin-Key.',
        'admin.refresh': 'Refresh',
        'admin.reports': 'Open reports',
        'admin.settle': 'Topics pending settlement',
        'admin.resolve': 'Resolve',
        'admin.runSettle': 'Settle',
        'admin.settleOk': 'Settled',
        'admin.loadFailed': 'Failed to load admin data',
        'admin.topicsTitle': 'Topics & posts (including hidden)',
        'admin.topicsHint':
            'Full descriptions, rules, and posts in all states — admin only.',
        'admin.ledgerTitle': 'Credit ledger (site-wide)',
        'admin.postInspectTitle': 'Post detail (admin)',
        'admin.closeInspect': 'Close',
        'admin.loadPosts': 'Load posts',
        'admin.viewFull': 'Full content',
        'admin.viewReportedPost': 'View post',
        'admin.commentsHeading': 'Comments',
        'admin.promptSummary': 'Prompt summary',
        'admin.historyProof': 'historyProof (JSON)',
        'home.card.style.title': 'Stylized edit',
        'home.card.style.desc': 'Natural language + Flux2 workflow',
        'home.card.upscale.title': 'HD enhance',
        'home.card.upscale.desc': 'Server: lanczos upscale, ~2.25MP, 12 Flux2 steps (not prompt-only)',
        'home.card.bg.title': 'Background repaint',
        'home.card.bg.desc': 'Server: higher CFG + 8 steps; pair with background-style prompts',
        'home.card.history.title': 'History',
        'home.card.history.desc': 'Saved in this browser; replay without GPU',
        'home.card.settings.title': 'Settings',
        'home.card.settings.desc': 'Health & version',
        'home.card.jewelry.retouch.title': 'Jewelry polish',
        'home.card.jewelry.retouch.desc': 'Metal & gemstone polish · jewelry_retouch',
        'home.card.jewelry.cutout.title': 'Cutout / white BG',
        'home.card.jewelry.cutout.desc': 'Clean edges · jewelry_product_cutout',
        'home.card.jewelry.scene.title': 'Lifestyle scene',
        'home.card.jewelry.scene.desc': 'Luxury set · jewelry_scene',
        'home.card.jewelry.macro.title': 'Macro detail',
        'home.card.jewelry.macro.desc': 'Commercial upscale · jewelry_macro_detail',
        'jewelry.panelTitle': 'Jewelry & product photo',
        'jewelry.category': 'Category framing hint',
        'jewelry.scenes': 'Scene snippets',
        'jewelry.export': 'Export size (white contain)',
        'jewelry.padding': 'White margin',
        'jewelry.watermark': 'Watermark text',
        'jewelry.wmPlaceholder': 'Brand initials',
        'jewelry.batchTitle': 'Batch queue',
        'jewelry.batchPick': 'Pick multiple',
        'jewelry.batchClear': 'Clear',
        'jewelry.batchRun': 'Process in order',
        'jewelry.quickHint':
            'No long prompts needed — pick a category, upload, and go. Advanced options stay folded below.',
        'jewelry.injectHint':
            'Category text is prefixed to every jewelry edit prompt; the scene chip is appended only in Scene composite mode — same string as in POST /api/edit body.',
        'jewelry.pickCategory': 'Category',
        'jewelry.pickScene': 'Set & lighting',
        'jewelry.advancedTitle': 'Export, exclusions & batch',
        'jewelry.demo.eyebrow': 'Guided preview',
        'jewelry.demo.title': 'What this mode is aiming for',
        'jewelry.demo.before': 'Typical input',
        'jewelry.demo.after': 'Target look',
        'jewelry.demo.caption.jewelry_retouch':
            'Real pipeline: text-to-image base plate → img2img jewelry_retouch. Thumbnails in repo; run npm run generate:jewelry-demos to refresh.',
        'jewelry.demo.caption.jewelry_cutout':
            'Real pipeline: T2I busy tabletop → jewelry_product_cutout. Your uploads use the same /api/edit path.',
        'jewelry.demo.caption.jewelry_scene':
            'Real pipeline: T2I flat gray set → jewelry_scene. Use scene chips in-app for your photos.',
        'jewelry.demo.caption.jewelry_macro':
            'Real pipeline: T2I softer wide shot → jewelry_macro_detail.',
        'edit.samples': 'Sample images',
        'edit.sampleWarm': 'Warm gradient',
        'edit.sampleCool': 'Cool gradient',
        'edit.sampleNeutral': 'Neutral gray',
        'edit.negativeLabel': 'Exclude (optional)',
        'edit.negativePlaceholder': 'e.g. extra fingers, watermark, text',
        'edit.negativeHint': 'Sent as an exclusion hint appended to your prompt.',
        'compare.before': 'Before',
        'compare.after': 'After',
        'result.regenerate': 'Generate again',
        'task.cancel': 'Cancel',
        'task.timeout': 'Task timed out. Please retry or check History.',
        'task.cancelled': 'Cancelled',
        'history.title': 'History',
        'history.hint': 'Stored in this browser only.',
        'history.empty': 'No completed tasks yet.',
        'history.detailTitle': 'Task detail',
        'history.openEditor': 'Open in editor',
        'history.close': 'Close',
        'community.title': 'Topic challenges',
        'community.subtitle':
            'Limited-time themes · platform-made entries only · AI labels on public work',
        'community.loading': 'Loading…',
        'community.back': 'Back',
        'community.sort.latest': 'Latest',
        'community.sort.hot': 'Hot',
        'community.sort.rank': 'Rank',
        'community.leaderboard': 'Leaderboard',
        'community.publish': 'Publish to topic',
        'community.publishTitle': 'Publish to topic',
        'community.publishHint':
            'Only outputs still on this server can be submitted. One entry per topic per account.',
        'community.pickTopic': 'Topic',
        'community.caption': 'Caption',
        'community.captionPh': 'Short description of your work',
        'community.publicPrompt': 'Show prompt summary publicly',
        'community.submit': 'Submit',
        'community.cancel': 'Cancel',
        'community.aiBadge': 'AI',
        'community.comments': 'Comments',
        'community.openDetail': 'Detail',
        'community.postDetail': 'Work detail',
        'community.yourComment': 'Your comment',
        'community.commentPh': 'Say something constructive…',
        'community.sendComment': 'Send',
        'community.needLogin': 'Please sign in to continue.',
        'community.submitted': 'Submitted.',
        'community.alreadySubmitted': 'You already submitted to this topic.',
        'community.workflowRejected': 'This workflow is not allowed for the selected topic.',
        'community.fileMissing': 'Image not found on server (re-run task on this server).',
        'community.sortLabel': 'Sort',
        'community.fav': 'Favorite',
        'settings.healthTitle': 'Connectivity',
        'settings.healthDesc': 'Checks this web service and ComfyUI (server-side).',
        'settings.refreshHealth': 'Run health check',
        'settings.versionTitle': 'Version',
        'settings.archTitle': 'Architecture',
        'settings.archBody': 'The browser only calls this Node service. ComfyUI is reached server-side.',
        'settings.demoTitle': 'Demo fallback',
        'settings.demoBody': 'Use History to replay past successful outputs when GPU is offline.',
        'settings.dataTitle': 'Local data',
        'settings.clearHistory': 'Clear all history',
        'settings.ledgerTitle': 'Credit ledger',
        'settings.ledgerHint':
            'Reward credits from settled challenges (login required). Generation debits appear in task history.',
        'settings.refreshLedger': 'Refresh ledger',
        'settings.ledgerLogin': 'Sign in to view your ledger.',
        'home.card.topics.title': 'Topic challenges',
        'home.card.topics.desc': 'Limited-time themes, leaderboard, reward credits',
        'moderation.reportTitle': 'Report this work',
        'moderation.notePh': 'Optional details (max 2000 characters)',
        'moderation.submit': 'Submit report',
        'moderation.done': 'Report received. Thank you.',
        'moderation.opt.spam': 'Spam / low quality',
        'moderation.opt.copyright': 'Copyright / portrait rights',
        'moderation.opt.illegal': 'Illegal content',
        'moderation.opt.harassment': 'Harassment / hate',
        'moderation.opt.cheating': 'Cheating / non-platform work',
        'moderation.opt.other': 'Other',
        'moderation.duplicate': 'You already reported this work.',
        'editor.mode.style':
            '当前：风格化 · ComfyUI ~1MP、4 步、nearest 缩放 · 提交模板 img2img_style',
        'editor.mode.upscale':
            '当前：高清增强 · lanczos + ~2.25MP、12 步（更慢、更吃显存）· 提交模板 image_upscale',
        'editor.mode.background':
            '当前：背景重绘 · CFG 1.22、8 步 · 提交模板 background_repaint（请配合背景类描述）',
        'editor.mode.jewelry_retouch':
            'Mode: Jewelry polish · lanczos ~1.15MP, 6 steps, CFG 1.06 · template jewelry_retouch',
        'editor.mode.jewelry_cutout':
            'Mode: Cutout / white BG · 10 steps, CFG 1.30 · template jewelry_product_cutout',
        'editor.mode.jewelry_scene':
            'Mode: Lifestyle scene · ~1.25MP, 9 steps, CFG 1.20 · template jewelry_scene',
        'editor.mode.jewelry_macro':
            'Mode: Macro detail · ~2.25MP, 14 steps · template jewelry_macro_detail',
        'footer.terms': 'Terms of Service',
        'footer.privacy': 'Privacy Policy',
        'footer.icp':
            'Operator: 北京刻熵科技有限责任公司 · Contact: 24373054@buaa.edu.cn',
        'footer.copyPrefix': '©',
        'footer.brand': 'ImageForge',
        'footer.tagline': 'Image editing & generation'
    },
    zh: {
        title: 'ImageForge Web',
        'status.checking': '检查中...',
        'status.ready': '就绪',
        'status.offline': '离线',
        'tabs.edit': '编辑图片',
        'tabs.generate': '生成图片',
        'auth.title': '登录',
        'auth.lead': '使用邮箱注册或登录；支持密码与邮箱验证码两种方式。',
        'auth.tabLogin': '登录',
        'auth.tabRegister': '注册',
        'auth.tabForgot': '找回密码',
        'auth.email': '邮箱',
        'auth.username': '用户名',
        'auth.password': '密码',
        'auth.newPassword': '新密码',
        'auth.code': '验证码',
        'auth.modePassword': '密码登录',
        'auth.modeCode': '验证码登录',
        'auth.sendCode': '发送登录验证码',
        'auth.sendRegCode': '发送注册验证码',
        'auth.sendResetCode': '发送重置验证码',
        'auth.login': '登录',
        'auth.register': '注册',
        'auth.resetPassword': '重置密码',
        'auth.registerBonus': '首次注册成功后赠送 30 积分。',
        'auth.logout': '退出',
        'auth.legacyToggle': '使用旧版邀请码',
        'auth.legacyCode': '邀请码',
        'auth.legacySubmit': '提交邀请码',
        'auth.placeholder': '邀请码',
        'auth.submit': '提交',
        'auth.error': '操作失败，请检查输入或稍后重试',
        'auth.needEmail': '请先填写有效邮箱地址。',
        'auth.serverHtmlError':
            '接口返回了网页而不是 JSON：多半是 38024 上仍是旧版 Node，或新进程因端口被占用没起来。请执行 `./ptp-daemon.sh restart`（脚本会释放端口），并查看 `ptp-daemon.log` 是否还有 EADDRINUSE。',
        'cookies.title': 'Cookie 与隐私',
        'cookies.body':
            '我们使用必要的会话 Cookie 保持您的登录状态。点击同意即表示您了解并继续。',
        'cookies.accept': '同意并继续',
        'credits.cost': '消耗：',
        'credits.unit': '积分',
        'credits.insufficient': '积分不足，请升级订阅方案',
        'plans.title': '订阅方案',
        'plans.current': '当前方案',
        'plans.upgrade': '升级',
        'plans.perMonth': '/月',
        'plans.creditsPerMonth': '积分/月',
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
        'generate.gridMode': '四宫格模式 (4 GPU并行)',
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
        'error.invalidSteps': '步数必须在 1 到 50 之间',
        'nav.home': '首页',
        'nav.editor': '创作',
        'nav.history': '历史',
        'nav.topics': '挑战',
        'nav.admin': '工作台',
        'nav.settings': '设置',
        'auth.portalUser': '用户入口',
        'auth.portalAdmin': '管理员入口',
        'admin.title': '管理工作台',
        'admin.hint': '需使用「管理员入口」登录；脚本或自动化可带 X-Admin-Key 调用接口。',
        'admin.refresh': '刷新数据',
        'admin.reports': '待处理举报',
        'admin.settle': '待结算话题',
        'admin.resolve': '结案',
        'admin.runSettle': '执行结算',
        'admin.settleOk': '已结算',
        'admin.loadFailed': '加载管理数据失败',
        'admin.topicsTitle': '话题与作品（含隐藏）',
        'admin.topicsHint': '完整描述、规则与全部状态的作品；仅管理员可见。',
        'admin.ledgerTitle': '积分流水（全站）',
        'admin.postInspectTitle': '作品详情（管理员）',
        'admin.closeInspect': '关闭',
        'admin.loadPosts': '加载作品列表',
        'admin.viewFull': '查看全文',
        'admin.viewReportedPost': '查看被举报作品',
        'admin.commentsHeading': '评论',
        'admin.promptSummary': '提示词摘要',
        'admin.historyProof': 'historyProof（JSON）',
        'home.card.style.title': '风格化修图',
        'home.card.style.desc': '自然语言编辑 + Flux2 工作流',
        'home.card.upscale.title': '高清增强',
        'home.card.upscale.desc': '服务端：lanczos 放大 + 约 2.25MP、12 步 Flux2（非仅提示词）',
        'home.card.bg.title': '背景重绘',
        'home.card.bg.desc': '服务端：提高 CFG + 8 步，请配合背景类描述',
        'home.card.history.title': '历史记录',
        'home.card.history.desc': '本机保存的成功任务，无 GPU 也可回看',
        'home.card.settings.title': '服务设置',
        'home.card.settings.desc': '健康检查与版本',
        'home.card.jewelry.retouch.title': '珠宝精修',
        'home.card.jewelry.retouch.desc': '金属与火彩 · jewelry_retouch',
        'home.card.jewelry.cutout.title': '抠图白底',
        'home.card.jewelry.cutout.desc': '干净边缘 · jewelry_product_cutout',
        'home.card.jewelry.scene.title': '场景合成',
        'home.card.jewelry.scene.desc': '轻奢布景 · jewelry_scene',
        'home.card.jewelry.macro.title': '微距细节',
        'home.card.jewelry.macro.desc': '商用放大 · jewelry_macro_detail',
        'jewelry.panelTitle': '珠宝商拍选项',
        'jewelry.category': '品类构图提示（写入提示词前缀）',
        'jewelry.scenes': '场景快捷句',
        'jewelry.export': '导出尺寸（白底 contain）',
        'jewelry.padding': '白边留白',
        'jewelry.watermark': '水印文字',
        'jewelry.wmPlaceholder': '品牌缩写',
        'jewelry.batchTitle': '批量队列',
        'jewelry.batchPick': '选择多张',
        'jewelry.batchClear': '清空',
        'jewelry.batchRun': '顺序处理',
        'jewelry.quickHint': '不用写长提示词，点选品类后上传即可；导出与批量收在下方折叠里。',
        'jewelry.injectHint':
            '所选「品类」会作为构图提示前缀拼入每次珠宝编辑请求；「布景光感」仅在「场景合成」模式下追加在模板提示之后，与提交到 /api/edit 的 prompt 字段一致。',
        'jewelry.pickCategory': '品类',
        'jewelry.pickScene': '布景光感',
        'jewelry.advancedTitle': '导出、排除与批量',
        'jewelry.demo.eyebrow': '效果示意',
        'jewelry.demo.title': '这个模式在做什么',
        'jewelry.demo.before': '常见实拍',
        'jewelry.demo.after': '目标商拍',
        'jewelry.demo.caption.jewelry_retouch':
            '真机样张：Flux2 文生图「偏灰实拍感底图」→ 本服务 jewelry_retouch 图生图缩略图；与线上一致。可运行 npm run generate:jewelry-demos 重新生成。',
        'jewelry.demo.caption.jewelry_cutout':
            '真机样张：文生图杂乱台面底图 → jewelry_product_cutout 抠白底；您上传后走同一套接口。',
        'jewelry.demo.caption.jewelry_scene':
            '真机样张：文生图平淡灰底 → jewelry_scene + 深蓝绒布布景句；创作页可换布景芯片。',
        'jewelry.demo.caption.jewelry_macro':
            '真机样张：文生图主体略小略软 → jewelry_macro_detail 微距增强路径。',
        'edit.samples': '样例图',
        'edit.sampleWarm': '暖色渐变',
        'edit.sampleCool': '冷色渐变',
        'edit.sampleNeutral': '中性灰',
        'edit.negativeLabel': '排除内容（可选）',
        'edit.negativePlaceholder': '例如：多余手指、水印、文字',
        'edit.negativeHint': '将作为排除说明附加在提示词后发送给模型。',
        'compare.before': '原图',
        'compare.after': '结果',
        'result.regenerate': '再次生成',
        'task.cancel': '取消',
        'task.timeout': '任务超时，请重试或查看历史记录。',
        'task.cancelled': '已取消',
        'history.title': '历史记录',
        'history.hint': '仅保存在本浏览器。',
        'history.empty': '暂无已完成任务。',
        'history.detailTitle': '任务详情',
        'history.openEditor': '在创作中打开',
        'history.close': '关闭',
        'community.title': '话题挑战',
        'community.subtitle': '限时活动 · 仅本平台生成作品 · 公开展示含 AI 标识',
        'community.loading': '加载中…',
        'community.back': '返回',
        'community.sort.latest': '最新',
        'community.sort.hot': '热度',
        'community.sort.rank': '排名',
        'community.leaderboard': '排行榜',
        'community.publish': '发布到话题',
        'community.publishTitle': '发布到话题',
        'community.publishHint':
            '仅当输出仍保存在本服务器上时可投稿；每个话题每账号限一件作品。',
        'community.pickTopic': '选择话题',
        'community.caption': '作品说明',
        'community.captionPh': '一句话介绍你的作品',
        'community.publicPrompt': '公开提示词摘要',
        'community.submit': '投稿',
        'community.cancel': '取消',
        'community.aiBadge': 'AI',
        'community.comments': '评论',
        'community.openDetail': '详情',
        'community.postDetail': '作品详情',
        'community.yourComment': '你的评论',
        'community.commentPh': '友善、具体的反馈更受欢迎…',
        'community.sendComment': '发送',
        'community.needLogin': '请先登录后再操作。',
        'community.submitted': '投稿成功。',
        'community.alreadySubmitted': '您已在本话题投过稿。',
        'community.workflowRejected': '当前作品工作流不符合该话题要求。',
        'community.fileMissing': '服务器上找不到该输出文件（请在本机重新生成后再投）。',
        'community.sortLabel': '排序',
        'community.fav': '收藏',
        'settings.healthTitle': '连通性',
        'settings.healthDesc': '检测本 Web 服务与 ComfyUI（服务端转发）。',
        'settings.refreshHealth': '执行健康检查',
        'settings.versionTitle': '版本信息',
        'settings.archTitle': '架构说明',
        'settings.archBody': '浏览器只访问本 Node 服务；ComfyUI 由服务端连接，可与鸿蒙端对齐同一套 API。',
        'settings.demoTitle': '演示兜底',
        'settings.demoBody': 'GPU 不可用时，用历史记录回看已成功输出。',
        'settings.dataTitle': '本地数据',
        'settings.clearHistory': '清空全部历史',
        'settings.ledgerTitle': '积分流水',
        'settings.ledgerHint': '含活动结算后的奖励入账（需登录）。生成消耗见历史任务。',
        'settings.refreshLedger': '刷新流水',
        'settings.ledgerLogin': '登录后可查看积分流水。',
        'home.card.topics.title': '话题挑战',
        'home.card.topics.desc': '限时主题、榜单与奖励积分',
        'moderation.reportTitle': '举报该作品',
        'moderation.notePh': '可选补充说明（最多约 2000 字）',
        'moderation.submit': '提交举报',
        'moderation.done': '已收到举报，感谢反馈。',
        'moderation.opt.spam': '垃圾 / 低质',
        'moderation.opt.copyright': '版权 / 肖像权',
        'moderation.opt.illegal': '违法违规',
        'moderation.opt.harassment': '骚扰 / 仇恨',
        'moderation.opt.cheating': '作弊 / 非本平台作品',
        'moderation.opt.other': '其他',
        'moderation.duplicate': '您已举报过该作品。',
        'editor.mode.style':
            '当前：风格化 · ComfyUI 约 1MP、4 步、nearest 缩放 · 提交模板 img2img_style',
        'editor.mode.upscale':
            '当前：高清增强 · lanczos + 约 2.25MP、12 步（更慢、更吃显存）· 提交模板 image_upscale',
        'editor.mode.background':
            '当前：背景重绘 · CFG 1.22、8 步 · 提交模板 background_repaint（请配合背景类描述）',
        'editor.mode.jewelry_retouch':
            '当前：珠宝精修 · lanczos ~1.15MP、6 步、CFG 1.06 · 模板 jewelry_retouch',
        'editor.mode.jewelry_cutout':
            '当前：抠图白底 · 10 步、CFG 1.30 · 模板 jewelry_product_cutout',
        'editor.mode.jewelry_scene':
            '当前：场景合成 · ~1.25MP、9 步、CFG 1.20 · 模板 jewelry_scene',
        'editor.mode.jewelry_macro':
            '当前：微距细节 · ~2.25MP、14 步 · 模板 jewelry_macro_detail',
        'footer.terms': '服务条款',
        'footer.privacy': '隐私政策',
        'footer.icp':
            '主办单位：北京刻熵科技有限责任公司 · 联系邮箱：24373054@buaa.edu.cn',
        'footer.copyPrefix': '©',
        'footer.brand': 'ImageForge',
        'footer.tagline': '图像编辑与生成服务'
    }
};

function absUrl(rel) {
    if (!rel) return '';
    if (rel.startsWith('http')) return rel;
    return new URL(rel, window.location.origin).href;
}

function readHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (_) {
        return [];
    }
}

function writeHistory(arr) {
    localStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(arr.slice(0, HISTORY_LIMIT))
    );
}

function showForgePage(page) {
    const map = {
        home: 'pageHome',
        editor: 'pageEditor',
        history: 'pageHistory',
        settings: 'pageSettings',
        topics: 'pageTopics',
        topicDetail: 'pageTopicDetail',
        admin: 'pageAdmin'
    };
    document.querySelectorAll('.forge-page').forEach((el) => el.classList.add('hidden'));
    const id = map[page];
    if (id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('hidden');
    }
    if (forgeNav) {
        forgeNav.querySelectorAll('button').forEach((b) => {
            const active =
                b.dataset.page === page ||
                (page === 'topicDetail' && b.dataset.page === 'topics');
            b.classList.toggle('active', active);
        });
    }
    if (page === 'history') renderHistoryList();
    if (page === 'settings') loadSettingsPanel();
    if (page === 'topics') loadTopicsList();
    if (page === 'admin') loadAdminPanel();
    if (page === 'topicDetail' && communityTopicId) {
        loadTopicDetailPage(communityTopicId);
    }
    if (page === 'editor' && editMode && editMode.classList.contains('active')) {
        updateEditModeBanner();
        updateJewelryFlowLayout();
    }
}

/** 创作页顶部：标明当前 workflowTemplate 与 Comfy 侧真实差异（样式统一为中性材质） */
function updateEditModeBanner() {
    const el = document.getElementById('editModeBanner');
    if (!el) return;
    const keyMap = {
        upscale: 'editor.mode.upscale',
        background: 'editor.mode.background',
        style: 'editor.mode.style',
        jewelry_retouch: 'editor.mode.jewelry_retouch',
        jewelry_cutout: 'editor.mode.jewelry_cutout',
        jewelry_scene: 'editor.mode.jewelry_scene',
        jewelry_macro: 'editor.mode.jewelry_macro'
    };
    const key = keyMap[editIntentTask] || 'editor.mode.style';
    el.textContent = i18n[currentLang][key] || '';
}

function applyHomeTaskIntent(task) {
    editIntentTask = task || 'style';

    if (task === 'jewelry_scene' && forgePresets && forgePresets.jewelryScenePacks && forgePresets.jewelryScenePacks.length) {
        const langKey = currentLang === 'zh' ? 'zh' : 'en';
        const first = forgePresets.jewelryScenePacks[0];
        jewelrySceneSnippet = first.prompt[langKey] || first.prompt.en || '';
        jewelrySelectedSceneId = first.id;
    } else {
        jewelrySceneSnippet = '';
        jewelrySelectedSceneId = '';
    }

    if (forgePresets && forgePresets.editPresets && !isJewelryIntent()) {
        const langKey = currentLang === 'zh' ? 'zh' : 'en';
        const ep = forgePresets.editPresets;
        let extra = '';
        if (task === 'upscale' && ep.upscale_main)
            extra = ep.upscale_main.prompt[langKey] || '';
        else if (task === 'background' && ep.background_main)
            extra = ep.background_main.prompt[langKey] || '';
        if (extra) {
            const cur = promptInput.value.trim();
            promptInput.value = cur ? `${cur}\n${extra}` : extra;
        }
    }

    renderEditPresetChips();
    populateJewelryUi();
    updateEditModeBanner();
    updateJewelryFlowLayout();
    renderBatchFileList();
    updateEditButton();
}

function buildJewelryCategoryPrefix() {
    if (!isJewelryIntent() || !forgePresets || !forgePresets.jewelryProductCategories) {
        return '';
    }
    const cat = forgePresets.jewelryProductCategories.find((c) => c.id === jewelryCategoryId);
    if (!cat || !cat.promptHint) return '';
    const langKey = currentLang === 'zh' ? 'zh' : 'en';
    const hint = cat.promptHint[langKey] || cat.promptHint.en;
    const name = cat.name[langKey] || cat.name.en;
    if (!hint) return '';
    return currentLang === 'zh' ? `【${name}】${hint}\n` : `[${name}] ${hint}\n`;
}

function buildPostProcessPayload() {
    const out = {};
    const padEl = document.getElementById('jewelryPadRange');
    if (padEl && Number(padEl.value) > 0) {
        out.paddingRatio = Number(padEl.value) / 100;
    }
    const expSel = document.getElementById('jewelryExportSelect');
    if (expSel && expSel.value && forgePresets && forgePresets.exportPresets) {
        const preset = forgePresets.exportPresets.find((x) => x.id === expSel.value);
        if (preset && preset.width && preset.height) {
            out.export = { width: preset.width, height: preset.height };
        }
    }
    const wmChk = document.getElementById('jewelryWmCheck');
    const wmTxt = document.getElementById('jewelryWmText');
    if (wmChk && wmChk.checked && wmTxt && wmTxt.value.trim()) {
        out.watermark = { text: wmTxt.value.trim(), opacity: 0.38 };
    }
    return Object.keys(out).length ? out : null;
}

function fileToDataUrl(file) {
    return new Promise((resolve) => {
        if (!file) return resolve(null);
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => resolve(null);
        r.readAsDataURL(file);
    });
}

function getEditPresetChipKeys() {
    if (isJewelryIntent()) return [];
    return ['style_portrait', 'style_vintage', 'style_id'];
}

const JEWELRY_DEMO_SLUG = {
    jewelry_retouch: 'retouch',
    jewelry_cutout: 'cutout',
    jewelry_scene: 'scene',
    jewelry_macro: 'macro'
};
/** 与 tools/generate-jewelry-demos.mjs 产出同步；更新资源后 bump 以破缓存 */
const JEWELRY_DEMO_ASSET_VER = '20260501';

function syncJewelryDemoImages() {
    const beforeImg = document.getElementById('jewelryDemoBefore');
    const afterImg = document.getElementById('jewelryDemoAfter');
    if (!beforeImg || !afterImg) return;
    const slug = JEWELRY_DEMO_SLUG[editIntentTask];
    if (!slug) return;
    const q = `?v=${encodeURIComponent(JEWELRY_DEMO_ASSET_VER)}`;
    const fallback = () => {
        beforeImg.onerror = null;
        afterImg.onerror = null;
        refreshJewelryDemoArt();
    };
    beforeImg.onerror = fallback;
    afterImg.onerror = fallback;
    beforeImg.src = `${apiUrl(`/assets/jewelry-demo/thumb-before-${slug}.jpg`)}${q}`;
    afterImg.src = `${apiUrl(`/assets/jewelry-demo/thumb-after-${slug}.jpg`)}${q}`;
}

function syncJewelryDemoCaption() {
    const cap = document.getElementById('jewelryDemoCaption');
    if (!cap) return;
    const key = `jewelry.demo.caption.${editIntentTask}`;
    cap.textContent = i18n[currentLang][key] || '';
}

function paintJewelryDemoBefore(ctx, w, h) {
    const g = ctx.createRadialGradient(w * 0.35, h * 0.25, 0, w * 0.5, h * 0.55, w * 0.95);
    g.addColorStop(0, '#5c4033');
    g.addColorStop(0.35, '#a08060');
    g.addColorStop(0.65, '#7a8aaa');
    g.addColorStop(1, '#2a1e18');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2800; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.07})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2);
    }
    drawJewelryDemoPiece(ctx, w, h, false);
}

function paintJewelryDemoAfter(ctx, w, h) {
    ctx.fillStyle = '#f4f3f0';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.14)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 14;
    drawJewelryDemoPiece(ctx, w, h, true);
    ctx.restore();
}

function drawJewelryDemoPiece(ctx, w, h, clean) {
    const cx = w / 2;
    const cy = h / 2 + 8;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.28);
    const rg = ctx.createLinearGradient(-55, -40, 55, 55);
    rg.addColorStop(0, '#efe2c2');
    rg.addColorStop(0.4, '#f7efd8');
    rg.addColorStop(0.55, '#c4a05a');
    rg.addColorStop(1, '#7d6238');
    ctx.strokeStyle = rg;
    ctx.lineWidth = clean ? 12 : 13;
    ctx.beginPath();
    ctx.ellipse(0, 0, 78, 54, 0, 0, Math.PI * 2);
    ctx.stroke();
    const gg = ctx.createRadialGradient(-10, -22, 2, 0, -14, 26);
    gg.addColorStop(0, '#ffffff');
    gg.addColorStop(0.3, '#dde8ff');
    gg.addColorStop(0.65, '#6b8cc9');
    gg.addColorStop(1, '#3a5080');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.moveTo(0, -42);
    ctx.lineTo(20, -22);
    ctx.lineTo(0, 4);
    ctx.lineTo(-20, -22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function refreshJewelryDemoArt() {
    const beforeImg = document.getElementById('jewelryDemoBefore');
    const afterImg = document.getElementById('jewelryDemoAfter');
    if (!beforeImg || !afterImg) return;
    const w = 440;
    const h = 440;
    const c1 = document.createElement('canvas');
    c1.width = w;
    c1.height = h;
    const c2 = document.createElement('canvas');
    c2.width = w;
    c2.height = h;
    paintJewelryDemoBefore(c1.getContext('2d'), w, h);
    paintJewelryDemoAfter(c2.getContext('2d'), w, h);
    beforeImg.src = c1.toDataURL('image/jpeg', 0.92);
    afterImg.src = c2.toDataURL('image/jpeg', 0.92);
}

function updateJewelryFlowLayout() {
    const j = isJewelryIntent();
    const demo = document.getElementById('jewelryDemoStrip');
    const classic = document.getElementById('classicPromptBlock');
    const quick = document.getElementById('jewelryQuickStrip');
    const adv = document.getElementById('jewelryAdvancedPanel');
    const sceneRow = document.getElementById('jewelrySceneRow');
    const presetBar = document.getElementById('editPresetBar');
    const sampleRow = document.querySelector('#editMode .sample-row');

    if (editMode) editMode.classList.toggle('jewelry-flow', j);
    if (demo) demo.classList.toggle('hidden', !j);
    if (classic) classic.classList.toggle('hidden', j);
    if (quick) quick.classList.toggle('hidden', !j);
    if (adv) adv.classList.toggle('hidden', !j);
    if (sceneRow) sceneRow.classList.toggle('hidden', !j || editIntentTask !== 'jewelry_scene');
    if (presetBar) presetBar.classList.toggle('hidden', j);
    if (sampleRow) sampleRow.classList.toggle('hidden', j);

    if (j) {
        syncJewelryDemoImages();
        syncJewelryDemoCaption();
        renderJewelrySceneChips();
    }
}

function populateJewelryUi() {
    const lang = currentLang === 'zh' ? 'zh' : 'en';
    renderJewelryCategoryChips();
    const expSel = document.getElementById('jewelryExportSelect');
    if (expSel) {
        const prev = expSel.value;
        const list = Array.isArray(forgePresets.exportPresets)
            ? forgePresets.exportPresets
            : [];
        expSel.innerHTML = '';
        const o0 = document.createElement('option');
        o0.value = '';
        o0.textContent =
            currentLang === 'zh' ? '不缩放（仅 Comfy 输出）' : 'No resize (Comfy output only)';
        expSel.appendChild(o0);
        list.forEach((p) => {
            const o = document.createElement('option');
            o.value = p.id;
            o.textContent = `${p.name[lang] || p.name.en} (${p.width}×${p.height})`;
            expSel.appendChild(o);
        });
        if (prev && [...expSel.options].some((opt) => opt.value === prev)) {
            expSel.value = prev;
        }
    }
    renderJewelrySceneChips();
}

function renderJewelryCategoryChips() {
    const bar = document.getElementById('jewelryCategoryBar');
    if (!bar || !forgePresets || !forgePresets.jewelryProductCategories) return;
    const lang = currentLang === 'zh' ? 'zh' : 'en';
    bar.innerHTML = '';
    forgePresets.jewelryProductCategories.forEach((c) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className =
            'jewelry-cat-chip' + (c.id === jewelryCategoryId ? ' jewelry-cat-chip--active' : '');
        b.textContent = c.name[lang] || c.name.en;
        b.addEventListener('click', () => {
            jewelryCategoryId = c.id;
            renderJewelryCategoryChips();
            updateEditButton();
        });
        bar.appendChild(b);
    });
}

function renderJewelrySceneChips() {
    const bar = document.getElementById('jewelrySceneBar');
    if (!bar || !forgePresets || !forgePresets.jewelryScenePacks) return;
    if (editIntentTask !== 'jewelry_scene') {
        bar.innerHTML = '';
        return;
    }
    const lang = currentLang === 'zh' ? 'zh' : 'en';
    bar.innerHTML = '';
    forgePresets.jewelryScenePacks.forEach((pack) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className =
            'scene-chip' +
            (jewelrySelectedSceneId === pack.id ? ' scene-chip--active' : '');
        btn.textContent = pack.name[lang] || pack.name.en;
        btn.addEventListener('click', () => {
            jewelrySceneSnippet = pack.prompt[lang] || pack.prompt.en || '';
            jewelrySelectedSceneId = pack.id;
            renderJewelrySceneChips();
            updateEditButton();
            renderBatchFileList();
        });
        bar.appendChild(btn);
    });
}

function renderBatchFileList() {
    const ul = document.getElementById('batchFileList');
    const runBtn = document.getElementById('batchRunBtn');
    if (!ul) return;
    ul.innerHTML = '';
    batchQueue.forEach((f, i) => {
        const li = document.createElement('li');
        li.textContent = `${i + 1}. ${f.name}`;
        ul.appendChild(li);
    });
    if (runBtn) {
        runBtn.disabled =
            batchQueue.length === 0 || !hasValidEditPromptCore() || !currentUser;
    }
}

/** 不含 negative 附加句，用于判断主提示是否已可由程序拼出 */
function hasValidEditPromptCore() {
    let body;
    if (isJewelryIntent()) {
        const parts = [
            buildJewelryCategoryPrefix(),
            buildJewelryAutoBasePrompt(),
            editIntentTask === 'jewelry_scene' ? jewelrySceneSnippet : ''
        ].filter(Boolean);
        body = parts.join('\n').trim();
    } else {
        body = promptInput.value.trim();
    }
    return body.length > 0;
}

function buildJewelryAutoBasePrompt() {
    if (!isJewelryIntent() || !forgePresets || !forgePresets.editPresets) return '';
    const langKey = currentLang === 'zh' ? 'zh' : 'en';
    const ep = forgePresets.editPresets;
    let key;
    if (editIntentTask === 'jewelry_cutout') key = 'jewelry_white_pure';
    else if (editIntentTask === 'jewelry_scene') key = 'background_main';
    else if (editIntentTask === 'jewelry_macro') key = 'upscale_main';
    else if (editIntentTask === 'jewelry_retouch') key = 'jewelry_metal_fire';
    if (!key || !ep[key]) return '';
    return ep[key].prompt[langKey] || ep[key].prompt.en || '';
}

function buildEditPromptForRequest() {
    let t;
    if (isJewelryIntent()) {
        const parts = [
            buildJewelryCategoryPrefix(),
            buildJewelryAutoBasePrompt(),
            editIntentTask === 'jewelry_scene' ? jewelrySceneSnippet : ''
        ].filter(Boolean);
        t = parts.join('\n').trim();
    } else {
        t = promptInput.value.trim();
    }
    const neg = getNegativeForEdit();
    if (neg) {
        t +=
            currentLang === 'zh'
                ? `\n\n（请避免出现或弱化：${neg}）`
                : `\n\n(Avoid or de-emphasize: ${neg})`;
    }
    return t.trim();
}

function summarizeEditPromptForDisplay() {
    if (isJewelryIntent()) {
        const parts = [
            buildJewelryCategoryPrefix().replace(/\n$/, ''),
            buildJewelryAutoBasePrompt().slice(0, 120),
            editIntentTask === 'jewelry_scene' ? jewelrySceneSnippet.slice(0, 120) : ''
        ].filter(Boolean);
        return parts.join(' · ').slice(0, 400);
    }
    return promptInput.value.trim().slice(0, 400);
}

function resetResultPresentation() {
    if (resultMetaSummary) {
        resultMetaSummary.classList.add('hidden');
        resultMetaSummary.textContent = '';
    }
    if (compareBox) compareBox.classList.add('hidden');
    compareBeforeDataUrl = null;
    currentOriginalImage = null;
}

function setResultMeta(lines) {
    if (!resultMetaSummary) return;
    resultMetaSummary.textContent = lines.filter(Boolean).join('\n');
    resultMetaSummary.classList.remove('hidden');
}

function setCompareAfterEdit(beforeDataUrl, outThumbOrUrl, outFullUrl) {
    if (!compareBox || !compareImgBefore || !compareImgAfter) return;
    if (beforeDataUrl && outThumbOrUrl) {
        compareImgBefore.src = beforeDataUrl;
        compareImgAfter.src = absUrl(outThumbOrUrl);
        compareBox.classList.remove('hidden');
    } else {
        compareBox.classList.add('hidden');
    }
}

async function registerHistoryEntry(entry) {
    lastCompletedHistoryEntry = entry;
    const arr = readHistory();
    arr.unshift(entry);
    writeHistory(arr);
}

function renderHistoryList() {
    if (!historyList || !historyEmpty) return;
    const arr = readHistory().filter((x) => x.status === 'done');
    historyList.innerHTML = '';
    if (!arr.length) {
        historyEmpty.classList.remove('hidden');
        return;
    }
    historyEmpty.classList.add('hidden');
    arr.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'history-card';
        const thumb = document.createElement('img');
        thumb.src = absUrl(item.thumbRel || item.outRel);
        thumb.alt = '';
        const body = document.createElement('div');
        body.className = 'hc-body';
        const l1 = document.createElement('div');
        l1.className = 'hc-line1';
        l1.textContent = item.prompt || item.taskType || '—';
        const l2 = document.createElement('div');
        l2.className = 'hc-line2';
        l2.textContent = `${item.mode || ''} · ${item.taskType || ''} · ${item.at || ''}`;
        body.appendChild(l1);
        body.appendChild(l2);
        card.appendChild(thumb);
        card.appendChild(body);
        card.addEventListener('click', () => openHistoryModal(item));
        historyList.appendChild(card);
    });
}

let historyModalItem = null;

function openHistoryModal(item) {
    historyModalItem = item;
    if (!historyModal) return;
    historyModal.classList.remove('hidden');
    historyModalMeta.textContent = [
        `mode: ${item.mode}`,
        `task: ${item.taskType}`,
        `at: ${item.at}`,
        `prompt: ${item.prompt || '—'}`,
        item.params && Object.keys(item.params).length
            ? `params: ${JSON.stringify(item.params)}`
            : ''
    ]
        .filter(Boolean)
        .join('\n');
    const afterSrc = absUrl(item.outRel);
    historyModalAfter.src = afterSrc;
    const colBefore =
        historyModalBefore && historyModalBefore.closest('.compare-col');
    if (item.inThumbDataUrl && colBefore) {
        historyModalBefore.src = item.inThumbDataUrl;
        colBefore.style.display = '';
    } else if (colBefore) {
        historyModalBefore.removeAttribute('src');
        colBefore.style.display = 'none';
    }
}

function closeHistoryModal() {
    if (historyModal) historyModal.classList.add('hidden');
    historyModalItem = null;
}

async function loadForgePresets() {
    let raw = null;
    try {
        const r = await apiFetch(apiUrl('/api/presets'));
        if (r.ok) raw = await r.json();
    } catch (_) {
        raw = null;
    }
    const jewelryLooksEmpty =
        !raw ||
        typeof raw !== 'object' ||
        !Array.isArray(raw.jewelryProductCategories) ||
        raw.jewelryProductCategories.length === 0 ||
        !Array.isArray(raw.jewelryScenePacks) ||
        raw.jewelryScenePacks.length === 0;
    if (jewelryLooksEmpty) {
        try {
            const r2 = await apiFetch(apiUrl('/workflows/presets.json'));
            if (r2.ok) {
                const alt = await r2.json();
                if (
                    alt &&
                    typeof alt === 'object' &&
                    Array.isArray(alt.jewelryProductCategories) &&
                    alt.jewelryProductCategories.length > 0
                ) {
                    raw = { ...(typeof raw === 'object' && raw ? raw : {}), ...alt };
                }
            }
        } catch (_) {}
    }
    forgePresets = mergeJewelryUiPresets(raw);
    renderEditPresetChips();
    populateJewelryUi();
    if (typeof editMode !== 'undefined' && editMode && editMode.classList.contains('active')) {
        updateJewelryFlowLayout();
    }
    updateEditButton();
}

function renderEditPresetChips() {
    if (!editPresetBar) return;
    editPresetBar.innerHTML = '';
    if (!forgePresets || !forgePresets.editPresets) return;
    const langKey = currentLang === 'zh' ? 'zh' : 'en';
    const keys = getEditPresetChipKeys();
    keys.forEach((key) => {
        const def = forgePresets.editPresets[key];
        if (!def) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'preset-chip';
        btn.textContent = def.name[langKey] || def.name.en || key;
        btn.addEventListener('click', () => {
            const p = def.prompt[langKey] || def.prompt.en;
            const cur = promptInput.value.trim();
            promptInput.value = cur ? `${cur}\n${p}` : p;
            updateEditButton();
            renderBatchFileList();
        });
        editPresetBar.appendChild(btn);
    });
}

function createSampleFile(kind) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const g = c.getContext('2d');
    let grd;
    if (kind === 'warm')
        grd = g.createLinearGradient(0, 0, c.width, c.height);
    else if (kind === 'cool')
        grd = g.createLinearGradient(0, 0, c.width, c.height);
    else grd = g.createLinearGradient(0, 0, c.width, c.height);
    if (kind === 'warm') {
        grd.addColorStop(0, '#f8e8c8');
        grd.addColorStop(1, '#c87850');
    } else if (kind === 'cool') {
        grd.addColorStop(0, '#c8e8ff');
        grd.addColorStop(1, '#3050a0');
    } else {
        grd.addColorStop(0, '#e8e8e8');
        grd.addColorStop(1, '#888888');
    }
    g.fillStyle = grd;
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.font = '22px sans-serif';
    g.fillText('Sample', 24, 48);
    return new Promise((resolve) => {
        c.toBlob(
            (blob) => {
                if (!blob) return resolve(null);
                resolve(
                    new File([blob], `sample-${kind}.png`, { type: 'image/png' })
                );
            },
            'image/png',
            0.92
        );
    });
}

async function loadSettingsPanel() {
    if (!settingsVersionOut) {
        await loadLedgerPanel();
        return;
    }
    try {
        const url = apiUrl('/api/version');
        const r = await fetch(url);
        if (r.ok) {
            const j = await r.json();
            settingsVersionOut.textContent = JSON.stringify(j, null, 2);
            await loadLedgerPanel();
            return;
        }
        const body = await r.text();
        const isExpressCannotGet =
            typeof body === 'string' && body.includes('Cannot GET /api/version');

        const fbUrl = apiUrl(`/version-info.json?t=${Date.now()}`);
        try {
            const fr = await fetch(fbUrl);
            if (fr.ok) {
                const j = await fr.json();
                settingsVersionOut.textContent = JSON.stringify(
                    {
                        ...j,
                        _note:
                            (isExpressCannotGet
                                ? '当前域名已打到 Express，但进程内未注册 GET /api/version（多为旧版 server.js）。请把本仓库最新 server.js 部署到 ptp.matrixlabs.cn 所用 Node 并重启。'
                                : `GET /api/version 返回 HTTP ${r.status}。`) +
                            ' 以下为 /version-info.json 回退（由新版 server 启动时写入；若仍缺字段请确认已部署并重启）。'
                    },
                    null,
                    2
                );
                await loadLedgerPanel();
                return;
            }
        } catch (_) {
            /* no fallback file */
        }

        let parsed = null;
        try {
            parsed = JSON.parse(body);
        } catch (_) {
            /* ignore */
        }
        const payload = {
            error: r.status,
            url,
            apiBase: getPtpApiBase() || '(同源，未设置 ptp-api-base)',
            hint: isExpressCannotGet
                ? 'Express 返回 Cannot GET /api/version：线上 Node 仍是旧构建。请同步部署含靠前注册的 app.get("/api/version") 的 server.js，或确保 Nginx 将 /api 指向该进程。'
                : r.status === 404
                  ? '404：未找到版本接口。请用最新 server.js 启动 BFF，或在 meta ptp-api-base 指向正确 BFF。'
                  : '版本接口返回非成功状态。'
        };
        if (parsed && typeof parsed === 'object') {
            payload.response = parsed;
        } else if (body) {
            payload.responseBodyPreview = body.slice(0, 500);
        }
        settingsVersionOut.textContent = JSON.stringify(payload, null, 2);
    } catch (e) {
        settingsVersionOut.textContent = String(e.message || e);
    }
    await loadLedgerPanel();
}

async function loadLedgerPanel() {
    const el = document.getElementById('settingsLedgerOut');
    if (!el) return;
    if (!currentUser) {
        el.textContent = i18n[currentLang]['settings.ledgerLogin'];
        return;
    }
    el.textContent = i18n[currentLang]['community.loading'];
    try {
        const r = await apiFetch(apiUrl('/api/auth/point-ledger?pageSize=40'));
        const j = await r.json();
        if (!r.ok || j.code !== 0) throw new Error(j.message || 'ledger');
        el.textContent = JSON.stringify(j.data, null, 2);
    } catch (e) {
        el.textContent = String(e.message || e);
    }
}

async function runHealthToPanel() {
    if (!settingsHealthOut) return;
    settingsHealthOut.textContent = '…';
    try {
        const r = await apiFetch(apiUrl('/api/health'));
        const j = await r.json();
        settingsHealthOut.textContent = JSON.stringify(j, null, 2);
    } catch (e) {
        settingsHealthOut.textContent = String(e.message || e);
    }
}

async function consumeSseStream(response, onData, signal) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = JSON.parse(line.slice(6));
            await onData(data);
        }
    }
}

function shrinkDataUrl(dataUrl, maxW = 320) {
    return new Promise((resolve) => {
        if (!dataUrl || !dataUrl.startsWith('data:')) return resolve(null);
        const im = new Image();
        im.onload = () => {
            try {
                const c = document.createElement('canvas');
                const w = Math.min(maxW, im.width);
                const h = Math.round((im.height * w) / im.width) || 1;
                c.width = w;
                c.height = h;
                c.getContext('2d').drawImage(im, 0, 0, w, h);
                resolve(c.toDataURL('image/jpeg', 0.72));
            } catch (_) {
                resolve(null);
            }
        };
        im.onerror = () => resolve(null);
        im.src = dataUrl;
    });
}

// --- 话题挑战 / 作品社区（Phase 1） ---

function communityEsc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
}

function communityFormatDate(iso) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (_) {
        return String(iso);
    }
}

function buildHistoryProofFromItem(item) {
    if (!item || item.status !== 'done') return null;
    const wf =
        item.mode === 'generate'
            ? 't2i_generate'
            : item.params && item.params.workflowTemplate;
    if (!wf) return null;
    return {
        historyId: item.id,
        at: item.at,
        outRel: item.outRel,
        thumbRel: item.thumbRel,
        workflowTemplate: wf,
        taskType: item.taskType,
        mode: item.mode,
        prompt: item.prompt,
        params: item.params
    };
}

function refreshCommunityUiLang() {
    const td = document.getElementById('pageTopicDetail');
    const tl = document.getElementById('pageTopics');
    if (td && !td.classList.contains('hidden') && communityTopicId) {
        loadTopicDetailPage(communityTopicId);
    } else if (tl && !tl.classList.contains('hidden')) {
        loadTopicsList();
    }
}

async function loadTopicsList() {
    const grid = document.getElementById('topicsListGrid');
    if (!grid) return;
    grid.innerHTML = `<p class="community-loading">${communityEsc(
        i18n[currentLang]['community.loading']
    )}</p>`;
    try {
        const r = await apiFetch(apiUrl('/api/topics?pageSize=40'));
        const body = await r.json();
        if (!r.ok || body.code !== 0) throw new Error(body.message || 'topics');
        const { list } = body.data;
        grid.innerHTML = '';
        if (!list.length) {
            grid.innerHTML = `<p class="empty-hint">${communityEsc(
                i18n[currentLang]['history.empty']
            )}</p>`;
            return;
        }
        list.forEach((t) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'topic-card';
            card.innerHTML = `
                <span class="topic-card-tag">${communityEsc(t.tag)}</span>
                <span class="topic-card-title">${communityEsc(t.title)}</span>
                <span class="topic-card-meta">${communityEsc(
                    `${t.postCount || 0} · ${communityFormatDate(t.endAt)}`
                )}</span>`;
            card.addEventListener('click', () => {
                communityTopicId = t.id;
                showForgePage('topicDetail');
            });
            grid.appendChild(card);
        });
    } catch (e) {
        grid.innerHTML = `<p class="publish-error">${communityEsc(e.message)}</p>`;
    }
}

function updateTopicSortTabs() {
    const tabs = document.getElementById('topicSortTabs');
    if (!tabs) return;
    tabs.querySelectorAll('button[data-sort]').forEach((b) => {
        b.classList.toggle('active', b.dataset.sort === communityPostSort);
    });
}

async function loadTopicDetailPage(topicId) {
    const hero = document.getElementById('topicDetailHero');
    const postsGrid = document.getElementById('topicPostsGrid');
    const rankList = document.getElementById('topicRankingList');
    if (!hero || !postsGrid || !rankList) return;
    updateTopicSortTabs();
    hero.innerHTML = `<p class="community-loading">${communityEsc(
        i18n[currentLang]['community.loading']
    )}</p>`;
    postsGrid.innerHTML = '';
    rankList.innerHTML = '';
    try {
        const [tr, pr, rr] = await Promise.all([
            apiFetch(apiUrl(`/api/topics/${encodeURIComponent(topicId)}`)),
            apiFetch(
                apiUrl(
                    `/api/topics/${encodeURIComponent(topicId)}/posts?sort=${encodeURIComponent(
                        communityPostSort
                    )}&pageSize=40`
                )
            ),
            apiFetch(
                apiUrl(
                    `/api/topics/${encodeURIComponent(topicId)}/ranking?pageSize=15`
                )
            )
        ]);
        const tj = await tr.json();
        const pj = await pr.json();
        const rj = await rr.json();
        if (!tr.ok || tj.code !== 0) throw new Error(tj.message || 'topic');
        const topic = tj.data;
        const submittedLabel = currentLang === 'zh' ? '已投稿' : 'Submitted';
        hero.innerHTML = `
            <h2>${communityEsc(topic.title)}</h2>
            <p class="topic-hero-desc">${communityEsc(topic.description || '')}</p>
            <p class="topic-hero-meta">${communityEsc(
                `${communityFormatDate(topic.startAt)} — ${communityFormatDate(
                    topic.endAt
                )} · ${topic.postCount || 0}`
            )}${
                topic.mySubmitted ? ` · <strong>${submittedLabel}</strong>` : ''
            }</p>
            <p class="topic-hero-meta">${communityEsc(
                `${i18n[currentLang]['community.sortLabel']}: ${(
                    topic.allowedTaskTypes || []
                ).join(', ')}`
            )}</p>`;

        if (!pr.ok || pj.code !== 0) throw new Error(pj.message || 'posts');
        postsGrid.innerHTML = '';
        pj.data.list.forEach((p) => {
            postsGrid.appendChild(renderCommunityPostCard(p));
        });
        if (!pj.data.list.length) {
            postsGrid.innerHTML = `<p class="empty-hint">${communityEsc(
                i18n[currentLang]['history.empty']
            )}</p>`;
        }

        rankList.innerHTML = '';
        if (rj.code === 0 && rj.data && rj.data.list) {
            rj.data.list.slice(0, 15).forEach((row) => {
                const el = document.createElement('div');
                el.className = 'rank-row';
                const n = document.createElement('span');
                n.className = 'rank-num';
                n.textContent = String(row.rank);
                const im = document.createElement('img');
                im.alt = '';
                im.loading = 'lazy';
                im.src = row.imageUrl;
                const txt = document.createElement('div');
                const l1 = document.createElement('div');
                l1.textContent = row.user.nickname;
                const l2 = document.createElement('div');
                l2.style.fontSize = '12px';
                l2.style.color = 'var(--color-text-secondary)';
                l2.textContent = `${row.score} · ♥ ${row.likeCount}`;
                txt.appendChild(l1);
                txt.appendChild(l2);
                el.appendChild(n);
                el.appendChild(im);
                el.appendChild(txt);
                rankList.appendChild(el);
            });
        }
    } catch (e) {
        hero.innerHTML = `<p class="publish-error">${communityEsc(e.message)}</p>`;
    }
}

function fillReportReasonSelect(force) {
    const sel = document.getElementById('reportReason');
    if (!sel) return;
    if (!force && sel.dataset.langFill === currentLang) return;
    sel.innerHTML = '';
    const specs = [
        ['spam', 'moderation.opt.spam'],
        ['copyright', 'moderation.opt.copyright'],
        ['illegal', 'moderation.opt.illegal'],
        ['harassment', 'moderation.opt.harassment'],
        ['cheating', 'moderation.opt.cheating'],
        ['other', 'moderation.opt.other']
    ];
    for (const [v, k] of specs) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = i18n[currentLang][k];
        sel.appendChild(o);
    }
    sel.dataset.langFill = currentLang;
}

function updatePostDetailFavUI(btn, favorited, count) {
    if (!btn) return;
    btn.classList.toggle('is-fav', !!favorited);
    const n = count != null ? count : 0;
    btn.textContent = favorited ? `★ ${n}` : `☆ ${n}`;
}

function renderCommunityPostCard(p) {
    const card = document.createElement('div');
    card.className = 'post-card';
    const wrap = document.createElement('div');
    wrap.className = 'post-card-img-wrap';
    const img = document.createElement('img');
    img.src = p.imageUrl;
    img.alt = '';
    img.loading = 'lazy';
    const badge = document.createElement('span');
    badge.className = 'post-ai-badge';
    badge.textContent = i18n[currentLang]['community.aiBadge'];
    wrap.appendChild(img);
    wrap.appendChild(badge);
    const body = document.createElement('div');
    body.className = 'post-card-body';
    const cap = document.createElement('div');
    cap.className = 'post-card-cap';
    cap.textContent = p.caption || '—';
    const meta = document.createElement('div');
    meta.className = 'post-card-meta';
    const who = document.createElement('span');
    who.textContent = p.user.nickname;
    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'post-open-btn';
    openBtn.textContent = i18n[currentLang]['community.openDetail'];
    openBtn.dataset.postOpen = p.id;
    const likeBtn = document.createElement('button');
    likeBtn.type = 'button';
    likeBtn.className = `post-like-btn${p.liked ? ' is-liked' : ''}`;
    likeBtn.dataset.postId = p.id;
    likeBtn.dataset.liked = p.liked ? '1' : '0';
    likeBtn.textContent = `♥ ${p.likeCount}`;
    if (!currentUser) likeBtn.disabled = true;
    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = `post-fav-btn${p.favorited ? ' is-fav' : ''}`;
    favBtn.dataset.favPost = p.id;
    favBtn.textContent = p.favorited ? `★ ${p.favoriteCount}` : `☆ ${p.favoriteCount}`;
    if (!currentUser) favBtn.disabled = true;
    meta.appendChild(who);
    meta.appendChild(openBtn);
    meta.appendChild(favBtn);
    meta.appendChild(likeBtn);
    body.appendChild(cap);
    body.appendChild(meta);
    card.appendChild(wrap);
    card.appendChild(body);
    return card;
}

function wireCommunityPostGridDelegation() {
    const postsGrid = document.getElementById('topicPostsGrid');
    if (!postsGrid || postsGrid.dataset.wired === '1') return;
    postsGrid.dataset.wired = '1';
    postsGrid.addEventListener('click', async (e) => {
        const favBtn = e.target.closest('.post-fav-btn[data-fav-post]');
        if (favBtn && !favBtn.disabled) {
            const id = favBtn.getAttribute('data-fav-post');
            const favorited = favBtn.classList.contains('is-fav');
            const method = favorited ? 'DELETE' : 'POST';
            try {
                const r = await apiFetch(apiUrl(`/api/posts/${encodeURIComponent(id)}/favorite`), {
                    method
                });
                const j = await r.json();
                if (!r.ok || j.code !== 0) throw new Error(j.message || 'favorite');
                favBtn.classList.toggle('is-fav', j.data.favorited);
                favBtn.textContent = j.data.favorited
                    ? `★ ${j.data.favoriteCount}`
                    : `☆ ${j.data.favoriteCount}`;
                if (communityTopicId) loadTopicDetailPage(communityTopicId);
            } catch (err) {
                showAlert(err.message || 'favorite');
            }
            return;
        }
        const likeBtn = e.target.closest('.post-like-btn[data-post-id]');
        if (likeBtn && !likeBtn.disabled) {
            const id = likeBtn.getAttribute('data-post-id');
            const liked = likeBtn.getAttribute('data-liked') === '1';
            const method = liked ? 'DELETE' : 'POST';
            try {
                const r = await apiFetch(apiUrl(`/api/posts/${encodeURIComponent(id)}/like`), {
                    method
                });
                const j = await r.json();
                if (!r.ok || j.code !== 0) throw new Error(j.message || 'like');
                likeBtn.setAttribute('data-liked', j.data.liked ? '1' : '0');
                likeBtn.classList.toggle('is-liked', j.data.liked);
                likeBtn.textContent = `♥ ${j.data.likeCount}`;
            } catch (err) {
                showAlert(err.message || 'like');
            }
            return;
        }
        const openBtn = e.target.closest('[data-post-open]');
        if (openBtn) {
            openPostDetailModal(openBtn.getAttribute('data-post-open'));
        }
    });
}

async function openPostDetailModal(postId) {
    const modal = document.getElementById('postDetailModal');
    if (!modal) return;
    communityViewingPostId = postId;
    modal.classList.remove('hidden');
    syncModalScrollLock();
    fillReportReasonSelect(false);
    const img = document.getElementById('postDetailImg');
    const cap = document.getElementById('postDetailCaption');
    const meta = document.getElementById('postDetailMeta');
    const box = document.getElementById('postDetailComments');
    const inp = document.getElementById('postDetailCommentInput');
    const favBtn = document.getElementById('postDetailFavBtn');
    const rf = document.getElementById('reportFeedback');
    const rn = document.getElementById('reportNote');
    if (inp) inp.value = '';
    if (rn) rn.value = '';
    if (rf) {
        rf.textContent = '';
        rf.classList.add('hidden');
    }
    if (favBtn) {
        favBtn.hidden = true;
        favBtn.disabled = true;
    }
    try {
        const r = await apiFetch(apiUrl(`/api/posts/${encodeURIComponent(postId)}`));
        const j = await r.json();
        if (!r.ok || j.code !== 0) throw new Error(j.message || 'post');
        const p = j.data;
        if (img) img.src = p.imageUrl;
        if (cap) {
            const promptLine =
                p.promptSummary != null && String(p.promptSummary).length
                    ? `\n${currentLang === 'zh' ? '提示摘要' : 'Prompt summary'}: ${p.promptSummary}`
                    : '';
            cap.textContent = (p.caption || '—') + promptLine;
        }
        if (meta) {
            meta.textContent = [
                `rank #${p.rank != null ? p.rank : '—'}`,
                p.workflowTemplate,
                p.taskType,
                communityFormatDate(p.createdAt)
            ].join(' · ');
        }
        if (favBtn && currentUser) {
            favBtn.hidden = false;
            favBtn.disabled = false;
            updatePostDetailFavUI(favBtn, p.favorited, p.favoriteCount);
        }
        await renderPostDetailComments(postId, box);
    } catch (e) {
        if (cap) cap.textContent = e.message;
    }
}

async function renderPostDetailComments(postId, box) {
    if (!box) return;
    box.innerHTML = '';
    try {
        const r = await apiFetch(
            apiUrl(`/api/posts/${encodeURIComponent(postId)}/comments?pageSize=50`)
        );
        const j = await r.json();
        if (!r.ok || j.code !== 0) return;
        if (!j.data.list.length) {
            box.innerHTML = `<p class="neg-hint">${communityEsc(
                i18n[currentLang]['history.empty']
            )}</p>`;
            return;
        }
        j.data.list.forEach((c) => {
            const row = document.createElement('div');
            row.className = 'comment-row';
            const au = document.createElement('div');
            au.className = 'comment-author';
            au.textContent = c.user.nickname;
            const tx = document.createElement('div');
            tx.textContent = c.content;
            row.appendChild(au);
            row.appendChild(tx);
            box.appendChild(row);
        });
    } catch (_) {
        /* ignore */
    }
}

function closePostDetailModal() {
    const modal = document.getElementById('postDetailModal');
    if (modal) modal.classList.add('hidden');
    communityViewingPostId = null;
    syncModalScrollLock();
}

function closePublishModal() {
    const modal = document.getElementById('publishModal');
    if (modal) modal.classList.add('hidden');
    communityPublishTargetItem = null;
    syncModalScrollLock();
}

function communityErrorMessage(code) {
    const map = {
        40901: 'community.alreadySubmitted',
        40902: 'moderation.duplicate',
        40004: 'community.workflowRejected',
        40005: 'community.fileMissing'
    };
    const k = map[code];
    return k ? i18n[currentLang][k] : null;
}

async function openPublishModal(historyItem) {
    const item = historyItem || lastCompletedHistoryEntry;
    if (!item || item.status !== 'done') {
        showAlert(i18n[currentLang]['history.empty']);
        return;
    }
    if (!currentUser) {
        showAlert(i18n[currentLang]['community.needLogin']);
        return;
    }
    const proof = buildHistoryProofFromItem(item);
    if (!proof) {
        showAlert(i18n[currentLang]['community.workflowRejected']);
        return;
    }
    communityPublishTargetItem = item;
    const modal = document.getElementById('publishModal');
    const sel = document.getElementById('publishTopicSelect');
    const err = document.getElementById('publishModalError');
    const cap = document.getElementById('publishCaption');
    const pub = document.getElementById('publishPublicPrompt');
    if (err) {
        err.classList.add('hidden');
        err.textContent = '';
    }
    if (cap) cap.value = '';
    if (pub) pub.checked = false;
    if (!modal) return;
    try {
        const r = await apiFetch(apiUrl('/api/topics?pageSize=50'));
        const j = await r.json();
        if (!r.ok || j.code !== 0) throw new Error(j.message || 'topics');
        if (sel) {
            sel.innerHTML = '';
            j.data.list
                .filter((t) => t.status === 'active')
                .forEach((t) => {
                    const o = document.createElement('option');
                    o.value = t.id;
                    o.textContent = t.title;
                    sel.appendChild(o);
                });
        }
    } catch (e) {
        if (err) {
            err.textContent = e.message;
            err.classList.remove('hidden');
        }
    }
    modal.classList.remove('hidden');
    syncModalScrollLock();
}

async function submitPublishForm() {
    const err = document.getElementById('publishModalError');
    const sel = document.getElementById('publishTopicSelect');
    const cap = document.getElementById('publishCaption');
    const pub = document.getElementById('publishPublicPrompt');
    if (err) {
        err.classList.add('hidden');
        err.textContent = '';
    }
    if (!currentUser) {
        showAlert(i18n[currentLang]['community.needLogin']);
        return;
    }
    const item = communityPublishTargetItem;
    const proof = buildHistoryProofFromItem(item);
    if (!item || !proof) {
        showAlert(i18n[currentLang]['community.workflowRejected']);
        return;
    }
    const topicId = sel && sel.value;
    if (!topicId) {
        if (err) {
            err.textContent = i18n[currentLang]['community.pickTopic'];
            err.classList.remove('hidden');
        }
        return;
    }
    try {
        const r = await apiFetch(apiUrl(`/api/topics/${encodeURIComponent(topicId)}/posts`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                caption: (cap && cap.value) || '',
                publicPrompt: pub && pub.checked,
                historyProof: proof
            })
        });
        const j = await r.json();
        if (!r.ok || j.code !== 0) {
            const msg = communityErrorMessage(j.code) || j.message || 'submit';
            throw new Error(msg);
        }
        showToast(i18n[currentLang]['community.submitted']);
        closePublishModal();
        if (communityTopicId === topicId) loadTopicDetailPage(topicId);
    } catch (e) {
        if (err) {
            err.textContent = e.message;
            err.classList.remove('hidden');
        } else {
            showAlert(e.message);
        }
    }
}

function wireTopicDetailUi() {
    fillReportReasonSelect(false);
    const back = document.getElementById('topicDetailBack');
    if (back && !back.dataset.wired) {
        back.dataset.wired = '1';
        back.addEventListener('click', () => {
            communityTopicId = null;
            showForgePage('topics');
        });
    }
    const tabs = document.getElementById('topicSortTabs');
    if (tabs && !tabs.dataset.wired) {
        tabs.dataset.wired = '1';
        tabs.addEventListener('click', (e) => {
            const b = e.target.closest('button[data-sort]');
            if (!b) return;
            communityPostSort = b.dataset.sort || 'latest';
            if (communityTopicId) loadTopicDetailPage(communityTopicId);
        });
    }
    wireCommunityPostGridDelegation();

    const pClose = document.getElementById('postDetailClose');
    if (pClose && !pClose.dataset.wired) {
        pClose.dataset.wired = '1';
        pClose.addEventListener('click', closePostDetailModal);
    }
    const pModal = document.getElementById('postDetailModal');
    if (pModal && !pModal.dataset.wired) {
        pModal.dataset.wired = '1';
        pModal.addEventListener('click', (e) => {
            if (e.target === pModal) closePostDetailModal();
        });
    }
    const send = document.getElementById('postDetailCommentSend');
    if (send && !send.dataset.wired) {
        send.dataset.wired = '1';
        send.addEventListener('click', async () => {
            if (!currentUser) {
                showAlert(i18n[currentLang]['community.needLogin']);
                return;
            }
            const pid = communityViewingPostId;
            const inp = document.getElementById('postDetailCommentInput');
            if (!pid || !inp) return;
            try {
                const r = await apiFetch(apiUrl(`/api/posts/${encodeURIComponent(pid)}/comments`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: inp.value })
                });
                const j = await r.json();
                if (!r.ok || j.code !== 0) throw new Error(j.message || 'comment');
                inp.value = '';
                await renderPostDetailComments(
                    pid,
                    document.getElementById('postDetailComments')
                );
                if (communityTopicId) loadTopicDetailPage(communityTopicId);
            } catch (e) {
                showAlert(e.message);
            }
        });
    }

    const pdfb = document.getElementById('postDetailFavBtn');
    if (pdfb && !pdfb.dataset.wired) {
        pdfb.dataset.wired = '1';
        pdfb.addEventListener('click', async () => {
            const id = communityViewingPostId;
            if (!id || !currentUser) return;
            const favorited = pdfb.classList.contains('is-fav');
            const method = favorited ? 'DELETE' : 'POST';
            try {
                const r = await apiFetch(apiUrl(`/api/posts/${encodeURIComponent(id)}/favorite`), {
                    method
                });
                const j = await r.json();
                if (!r.ok || j.code !== 0) throw new Error(j.message || 'favorite');
                updatePostDetailFavUI(pdfb, j.data.favorited, j.data.favoriteCount);
                if (communityTopicId) loadTopicDetailPage(communityTopicId);
            } catch (err) {
                showAlert(err.message || 'favorite');
            }
        });
    }
    const rsBtn = document.getElementById('reportSubmitBtn');
    if (rsBtn && !rsBtn.dataset.wired) {
        rsBtn.dataset.wired = '1';
        rsBtn.addEventListener('click', async () => {
            const pid = communityViewingPostId;
            const sel = document.getElementById('reportReason');
            const note = document.getElementById('reportNote');
            const fb = document.getElementById('reportFeedback');
            if (!pid) return;
            if (!currentUser) {
                showAlert(i18n[currentLang]['community.needLogin']);
                return;
            }
            try {
                const r = await apiFetch(apiUrl(`/api/posts/${encodeURIComponent(pid)}/report`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reason: (sel && sel.value) || 'other',
                        note: (note && note.value) || ''
                    })
                });
                const j = await r.json();
                if (!r.ok || j.code !== 0) {
                    const msg =
                        j.code === 40902
                            ? i18n[currentLang]['moderation.duplicate']
                            : j.message || 'report';
                    throw new Error(msg);
                }
                if (fb) {
                    fb.textContent = i18n[currentLang]['moderation.done'];
                    fb.classList.remove('hidden');
                }
            } catch (e) {
                if (fb) {
                    fb.textContent = e.message;
                    fb.classList.remove('hidden');
                }
            }
        });
    }
    const btnLedger = document.getElementById('btnRefreshLedger');
    if (btnLedger && !btnLedger.dataset.wired) {
        btnLedger.dataset.wired = '1';
        btnLedger.addEventListener('click', () => loadLedgerPanel());
    }

    const rp = document.getElementById('resultPublishBtn');
    if (rp && !rp.dataset.wired) {
        rp.dataset.wired = '1';
        rp.addEventListener('click', () => openPublishModal(lastCompletedHistoryEntry));
    }
    const hp = document.getElementById('historyModalPublishBtn');
    if (hp && !hp.dataset.wired) {
        hp.dataset.wired = '1';
        hp.addEventListener('click', () => {
            if (historyModalItem) openPublishModal(historyModalItem);
        });
    }
    const pmC = document.getElementById('publishModalClose');
    const pmX = document.getElementById('publishCancelBtn');
    if (pmC && !pmC.dataset.wired) {
        pmC.dataset.wired = '1';
        pmC.addEventListener('click', closePublishModal);
    }
    if (pmX && !pmX.dataset.wired) {
        pmX.dataset.wired = '1';
        pmX.addEventListener('click', closePublishModal);
    }
    const pms = document.getElementById('publishSubmitBtn');
    if (pms && !pms.dataset.wired) {
        pms.dataset.wired = '1';
        pms.addEventListener('click', submitPublishForm);
    }
    const publishModal = document.getElementById('publishModal');
    if (publishModal && !publishModal.dataset.wired) {
        publishModal.dataset.wired = '1';
        publishModal.addEventListener('click', (e) => {
            if (e.target === publishModal) closePublishModal();
        });
    }
}

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
    
    // 更新语言切换按钮文本（顶栏 + 登录弹窗内）
    const langLabel = lang === 'en' ? '中文' : 'English';
    const langSwitch = document.getElementById('langSwitch');
    const langTextMain = langSwitch && langSwitch.querySelector('.lang-text');
    if (langTextMain) langTextMain.textContent = langLabel;
    const authLangSwitch = document.getElementById('authLangSwitch');
    const langTextAuth = authLangSwitch && authLangSwitch.querySelector('.lang-text');
    if (langTextAuth) langTextAuth.textContent = langLabel;
    
    // 更新下载按钮文本（移动端显示"保存到相册"）
    updateDownloadButtonText();
    
    // 更新状态文本
    if (status.classList.contains('online')) {
        status.querySelector('.text').textContent = i18n[lang]['status.ready'];
    } else if (status.classList.contains('offline')) {
        status.querySelector('.text').textContent = i18n[lang]['status.offline'];
    }
    
    // 重新加载订阅方案（使用新语言）
    if (currentUser) {
        loadPlans();
        // 更新按钮上的积分单位
        updateUserInfo();
    }
    renderEditPresetChips();
    populateJewelryUi();
    if (
        isJewelryIntent() &&
        editIntentTask === 'jewelry_scene' &&
        jewelrySelectedSceneId &&
        forgePresets &&
        forgePresets.jewelryScenePacks
    ) {
        const pack = forgePresets.jewelryScenePacks.find((p) => p.id === jewelrySelectedSceneId);
        if (pack) {
            const lk = currentLang === 'zh' ? 'zh' : 'en';
            jewelrySceneSnippet = pack.prompt[lk] || pack.prompt.en || '';
        }
    }
    if (typeof editMode !== 'undefined' && editMode.classList.contains('active')) {
        updateEditModeBanner();
        updateJewelryFlowLayout();
    }
    updateEditButton();
    refreshCommunityUiLang();
    fillReportReasonSelect(true);
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

const AUTH_KEY = 'ptp_auth_token';

function setAuthError(msg) {
    if (!errorMessage) return;
    errorMessage.textContent =
        msg || (i18n[currentLang] && i18n[currentLang]['auth.error']) || 'Error';
    errorMessage.classList.remove('hidden');
}

function clearAuthError() {
    if (errorMessage) errorMessage.classList.add('hidden');
}

/** 登录/Cookie 弹窗打开时禁止背景页滚动（不依赖 :has） */
function syncModalScrollLock() {
    const authOpen = authOverlay && !authOverlay.classList.contains('hidden');
    const cookieOpen =
        cookieConsentOverlay && !cookieConsentOverlay.classList.contains('hidden');
    const publishModal = document.getElementById('publishModal');
    const publishOpen =
        publishModal && !publishModal.classList.contains('hidden');
    const postDetailModal = document.getElementById('postDetailModal');
    const postDetailOpen =
        postDetailModal && !postDetailModal.classList.contains('hidden');
    document.documentElement.classList.toggle(
        'modal-scroll-lock',
        !!(authOpen || cookieOpen || publishOpen || postDetailOpen)
    );
}

async function authenticateWithInviteCode(accessCode) {
    try {
        const response = await apiFetch(apiUrl('/api/auth'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessCode })
        });
        if (!response.ok) return false;
        const data = await response.json();
        if (data.success) {
            currentUser = data.user;
            currentAccessCode = accessCode;
            currentAuthPortal = 'user';
            sessionIsAdmin = false;
            updateAdminNavVisibility();
            updateUserInfo();
            authOverlay.classList.add('hidden');
            syncModalScrollLock();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Authentication failed:', error);
        return false;
    }
}

async function restoreAuth() {
    try {
        const r = await apiFetch(apiUrl('/api/auth/me'));
        if (r.ok) {
            const d = await r.json();
            if (d.success && d.user) {
                currentUser = d.user;
                currentAccessCode = null;
                applySessionPortalFromAuth(d);
                updateUserInfo();
                authOverlay.classList.add('hidden');
                syncModalScrollLock();
                return true;
            }
        }
    } catch (_) {}
    const token = sessionStorage.getItem(AUTH_KEY);
    if (token) {
        currentAccessCode = token;
        return authenticateWithInviteCode(token);
    }
    return false;
}

function getEditCreditLabelAmount() {
    if (!currentUser || !currentUser.creditCost) return null;
    const cc = currentUser.creditCost;
    if (currentUser.plan === 'beta' || cc.edit === 0) return null;
    if (!isJewelryIntent()) return cc.edit;
    const wt = EDIT_WORKFLOW_TEMPLATE[editIntentTask];
    const map = {
        jewelry_retouch: 'jewelry_retouch',
        jewelry_product_cutout: 'jewelry_cutout',
        jewelry_scene: 'jewelry_scene',
        jewelry_macro_detail: 'jewelry_macro'
    };
    const k = map[wt] || 'edit';
    return cc[k] != null ? cc[k] : cc.edit;
}

async function refreshAdminUserMap() {
    adminUserMap.clear();
    try {
        const r = await apiFetch(apiUrl('/api/admin/users'));
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.code === 0 && Array.isArray(d.data?.list)) {
            for (const u of d.data.list) adminUserMap.set(u.id, u);
        }
    } catch (_) {
        /* ignore */
    }
}

function adminUserLabel(userId) {
    if (userId == null) return '—';
    const u = adminUserMap.get(userId);
    if (!u) return String(userId);
    const name = u.username || u.email || userId;
    return `${name} (${userId})`;
}

async function loadAdminTopicsBrowser() {
    const el = document.getElementById('adminTopicsBrowser');
    if (!el) return;
    const failMsg =
        (i18n[currentLang] && i18n[currentLang]['admin.loadFailed']) ||
        'Failed to load';
    el.textContent = '';
    try {
        const tr = await apiFetch(apiUrl('/api/admin/topics?pageSize=100'));
        const td = await tr.json().catch(() => ({}));
        if (!tr.ok || td.code !== 0) {
            const p = document.createElement('p');
            p.className = 'neg-hint';
            p.textContent = td.message || failMsg;
            el.appendChild(p);
            return;
        }
        const loadPostsLabel =
            (i18n[currentLang] && i18n[currentLang]['admin.loadPosts']) ||
            'Load posts';
        const fullLabel =
            (i18n[currentLang] && i18n[currentLang]['admin.viewFull']) ||
            'Full content';
        const list = td.data?.list || [];
        for (const t of list) {
            const wrap = document.createElement('div');
            wrap.className = 'admin-topic-block';
            const h4 = document.createElement('h4');
            h4.textContent = t.title;
            wrap.appendChild(h4);
            const meta = document.createElement('p');
            meta.className = 'admin-meta';
            meta.textContent = `${t.id} · ${t.status} · ${t.startAt} – ${t.endAt} · posts ${t.postCount}`;
            wrap.appendChild(meta);
            const desc = document.createElement('div');
            desc.className = 'admin-topic-desc';
            desc.textContent = t.description || '';
            wrap.appendChild(desc);
            const rulesPre = document.createElement('pre');
            rulesPre.className = 'admin-pre admin-pre-small';
            rulesPre.textContent = JSON.stringify(t.rewardRules, null, 2);
            wrap.appendChild(rulesPre);
            const postsBox = document.createElement('div');
            postsBox.className = 'admin-topic-posts';
            wrap.appendChild(postsBox);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-secondary';
            btn.textContent = loadPostsLabel;
            btn.addEventListener('click', async () => {
                postsBox.textContent = '';
                const pr = await apiFetch(
                    apiUrl(
                        `/api/admin/topics/${encodeURIComponent(t.id)}/posts?pageSize=100`
                    )
                );
                const pd = await pr.json().catch(() => ({}));
                if (!pr.ok || pd.code !== 0) {
                    postsBox.textContent = pd.message || failMsg;
                    return;
                }
                const grid = document.createElement('div');
                grid.className = 'admin-post-grid';
                for (const post of pd.data.list || []) {
                    const card = document.createElement('div');
                    card.className = 'admin-post-card';
                    const img = document.createElement('img');
                    img.src = post.thumbUrl || post.imageUrl;
                    img.alt = '';
                    img.loading = 'lazy';
                    card.appendChild(img);
                    const cap = document.createElement('p');
                    cap.textContent = (post.caption || '').slice(0, 160);
                    card.appendChild(cap);
                    const st = document.createElement('div');
                    st.className = 'admin-post-card-meta';
                    st.textContent = `${post.status} · ${adminUserLabel(post.userId)}`;
                    card.appendChild(st);
                    const b2 = document.createElement('button');
                    b2.type = 'button';
                    b2.className = 'btn-secondary';
                    b2.textContent = fullLabel;
                    b2.addEventListener('click', () =>
                        showAdminPostInspect(post.id)
                    );
                    card.appendChild(b2);
                    grid.appendChild(card);
                }
                postsBox.appendChild(grid);
            });
            wrap.appendChild(btn);
            el.appendChild(wrap);
        }
        if (!list.length) {
            const p = document.createElement('p');
            p.textContent = '—';
            el.appendChild(p);
        }
    } catch (e) {
        el.textContent = failMsg;
        console.error(e);
    }
}

async function loadAdminLedgerBlock() {
    const el = document.getElementById('adminLedgerWrap');
    if (!el) return;
    const failMsg =
        (i18n[currentLang] && i18n[currentLang]['admin.loadFailed']) ||
        'Failed to load';
    el.innerHTML = '';
    try {
        const lr = await apiFetch(apiUrl('/api/admin/ledger?pageSize=100'));
        const ld = await lr.json().catch(() => ({}));
        if (!lr.ok || ld.code !== 0) {
            const p = document.createElement('p');
            p.className = 'neg-hint';
            p.textContent = ld.message || failMsg;
            el.appendChild(p);
            return;
        }
        const tbl = document.createElement('table');
        tbl.className = 'admin-ledger-table';
        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        for (const h of ['time', 'user', 'type', 'amt', 'bal', 'remark']) {
            const th = document.createElement('th');
            th.textContent = h;
            hr.appendChild(th);
        }
        thead.appendChild(hr);
        tbl.appendChild(thead);
        const tb = document.createElement('tbody');
        for (const row of ld.data.list || []) {
            const tr = document.createElement('tr');
            const cells = [
                row.createdAt,
                adminUserLabel(row.userId),
                row.type,
                String(row.amount),
                row.balanceAfter != null ? String(row.balanceAfter) : '—',
                row.remark || ''
            ];
            for (const c of cells) {
                const td = document.createElement('td');
                td.textContent = c;
                tr.appendChild(td);
            }
            tb.appendChild(tr);
        }
        tbl.appendChild(tb);
        el.appendChild(tbl);
        const total = ld.data.total ?? 0;
        const page = ld.data.page ?? 1;
        const ps = ld.data.pageSize ?? 1;
        const pages = Math.max(1, Math.ceil(total / ps));
        const foot = document.createElement('p');
        foot.className = 'muted';
        foot.textContent = `total ${total} · page ${page} / ${pages}`;
        el.appendChild(foot);
    } catch (e) {
        el.textContent = failMsg;
        console.error(e);
    }
}

async function showAdminPostInspect(postId) {
    const panel = document.getElementById('adminPostInspect');
    const body = document.getElementById('adminPostInspectBody');
    if (!panel || !body) return;
    const failMsg =
        (i18n[currentLang] && i18n[currentLang]['admin.loadFailed']) ||
        'Failed to load';
    panel.classList.remove('hidden');
    body.textContent = '…';
    const cmtHeading =
        (i18n[currentLang] && i18n[currentLang]['admin.commentsHeading']) ||
        'Comments';
    const promptSummaryLab =
        (i18n[currentLang] && i18n[currentLang]['admin.promptSummary']) ||
        'Prompt summary';
    const historyProofLab =
        (i18n[currentLang] && i18n[currentLang]['admin.historyProof']) ||
        'historyProof';
    try {
        const r = await apiFetch(
            apiUrl(`/api/admin/posts/${encodeURIComponent(postId)}`)
        );
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.code !== 0) {
            body.textContent = d.message || failMsg;
            return;
        }
        const p = d.data;
        body.innerHTML = '';
        const img = document.createElement('img');
        img.src = p.imageUrl;
        img.alt = '';
        img.className = 'admin-inspect-img';
        body.appendChild(img);
        const cap = document.createElement('p');
        cap.className = 'admin-inspect-caption';
        cap.textContent = p.caption || '';
        body.appendChild(cap);
        const meta = document.createElement('div');
        meta.className = 'admin-inspect-meta';
        meta.textContent = [
            p.id,
            p.status,
            adminUserLabel(p.userId),
            p.topicId,
            typeof p.score === 'number' ? `score ${p.score}` : '',
            p.createdAt
        ]
            .filter(Boolean)
            .join(' · ');
        body.appendChild(meta);
        const promptLab = document.createElement('strong');
        promptLab.textContent = promptSummaryLab;
        body.appendChild(promptLab);
        const promptPre = document.createElement('pre');
        promptPre.className = 'admin-pre';
        promptPre.textContent = p.promptSummary || '';
        body.appendChild(promptPre);
        const hpLab = document.createElement('strong');
        hpLab.textContent = historyProofLab;
        body.appendChild(hpLab);
        const hpPre = document.createElement('pre');
        hpPre.className = 'admin-pre';
        try {
            hpPre.textContent = JSON.stringify(p.historyProof, null, 2);
        } catch (_) {
            hpPre.textContent = String(p.historyProof);
        }
        body.appendChild(hpPre);
        const likeLab = document.createElement('div');
        likeLab.className = 'admin-inspect-meta';
        const lids = p.likeUserIds || [];
        likeLab.textContent = `likes (${lids.length}): ${lids.map(adminUserLabel).join(', ') || '—'}`;
        body.appendChild(likeLab);
        const favLab = document.createElement('div');
        favLab.className = 'admin-inspect-meta';
        const fids = p.favoriteUserIds || [];
        favLab.textContent = `favorites (${fids.length}): ${fids.map(adminUserLabel).join(', ') || '—'}`;
        body.appendChild(favLab);
        const cmtTitle = document.createElement('h4');
        cmtTitle.textContent = cmtHeading;
        body.appendChild(cmtTitle);
        const ul = document.createElement('ul');
        ul.className = 'admin-comment-list';
        for (const c of p.comments || []) {
            const li = document.createElement('li');
            const who = (c.user && c.user.nickname) || c.userId;
            li.textContent = `${who} @ ${c.createdAt}: ${c.content || ''}`;
            ul.appendChild(li);
        }
        body.appendChild(ul);
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {
        body.textContent = failMsg;
        console.error(e);
    }
}

function updateAdminNavVisibility() {
    if (!navBtnAdmin) return;
    const show = currentAuthPortal === 'admin' && sessionIsAdmin;
    navBtnAdmin.classList.toggle('hidden', !show);
}

function applySessionPortalFromAuth(d) {
    if (!d) return;
    currentAuthPortal = d.authPortal || 'user';
    sessionIsAdmin = !!d.isAdmin;
    updateAdminNavVisibility();
}

async function loadAdminPanel() {
    const sumEl = document.getElementById('adminSummaryOut');
    const repEl = document.getElementById('adminReportsList');
    const setEl = document.getElementById('adminSettleList');
    if (!sumEl || !repEl || !setEl) return;
    const failMsg =
        (i18n[currentLang] && i18n[currentLang]['admin.loadFailed']) ||
        'Failed to load';
    let pending = [];
    try {
        await refreshAdminUserMap();
        const sr = await apiFetch(apiUrl('/api/admin/summary'));
        const sd = await sr.json().catch(() => ({}));
        if (!sr.ok || sd.code !== 0) {
            sumEl.textContent = `${failMsg}: ${sd.message || sr.status}`;
        } else {
            sumEl.textContent = JSON.stringify(sd.data, null, 2);
            pending = sd.data?.pendingSettlementTopicIds || [];
        }
        const rr = await apiFetch(apiUrl('/api/admin/moderation?status=open'));
        const rd = await rr.json().catch(() => ({}));
        repEl.innerHTML = '';
        if (!rr.ok || rd.code !== 0) {
            const p = document.createElement('p');
            p.className = 'neg-hint';
            p.textContent = rd.message || failMsg;
            repEl.appendChild(p);
        } else {
            const list = rd.data?.list || [];
            const resLabel =
                (i18n[currentLang] && i18n[currentLang]['admin.resolve']) ||
                'Resolve';
            const viewPostLabel =
                (i18n[currentLang] &&
                    i18n[currentLang]['admin.viewReportedPost']) ||
                'View post';
            for (const r of list) {
                const row = document.createElement('div');
                row.className = 'admin-row';
                const line = document.createElement('div');
                line.textContent = `${r.id} · post ${r.postId} · ${r.reason}`;
                row.appendChild(line);
                const btnView = document.createElement('button');
                btnView.type = 'button';
                btnView.className = 'btn-secondary';
                btnView.textContent = viewPostLabel;
                btnView.addEventListener('click', () =>
                    showAdminPostInspect(r.postId)
                );
                row.appendChild(btnView);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn-secondary';
                btn.textContent = resLabel;
                btn.addEventListener('click', async () => {
                    const res = await apiFetch(
                        apiUrl(`/api/admin/moderation/${r.id}/resolve`),
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                resolution: 'reviewed',
                                adminNote: ''
                            })
                        }
                    );
                    if (res.ok) loadAdminPanel();
                    else showToast(failMsg);
                });
                row.appendChild(btn);
                repEl.appendChild(row);
            }
            if (!list.length) {
                const p = document.createElement('p');
                p.textContent = '—';
                repEl.appendChild(p);
            }
        }
        setEl.innerHTML = '';
        const settleLabel =
            (i18n[currentLang] && i18n[currentLang]['admin.runSettle']) ||
            'Settle';
        const okLabel =
            (i18n[currentLang] && i18n[currentLang]['admin.settleOk']) ||
            'Done';
        for (const tid of pending) {
            const row = document.createElement('div');
            row.className = 'admin-row';
            row.innerHTML = `<code>${tid}</code>`;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-secondary';
            btn.textContent = settleLabel;
            btn.addEventListener('click', async () => {
                const res = await apiFetch(
                    apiUrl(`/api/admin/topics/${tid}/settle`),
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: '{}'
                    }
                );
                if (res.ok) {
                    showToast(okLabel);
                    loadAdminPanel();
                } else showToast(failMsg);
            });
            row.appendChild(btn);
            setEl.appendChild(row);
        }
        if (!pending.length) {
            const p = document.createElement('p');
            p.textContent = '—';
            setEl.appendChild(p);
        }
        await Promise.all([loadAdminTopicsBrowser(), loadAdminLedgerBlock()]);
    } catch (e) {
        sumEl.textContent = failMsg;
        console.error(e);
    }
}

function updateUserInfo() {
    if (!currentUser) return;

    userName.textContent = currentUser.username;
    userPlan.textContent = currentUser.planName;
    creditsCount.textContent = currentUser.credits;

    userInfo.classList.remove('hidden');

    if (currentUser.creditCost) {
        const creditUnit = currentLang === 'zh' ? '积分' : 'credits';
        if (currentUser.plan === 'beta' || currentUser.creditCost.edit === 0) {
            editBtnCredit.classList.add('hidden');
            generateBtnCredit.classList.add('hidden');
        } else {
            const editAmt = getEditCreditLabelAmount();
            editBtnCredit.textContent = `~ ${editAmt} ${creditUnit}`;
            generateBtnCredit.textContent = `~ ${currentUser.creditCost.generate} ${creditUnit}`;
            editBtnCredit.classList.remove('hidden');
            generateBtnCredit.classList.remove('hidden');
        }
    }
    updateAdminNavVisibility();
}

async function loadPlans() {
    try {
        const response = await apiFetch(apiUrl(`/api/plans?lang=${currentLang}`));
        const data = await response.json();

        if (data.plans) {
            renderPlans(data.plans);
        }
    } catch (error) {
        console.error('Failed to load plans:', error);
    }
}

function renderPlans(plans) {
    plansGrid.innerHTML = '';

    plans.forEach((plan) => {
        const planCard = document.createElement('div');
        planCard.className = 'plan-card';

        if (currentUser && currentUser.plan === plan.id) {
            planCard.classList.add('current');
        }

        const isCurrent = currentUser && currentUser.plan === plan.id;
        const editLabel = currentLang === 'zh' ? '编辑' : 'Edit';
        const generateLabel = currentLang === 'zh' ? '生成' : 'Generate';
        const cc = plan.creditCost || {};
        const zh = currentLang === 'zh';
        const jewel = [];
        if (cc.jewelry_retouch != null) {
            jewel.push(`${zh ? '珠宝精修' : 'Jewelry polish'}: ${cc.jewelry_retouch}`);
        }
        if (cc.jewelry_cutout != null) {
            jewel.push(`${zh ? '抠图白底' : 'Cutout'}: ${cc.jewelry_cutout}`);
        }
        if (cc.jewelry_scene != null) {
            jewel.push(`${zh ? '场景合成' : 'Scene'}: ${cc.jewelry_scene}`);
        }
        if (cc.jewelry_macro != null) {
            jewel.push(`${zh ? '微距细节' : 'Macro'}: ${cc.jewelry_macro}`);
        }

        planCard.innerHTML = `
            <div class="plan-header">
                <h3>${plan.name}</h3>
                <div class="plan-price">
                    <span class="price">$${plan.price}</span>
                    <span class="period">${i18n[currentLang]['plans.perMonth']}</span>
                </div>
            </div>
            <div class="plan-credits">
                <span class="credits-amount">${plan.credits}</span>
                <span>${i18n[currentLang]['plans.creditsPerMonth']}</span>
            </div>
            <div class="plan-cost">
                <span>${editLabel}: ${plan.creditCost.edit} ${i18n[currentLang]['credits.unit']}</span>
                <span>${generateLabel}: ${plan.creditCost.generate} ${i18n[currentLang]['credits.unit']}</span>
                ${
                    jewel.length
                        ? `<div class="plan-jewelry-cost">${jewel.join(' · ')}</div>`
                        : ''
                }
            </div>
            <ul class="plan-features">
                ${plan.features.map((f) => `<li>${f}</li>`).join('')}
            </ul>
            <button class="plan-btn ${isCurrent ? 'current' : ''}" 
                    ${isCurrent ? 'disabled' : ''}>
                ${isCurrent ? i18n[currentLang]['plans.current'] : i18n[currentLang]['plans.upgrade']}
            </button>
        `;

        plansGrid.appendChild(planCard);
    });

    plansSection.classList.remove('hidden');
}

let loginMode = 'password';

async function sendAuthOtp(email, purpose) {
    const em = String(email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        throw new Error(
            (i18n[currentLang] && i18n[currentLang]['auth.needEmail']) || 'Enter a valid email'
        );
    }
    const langKey = currentLang === 'zh' ? 'zh' : 'en';
    const r = await apiFetch(apiUrl('/api/auth/send-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em, purpose, lang: langKey })
    });
    const text = await r.text();
    let j = {};
    try {
        j = text ? JSON.parse(text) : {};
    } catch (_) {
        const hint =
            (i18n[currentLang] && i18n[currentLang]['auth.serverHtmlError']) ||
            'Server returned non-JSON. Restart Node with the latest server.js on the same port as this page.';
        if (
            /cannot post\s+\/api\/auth\/send-code/i.test(text) ||
            /<!DOCTYPE\s+html/i.test(text)
        ) {
            throw new Error(hint);
        }
        throw new Error(text ? text.slice(0, 200) : 'Invalid server response');
    }
    if (!r.ok) throw new Error(j.error || `send failed (${r.status})`);
}

function scrollAuthModalTop() {
    const modal = document.querySelector('.auth-overlay .auth-modal');
    if (modal) modal.scrollTop = 0;
    if (authOverlay) authOverlay.scrollTop = 0;
}

function wireAuthForms() {
    if (!authOverlay || authOverlay.dataset.authFormsWired === '1') return;
    authOverlay.dataset.authFormsWired = '1';

    authOverlay.querySelectorAll('[data-auth-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
            authOverlay.querySelectorAll('[data-auth-tab]').forEach((b) => {
                b.classList.toggle('auth-tab--active', b === btn);
            });
            const t = btn.getAttribute('data-auth-tab');
            const panelLogin = document.getElementById('authPanelLogin');
            const panelReg = document.getElementById('authPanelRegister');
            const panelForgot = document.getElementById('authPanelForgot');
            if (panelLogin) panelLogin.classList.toggle('hidden', t !== 'login');
            if (panelReg) panelReg.classList.toggle('hidden', t !== 'register');
            if (panelForgot) panelForgot.classList.toggle('hidden', t !== 'forgot');
            clearAuthError();
            scrollAuthModalTop();
        });
    });

    authOverlay.querySelectorAll('[data-login-mode]').forEach((chip) => {
        chip.addEventListener('click', () => {
            loginMode = chip.getAttribute('data-login-mode') || 'password';
            authOverlay.querySelectorAll('[data-login-mode]').forEach((c) => {
                c.classList.toggle('auth-chip--active', c === chip);
            });
            const bp = document.getElementById('loginBlockPassword');
            const bc = document.getElementById('loginBlockCode');
            if (bp) bp.classList.toggle('hidden', loginMode !== 'password');
            if (bc) bc.classList.toggle('hidden', loginMode !== 'code');
        });
    });

    authOverlay.querySelectorAll('[data-auth-portal]').forEach((chip) => {
        chip.addEventListener('click', () => {
            authPortalIntent = chip.getAttribute('data-auth-portal') || 'user';
            authOverlay.querySelectorAll('[data-auth-portal]').forEach((c) => {
                c.classList.toggle('auth-chip--active', c === chip);
            });
        });
    });

    document.getElementById('btnSendLoginCode')?.addEventListener('click', async () => {
        const btn = document.getElementById('btnSendLoginCode');
        const email = document.getElementById('loginEmail')?.value.trim();
        try {
            clearAuthError();
            if (btn) btn.disabled = true;
            await sendAuthOtp(email, 'login');
            showToast(currentLang === 'zh' ? '验证码已发送' : 'Code sent');
        } catch (e) {
            setAuthError(e.message);
            scrollAuthModalTop();
        } finally {
            if (btn) btn.disabled = false;
        }
    });

    document.getElementById('btnSendRegCode')?.addEventListener('click', async () => {
        const btn = document.getElementById('btnSendRegCode');
        const email = document.getElementById('regEmail')?.value.trim();
        try {
            clearAuthError();
            if (btn) btn.disabled = true;
            await sendAuthOtp(email, 'register');
            showToast(currentLang === 'zh' ? '验证码已发送' : 'Code sent');
        } catch (e) {
            setAuthError(e.message);
            scrollAuthModalTop();
        } finally {
            if (btn) btn.disabled = false;
        }
    });

    document.getElementById('btnSendForgotCode')?.addEventListener('click', async () => {
        const btn = document.getElementById('btnSendForgotCode');
        const email = document.getElementById('forgotEmail')?.value.trim();
        try {
            clearAuthError();
            if (btn) btn.disabled = true;
            await sendAuthOtp(email, 'reset_password');
            showToast(currentLang === 'zh' ? '验证码已发送' : 'Code sent');
        } catch (e) {
            setAuthError(e.message);
            scrollAuthModalTop();
        } finally {
            if (btn) btn.disabled = false;
        }
    });

    document.getElementById('btnSubmitLogin')?.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail')?.value.trim();
        clearAuthError();
        try {
            if (loginMode === 'password') {
                const password = document.getElementById('loginPassword')?.value || '';
                const r = await apiFetch(apiUrl('/api/auth/login-password'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        password,
                        intent: authPortalIntent
                    })
                });
                const d = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(d.error || 'login failed');
                sessionStorage.removeItem(AUTH_KEY);
                currentUser = d.user;
                currentAccessCode = null;
                applySessionPortalFromAuth(d);
                updateUserInfo();
                authOverlay.classList.add('hidden');
                syncModalScrollLock();
                checkHealth();
                loadPlans();
                loadForgePresets();
            } else {
                const code = document.getElementById('loginCode')?.value.trim() || '';
                const r = await apiFetch(apiUrl('/api/auth/login-code'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        code,
                        intent: authPortalIntent
                    })
                });
                const d = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(d.error || 'login failed');
                sessionStorage.removeItem(AUTH_KEY);
                currentUser = d.user;
                currentAccessCode = null;
                applySessionPortalFromAuth(d);
                updateUserInfo();
                authOverlay.classList.add('hidden');
                syncModalScrollLock();
                checkHealth();
                loadPlans();
                loadForgePresets();
            }
        } catch (e) {
            setAuthError(e.message);
            scrollAuthModalTop();
        }
    });

    document.getElementById('btnSubmitRegister')?.addEventListener('click', async () => {
        const email = document.getElementById('regEmail')?.value.trim();
        const username = document.getElementById('regUsername')?.value.trim();
        const password = document.getElementById('regPassword')?.value || '';
        const code = document.getElementById('regCode')?.value.trim() || '';
        clearAuthError();
        try {
            const r = await apiFetch(apiUrl('/api/auth/register'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    username,
                    password,
                    code,
                    lang: currentLang
                })
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || 'register failed');
            sessionStorage.removeItem(AUTH_KEY);
            currentUser = d.user;
            currentAccessCode = null;
            applySessionPortalFromAuth(d);
            updateUserInfo();
            authOverlay.classList.add('hidden');
            syncModalScrollLock();
            checkHealth();
            loadPlans();
            loadForgePresets();
        } catch (e) {
            setAuthError(e.message);
            scrollAuthModalTop();
        }
    });

    document.getElementById('btnSubmitForgot')?.addEventListener('click', async () => {
        const email = document.getElementById('forgotEmail')?.value.trim();
        const code = document.getElementById('forgotCode')?.value.trim() || '';
        const newPassword = document.getElementById('forgotNewPassword')?.value || '';
        clearAuthError();
        try {
            const r = await apiFetch(apiUrl('/api/auth/reset-password'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, newPassword })
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || 'reset failed');
            sessionStorage.removeItem(AUTH_KEY);
            currentUser = d.user;
            currentAccessCode = null;
            applySessionPortalFromAuth(d);
            updateUserInfo();
            authOverlay.classList.add('hidden');
            syncModalScrollLock();
            checkHealth();
            loadPlans();
            loadForgePresets();
        } catch (e) {
            setAuthError(e.message);
            scrollAuthModalTop();
        }
    });

    submitCodeBtn?.addEventListener('click', async () => {
        const code = accessCodeInput?.value.trim();
        if (!code) {
            setAuthError();
            return;
        }
        const success = await authenticateWithInviteCode(code);
        if (success) {
            sessionStorage.setItem(AUTH_KEY, code);
            clearAuthError();
            checkHealth();
            loadPlans();
            loadForgePresets();
        } else {
            setAuthError();
            accessCodeInput.value = '';
            accessCodeInput?.focus();
        }
    });

    accessCodeInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitCodeBtn?.click();
    });

    syncModalScrollLock();
}

function initCookieConsent() {
    if (!cookieConsentOverlay || !cookieConsentAccept) return;
    if (!localStorage.getItem('ptp_cookie_consent_v1')) {
        cookieConsentOverlay.classList.remove('hidden');
        syncModalScrollLock();
    }
    cookieConsentAccept.addEventListener('click', () => {
        localStorage.setItem('ptp_cookie_consent_v1', '1');
        cookieConsentOverlay.classList.add('hidden');
        syncModalScrollLock();
    });
}

// 语言切换（顶栏与登录/注册弹窗内共用逻辑）
function bindLangToggle(btn) {
    if (!btn) return;
    btn.addEventListener('click', () => {
        const newLang = currentLang === 'en' ? 'zh' : 'en';
        switchLanguage(newLang);
    });
}
bindLangToggle(document.getElementById('langSwitch'));
bindLangToggle(document.getElementById('authLangSwitch'));

// 初始化语言
switchLanguage(currentLang);

const footerYearEl = document.getElementById('footerYear');
if (footerYearEl) footerYearEl.textContent = String(new Date().getFullYear());

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
            updateEditModeBanner();
            updateJewelryFlowLayout();
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
        const response = await apiFetch(apiUrl('/api/health'));
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
        showAlert(i18n[currentLang]['error.noImage']);
        return;
    }
    
    if (file.size > 20 * 1024 * 1024) {
        showAlert(i18n[currentLang]['error.fileSize']);
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
    resetResultPresentation();
    updateEditButton();
});

// Prompt input
promptInput.addEventListener('input', updateEditButton);
if (negativePrompt) negativePrompt.addEventListener('input', updateEditButton);
const jewelryNegativePromptEl = document.getElementById('jewelryNegativePrompt');
if (jewelryNegativePromptEl)
    jewelryNegativePromptEl.addEventListener('input', updateEditButton);

function updateEditButton() {
    const hasFile = selectedFile !== null;
    editBtn.disabled = !(hasFile && hasValidEditPromptCore());
    renderBatchFileList();
    if (currentUser) updateUserInfo();
}

/**
 * 单次编辑 SSE（供主按钮与批量队列复用）。依赖外部已设置 activeAbortController。
 * @param {File} uploadFile
 */
async function runEditStreamForFile(uploadFile) {
    const formData = new FormData();
    formData.append('image', uploadFile);
    formData.append('prompt', buildEditPromptForRequest());
    if (currentAccessCode) {
        formData.append('accessCode', currentAccessCode);
    }
    formData.append(
        'workflowTemplate',
        EDIT_WORKFLOW_TEMPLATE[editIntentTask] || 'img2img_style'
    );
    const pp = buildPostProcessPayload();
    if (pp) formData.append('postProcess', JSON.stringify(pp));

    if (uploadFile === selectedFile && previewImage && previewImage.src) {
        compareBeforeDataUrl = previewImage.src;
    } else {
        compareBeforeDataUrl = await fileToDataUrl(uploadFile);
    }

    const response = await apiFetch(apiUrl('/api/edit-stream'), {
        method: 'POST',
        body: formData,
        signal: activeAbortController.signal
    });

    if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        if (response.status === 402) {
            throw new Error(i18n[currentLang]['credits.insufficient']);
        }
        throw new Error(errBody.error || 'Failed to process image');
    }

    let finalResult = null;
    await consumeSseStream(
        response,
        async (data) => {
            if (data.progress !== undefined) updateRealProgress(data.progress);
            if (data.status === 'completed' && data.result) {
                finalResult = data.result;
                if (data.result.creditsRemaining !== undefined && creditsCount) {
                    creditsCount.textContent = data.result.creditsRemaining;
                    currentUser.credits = data.result.creditsRemaining;
                }
            }
            if (data.status === 'error') {
                throw new Error(data.error || 'Failed to process image');
            }
        },
        activeAbortController.signal
    );

    if (!finalResult) throw new Error('No result');
    return finalResult;
}

async function finalizeEditSuccess(finalResult) {
    resultImage.src = finalResult.thumbnail || finalResult.image;
    currentOriginalImage = finalResult.image;

    const postSnap = buildPostProcessPayload();
    const negSnap = getNegativeForEdit();
    lastResultSummary = {
        mode: 'edit',
        taskType: editIntentTask,
        prompt: buildEditPromptForRequest(),
        neg: negSnap
    };
    const summaryLine = summarizeEditPromptForDisplay();
    setResultMeta([
        `${currentLang === 'zh' ? '模式' : 'Mode'}: edit · ${editIntentTask}`,
        `workflowTemplate: ${EDIT_WORKFLOW_TEMPLATE[editIntentTask] || 'img2img_style'}`,
        postSnap
            ? `${currentLang === 'zh' ? '后处理' : 'Post'}: ${JSON.stringify(postSnap)}`
            : '',
        `${currentLang === 'zh' ? '提示摘要' : 'Prompt summary'}: ${summaryLine}${
            summaryLine.length >= 400 ? '…' : ''
        }`
    ]);
    setCompareAfterEdit(
        compareBeforeDataUrl,
        finalResult.thumbnail || finalResult.image,
        finalResult.image
    );

    hideLoadingProgress();
    updateDownloadButtonText();
    resultSection.classList.remove('hidden');
    showForgePage('editor');
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const inThumb = await shrinkDataUrl(compareBeforeDataUrl);
    await registerHistoryEntry({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        mode: 'edit',
        taskType: editIntentTask,
        prompt: isJewelryIntent()
            ? summarizeEditPromptForDisplay()
            : promptInput.value.trim(),
        params: {
            negative: lastResultSummary.neg || '',
            workflowTemplate:
                EDIT_WORKFLOW_TEMPLATE[editIntentTask] || 'img2img_style',
            postProcess: postSnap,
            promptSent: buildEditPromptForRequest()
        },
        outRel: finalResult.image,
        thumbRel: finalResult.thumbnail || finalResult.image,
        inThumbDataUrl: inThumb,
        status: 'done',
        err: null
    });
}

// Edit image
editBtn.addEventListener('click', async () => {
    if (!selectedFile || !hasValidEditPromptCore()) return;

    editBtn.disabled = true;
    editBtn.querySelector('.btn-text').classList.add('hidden');
    editBtn.querySelector('.btn-loading').classList.remove('hidden');

    showLoadingProgress();

    activeAbortController = new AbortController();
    const tm = setTimeout(() => {
        try {
            activeAbortController.abort();
        } catch (_) {}
    }, TASK_CLIENT_TIMEOUT_MS);

    try {
        const finalResult = await runEditStreamForFile(selectedFile);
        await finalizeEditSuccess(finalResult);
    } catch (error) {
        hideLoadingProgress();
        resultSection.classList.add('hidden');
        if (forgeUserCancelled) {
            showAlert(i18n[currentLang]['task.cancelled']);
        } else if (
            error.name === 'AbortError' ||
            (error.message && error.message.includes('aborted'))
        ) {
            showAlert(i18n[currentLang]['task.timeout']);
        } else {
            showAlert(`Error: ${error.message}`);
        }
    } finally {
        forgeUserCancelled = false;
        clearTimeout(tm);
        activeAbortController = null;
        editBtn.disabled = false;
        editBtn.querySelector('.btn-text').classList.remove('hidden');
        editBtn.querySelector('.btn-loading').classList.add('hidden');
    }
});

// Download result
downloadBtn.addEventListener('click', async () => {
    if (isMobile) {
        // 移动端：保存到相册（使用原图）
        await saveToAlbum();
    } else {
        // PC端：直接下载原图
        const link = document.createElement('a');
        link.href = currentOriginalImage || resultImage.src;
        link.download = `${currentMode}-${Date.now()}.png`;
        link.click();
    }
});

// 保存图片到相册（移动端）
async function saveToAlbum() {
    try {
        // 获取原图
        const imageUrl = currentOriginalImage || resultImage.src;
        
        // 下载原图
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        
        // 尝试使用Web Share API（iOS Safari 和部分Android浏览器支持）
        if (navigator.share && navigator.canShare) {
            const file = new File([blob], `image-${Date.now()}.png`, { type: blob.type });
            
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

async function afterGenerateSuccess(result, meta) {
    resultImage.src = result.thumbnail || result.image;
    currentOriginalImage = result.image;
    if (compareBox) compareBox.classList.add('hidden');
    lastResultSummary = { mode: 'generate', ...meta };
    setResultMeta([
        `${currentLang === 'zh' ? '模式' : 'Mode'}: generate${meta.grid ? ' (grid)' : ''}`,
        `${currentLang === 'zh' ? '尺寸' : 'Size'}: ${meta.width}×${meta.height}`,
        `steps: ${meta.steps}, cfg: ${meta.cfg}`,
        `${currentLang === 'zh' ? '提示' : 'Prompt'}: ${meta.prompt.slice(0, 320)}${
            meta.prompt.length > 320 ? '…' : ''
        }`
    ]);
    hideLoadingProgress();
    updateDownloadButtonText();
    resultSection.classList.remove('hidden');
    showForgePage('editor');
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await registerHistoryEntry({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        mode: 'generate',
        taskType: meta.grid ? 'grid' : 'generate',
        prompt: meta.prompt,
        params: {
            width: meta.width,
            height: meta.height,
            steps: meta.steps,
            cfg: meta.cfg
        },
        outRel: result.image,
        thumbRel: result.thumbnail || result.image,
        inThumbDataUrl: null,
        status: 'done',
        err: null
    });
}

// Generate image (T2I)
generateBtn.addEventListener('click', async () => {
    const prompt = generatePrompt.value.trim();
    if (!prompt) {
        showAlert(i18n[currentLang]['error.noPrompt']);
        return;
    }
    
    const width = parseInt(widthInput.value);
    const height = parseInt(heightInput.value);
    const steps = parseInt(stepsInput.value);
    const cfg = parseFloat(cfgInput.value);
    const gridMode = gridModeCheckbox.checked;
    
    // Validate parameters
    if (width < 256 || width > 2048 || height < 256 || height > 2048) {
        showAlert(i18n[currentLang]['error.invalidSize']);
        return;
    }
    
    if (steps < 1 || steps > 50) {
        showAlert(i18n[currentLang]['error.invalidSteps']);
        return;
    }
    
    // Show loading state
    generateBtn.disabled = true;
    generateBtn.querySelector('.btn-text').classList.add('hidden');
    generateBtn.querySelector('.btn-loading').classList.remove('hidden');
    
    showLoadingProgress();

    activeAbortController = new AbortController();
    const tm = setTimeout(() => {
        try {
            activeAbortController.abort();
        } catch (_) {}
    }, TASK_CLIENT_TIMEOUT_MS);

    try {
        const metaBase = { prompt, width, height, steps, cfg, grid: gridMode };

        if (gridMode) {
            const response = await apiFetch(apiUrl('/api/generate-grid'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    width,
                    height,
                    steps,
                    cfg,
                    ...(currentAccessCode ? { accessCode: currentAccessCode } : {})
                }),
                signal: activeAbortController.signal
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                if (response.status === 402) {
                    throw new Error(i18n[currentLang]['credits.insufficient']);
                }
                throw new Error(error.error || 'Failed to generate image');
            }

            const data = await response.json();
            if (data.creditsRemaining !== undefined) {
                creditsCount.textContent = data.creditsRemaining;
                currentUser.credits = data.creditsRemaining;
            }
            await afterGenerateSuccess(data, metaBase);
        } else {
            const response = await apiFetch(apiUrl('/api/generate-stream'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    width,
                    height,
                    steps,
                    cfg,
                    ...(currentAccessCode ? { accessCode: currentAccessCode } : {})
                }),
                signal: activeAbortController.signal
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                if (response.status === 402) {
                    throw new Error(i18n[currentLang]['credits.insufficient']);
                }
                throw new Error(error.error || 'Failed to generate image');
            }

            let finalResult = null;
            await consumeSseStream(
                response,
                async (data) => {
                    if (data.progress !== undefined) updateRealProgress(data.progress);
                    if (data.status === 'completed' && data.result) {
                        finalResult = data.result;
                        if (data.result.creditsRemaining !== undefined) {
                            creditsCount.textContent = data.result.creditsRemaining;
                            currentUser.credits = data.result.creditsRemaining;
                        }
                    }
                    if (data.status === 'error') {
                        throw new Error(data.error || 'Failed to generate image');
                    }
                },
                activeAbortController.signal
            );

            if (!finalResult) throw new Error('No result');
            await afterGenerateSuccess(finalResult, metaBase);
        }
    } catch (error) {
        hideLoadingProgress();
        resultSection.classList.add('hidden');
        if (forgeUserCancelled) {
            showAlert(i18n[currentLang]['task.cancelled']);
        } else if (error.name === 'AbortError' || (error.message && error.message.includes('aborted'))) {
            showAlert(i18n[currentLang]['task.timeout']);
        } else {
            showAlert(`Error: ${error.message}`);
        }
    } finally {
        forgeUserCancelled = false;
        clearTimeout(tm);
        activeAbortController = null;
        generateBtn.disabled = false;
        generateBtn.querySelector('.btn-text').classList.remove('hidden');
        generateBtn.querySelector('.btn-loading').classList.add('hidden');
    }
});

if (forgeNav) {
    forgeNav.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-page]');
        if (!b) return;
        showForgePage(b.dataset.page);
    });
}

btnAdminRefresh?.addEventListener('click', () => loadAdminPanel());
document
    .getElementById('btnAdminPostInspectClose')
    ?.addEventListener('click', () => {
        document.getElementById('adminPostInspect')?.classList.add('hidden');
    });

document.querySelectorAll('.home-card').forEach((card) => {
    card.addEventListener('click', () => {
        const open = card.dataset.open;
        if (open === 'topics') {
            showForgePage('topics');
            return;
        }
        if (open === 'history') {
            showForgePage('history');
            return;
        }
        if (open === 'settings') {
            showForgePage('settings');
            return;
        }
        if (open === 'editor') {
            applyHomeTaskIntent(card.dataset.task || 'style');
            tabBtns.forEach((b) => b.classList.remove('active'));
            const editTab = document.querySelector('.tab-btn[data-mode="edit"]');
            if (editTab) editTab.classList.add('active');
            editMode.classList.add('active');
            generateMode.classList.remove('active');
            currentMode = 'edit';
            showForgePage('editor');
        }
    });
});

document.querySelectorAll('.sample-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
        const f = await createSampleFile(btn.dataset.sample || 'neutral');
        if (f) handleFile(f);
    });
});

if (cancelTaskBtn) {
    cancelTaskBtn.addEventListener('click', () => {
        forgeUserCancelled = true;
        if (activeAbortController) activeAbortController.abort();
    });
}

if (regenerateBtn) {
    regenerateBtn.addEventListener('click', () => {
        showForgePage('editor');
        if (currentMode === 'edit') {
            promptInput.focus();
            resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            generatePrompt.focus();
        }
    });
}

if (historyModalClose) {
    historyModalClose.addEventListener('click', closeHistoryModal);
}
if (historyModal) {
    historyModal.addEventListener('click', (e) => {
        if (e.target === historyModal) closeHistoryModal();
    });
}
if (historyModalOpenEditor) {
    historyModalOpenEditor.addEventListener('click', () => {
        if (!historyModalItem) return;
        showForgePage('editor');
        if (historyModalItem.mode === 'generate') {
            tabBtns.forEach((b) => b.classList.remove('active'));
            const gTab = document.querySelector('.tab-btn[data-mode="generate"]');
            if (gTab) gTab.classList.add('active');
            editMode.classList.remove('active');
            generateMode.classList.add('active');
            currentMode = 'generate';
            generatePrompt.value = historyModalItem.prompt || '';
            if (historyModalItem.params) {
                if (historyModalItem.params.width)
                    widthInput.value = historyModalItem.params.width;
                if (historyModalItem.params.height)
                    heightInput.value = historyModalItem.params.height;
                if (historyModalItem.params.steps)
                    stepsInput.value = historyModalItem.params.steps;
                if (historyModalItem.params.cfg != null)
                    cfgInput.value = historyModalItem.params.cfg;
            }
        } else {
            tabBtns.forEach((b) => b.classList.remove('active'));
            const eTab = document.querySelector('.tab-btn[data-mode="edit"]');
            if (eTab) eTab.classList.add('active');
            editMode.classList.add('active');
            generateMode.classList.remove('active');
            currentMode = 'edit';
            if (negativePrompt && historyModalItem.params)
                negativePrompt.value = historyModalItem.params.negative || '';
            const jNeg = document.getElementById('jewelryNegativePrompt');
            if (jNeg && historyModalItem.params)
                jNeg.value = historyModalItem.params.negative || '';
            const wtRev = {
                img2img_style: 'style',
                image_upscale: 'upscale',
                background_repaint: 'background',
                jewelry_retouch: 'jewelry_retouch',
                jewelry_product_cutout: 'jewelry_cutout',
                jewelry_scene: 'jewelry_scene',
                jewelry_macro_detail: 'jewelry_macro'
            };
            const wt = historyModalItem.params && historyModalItem.params.workflowTemplate;
            editIntentTask = wt
                ? wtRev[wt] || historyModalItem.taskType || 'style'
                : historyModalItem.taskType || 'style';
            if (isJewelryIntent()) {
                promptInput.value = '';
            } else {
                promptInput.value = historyModalItem.prompt || '';
            }
            renderEditPresetChips();
            populateJewelryUi();
            updateEditModeBanner();
            updateJewelryFlowLayout();
            updateEditButton();
        }
        closeHistoryModal();
    });
}

if (btnRefreshHealth) {
    btnRefreshHealth.addEventListener('click', () => runHealthToPanel());
}

if (btnClearHistory) {
    btnClearHistory.addEventListener('click', () => {
        const ok = confirm(
            currentLang === 'zh'
                ? '确定清空本地历史？'
                : 'Clear all local history?'
        );
        if (!ok) return;
        localStorage.removeItem(HISTORY_STORAGE_KEY);
        renderHistoryList();
    });
}

const jewelryPadRange = document.getElementById('jewelryPadRange');
const jewelryPadValue = document.getElementById('jewelryPadValue');
if (jewelryPadRange && jewelryPadValue) {
    jewelryPadRange.addEventListener('input', () => {
        jewelryPadValue.textContent = jewelryPadRange.value;
    });
}

const batchFileInput = document.getElementById('batchFileInput');
const batchPickBtn = document.getElementById('batchPickBtn');
const batchClearBtn = document.getElementById('batchClearBtn');
const batchRunBtn = document.getElementById('batchRunBtn');

if (batchPickBtn && batchFileInput) {
    batchPickBtn.addEventListener('click', () => batchFileInput.click());
}
if (batchFileInput) {
    batchFileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []).filter((f) =>
            f.type.startsWith('image/')
        );
        for (const f of files) {
            if (f.size <= 20 * 1024 * 1024) batchQueue.push(f);
        }
        e.target.value = '';
        renderBatchFileList();
    });
}
if (batchClearBtn) {
    batchClearBtn.addEventListener('click', () => {
        batchQueue = [];
        renderBatchFileList();
    });
}
if (batchRunBtn) {
    batchRunBtn.addEventListener('click', async () => {
        if (!batchQueue.length || !hasValidEditPromptCore()) return;

        editBtn.disabled = true;
        batchRunBtn.disabled = true;
        editBtn.querySelector('.btn-text').classList.add('hidden');
        editBtn.querySelector('.btn-loading').classList.remove('hidden');

        showLoadingProgress();
        activeAbortController = new AbortController();
        const tm = setTimeout(() => {
            try {
                activeAbortController.abort();
            } catch (_) {}
        }, TASK_CLIENT_TIMEOUT_MS);

        try {
            const q = batchQueue.slice();
            for (let i = 0; i < q.length; i++) {
                showLoadingProgress();
                const finalResult = await runEditStreamForFile(q[i]);
                await finalizeEditSuccess(finalResult);
            }
            batchQueue = [];
            renderBatchFileList();
        } catch (error) {
            hideLoadingProgress();
            resultSection.classList.add('hidden');
            if (forgeUserCancelled) {
                showAlert(i18n[currentLang]['task.cancelled']);
            } else if (
                error.name === 'AbortError' ||
                (error.message && error.message.includes('aborted'))
            ) {
                showAlert(i18n[currentLang]['task.timeout']);
            } else {
                showAlert(`Error: ${error.message}`);
            }
        } finally {
            forgeUserCancelled = false;
            clearTimeout(tm);
            activeAbortController = null;
            editBtn.disabled = false;
            editBtn.querySelector('.btn-text').classList.remove('hidden');
            editBtn.querySelector('.btn-loading').classList.add('hidden');
            renderBatchFileList();
        }
    });
}

// Initialize（邮箱会话 + 可选邀请码回退）
wireTopicDetailUi();
initCookieConsent();
wireAuthForms();
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await apiFetch(apiUrl('/api/auth/logout'), { method: 'POST' });
        } catch (_) {}
        sessionStorage.removeItem(AUTH_KEY);
        currentUser = null;
        currentAccessCode = null;
        currentAuthPortal = 'user';
        sessionIsAdmin = false;
        updateAdminNavVisibility();
        showForgePage('home');
        userInfo.classList.add('hidden');
        authOverlay.classList.remove('hidden');
        syncModalScrollLock();
    });
}

(async function bootAuth() {
    const ok = await restoreAuth();
    if (ok) {
        checkHealth();
        setInterval(checkHealth, 30000);
        loadPlans();
        loadForgePresets();
        showForgePage('home');
        syncModalScrollLock();
    } else {
        const le = document.getElementById('loginEmail');
        if (le) le.focus();
        syncModalScrollLock();
    }
})();
