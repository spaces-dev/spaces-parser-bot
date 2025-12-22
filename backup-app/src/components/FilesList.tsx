import type { File, FileDownloadProgress } from '../types';
import { formatBytes } from '../utils/formatters';

interface FilesListProps {
  files: File[];
  currentPage: number;
  filesPerPage: number;
  fileProgress: Map<string, FileDownloadProgress>;
  onPageChange: (page: number) => void;
  onRetryFile?: (fileId: string) => void;
}

export function FilesList({ files, currentPage, filesPerPage, fileProgress, onPageChange, onRetryFile }: FilesListProps) {
  const totalPages = Math.ceil(files.length / filesPerPage);
  const startIndex = (currentPage - 1) * filesPerPage;
  const endIndex = startIndex + filesPerPage;
  const currentFiles = files.slice(startIndex, endIndex);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="bg-dark-surface bg-opacity-50 backdrop-blur-sm rounded-lg border border-dark-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">
          Найдено файлов: {files.length}
        </h3>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-dark-hover border border-dark-border rounded disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
            >
              ←
            </button>
            <span className="text-gray-400 text-sm">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-dark-hover border border-dark-border rounded disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
            >
              →
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {currentFiles.map((file) => {
          const progress = fileProgress.get(file.id);
          const isDownloading = progress?.status === 'downloading';
          const isCompleted = progress?.status === 'completed';
          const isError = progress?.status === 'error';

          return (
            <div
              key={file.id}
              className={`p-3 bg-dark-hover rounded border ${
                isDownloading ? 'border-blue-500' : 
                isCompleted ? 'border-green-500' : 
                isError ? 'border-red-500' : 
                'border-dark-border'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm truncate">
                    {file.name}
                    <span className="text-gray-400">{file.extension}</span>
                  </div>
                  <div className="text-gray-500 text-xs mt-1 truncate">
                    {file.path}
                  </div>
                  {progress && (
                    <div className="mt-2">
                      {isDownloading && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>{progress.progress.toFixed(1)}%</span>
                            <span>{formatBytes(progress.speed)}/s</span>
                          </div>
                          <div className="w-full h-1 bg-dark-surface rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all duration-300"
                              style={{ width: `${progress.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {isCompleted && (
                        <div className="text-xs text-green-400">✓ Загружено</div>
                      )}
                      {isError && (
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-red-400">✗ Ошибка</div>
                          {onRetryFile && (
                            <button
                              onClick={() => onRetryFile(file.id)}
                              className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                            >
                              Повторить
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
