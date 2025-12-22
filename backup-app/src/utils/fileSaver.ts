import type { Folder, File } from '../types';
import type { SaveMode } from '../types';
import { sanitizeFileName } from './formatters';

export async function selectDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if ('showDirectoryPicker' in window) {
    try {
      const handle = await (window as any).showDirectoryPicker();
      if (handle && 'requestPermission' in handle) {
        const permission = await handle.requestPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          throw new Error('Permission denied');
        }
      }
      return handle;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error selecting directory:', error);
      }
      return null;
    }
  }
  return null;
}

export async function saveFilesToDirectory(
  rootFolder: Folder,
  files: Map<string, ArrayBuffer>,
  directoryHandle: FileSystemDirectoryHandle,
  saveMode: SaveMode
): Promise<void> {
  try {
    if (saveMode === 'flat') {
      const usedNames = new Set<string>();
      
      for (const [fileId, data] of files.entries()) {
        const file = findFileById(rootFolder, fileId);
        if (file) {
          let fileName = sanitizeFileName(`${file.name}${file.extension}`);
          
          let counter = 1;
          while (usedNames.has(fileName)) {
            const nameWithoutExt = file.name;
            const ext = file.extension;
            fileName = sanitizeFileName(`${nameWithoutExt}_${counter}${ext}`);
            counter++;
          }
          
          usedNames.add(fileName);
          const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(data);
          await writable.close();
        }
      }
    } else {
      await saveFolderStructure(rootFolder, files, directoryHandle);
    }
  } catch (error) {
    if ((error as Error).message.includes('User activation')) {
      throw new Error('Требуется разрешение на запись. Пожалуйста, выберите папку снова и нажмите "Сохранить".');
    }
    throw error;
  }
}


function findFileById(folder: Folder, fileId: string): File | null {
  for (const file of folder.files) {
    if (file.id === fileId) return file;
  }
  for (const subFolder of folder.folders) {
    const found = findFileById(subFolder, fileId);
    if (found) return found;
  }
  return null;
}

async function saveFolderStructure(
  folder: Folder,
  files: Map<string, ArrayBuffer>,
  parentHandle: FileSystemDirectoryHandle
): Promise<void> {
  const folderHandle = await parentHandle.getDirectoryHandle(
    sanitizeFileName(folder.name),
    { create: true }
  );

  for (const file of folder.files) {
    const fileData = files.get(file.id);
    if (fileData) {
      const fileName = sanitizeFileName(`${file.name}${file.extension}`);
      const fileHandle = await folderHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(fileData);
      await writable.close();
    }
  }

  for (const subFolder of folder.folders) {
    await saveFolderStructure(subFolder, files, folderHandle);
  }
}

