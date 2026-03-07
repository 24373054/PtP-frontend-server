# P2P Image Editor

Minimalist image editor powered by Flux2 Klein and ComfyUI.

## Features

- Upload images (JPG, PNG, WEBP)
- Edit with natural language instructions
- Clean, professional interface
- Real-time processing status

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure ComfyUI is running:
```bash
bash /home/Matrix/yz/AI-movie/ai-comic-drama/start_comfyui.sh
```

3. Start the server:
```bash
npm start
```

4. Open browser:
```
http://localhost:3000
```

## Usage

1. Upload an image
2. Describe your edits in the text area
3. Click "Edit Image"
4. Wait for processing (usually 10-30 seconds)
5. Download the result

## Example Prompts

- "Replace the background with a quiet coastal cliff at overcast sunset"
- "Change the sky to a starry night"
- "Add autumn leaves falling around the subject"
- "Make it look like a vintage photograph"

## Technical Details

- Frontend: Vanilla JS, no frameworks
- Backend: Node.js + Express
- Image Processing: ComfyUI + Flux2 Klein
- API: RESTful endpoints

## Directory Structure

```
p2p-server/
├── server.js          # Express server
├── package.json       # Dependencies
├── public/            # Frontend files
│   ├── index.html     # Main page
│   ├── style.css      # Styles
│   └── script.js      # Client logic
├── uploads/           # Temporary uploads
└── outputs/           # Generated images
```

## API Endpoints

### POST /api/edit
Edit an image with a text prompt.

Request:
- `image`: Image file (multipart/form-data)
- `prompt`: Edit instructions (text)

Response:
```json
{
  "success": true,
  "image": "/outputs/xxx.png",
  "prompt": "..."
}
```

### GET /api/health
Check server and ComfyUI status.

Response:
```json
{
  "status": "ok",
  "comfyui": "connected"
}
```
