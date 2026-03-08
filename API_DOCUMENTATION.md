# Flux2 Image Generation API Documentation

**Base URL**: `http://140.143.183.163:38024` (Internal) / `https://ptp.matrixlabs.cn` (Public)

**Version**: 1.0.0

**Last Updated**: 2026-03-07

---

## Overview

This API provides two AI-powered image generation capabilities using Flux2 Klein 9B model:

1. **Image-to-Image (P2P)**: Edit existing images with text instructions
2. **Text-to-Image (T2I)**: Generate new images from text descriptions

Both endpoints use ComfyUI workflows running on GPU servers with automatic load balancing through FRP.

---

## Authentication

All API requests require an access token in the session. For web interface access, use the beta code: `ptp2025`

For programmatic access, include the token in your session storage or implement your own authentication layer.

---

## API Endpoints

### 1. Health Check

Check if the service and ComfyUI backend are available.

**Endpoint**: `GET /api/health`

**Response**:
```json
{
  "status": "ok",
  "comfyui": "connected"
}
```

**Status Codes**:
- `200`: Service is healthy
- `503`: Service unavailable

---

### 2. Image-to-Image Editing (P2P)

Edit an existing image using natural language instructions. Based on Flux2 Klein's prompt-to-prompt editing capabilities.

**Endpoint**: `POST /api/edit`

**Content-Type**: `multipart/form-data`

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` | File | Yes | Image file (JPG, PNG, WEBP). Max 20MB |
| `prompt` | String | Yes | Text instructions describing the desired edits |

**Example Request (cURL)**:
```bash
curl -X POST https://ptp.matrixlabs.cn/api/edit \
  -F "image=@/path/to/image.jpg" \
  -F "prompt=Replace the background with a sunset beach scene"
```

**Example Request (Python)**:
```python
import requests

url = "https://ptp.matrixlabs.cn/api/edit"
files = {
    'image': open('input.jpg', 'rb')
}
data = {
    'prompt': 'Replace the background with a sunset beach scene'
}

response = requests.post(url, files=files, data=data)
result = response.json()
print(result)
```

**Example Request (JavaScript)**:
```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('prompt', 'Replace the background with a sunset beach scene');

fetch('https://ptp.matrixlabs.cn/api/edit', {
    method: 'POST',
    body: formData
})
.then(response => response.json())
.then(data => console.log(data));
```

**Response**:
```json
{
  "success": true,
  "image": "/outputs/abc123.png",
  "thumbnail": "/outputs/thumb_abc123.jpg",
  "prompt": "Replace the background with a sunset beach scene"
}
```

**Response Fields**:
- `success` (boolean): Whether the operation succeeded
- `image` (string): Relative URL path to the original high-resolution image
- `thumbnail` (string): Relative URL path to the thumbnail (800px width, optimized for fast preview)
- `prompt` (string): The prompt that was used

**Full Image URLs**: 
- Original: `https://ptp.matrixlabs.cn/outputs/abc123.png`
- Thumbnail: `https://ptp.matrixlabs.cn/outputs/thumb_abc123.jpg`

**Performance Optimization**:
- The API returns both original and thumbnail URLs
- Thumbnail is ~10-20% the size of the original for faster loading
- Use `thumbnail` for preview/display, `image` for download/save
- Thumbnail: 800px max width, JPEG format, 85% quality

**Processing Time**: Typically 10-30 seconds depending on image size and complexity

**Error Response**:
```json
{
  "error": "Failed to process image",
  "details": "Timeout waiting for image generation"
}
```

**Status Codes**:
- `200`: Success
- `400`: Bad request (missing parameters or invalid file)
- `500`: Server error

**Prompt Guidelines**:
- Be specific about what to change
- Mention what to keep unchanged
- Use descriptive language
- Examples:
  - ✓ "Replace the background with a quiet coastal cliff at overcast sunset. Keep the subject's pose unchanged."
  - ✓ "Change the sky to starry night, add northern lights"
  - ✓ "Make it look like a vintage 1980s photograph with film grain"
  - ✗ "Make it better" (too vague)

