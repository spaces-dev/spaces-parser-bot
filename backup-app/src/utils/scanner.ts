import { fetchPage } from './http';
import { parseFolders, parseFiles, parsePagination, addPagination } from './parser';
import type { Folder, File } from '../types';

export async function scanFolder(
  url: string,
  cookies: Record<string, string>,
  parentPath: string = ''
): Promise<Folder> {
  console.log(`Scanning folder: ${url}`);
  const html = await fetchPage(url, cookies);
  
  const folders = parseFolders(html);
  let files = parseFiles(html);
  
  console.log(`Found ${folders.length} folders and ${files.length} files on page 1`);
  
  const maxPages = parsePagination(html);
  console.log(`Max pages: ${maxPages}`);
  
  if (maxPages && maxPages > 1) {
    for (let page = 2; page <= maxPages; page++) {
      const pageUrl = addPagination(url, page);
      console.log(`Scanning page ${page}: ${pageUrl}`);
      const pageHtml = await fetchPage(pageUrl, cookies);
      const pageFiles = parseFiles(pageHtml);
      files = files.concat(pageFiles);
      console.log(`Found ${pageFiles.length} files on page ${page}`);
    }
  }
  
  const folderName = extractFolderName(url);
  const currentPath = parentPath ? `${parentPath}/${folderName}` : folderName;
  
  console.log(`Scanning ${folders.length} subfolders...`);
  const scannedFolders = await Promise.all(
    folders.map(folder => 
      scanFolder(folder.url, cookies, currentPath)
    )
  );
  
  files.forEach(file => {
    file.path = `${currentPath}/${file.name}${file.extension}`;
  });
  
  console.log(`Completed scanning ${folderName}: ${files.length} files, ${scannedFolders.length} subfolders`);
  
  return {
    id: extractFolderId(url),
    name: folderName,
    url,
    path: currentPath,
    files,
    folders: scannedFolders,
  };
}

function extractFolderName(url: string): string {
  if (url.includes('/list/-/')) {
    if (url.includes('/pictures/')) return 'Фотографии';
    if (url.includes('/music/')) return 'Музыка';
    if (url.includes('/video/')) return 'Видео';
    if (url.includes('/files/')) return 'Файлы';
    return 'root';
  }
  const match = url.match(/\/list\/([^\/]+)\//);
  return match ? match[1].split('-').slice(0, -1).join('-') : 'unknown';
}

function extractFolderId(url: string): string {
  const match = url.match(/Link_id=(\d+)/);
  return match ? match[1] : Date.now().toString();
}

export function collectAllFiles(folder: Folder): File[] {
  let files = [...folder.files];
  folder.folders.forEach(subFolder => {
    files = files.concat(collectAllFiles(subFolder));
  });
  return files;
}

