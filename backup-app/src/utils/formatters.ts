export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function sanitizeFileName(fileName: string): string {
  const parts = fileName.split('/');
  const sanitizedParts = parts.map(part => part.replace(/[<>:"\\|?*]/g, '_'));
  return sanitizedParts.join('/');
}

export function extractFileNameFromUrl(url: string): { name: string; extension: string } {
  try {
    let pathname = url;
    
    if (url.includes('?')) {
      pathname = url.split('?')[0];
    }
    if (url.includes('#')) {
      pathname = pathname.split('#')[0];
    }
    
    const urlObj = new URL(pathname.startsWith('http') ? pathname : `https://example.com${pathname}`);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    const filename = pathParts[pathParts.length - 1] || '';
    
    if (!filename) {
      return { name: '', extension: '' };
    }
    
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === 0) {
      return { name: filename, extension: '' };
    }
    
    const name = filename.substring(0, lastDotIndex);
    const extension = filename.substring(lastDotIndex);
    
    return { name, extension };
  } catch {
    let cleanUrl = url;
    if (url.includes('?')) {
      cleanUrl = url.split('?')[0];
    }
    if (url.includes('#')) {
      cleanUrl = cleanUrl.split('#')[0];
    }
    
    const match = cleanUrl.match(/\/([^\/\?]+)$/);
    if (match) {
      const filename = match[1];
      const lastDotIndex = filename.lastIndexOf('.');
      if (lastDotIndex > 0 && lastDotIndex < filename.length - 1) {
        return {
          name: filename.substring(0, lastDotIndex),
          extension: filename.substring(lastDotIndex),
        };
      }
      return { name: filename, extension: '' };
    }
    return { name: '', extension: '' };
  }
}

