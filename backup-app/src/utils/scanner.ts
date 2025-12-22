import { fetchPageWithCookies } from '@/utils/http';
import { parseFolders, parseFiles, parsePagination, addPagination, extractUsernameFromProfileUrl, parseUserSections } from '@/utils/parser';
import { mergeCookies } from '@/utils/cookies';
import * as cheerio from 'cheerio';
import type { Folder, File } from '@/types';

export async function scanFolder(
  url: string,
  cookies: Record<string, string>,
  parentPath: string = '',
  onCookiesUpdate?: (cookies: Record<string, string>) => void,
  skipPasswordProtected: boolean = false
): Promise<Folder> {
  console.log(`Scanning folder: ${url}`, { skipPasswordProtected });
  let currentCookies = cookies;
  const response = await fetchPageWithCookies(url, currentCookies);
  const html = response.html;
  if (Object.keys(response.cookies).length > 0) {
    currentCookies = mergeCookies(currentCookies, response.cookies);
    if (onCookiesUpdate) {
      onCookiesUpdate(currentCookies);
    }
  }
  
  const folders = parseFolders(html, skipPasswordProtected);
  let files = parseFiles(html);
  
  console.log(`Found ${folders.length} folders and ${files.length} files on page 1`);
  
  const maxPages = parsePagination(html);
  console.log(`Max pages: ${maxPages}`);
  
  if (maxPages && maxPages > 1) {
    for (let page = 2; page <= maxPages; page++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const pageUrl = addPagination(url, page);
      console.log(`Scanning page ${page}: ${pageUrl}`);
      const pageResponse = await fetchPageWithCookies(pageUrl, currentCookies);
      const pageHtml = pageResponse.html;
      if (Object.keys(pageResponse.cookies).length > 0) {
        currentCookies = mergeCookies(currentCookies, pageResponse.cookies);
        if (onCookiesUpdate) {
          onCookiesUpdate(currentCookies);
        }
      }
      const pageFiles = parseFiles(pageHtml);
      files = files.concat(pageFiles);
      console.log(`Found ${pageFiles.length} files on page ${page}`);
    }
  }
  
  const folderName = extractFolderNameFromHtml(html, url, parentPath);
  const currentPath = folderName ? (parentPath ? `${parentPath}/${folderName}` : folderName) : parentPath;
  
  console.log(`Scanning ${folders.length} subfolders...`);
  const scannedFolders = [];
  for (const folder of folders) {
    await new Promise(resolve => setTimeout(resolve, 200));
    const subfolderPath = currentPath ? `${currentPath}/${folder.name}` : folder.name;
    const scannedFolder = await scanFolder(folder.url, currentCookies, subfolderPath, onCookiesUpdate, skipPasswordProtected);
    scannedFolders.push(scannedFolder);
  }
  
  files.forEach(file => {
    file.path = currentPath ? `${currentPath}/${file.name}${file.extension}` : `${file.name}${file.extension}`;
  });
  
  const displayName = folderName || (parentPath ? parentPath.split('/').pop() || 'root' : 'root');
  console.log(`Completed scanning ${displayName}: ${files.length} files, ${scannedFolders.length} subfolders`);
  
  return {
    id: extractFolderId(url),
    name: displayName,
    url,
    path: currentPath || parentPath || '',
    files,
    folders: scannedFolders,
  };
}

function extractFolderNameFromHtml(html: string, url: string, parentPath?: string): string {
  if (parentPath && url.includes('/list/-/')) {
    return '';
  }
  if (url.includes('/list/-/')) {
    return '';
  }
  
  const $ = cheerio.load(html);
  const titleMatch = $('h1.sub-title_main').text().trim();
  if (titleMatch && titleMatch.includes('пользователя')) {
    return '';
  }
  
  const breadcrumb = $('.list-link__name, .js-dir_name').first().text().trim();
  if (breadcrumb) {
    return breadcrumb;
  }
  
  const match = url.match(/\/list\/([^\/]+)\//);
  if (match) {
    const urlName = match[1].split('-').slice(0, -1).join('-');
    return urlName || '';
  }
  
  return '';
}

function extractFolderId(url: string): string {
  const match = url.match(/Link_id=(\d+)/);
  return match ? match[1] : Date.now().toString();
}

export function collectAllFiles(folder: Folder): File[] {
  const filesMap = new Map<string, File>();
  
  folder.files.forEach(file => {
    filesMap.set(file.id, file);
  });
  
  folder.folders.forEach(subFolder => {
    const subFiles = collectAllFiles(subFolder);
    subFiles.forEach(file => {
      if (!filesMap.has(file.id)) {
        filesMap.set(file.id, file);
      }
    });
  });
  
  return Array.from(filesMap.values());
}

export async function scanProfileByUrl(
  profileUrl: string,
  cookies: Record<string, string>,
  onCookiesUpdate?: (cookies: Record<string, string>) => void
): Promise<{ folders: Folder[]; files: File[] }> {
  const username = extractUsernameFromProfileUrl(profileUrl);
  if (!username) {
    throw new Error('Не удалось извлечь username из URL профиля');
  }
  
  console.log(`Scanning profile for user: ${username}`);
  
  // Получаем HTML страницы профиля
  const baseUrl = 'https://spaces.im';
  const cleanProfileUrl = profileUrl.split('?')[0]; // Убираем query параметры
  const response = await fetchPageWithCookies(cleanProfileUrl, cookies);
  const html = response.html;
  
  let currentCookies = cookies;
  if (Object.keys(response.cookies).length > 0) {
    currentCookies = mergeCookies(currentCookies, response.cookies);
    if (onCookiesUpdate) {
      onCookiesUpdate(currentCookies);
    }
  }
  
  // Парсим секции пользователя
  const sections = parseUserSections(html, username, baseUrl);
  console.log(`Found ${sections.length} sections for user ${username}`);
  
  const allFolders: Folder[] = [];
  const allFiles: File[] = [];
  const filesMap = new Map<string, File>();
  
  // Сканируем каждую секцию, пропуская папки с паролем
  for (const section of sections) {
    console.log(`Scanning section: ${section.name} (${section.url})`);
    try {
      const rootFolder = await scanFolder(
        section.url,
        currentCookies,
        section.folderName,
        (newCookies) => {
          currentCookies = newCookies;
          if (onCookiesUpdate) {
            onCookiesUpdate(newCookies);
          }
        },
        true // skipPasswordProtected = true
      );
      
      allFolders.push(rootFolder);
      const files = collectAllFiles(rootFolder);
      
      files.forEach(file => {
        if (!filesMap.has(file.id)) {
          filesMap.set(file.id, file);
          allFiles.push(file);
        }
      });
      
      console.log(`Section ${section.name}: found ${files.length} files`);
    } catch (error) {
      console.error(`Error scanning section ${section.name}:`, error);
    }
  }
  
  console.log(`Total files collected from profile: ${allFiles.length}`);
  return { folders: allFolders, files: allFiles };
}