**Technical Details**:
- Model: Flux2 Klein 9B FP8
- Resolution: Automatically scaled to 1 megapixel
- Steps: 4 (fast inference)
- CFG: 1.0
- Sampler: Euler

---

### 3. Text-to-Image Generation (T2I)

Generate new images from text descriptions using Flux2 Klein model.

**Endpoint**: `POST /api/generate`

**Content-Type**: `application/json`

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | String | Yes | - | Text description of the image to generate |
| `width` | Integer | No | 1024 | Image width in pixels (256-2048) |
| `height` | Integer | No | 1024 | Image height in pixels (256-2048) |
| `steps` | Integer | No | 4 | Number of diffusion steps (1-50, Flux2 Klein optimized for 4 steps) |
| `cfg` | Float | No | 1.0 | Classifier-free guidance scale (Flux2 Klein optimized for 1.0) |

**Example Request (cURL)**:
```bash
curl -X POST https://ptp.matrixlabs.cn/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A vintage motorcycle parked in front of a retro diner at sunset, warm orange and pink sky, neon signs glowing, 80s vintage photo style, film grain",
    "width": 1024,
    "height": 1024,
    "steps": 20,
    "cfg": 5.0
  }'
```

**Example Request (Python)**:
```python
import requests

url = "https://ptp.matrixlabs.cn/api/generate"
data = {
    "prompt": "A serene mountain landscape at dawn, misty valleys, golden sunlight",
    "width": 1024,
    "height": 1024,
    "steps": 4,
    "cfg": 1.0
}

response = requests.post(url, json=data)
result = response.json()
print(f"Image URL: https://ptp.matrixlabs.cn{result['image']}")
```

**Example Request (JavaScript)**:
```javascript
fetch('https://ptp.matrixlabs.cn/api/generate', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        prompt: 'A futuristic cityscape at night, neon lights, cyberpunk style',
        width: 1024,
        height: 1024,
        steps: 4,
        cfg: 1.0
    })
})
.then(response => response.json())
.then(data => {
    console.log('Generated image:', data.image);
    // Display image: <img src={`https://ptp.matrixlabs.cn${data.image}`} />
});
```

**Response**:
```json
{
  "success": true,
  "image": "/outputs/xyz789.png",
  "thumbnail": "/outputs/thumb_xyz789.jpg",
  "prompt": "A vintage motorcycle parked in front of a retro diner at sunset...",
  "width": 1024,
  "height": 1024,
  "seed": 432262096973502
}
```

**Response Fields**:
- `success` (boolean): Whether the operation succeeded
- `image` (string): Relative URL path to the original high-resolution image
- `thumbnail` (string): Relative URL path to the thumbnail (800px width, optimized for fast preview)
- `prompt` (string): The prompt that was used
- `width` (integer): Generated image width
- `height` (integer): Generated image height
- `seed` (integer): Random seed used (for reproducibility)

**Full Image URLs**: 
- Original: `https://ptp.matrixlabs.cn/outputs/xyz789.png`
- Thumbnail: `https://ptp.matrixlabs.cn/outputs/thumb_xyz789.jpg`

**Performance Optimization**:
- The API returns both original and thumbnail URLs
- Thumbnail is ~10-20% the size of the original for faster loading
- Use `thumbnail` for preview/display, `image` for download/save
- Thumbnail: 800px max width, JPEG format, 85% quality

**Processing Time**: Typically 5-15 seconds depending on resolution (Flux2 Klein is optimized for fast inference)

**Error Response**:
```json
{
  "error": "Failed to generate image",
  "details": "Timeout waiting for image generation"
}
```

**Status Codes**:
- `200`: Success
- `400`: Bad request (missing prompt or invalid parameters)
- `500`: Server error

