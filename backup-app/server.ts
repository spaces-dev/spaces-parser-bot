import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const BASE_DOMAIN = 'spaces.im';
const BASE_URL = `https://${BASE_DOMAIN}`;

interface HeaderOptions {
  accept?: string;
  cacheControl?: string;
  fetchDest?: string;
  fetchMode?: string;
  fetchUser?: string;
  upgradeInsecure?: boolean;
}

const getRequestHeaders = (url: string, cookieString: string, options: HeaderOptions = {}): Record<string, string> => {
  const isBaseDomain = url.includes(BASE_DOMAIN);
  const referer = isBaseDomain ? `${BASE_URL}/` : url;
  
  const headers: Record<string, string> = {
    'Cookie': cookieString,
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
    'Accept': options.accept || '*/*',
    'Accept-Language': 'en-US,en;q=0.9,uk;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Referer': referer,
    'Sec-Ch-Ua': '"Microsoft Edge";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Linux"',
    'Sec-Fetch-Dest': options.fetchDest || 'empty',
    'Sec-Fetch-Mode': options.fetchMode || 'cors',
    'Sec-Fetch-Site': 'same-origin',
  };

  if (options.cacheControl) {
    headers['Cache-Control'] = options.cacheControl;
  }
  if (options.fetchUser) {
    headers['Sec-Fetch-User'] = options.fetchUser;
  }
  if (options.upgradeInsecure) {
    headers['Upgrade-Insecure-Requests'] = '1';
  }

  return headers;
};

app.use(cors());
app.use(express.json({ limit: '100mb' }));

if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

app.post('/api/fetch', async (req: Request, res: Response) => {
  try {
    const { url, cookies } = req.body;
    
    const cookieString = typeof cookies === 'string' 
      ? cookies 
      : Object.entries(cookies as Record<string, string>).map(([k, v]) => `${k}=${v}`).join('; ');
    
    const response = await axios.get<string>(url, {
      headers: getRequestHeaders(url, cookieString, {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        cacheControl: 'max-age=0',
        fetchDest: 'document',
        fetchMode: 'navigate',
        fetchUser: '?1',
        upgradeInsecure: true,
      }),
      timeout: 180000,
    });
    
    const setCookieHeaders = response.headers['set-cookie'] || [];
    const cookiesFromResponse: Record<string, string> = {};
    
    setCookieHeaders.forEach((cookieStr: string) => {
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
    const axiosError = error as { message: string; response?: { data?: unknown } };
    res.status(500).json({ 
      error: axiosError.message,
      details: axiosError.response?.data 
    });
  }
});

app.post('/api/download', async (req: Request, res: Response) => {
  try {
    const { url, cookies } = req.body;
    
    const cookieString = typeof cookies === 'string' 
      ? cookies 
      : Object.entries(cookies as Record<string, string>).map(([k, v]) => `${k}=${v}`).join('; ');
    
    const response = await axios.get<ArrayBuffer>(url, {
      headers: getRequestHeaders(url, cookieString),
      responseType: 'arraybuffer',
      timeout: 300000,
    });
    
    res.set({
      'Content-Type': response.headers['content-type'] || 'application/octet-stream',
      'Content-Length': response.data.byteLength.toString(),
    });
    
    res.send(Buffer.from(response.data));
  } catch (error) {
    const axiosError = error as { message: string };
    res.status(500).json({ error: axiosError.message });
  }
});

app.post('/api/download-and-save', async (req: Request, res: Response) => {
  try {
    const { fileUrl, filePath, cookies, saveMode, username } = req.body;
    
    if (!fileUrl || !filePath) {
      return res.status(400).json({ error: 'fileUrl and filePath are required' });
    }
    
    const cookieString = typeof cookies === 'string' 
      ? cookies 
      : Object.entries(cookies as Record<string, string>).map(([k, v]) => `${k}=${v}`).join('; ');
    
    const downloadResponse = await axios.get<ArrayBuffer>(fileUrl, {
      headers: getRequestHeaders(fileUrl, cookieString),
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
    }
    
    const baseDir = path.join(DOWNLOADS_DIR, username || 'default');
    let fullPath = saveMode === 'flat' 
      ? path.join(baseDir, path.basename(finalFilePath))
      : path.join(baseDir, finalFilePath);
    
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    if (fs.existsSync(fullPath)) {
      const fileBuffer = Buffer.from(downloadResponse.data);
      const hash = crypto.createHash('md5').update(fileBuffer).digest('hex').substring(0, 8);
      const ext = path.extname(fullPath);
      const nameWithoutExt = path.basename(fullPath, ext);
      const dirPath = path.dirname(fullPath);
      fullPath = path.join(dirPath, `${nameWithoutExt}_${hash}${ext}`);
    }
    
    fs.writeFileSync(fullPath, Buffer.from(downloadResponse.data));
    
    res.json({ 
      success: true, 
      path: fullPath,
      size: downloadResponse.data.byteLength,
    });
  } catch (error) {
    const axiosError = error as { message: string };
    res.status(500).json({ error: axiosError.message });
  }
});

app.post('/api/save-file', async (req: Request, res: Response) => {
  try {
    const { filePath, fileData, saveMode, username } = req.body;
    
    if (!filePath || !fileData) {
      return res.status(400).json({ error: 'filePath and fileData are required' });
    }
    
    const baseDir = path.join(DOWNLOADS_DIR, username || 'default');
    let fullPath = saveMode === 'flat' 
      ? path.join(baseDir, path.basename(filePath))
      : path.join(baseDir, filePath);
    
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const buffer = Buffer.from(fileData, 'base64');
    
    if (fs.existsSync(fullPath)) {
      const hash = crypto.createHash('md5').update(buffer).digest('hex').substring(0, 8);
      const ext = path.extname(fullPath);
      const nameWithoutExt = path.basename(fullPath, ext);
      const dirPath = path.dirname(fullPath);
      fullPath = path.join(dirPath, `${nameWithoutExt}_${hash}${ext}`);
    }
    
    fs.writeFileSync(fullPath, buffer);
    
    res.json({ success: true, path: fullPath });
  } catch (error) {
    const axiosError = error as { message: string };
    res.status(500).json({ error: axiosError.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`Downloads directory: ${DOWNLOADS_DIR}`);
});

