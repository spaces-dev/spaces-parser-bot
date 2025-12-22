import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Folder } from '../types';

export async function createArchive(
  rootFolder: Folder,
  files: Map<string, ArrayBuffer>,
  username: string
): Promise<void> {
  const zip = new JSZip();
  
  function addFolderToZip(folder: Folder, zipFolder: JSZip) {
    folder.files.forEach(file => {
      const fileData = files.get(file.id);
      if (fileData) {
        zipFolder.file(file.path, fileData);
      }
    });
    
    folder.folders.forEach(subFolder => {
      const subZipFolder = zipFolder.folder(subFolder.name);
      if (subZipFolder) {
        addFolderToZip(subFolder, subZipFolder);
      }
    });
  }
  
  addFolderToZip(rootFolder, zip);
  
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  
  const filename = `${username}_backup_${Date.now()}.zip`;
  saveAs(blob, filename);
}

