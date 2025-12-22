import { downloadFileBuffer, fetchPage } from './http';
import * as cheerio from 'cheerio';
import type { File } from '../types';

async function extractDownloadUrlFromFilePage(fileUrl: string, cookies: Record<string, string>): Promise<string | null> {
  try {
    const html = await fetchPage(fileUrl, cookies);
    const $ = cheerio.load(html);
    
    let downloadLink: string | undefined;
    
    $('a').each((_, elem) => {
      const $elem = $(elem);
      const href = $elem.attr('href');
      const text = $elem.text().trim();
      const hasDownloadIcon = $elem.find('.ico_download2_blue, .ico_download, [class*="download"]').length > 0;
      const hasDownloadClass = $elem.hasClass('list-link-blue') || $elem.hasClass('c-blue');
      
      if (href && (text.includes('Скачать') || hasDownloadIcon || (hasDownloadClass && href.includes('/download/')))) {
        if (href.includes('/download/')) {
          downloadLink = href;
          return false;
        }
      }
    });
    
    if (!downloadLink) {
      downloadLink = $('a.list-link-blue[href*="/download/"]').first().attr('href');
    }
    if (!downloadLink) {
      downloadLink = $('a[href*="/files/download/"][target="_blank"]').first().attr('href');
    }
    if (!downloadLink) {
      downloadLink = $('a[href*="/download/"][href*="/files/"]').first().attr('href');
    }
    if (!downloadLink) {
      downloadLink = $('a[href*="/files/download/"]').first().attr('href');
    }
    
    if (downloadLink) {
      const fullUrl = downloadLink.startsWith('http') ? downloadLink : `https://spaces.im${downloadLink}`;
      console.log(`Extracted download URL from file page: ${fullUrl}`);
      return fullUrl;
    }
    
    console.log('No download link found on file page');
    return null;
  } catch (error) {
    console.error('Error extracting download URL from file page:', error);
    return null;
  }
}

export async function downloadFile(
  file: File,
  cookies: Record<string, string>,
  onProgress?: (loaded: number, total: number) => void
): Promise<ArrayBuffer> {
  let url = file.directUrl || file.downloadUrl;
  
  if (!url || url.includes('/view/') || !url.includes('/download/')) {
    let viewUrl = file.downloadUrl?.includes('/view/') 
      ? file.downloadUrl 
      : null;
    
    if (!viewUrl) {
      if (file.type === 7) {
        viewUrl = `https://spaces.im/pictures/view/${file.id}/`;
      } else if (file.type === 6) {
        viewUrl = `https://spaces.im/music/view/${file.id}/`;
      } else if (file.type === 5) {
        viewUrl = `https://spaces.im/files/view/${file.id}/`;
      } else {
        viewUrl = `https://spaces.im/files/view/${file.id}/`;
      }
    }
    
    console.log(`File ${file.name}${file.extension} (type: ${file.type}) has no direct download link, fetching from page: ${viewUrl}`);
    const extractedUrl = await extractDownloadUrlFromFilePage(viewUrl, cookies);
    if (extractedUrl) {
      url = extractedUrl;
    } else {
      console.warn(`Could not extract download URL for file ${file.name}${file.extension}, using fallback`);
      if (file.type === 7) {
        url = `https://spaces.im/pictures/download/${file.id}/`;
      } else if (file.type === 6) {
        url = `https://spaces.im/music/download/${file.id}/`;
      } else {
        url = `https://spaces.im/files/download/${file.id}/`;
      }
    }
  }
  
  return downloadFileBuffer(url, cookies, onProgress);
}