**Prompt Guidelines for T2I**:
- Be descriptive and specific
- Include style, lighting, mood, composition
- Mention artistic style or photography type
- Examples:
  - ✓ "A vintage motorcycle parked in front of a retro diner at sunset, warm orange and pink sky, neon signs glowing, 80s vintage photo style, film grain"
  - ✓ "Portrait of a young woman with flowing red hair, soft natural lighting, shallow depth of field, professional photography, bokeh background"
  - ✓ "Futuristic cityscape at night, neon lights reflecting on wet streets, cyberpunk style, cinematic composition, high contrast"
  - ✗ "A nice picture" (too vague)

**Parameter Guidelines**:
- **Width/Height**: Multiples of 64 work best. Common: 512, 768, 1024, 1536
- **Steps**: 
  - 4: Optimal for Flux2 Klein (fast, high quality)
  - 8-12: Higher quality, slower
  - 20+: Diminishing returns for Flux2 Klein
- **CFG**: 
  - 1.0: Optimal for Flux2 Klein (recommended)
  - 1.5-3.0: More guidance, may reduce quality
  - Higher values not recommended for Flux2 Klein

**Technical Details**:
- Model: Flux2 Klein 9B FP8 (optimized for fast inference)
- Sampler: Euler
- VAE: Flux2 VAE
- Default Steps: 4 (optimal for Flux2 Klein)
- Default CFG: 1.0 (optimal for Flux2 Klein)
- Max Resolution: 2048x2048
- Recommended: 1024x1024 or 1024x1408 (portrait)

---

## Integration Examples

### Node.js/Express Integration

```javascript
const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const app = express();

// Proxy to P2P service
app.post('/edit-image', async (req, res) => {
    try {
        const formData = new FormData();
        formData.append('image', fs.createReadStream(req.file.path));
        formData.append('prompt', req.body.prompt);
        
        const response = await axios.post(
            'https://ptp.matrixlabs.cn/api/edit',
            formData,
            { headers: formData.getHeaders() }
        );
        
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000);
```

### Python/Flask Integration

```python
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

@app.route('/edit-image', methods=['POST'])
def edit_image():
    """Image-to-Image editing"""
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    files = {'image': request.files['image']}
    data = {'prompt': request.form.get('prompt')}
    
    response = requests.post(
        'https://ptp.matrixlabs.cn/api/edit',
        files=files,
        data=data
    )
    
    return jsonify(response.json())

@app.route('/generate-image', methods=['POST'])
def generate_image():
    """Text-to-Image generation"""
    data = request.get_json()
    
    response = requests.post(
        'https://ptp.matrixlabs.cn/api/generate',
        json=data
    )
    
    return jsonify(response.json())

if __name__ == '__main__':
    app.run(port=5000)
```

### React Frontend Integration

