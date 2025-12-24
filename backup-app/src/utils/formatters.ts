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
  let cleanUrl = url;
  
  // Убираем query параметры и hash
  const queryIndex = url.indexOf('?');
  if (queryIndex !== -1) {
    cleanUrl = url.substring(0, queryIndex);
  }
  const hashIndex = cleanUrl.indexOf('#');
  if (hashIndex !== -1) {
    cleanUrl = cleanUrl.substring(0, hashIndex);
  }
  
  // Извлекаем имя файла из пути
  const match = cleanUrl.match(/\/([^\/\?]+)$/);
  if (!match || !match[1]) {
    return { name: '', extension: '' };
  }
  
  const filename = match[1];
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === 0) {
    return { name: filename, extension: '' };
  }
  
  const name = filename.substring(0, lastDotIndex);
  const extension = filename.substring(lastDotIndex);
  
  return { name, extension };
}

