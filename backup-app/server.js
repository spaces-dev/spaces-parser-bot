import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

app.use(cors());
app.use(express.json({ limit: '100mb' }));

if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

app.post('/api/fetch', async (req, res) => {
  try {
    const { url, cookies } = req.body;
    
    const cookieString = typeof cookies === 'string' 
      ? cookies 
      : Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    
    const response = await axios.get(url, {
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,uk;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Cache-Control': 'max-age=0',
        'Referer': url.includes('spaces.im') ? 'https://spaces.im/' : url,
        'Sec-Ch-Ua': '"Microsoft Edge";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Linux"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 180000,
    });
    
    const setCookieHeaders = response.headers['set-cookie'] || [];
    const cookiesFromResponse = {};
    
    setCookieHeaders.forEach(cookieStr => {
      const parts = cookieStr.split(';')[0].split('=');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (name && value) {
          cookiesFromResponse[name] = value;
        }
      }
    });
    
    res.json({
      html: response.data,
      cookies: cookiesFromResponse,
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      details: error.response?.data 
    });
  }
});

app.post('/api/download', async (req, res) => {
  try {
    const { url, cookies } = req.body;
    
    const cookieString = typeof cookies === 'string' 
      ? cookies 
      : Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    
    const response = await axios.get(url, {
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9,uk;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Referer': url.includes('spaces.im') ? 'https://spaces.im/' : url,
        'Sec-Ch-Ua': '"Microsoft Edge";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Linux"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
      },
      responseType: 'arraybuffer',
      timeout: 300000,
    });
    
    res.set({
      'Content-Type': response.headers['content-type'] || 'application/octet-stream',
      'Content-Length': response.data.length,
    });
    
    res.send(Buffer.from(response.data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/download-and-save', async (req, res) => {
  try {
    const { fileUrl, filePath, cookies, saveMode, username } = req.body;
    
    if (!fileUrl || !filePath) {
      return res.status(400).json({ error: 'fileUrl and filePath are required' });
    }
    
    const cookieString = typeof cookies === 'string' 
      ? cookies 
      : Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    
    const downloadResponse = await axios.get(fileUrl, {
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9,uk;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Referer': fileUrl.includes('spaces.im') ? 'https://spaces.im/' : fileUrl,
        'Sec-Ch-Ua': '"Microsoft Edge";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Linux"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
      },
      responseType: 'arraybuffer',
      timeout: 300000,
    });
    
    let finalFilePath = filePath;
    let urlExt = '';
    try {
      const urlObj = new URL(fileUrl);
      urlExt = path.extname(urlObj.pathname);
    } catch {
      const match = fileUrl.match(/\/([^\/\?]+)$/);
      if (match) {
        const filename = match[1];
        const lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex > 0 && lastDotIndex < filename.length - 1) {
          urlExt = filename.substring(lastDotIndex);
        }
      }
    }
    
    const currentExt = path.extname(filePath);
    
    if (!currentExt && urlExt) {
      finalFilePath = filePath + urlExt;
    } else if (!currentExt && !urlExt) {
      const contentType = downloadResponse.headers['content-type'];
      const contentTypeMap = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'video/mp4': '.mp4',
        'video/avi': '.avi',
        'video/mkv': '.mkv',
        'audio/mpeg': '.mp3',
        'audio/mp3': '.mp3',
        'audio/wav': '.wav',
        'application/pdf': '.pdf',
        'application/zip': '.zip',
        'text/plain': '.txt',
        'text/html': '.html',
        'application/json': '.json',
      };
      
      if (contentType) {
        const ext = contentTypeMap[contentType.split(';')[0].trim()];
        if (ext) {
          finalFilePath = filePath + ext;
        }
      }
    }
    
    const baseDir = path.join(DOWNLOADS_DIR, username || 'default');
    const fullPath = saveMode === 'flat' 
      ? path.join(baseDir, path.basename(finalFilePath))
      : path.join(baseDir, finalFilePath);
    
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, Buffer.from(downloadResponse.data));
    
    res.json({ 
      success: true, 
      path: fullPath,
      size: downloadResponse.data.byteLength,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/save-file', async (req, res) => {
  try {
    const { filePath, fileData, saveMode, username } = req.body;
    
    if (!filePath || !fileData) {
      return res.status(400).json({ error: 'filePath and fileData are required' });
    }
    
    const baseDir = path.join(DOWNLOADS_DIR, username || 'default');
    const fullPath = saveMode === 'flat' 
      ? path.join(baseDir, path.basename(filePath))
      : path.join(baseDir, filePath);
    
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const buffer = Buffer.from(fileData, 'base64');
    fs.writeFileSync(fullPath, buffer);
    
    res.json({ success: true, path: fullPath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`Downloads directory: ${DOWNLOADS_DIR}`);
});