```jsx
import React, { useState } from 'react';

function ImageEditor() {
    const [image, setImage] = useState(null);
    const [prompt, setPrompt] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    // Image-to-Image editing
    const handleEdit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData();
        formData.append('image', image);
        formData.append('prompt', prompt);

        try {
            const response = await fetch('https://ptp.matrixlabs.cn/api/edit', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            setResult(`https://ptp.matrixlabs.cn${data.image}`);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    // Text-to-Image generation
    const handleGenerate = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch('https://ptp.matrixlabs.cn/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    width: 1024,
                    height: 1024,
                    steps: 20,
                    cfg: 5.0
                })
            });
            const data = await response.json();
            setResult(`https://ptp.matrixlabs.cn${data.image}`);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h2>Image Editor</h2>
            <form onSubmit={handleEdit}>
                <input 
                    type="file" 
                    onChange={(e) => setImage(e.target.files[0])}
                    accept="image/*"
                />
                <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your edits or image..."
                />
                <button type="submit" disabled={loading}>
                    {loading ? 'Processing...' : 'Edit Image'}
                </button>
                <button type="button" onClick={handleGenerate} disabled={loading}>
                    {loading ? 'Processing...' : 'Generate from Text'}
                </button>
            </form>
            {result && <img src={result} alt="Result" />}
        </div>
    );
}
```

---

## Rate Limiting & Best Practices

**Current Limits**:
- No hard rate limits currently enforced
- Recommended: Max 10 concurrent requests
- Processing time: 10-30 seconds per request

**Best Practices**:
1. **Implement client-side queuing** for multiple requests
2. **Show progress indicators** to users (processing takes time)
3. **Cache results** when possible (same image + prompt = same result with fixed seed)
4. **Validate file sizes** before upload (max 20MB)
5. **Handle timeouts gracefully** (set timeout to 5 minutes)
6. **Compress images** before upload if possible
7. **Use appropriate image formats**: JPG for photos, PNG for graphics

---

## Error Handling

**Common Errors**:

| Error | Cause | Solution |
|-------|-------|----------|
| `No image uploaded` | Missing image file | Include image in multipart form |
| `Prompt is required` | Empty or missing prompt | Provide non-empty prompt text |
| `Only image files are allowed` | Invalid file type | Use JPG, PNG, or WEBP |
| `File size must be less than 20MB` | File too large | Compress or resize image |
| `Timeout waiting for image generation` | ComfyUI overloaded or crashed | Retry after a few minutes |
| `Service unavailable` | ComfyUI not running | Contact administrator |

**Error Response Format**:
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

---

## System Architecture

```
┌─────────────┐
│   Client    │
│ Application │
└──────┬──────┘
       │ HTTPS
       ↓
┌─────────────────────┐
│  Public Server      │
│  140.143.183.163    │
│  ├─ Nginx (SSL)     │
│  └─ FRP Server      │
└──────┬──────────────┘
       │ FRP Tunnel
       │ Port 38024
       ↓
┌─────────────────────┐
│  Campus Server      │
│  10.143.12.80       │
│  ├─ Node.js API     │
│  └─ ComfyUI         │
│     └─ Flux2 Klein  │
│        8x A100 40GB │
└─────────────────────┘
```

**Components**:
- **Nginx**: SSL termination, reverse proxy
- **FRP**: Internal network penetration
- **Node.js**: API server, request handling
- **ComfyUI**: Workflow execution engine
- **Flux2 Klein**: AI model (9B parameters, FP8 quantized)

---

## Performance Metrics

**Hardware**:
- GPU: 8x NVIDIA A100 40GB
- Model: Flux2 Klein 9B FP8
- VRAM Usage: ~10GB per request

**Benchmarks**:
- Image-to-Image (P2P): 10-15 seconds (4 steps)
- Text-to-Image (T2I): 5-15 seconds (4 steps, Flux2 Klein fast mode)
- Throughput: ~6-10 images/minute (single GPU)
- Max Resolution: 2048x2048 (1024x1024 recommended)

---

## Changelog

### v1.0.0 (2026-03-07)
- Initial release
- Image-to-Image editing API
- Text-to-Image workflow documentation
- Access code authentication
- Mobile responsive web interface
- HTTPS support with Let's Encrypt

---

## Support & Contact

**Issues**: Report bugs or request features via GitHub Issues

**Documentation**: This file is maintained at `/home/Matrix/yz/AI-movie/p2p-server/API_DOCUMENTATION.md`

**Model Information**:
- Flux2 Klein: https://huggingface.co/black-forest-labs/FLUX.2-klein-9b-fp8
- ComfyUI: https://github.com/comfyanonymous/ComfyUI

---

## License & Usage Terms

This API is provided for internal testing and development purposes. 

**Restrictions**:
- Beta access only (access code required)
- No commercial use without permission
- Rate limits may be enforced
- Service availability not guaranteed

**Model License**: Flux2 Klein follows Black Forest Labs' licensing terms

---

**End of Documentation**
