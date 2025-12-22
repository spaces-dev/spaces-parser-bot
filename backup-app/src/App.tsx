import { useState, useCallback, useEffect } from 'react';
import { scanFolder, collectAllFiles } from './utils/scanner';
import { downloadAndSaveFileOnServer } from './utils/fileSaver';
import { extractUsername, checkIsCurrentUser, parseUserSections, extractAvatarUrl } from './utils/parser';
import { parseCookies, createCookiesFromSid, mergeCookies } from './utils/cookies';
import { fetchPageWithCookies } from './utils/http';
import { extractCKFromUrl, addCKToUrl } from './utils/url';
import { config } from './config';
import { saveCookies, loadCookies, saveUser, loadUser, clearCookies, saveSections, loadSections } from './utils/storage';
import { ProgressBar } from './components/ProgressBar';
import { formatBytes } from './utils/formatters';
import { isNewYearPeriod } from './utils/date';
import { StatusBadge } from './components/StatusBadge';
import { SectionSelector } from './components/SectionSelector';
import { SaveModeSelector } from './components/SaveModeSelector';
import { Sidebar } from './components/Sidebar';
import { FilesList } from './components/FilesList';
import type { BackupState, File, FileDownloadProgress } from './types';

function App() {
  const [sid, setSid] = useState('');
  const [fullCookies, setFullCookies] = useState<Record<string, string>>({});
  const [authCollapsed, setAuthCollapsed] = useState(false);
  const [state, setState] = useState<BackupState>({
    user: null,
    sections: [],
    selectedSections: [],
    saveMode: 'structure',
    savePath: '',
    rootFolder: null,
    scannedFiles: [],
    currentPage: 1,
    filesPerPage: 20,
    totalFiles: 0,
    downloadedFiles: 0,
    totalSize: 0,
    downloadedSize: 0,
      status: 'idle',
      fileProgress: new Map(),
      errors: [],
    });

  const loadUserData = useCallback(async () => {
    const sidToUse = sid.trim();
    if (!sidToUse) {
      setState(prev => ({ ...prev, user: null, sections: [], selectedSections: [] }));
      return;
    }

    try {
      setState(prev => ({ ...prev, status: 'loading' }));
      
      let currentCookies = fullCookies.sid ? fullCookies : createCookiesFromSid(sidToUse);
      
      const response = await fetchPageWithCookies(config.baseUrl, currentCookies);
      let html = response.html;
      const newCookies = mergeCookies(currentCookies, response.cookies);
      currentCookies = newCookies;
      setFullCookies(currentCookies);
      
      let username = extractUsername(config.baseUrl, html);
      let isCurrentUser = checkIsCurrentUser(html);
      
      const deviceTypeMatch = html.match(/href="([^"]*device_type[^"]*)"/);
      const deviceTypeUrl = deviceTypeMatch ? deviceTypeMatch[1] : '';
      let ck = extractCKFromUrl(deviceTypeUrl) || extractCKFromUrl(config.baseUrl);
      
      console.log('Extracted username from main:', username);
      console.log('Is current user:', isCurrentUser);
      console.log('CK:', ck);
      console.log('Cookies from response:', response.cookies);
      
      let avatarUrl: string | undefined;
      let sectionsHtml = html;
      
      if (!username && response.cookies.user_id) {
        console.log('Username not found, trying to load profile by user_id:', response.cookies.user_id);
        try {
          const profileUrl = `${config.baseUrl}/mysite/index/`;
          const profileResponse = await fetchPageWithCookies(profileUrl, currentCookies);
          const profileCookies = mergeCookies(currentCookies, profileResponse.cookies);
          currentCookies = profileCookies;
          setFullCookies(currentCookies);
          username = extractUsername(profileUrl, profileResponse.html);
          sectionsHtml = profileResponse.html;
          console.log('Found username from profile page:', username);
        } catch (e) {
          console.log('Failed to load profile page:', e);
        }
      }
      
      if (username) {
        let profileUrl = `${config.baseUrl}/mysite/index/${username}/`;
        if (ck) {
          profileUrl = addCKToUrl(profileUrl, ck);
        }
        try {
          const profileResponse = await fetchPageWithCookies(profileUrl, currentCookies);
          sectionsHtml = profileResponse.html;
          const profileCookies = mergeCookies(currentCookies, profileResponse.cookies);
          currentCookies = profileCookies;
          setFullCookies(currentCookies);
          console.log('Loaded profile page:', profileUrl);
          avatarUrl = extractAvatarUrl(profileResponse.html);
          console.log('Avatar URL from profile page:', avatarUrl);
          
          if (!username) {
            username = extractUsername(profileUrl, profileResponse.html);
            console.log('Extracted username from profile page:', username);
          }
        } catch (e) {
          console.log('Failed to load profile, using main page');
          avatarUrl = extractAvatarUrl(html);
        }
      } else {
        avatarUrl = extractAvatarUrl(html);
      }
      
      const sections = parseUserSections(sectionsHtml, username, config.baseUrl);
      
      console.log('Parsed sections:', sections);
      
      const userData = { username, isCurrentUser, avatarUrl };
      saveUser(userData);
      saveCookies(JSON.stringify(currentCookies));
      saveSections(sections);
      
      setState(prev => ({
        ...prev,
        user: userData,
        sections,
        selectedSections: sections.map(s => s.id),
        status: 'idle',
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        status: 'error',
        errors: [{ file: 'Load', error: errorMsg }],
      }));
    }
  }, [sid, fullCookies]);

  useEffect(() => {
    const savedCookies = loadCookies();
    const savedUser = loadUser();
    const savedSections = loadSections();
    
    if (savedCookies && sid.trim() === '' && Object.keys(fullCookies).length === 0) {
      try {
        const parsed = JSON.parse(savedCookies);
        if (parsed.sid) {
          setSid(parsed.sid);
          setFullCookies(parsed);
          if (savedUser) {
            setState(prev => ({
              ...prev,
              user: savedUser,
              sections: savedSections || [],
              selectedSections: savedSections ? savedSections.map(s => s.id) : [],
            }));
          }
        }
      } catch {
        const parsed = parseCookies(savedCookies);
        if (parsed.sid) {
          setSid(parsed.sid);
          setFullCookies(parsed);
          if (savedUser) {
            setState(prev => ({
              ...prev,
              user: savedUser,
              sections: savedSections || [],
              selectedSections: savedSections ? savedSections.map(s => s.id) : [],
            }));
          }
        }
      }
    } else if (savedUser && !state.user) {
      setState(prev => ({
        ...prev,
        user: savedUser,
        sections: savedSections || [],
        selectedSections: savedSections ? savedSections.map((s: any) => s.id) : [],
      }));
    }
  }, []);

  useEffect(() => {
    if (sid.trim() && Object.keys(fullCookies).length > 0 && (!state.user || !state.sections.length)) {
      loadUserData();
    }
  }, [sid, fullCookies, state.user, state.sections.length, loadUserData]);

  const handleLogout = useCallback(() => {
    clearCookies();
    setSid('');
    setFullCookies({});
    setState({
      user: null,
      sections: [],
      selectedSections: [],
      saveMode: 'structure',
      savePath: '',
      rootFolder: null,
      scannedFiles: [],
      currentPage: 1,
      filesPerPage: 20,
      totalFiles: 0,
      downloadedFiles: 0,
      totalSize: 0,
      downloadedSize: 0,
      status: 'idle',
      fileProgress: new Map(),
      errors: [],
    });
  }, []);

  const handleScan = useCallback(async () => {
    if (!state.user || state.selectedSections.length === 0) return;

    try {
      const cookiesObj = fullCookies.sid ? fullCookies : createCookiesFromSid(sid);
      setState(prev => ({ 
        ...prev, 
        status: 'scanning', 
        scannedFiles: [], 
        fileProgress: new Map(),
        downloadedFiles: 0,
        downloadedSize: 0,
        errors: [],
      }));

      const allFiles: File[] = [];
      const folderMap = new Map<string, { folder: any; sectionId: string }>();

      let updatedCookies = cookiesObj;
      
      for (const sectionId of state.selectedSections) {
        const section = state.sections.find(s => s.id === sectionId);
        if (!section) {
          console.log(`Section ${sectionId} not found`);
          continue;
        }

        console.log(`Scanning section: ${section.name} (${section.id})`);
        const rootFolder = await scanFolder(section.url, updatedCookies, section.folderName, (newCookies) => {
          updatedCookies = newCookies;
          setFullCookies(newCookies);
          saveCookies(JSON.stringify(newCookies));
        });
        const files = collectAllFiles(rootFolder);
        
        console.log(`Section ${section.name}: found ${files.length} files`);
        
        const existingIds = new Set(allFiles.map(f => f.id));
        const newFiles = files.filter(f => !existingIds.has(f.id));
        allFiles.push(...newFiles);
        folderMap.set(sectionId, { folder: rootFolder, sectionId });
      }
      
      console.log(`Total files collected: ${allFiles.length}`);

      const fileProgressMap = new Map<string, FileDownloadProgress>();
      allFiles.forEach(file => {
        fileProgressMap.set(file.id, {
          fileId: file.id,
          fileName: `${file.name}${file.extension}`,
          progress: 0,
          speed: 0,
          status: 'pending',
        });
      });

      setState(prev => ({
        ...prev,
        scannedFiles: allFiles,
        totalFiles: allFiles.length,
        fileProgress: fileProgressMap,
        rootFolder: state.user ? {
          id: 'root',
          name: state.user.username,
          url: '',
          path: '',
          files: [],
          folders: Array.from(folderMap.values()).map(({ folder, sectionId }) => {
            const section = state.sections.find(s => s.id === sectionId);
            return {
              ...folder,
              name: section?.folderName || folder.name,
              path: section?.folderName || folder.path,
            };
          }),
        } : null,
        status: 'idle',
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        status: 'error',
        errors: [...prev.errors, { file: 'Scan', error: errorMsg }],
      }));
    }
  }, [sid, fullCookies, state.user, state.sections, state.selectedSections]);

  const handleResetScan = useCallback(() => {
    setState(prev => ({
      ...prev,
      scannedFiles: [],
      fileProgress: new Map(),
      totalFiles: 0,
      downloadedFiles: 0,
      downloadedSize: 0,
      totalSize: 0,
      errors: [],
      rootFolder: null,
      currentPage: 1,
      status: 'idle',
    }));
  }, []);

  const downloadSingleFile = useCallback(async (
    file: File,
    cookiesObj: Record<string, string>
  ): Promise<void> => {
    if (!state.user) return;

    const currentProgress = state.fileProgress.get(file.id);
    if (currentProgress?.status === 'completed' || currentProgress?.status === 'downloading') {
      console.log(`File ${file.name}${file.extension} already ${currentProgress.status}, skipping`);
      return;
    }

    setState(prev => {
      const newProgress = new Map(prev.fileProgress);
      const progress = newProgress.get(file.id);
      if (progress) {
        newProgress.set(file.id, {
          ...progress,
          status: 'downloading',
          progress: 0,
          speed: 0,
        });
      }
      return { ...prev, fileProgress: newProgress, currentFile: file.name };
    });

    try {
      await downloadAndSaveFileOnServer(
        file,
        cookiesObj,
        state.user.username,
        state.saveMode,
        (progressPercent) => {
          setState(prev => {
            const newProgress = new Map(prev.fileProgress);
            const progress = newProgress.get(file.id);
            if (progress) {
              newProgress.set(file.id, {
                ...progress,
                progress: progressPercent,
                speed: 0,
              });
            }
            return { ...prev, fileProgress: newProgress };
          });
        }
      );

      setState(prev => {
        const newProgress = new Map(prev.fileProgress);
        const progress = newProgress.get(file.id);
        if (progress) {
          newProgress.set(file.id, {
            ...progress,
            progress: 100,
            speed: 0,
            status: 'completed',
          });
        }
        return {
          ...prev,
          fileProgress: newProgress,
          downloadedFiles: prev.downloadedFiles + 1,
        };
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => {
        const newProgress = new Map(prev.fileProgress);
        const progress = newProgress.get(file.id);
        if (progress) {
          newProgress.set(file.id, {
            ...progress,
            status: 'error',
          });
        }
        return {
          ...prev,
          fileProgress: newProgress,
          errors: prev.errors.filter(e => e.file !== file.name).concat({ file: file.name, error: errorMsg }),
        };
      });
      throw error;
    }
  }, [state.user, state.saveMode]);

  const handleDownload = useCallback(async () => {
    if (state.scannedFiles.length === 0 || !state.user) return;

    try {
      const cookiesObj = fullCookies.sid ? fullCookies : createCookiesFromSid(sid);
      setState(prev => ({ ...prev, status: 'downloading' }));

      for (const file of state.scannedFiles) {
        const progress = state.fileProgress.get(file.id);
        if (progress?.status === 'completed') {
          continue;
        }
        try {
          await downloadSingleFile(file, cookiesObj);
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error('Error downloading file:', error);
        }
      }

      setState(prev => ({ ...prev, status: 'completed' }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        status: 'error',
        errors: [...prev.errors, { file: 'General', error: errorMsg }],
      }));
    }
  }, [sid, fullCookies, state.scannedFiles, state.user, downloadSingleFile]);

  const canScan = state.user && state.selectedSections.length > 0 && state.status === 'idle';
  const canDownload = state.scannedFiles.length > 0 && state.status === 'idle';
  const inProgress = ['loading', 'scanning', 'downloading', 'saving'].includes(state.status);
  const canLoad = sid.trim() && !state.user && state.status === 'idle';
  const showNewYearBg = isNewYearPeriod();

  return (
    <div 
      className="min-h-screen bg-dark-bg flex relative"
      style={showNewYearBg ? {
        backgroundImage: 'url(https://spaces.im/i/bg/newyear_dark.png?r=1)',
        backgroundAttachment: 'fixed',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      } : {}}
    >
      <div className="absolute inset-0 bg-dark-bg bg-opacity-80" />
      <div className="relative z-10 flex w-full">
        <Sidebar user={state.user} onLogout={handleLogout} />
        
        <div className="flex-1 p-8">
          <div className="max-w-4xl mx-auto">

          <div className="bg-dark-surface bg-opacity-50 backdrop-blur-sm rounded-lg border border-dark-border p-6 mb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Авторизация</h2>
                <button
                  onClick={() => setAuthCollapsed(!authCollapsed)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {authCollapsed ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  )}
                </button>
              </div>

              {!authCollapsed && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      SID
                    </label>
                    <input
                      type="text"
                      value={sid}
                      onChange={(e) => setSid(e.target.value)}
                      placeholder="Введите значение cookie sid"
                      disabled={inProgress || !!state.user}
                      className="w-full px-4 py-2 bg-dark-hover border border-dark-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 font-mono text-sm"
                    />
                    {Object.keys(fullCookies).length > 1 && (
                      <p className="text-xs text-gray-400 mt-2">
                        Получено cookies: {Object.keys(fullCookies).join(', ')}
                      </p>
                    )}
                  </div>

                  {!state.user && (
                    <button
                      onClick={() => loadUserData()}
                      disabled={!canLoad || inProgress}
                      className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                    >
                      Войти
                    </button>
                  )}
                </>
              )}

              {state.user && (
                <div className="pt-4 border-t border-dark-border space-y-4">
                  <SectionSelector
                    sections={state.sections}
                    selected={state.selectedSections}
                    onChange={(selected) => setState(prev => ({ ...prev, selectedSections: selected }))}
                    disabled={inProgress}
                  />

                  <SaveModeSelector
                    mode={state.saveMode}
                    onChange={(mode) => setState(prev => ({ ...prev, saveMode: mode }))}
                    disabled={inProgress}
                  />

                  <div className="flex gap-2">
                    {state.scannedFiles.length === 0 ? (
                      <button
                        onClick={handleScan}
                        disabled={!canScan || inProgress}
                        className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                      >
                        {state.status === 'scanning' ? 'Сканирование...' : 'Сканировать файлы'}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleResetScan}
                          disabled={inProgress}
                          className="px-4 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                        >
                          Сбросить
                        </button>
                        <button
                          onClick={handleDownload}
                          disabled={!canDownload || inProgress}
                          className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                        >
                          {state.status === 'downloading' && 'Скачивание...'}
                          {state.status === 'saving' && 'Сохранение...'}
                          {state.status === 'completed' && 'Завершено'}
                          {state.status === 'idle' && `Сохранить (${state.scannedFiles.length} файлов)`}
                          {state.status === 'error' && 'Ошибка'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {state.scannedFiles.length > 0 && (
            <>
              <FilesList
                files={state.scannedFiles}
                currentPage={state.currentPage}
                filesPerPage={state.filesPerPage}
                fileProgress={state.fileProgress}
                onPageChange={(page) => setState(prev => ({ ...prev, currentPage: page }))}
                onRetryFile={(fileId) => {
                  const file = state.scannedFiles.find(f => f.id === fileId);
                  if (!file || !state.user) return;
                  
                  const cookiesObj = fullCookies.sid ? fullCookies : createCookiesFromSid(sid);
                  
                  downloadSingleFile(file, cookiesObj).catch(() => {
                    // Error already handled in downloadSingleFile
                  });
                }}
              />
            </>
          )}

          {state.user && state.status !== 'idle' && (
            <div className="bg-dark-surface bg-opacity-50 backdrop-blur-sm rounded-lg border border-dark-border p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
      <div>
                  <h2 className="text-lg font-semibold text-white">Прогресс</h2>
                </div>
                <StatusBadge status={state.status} />
              </div>

              {state.totalFiles > 0 && (
                <div className="space-y-4">
                  <ProgressBar
                    value={state.downloadedFiles}
                    max={state.totalFiles}
                    label="Файлы"
                  />

                  {state.downloadedSize > 0 && (
                    <ProgressBar
                      value={state.downloadedSize}
                      max={state.totalSize || state.downloadedSize}
                      label="Размер"
                      formatValue={formatBytes}
                    />
                  )}

                  {state.currentFile && (
                    <div className="text-sm text-gray-400">
                      Текущий файл: <span className="text-white">{state.currentFile}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {state.errors.length > 0 && (
            <div className="bg-dark-surface bg-opacity-50 backdrop-blur-sm rounded-lg border border-red-500 border-opacity-30 p-6">
              <h3 className="text-lg font-semibold text-red-400 mb-3">Ошибки</h3>
              <div className="space-y-2">
                {state.errors.map((error, index) => (
                  <div key={index} className="text-sm text-gray-300">
                    <span className="text-red-400">{error.file}:</span> {error.error}
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
      </div>
  );
}

export default App;
