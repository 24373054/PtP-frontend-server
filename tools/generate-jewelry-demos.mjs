#!/usr/bin/env node
/**
 * 用本机 BFF + ComfyUI 真跑文生图 / 图生图，生成珠宝模式「效果示意」用的 before/after 资源。
 *
 * 用法（在 PtP-frontend-server 目录）：
 *   BASE_URL=http://127.0.0.1:38024 ACCESS_CODE=ptp2025 node tools/generate-jewelry-demos.mjs
 *
 * 产出：public/assets/jewelry-demo/thumb-*.jpg（420 边长内 fit）。
 * 全尺寸仅写临时目录；设 SAVE_FULL_PNG=1 才额外保留 before/after 的 .png 到 jewelry-demo。
 */
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'assets', 'jewelry-demo');

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:38024').replace(/\/$/, '');
const CODE = process.env.ACCESS_CODE || 'ptp2025';

const PRESETS = {
    categoryRingZh: '【戒指】俯视或四分之三主图角；戒圈与主石居中，反射均匀。\n',
    categoryRingEn: '[Ring] Top-down or 3/4 hero angle; band and stone centered; even reflections.\n',
    jewelry_metal_fire: {
        en: 'Polish precious metal reflections and gemstone fire; micro-contrast on facets; no geometry change.',
        zh: '强化贵金属反光与宝石火彩，刻面微对比，不改变几何外形。'
    },
    jewelry_white_pure: {
        en: 'Isolate product on pure white #FFFFFF seamless background; crisp edge; soft contact shadow only.',
        zh: '纯白无缝背景商品隔离；边缘利落，仅保留极轻接触阴影。'
    },
    background_main: {
        en: 'Replace or repaint ONLY the background; keep the foreground subject pixel-accurate with clean edges; seamless blend.',
        zh: '仅替换或重绘背景，前景主体边缘干净、与背景自然融合，不改变主体形状。'
    },
    scene_velvet: {
        en: 'Place on deep navy velvet with soft studio light, subtle gradient, premium catalog look.',
        zh: '深蓝丝绒衬底，柔和棚拍光，轻微渐变，高级目录风。'
    },
    upscale_main: {
        en: 'Enhance clarity and micro-detail: sharper edges, reduce noise, preserve original composition and content, avoid hallucinated new objects.',
        zh: '提升清晰度与细节：边缘更锐利、降噪，保持原构图与内容，不要凭空增加物体。'
    }
};

function fullUrl(rel) {
    if (!rel) return null;
    if (rel.startsWith('http')) return rel;
    return `${BASE}${rel.startsWith('/') ? rel : `/${rel}`}`;
}

const SAVE_FULL = process.env.SAVE_FULL_PNG === '1';

