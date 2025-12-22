import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

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
      timeout: 30000,
    });
    
    res.send(response.data);
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
      timeout: 60000,
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

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});

