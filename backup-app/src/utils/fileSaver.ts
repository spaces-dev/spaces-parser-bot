import type { File } from '@/types';
import type { SaveMode } from '@/types';
import { sanitizeFileName, extractFileNameFromUrl } from '@/utils/formatters';
import { config, buildSpacesUrl } from '@/config';
import axios from 'axios';
import { extractDownloadUrlFromFilePage } from '@/utils/downloader';

export async function downloadAndSaveFileOnServer(
  file: File,
  cookies: Record<string, string>,
  username: string,
  saveMode: SaveMode,
  onProgress?: (progress: number) => void
): Promise<void> {
  let fileUrl = file.directUrl || file.downloadUrl;
  
  if (!fileUrl || fileUrl.includes('/view/') || !fileUrl.includes('/download/')) {
    let viewUrl = file.downloadUrl?.includes('/view/') 
      ? file.downloadUrl 
      : buildSpacesUrl(file.type, file.id, 'view');
    
    const extractedUrl = await extractDownloadUrlFromFilePage(viewUrl, cookies);
    if (extractedUrl) {
      fileUrl = extractedUrl;
    } else {
      fileUrl = buildSpacesUrl(file.type, file.id, 'download');
    }
  }
  
  let finalName = file.name;
  let finalExtension = file.extension;
  
  if (fileUrl) {
    const urlFileInfo = extractFileNameFromUrl(fileUrl);
    if (urlFileInfo.name && !finalName) {
      finalName = urlFileInfo.name;
    }
    if (urlFileInfo.extension) {
      finalExtension = urlFileInfo.extension;
    }
  }
  
  let filePath: string;
  if (saveMode === 'flat') {
    filePath = `${finalName}${finalExtension}`;
  } else {
    if (file.path && file.path.includes('/')) {
      const pathParts = file.path.split('/');
      pathParts[pathParts.length - 1] = `${finalName}${finalExtension}`;
      filePath = pathParts.join('/');
    } else {
      filePath = `${finalName}${finalExtension}`;
    }
  }
  
  try {
    await axios.post(`${config.proxyUrl}/api/download-and-save`, {
      fileUrl,
      filePath: sanitizeFileName(filePath),
      cookies,
      saveMode,
      username,
    }, {
      timeout: config.timeouts.download,
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(progress);
        }
      },
    });
  } catch (error) {
    console.error('Error downloading and saving file on server:', error);
    throw error;
  }
}