async function downloadToTemp(imageRel) {
    const u = fullUrl(imageRel);
    const r = await axios.get(u, { responseType: 'arraybuffer', timeout: 120000 });
    const tmp = path.join(os.tmpdir(), `jewel-demo-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    fs.writeFileSync(tmp, Buffer.from(r.data));
    return tmp;
}

async function thumbFromPng(pngPath, jpgPath) {
    fs.mkdirSync(path.dirname(jpgPath), { recursive: true });
    await sharp(pngPath)
        .resize(420, 420, { fit: 'inside', withoutEnlargement: false })
        .jpeg({ quality: 88 })
        .toFile(jpgPath);
}

function copyFullPng(tmp, name) {
    if (!SAVE_FULL) return;
    const dest = path.join(OUT, `${name}.png`);
    fs.mkdirSync(OUT, { recursive: true });
    fs.copyFileSync(tmp, dest);
    console.log(`  (full) → ${dest}`);
}

async function t2i(name, prompt) {
    console.log(`[T2I] ${name} …`);
    const r = await axios.post(
        `${BASE}/api/generate`,
        {
            prompt,
            width: 1024,
            height: 1024,
            steps: 4,
            cfg: 1,
            accessCode: CODE
        },
        { timeout: 600000 }
    );
    if (!r.data?.image) throw new Error(JSON.stringify(r.data));
    const tmp = await downloadToTemp(r.data.image);
    const jpg = path.join(OUT, `thumb-${name}.jpg`);
    await thumbFromPng(tmp, jpg);
    copyFullPng(tmp, name);
    console.log(`  → ${jpg}`);
    return tmp;
}

async function editPng(name, inputPng, workflowTemplate, prompt) {
    console.log(`[edit] ${name} (${workflowTemplate}) …`);
    const fd = new FormData();
    fd.append('image', fs.createReadStream(inputPng), { filename: 'input.png', contentType: 'image/png' });
    fd.append('prompt', prompt);
    fd.append('accessCode', CODE);
    fd.append('workflowTemplate', workflowTemplate);
    const r = await axios.post(`${BASE}/api/edit`, fd, {
        headers: fd.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 600000
    });
    if (!r.data?.image) throw new Error(JSON.stringify(r.data));
    const tmp = await downloadToTemp(r.data.image);
    const jpg = path.join(OUT, `thumb-${name}.jpg`);
    await thumbFromPng(tmp, jpg);
    copyFullPng(tmp, name);
    try {
        fs.unlinkSync(tmp);
    } catch (_) {}
    console.log(`  → ${jpg}`);
}

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    console.log(`BASE=${BASE} CODE=${CODE?.slice(0, 4)}…`);

    const zh = process.env.LANG !== 'en';

    const cat = zh ? PRESETS.categoryRingZh : PRESETS.categoryRingEn;

    const beforeRetouch = await t2i(
        'before-retouch',
        zh
            ? '金戒指镶嵌方形蓝宝石，放在深棕色粗布上，手机随手拍，光线不均、略发灰，真实产品照，杂乱阴影。'
            : 'Gold ring with square blue gemstone on dark brown rough fabric, uneven smartphone lighting, slightly gray, realistic product photo, messy shadows.'
    );

    const beforeCutout = await t2i(
        'before-cutout',
        zh
            ? '同一款金戒指蓝宝石，放在杂乱木纹桌面，背景有彩色杂物虚化，电商未修原片。'
            : 'Same style gold ring blue gemstone on cluttered wood table, colorful blurred clutter in background, raw e-commerce photo.'
    );

    const beforeScene = await t2i(
        'before-scene',
        zh
            ? '金戒指蓝宝石，浅灰无缝纸背景，顶光平淡无趣，像未布景的棚拍底片。'
            : 'Gold ring blue gemstone on plain light gray seamless paper, flat boring top light, unstyled studio plate.'
    );

    const beforeMacro = await t2i(
        'before-macro',
            zh
            ? '金戒指蓝宝石在白色大理石台面，主体在画面中偏小，略软，适合再做微距放大。'
            : 'Gold ring blue gemstone on white marble, subject small in frame, slightly soft, good for macro upscale.'
    );

    await editPng(
        'after-retouch',
        beforeRetouch,
        'jewelry_retouch',
        `${cat}${PRESETS.jewelry_metal_fire[zh ? 'zh' : 'en']}`
    );
    try {
        fs.unlinkSync(beforeRetouch);
    } catch (_) {}

    await editPng(
        'after-cutout',
        beforeCutout,
        'jewelry_product_cutout',
        `${cat}${PRESETS.jewelry_white_pure[zh ? 'zh' : 'en']}`
    );
    try {
        fs.unlinkSync(beforeCutout);
    } catch (_) {}

    await editPng(
        'after-scene',
        beforeScene,
        'jewelry_scene',
        `${cat}${PRESETS.background_main[zh ? 'zh' : 'en']}\n${PRESETS.scene_velvet[zh ? 'zh' : 'en']}`
    );
    try {
        fs.unlinkSync(beforeScene);
    } catch (_) {}

    await editPng(
        'after-macro',
        beforeMacro,
        'jewelry_macro_detail',
        `${cat}${PRESETS.upscale_main[zh ? 'zh' : 'en']}`
    );
    try {
        fs.unlinkSync(beforeMacro);
    } catch (_) {}

    console.log('Done. Files in public/assets/jewelry-demo/');
}

main().catch((e) => {
    console.error(e.response?.data || e.message || e);
    process.exit(1);
});
