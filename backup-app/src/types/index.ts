export interface File {
  id: string;
  name: string;
  extension: string;
  type: number;
  downloadUrl: string;
  directUrl?: string;
  path: string;
  folderId?: string;
}

export interface Folder {
  id: string;
  name: string;
  url: string;
  path: string;
  parentId?: string;
  fileCount?: number;
  files: File[];
  folders: Folder[];
}

export interface User {
  username: string;
  isCurrentUser: boolean;
  avatarUrl?: string;
}

export interface UserSection {
  id: string;
  name: string;
  folderName: string;
  url: string;
  icon: string;
  count: number;
  type: 'pictures' | 'music' | 'video' | 'files' | 'other';
}

export type BackupStatus = 'idle' | 'loading' | 'scanning' | 'downloading' | 'saving' | 'completed' | 'error';
export type SaveMode = 'structure' | 'flat';

export interface FileDownloadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  speed: number;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  lastLoaded?: number;
  lastTime?: number;
}

export interface BackupState {
  user: User | null;
  sections: UserSection[];
  selectedSections: string[];
  saveMode: SaveMode;
  savePath: string;
  rootFolder: Folder | null;
  scannedFiles: File[];
  currentPage: number;
  filesPerPage: number;
  totalFiles: number;
  downloadedFiles: number;
  totalSize: number;
  downloadedSize: number;
  status: BackupStatus;
  currentFile?: string;
  fileProgress: Map<string, FileDownloadProgress>;
  directoryHandle: FileSystemDirectoryHandle | null;
  errors: Array<{ file: string; error: string }>;
}
