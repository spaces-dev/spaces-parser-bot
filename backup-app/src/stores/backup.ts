import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import type { File, Folder, BackupStatus, SaveMode, FileDownloadProgress, UserSection } from '@/types'
import { scanFolder, collectAllFiles, scanProfileByUrl, getProfileSections } from '@/utils/scanner'
import { downloadAndSaveFileOnServer } from '@/utils/fileSaver'
import { mergeCookies } from '@/utils/cookies'
import { buildSpacesUrl, config } from '@/config'
import { useAuthStore } from '@/stores/auth'

export const useBackupStore = defineStore('backup', () => {
  const authStore = useAuthStore()

  const saveMode = ref<SaveMode>('structure')
  const savePath = ref('')
  const rootFolder = shallowRef<Folder | null>(null)
  const scannedFiles = shallowRef<File[]>([])
  const currentPage = ref(1)
  const filesPerPage = ref(config.pagination.filesPerPage)
  const totalFiles = ref(0)
  const downloadedFiles = ref(0)
  const totalSize = ref(0)
  const downloadedSize = ref(0)
  const status = ref<BackupStatus>('idle')
  const currentFile = ref<string | undefined>()
  const fileProgress = ref(new Map<string, FileDownloadProgress>())
  const errors = ref<Array<{ file: string; error: string }>>([])
  const downloadDuration = ref<number | null>(null)

  const canScan = computed(
    () =>
      !!authStore.user &&
      authStore.selectedSections.length > 0 &&
      status.value === 'idle'
  )

  const canDownload = computed(() => scannedFiles.value.length > 0 && status.value === 'idle')

  const inProgress = computed(() =>
    ['loading', 'scanning', 'downloading', 'saving'].includes(status.value)
  )

  const paginatedFiles = computed(() => {
    const start = (currentPage.value - 1) * filesPerPage.value
    const end = start + filesPerPage.value
    return scannedFiles.value.slice(start, end)
  })

  const totalPages = computed(() =>
    Math.ceil(scannedFiles.value.length / filesPerPage.value)
  )

  const failedFiles = computed(() => {
    return scannedFiles.value.filter((file) => {
      const progress = fileProgress.value.get(file.id)
      return progress?.status === 'error'
    })
  })

  const hasFailedFiles = computed(() => failedFiles.value.length > 0)

  const profileSections = ref<UserSection[]>([])
  const selectedProfileSections = ref<string[]>([])

  async function scan() {
    if (!authStore.user || authStore.selectedSections.length === 0) return

    try {
      const cookiesObj = authStore.effectiveCookies
      status.value = 'scanning'
      scannedFiles.value = []
      fileProgress.value = new Map()
      downloadedFiles.value = 0
      downloadedSize.value = 0
      errors.value = []

      const allFiles: File[] = []
      const folderMap = new Map<string, { folder: Folder; sectionId: string }>()

      let updatedCookies = cookiesObj

      for (const sectionId of authStore.selectedSections) {
        const section = authStore.sections.find((s) => s.id === sectionId)
        if (!section) {
          console.log(`Section ${sectionId} not found`)
          continue
        }

        console.log(`Scanning section: ${section.name} (${section.id})`)
        const rootFolder = await scanFolder(
          section.url,
          updatedCookies,
          section.folderName,
          (newCookies) => {
            updatedCookies = mergeCookies(updatedCookies, newCookies)
          }
        )
        const files = collectAllFiles(rootFolder)

        console.log(`Section ${section.name}: found ${files.length} files`)

        const existingIds = new Set(allFiles.map((f) => f.id))
        const newFiles = files.filter((f) => !existingIds.has(f.id))
        allFiles.push(...newFiles)
        folderMap.set(sectionId, { folder: rootFolder, sectionId })
      }

      console.log(`Total files collected: ${allFiles.length}`)

      const fileProgressMap = new Map<string, FileDownloadProgress>()
      allFiles.forEach((file) => {
        fileProgressMap.set(file.id, {
          fileId: file.id,
          fileName: `${file.name}${file.extension}`,
          progress: 0,
          speed: 0,
          status: 'pending',
        })
      })

      scannedFiles.value = allFiles
      totalFiles.value = allFiles.length
      fileProgress.value = fileProgressMap
      rootFolder.value = authStore.user
        ? {
            id: 'root',
            name: authStore.user.username,
            url: '',
            path: '',
            files: [],
            folders: Array.from(folderMap.values()).map(({ folder, sectionId }) => {
              const section = authStore.sections.find((s) => s.id === sectionId)
              return {
                ...folder,
                name: section?.folderName || folder.name,
                path: section?.folderName || folder.path,
              }
            }),
          }
        : null
      status.value = 'idle'
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      status.value = 'error'
      errors.value.push({ file: 'Scan', error: errorMsg })
    }
  }

  async function loadProfileSections(profileUrl: string) {
    if (!authStore.user) return

    try {
      const cookiesObj = authStore.effectiveCookies

      const sections = await getProfileSections(profileUrl, cookiesObj)
      profileSections.value = sections
      selectedProfileSections.value = sections.map((s) => s.id)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      errors.value.push({ file: 'Load Profile Sections', error: errorMsg })
    }
  }

  function setSelectedProfileSections(sectionIds: string[]) {
    selectedProfileSections.value = sectionIds
  }

  async function scanProfile(profileUrl: string) {
    if (!authStore.user || selectedProfileSections.value.length === 0) return

    try {
      const cookiesObj = authStore.effectiveCookies
      status.value = 'scanning'
      scannedFiles.value = []
      fileProgress.value = new Map()
      downloadedFiles.value = 0
      downloadedSize.value = 0
      errors.value = []

      let updatedCookies = cookiesObj

      const { folders, files } = await scanProfileByUrl(
        profileUrl,
        updatedCookies,
        (newCookies) => {
          updatedCookies = mergeCookies(updatedCookies, newCookies)
        },
        selectedProfileSections.value
      )

      console.log(`Total files collected from profile: ${files.length}`)

      const fileProgressMap = new Map<string, FileDownloadProgress>()
      files.forEach((file) => {
        fileProgressMap.set(file.id, {
          fileId: file.id,
          fileName: `${file.name}${file.extension}`,
          progress: 0,
          speed: 0,
          status: 'pending',
        })
      })

      scannedFiles.value = files
      totalFiles.value = files.length
      fileProgress.value = fileProgressMap
      rootFolder.value = folders.length > 0
        ? {
            id: 'profile-root',
            name: 'Profile',
            url: profileUrl,
            path: '',
            files: [],
            folders,
          }
        : null
      status.value = 'idle'
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      status.value = 'error'
      errors.value.push({ file: 'Profile Scan', error: errorMsg })
    }
  }

  function resetScan() {
    scannedFiles.value = []
    fileProgress.value = new Map()
    totalFiles.value = 0
    downloadedFiles.value = 0
    downloadedSize.value = 0
    totalSize.value = 0
    errors.value = []
    downloadDuration.value = null
    currentFile.value = undefined
    rootFolder.value = null
    currentPage.value = 1
    status.value = 'idle'
  }

  async function downloadSingleFile(file: File, cookiesObj: Record<string, string>): Promise<void> {
    if (!authStore.user) return

    const currentProgress = fileProgress.value.get(file.id)
    if (currentProgress?.status === 'completed' || currentProgress?.status === 'downloading') {
      console.log(`File ${file.name}${file.extension} already ${currentProgress.status}, skipping`)
      return
    }

    const newProgress = new Map(fileProgress.value)
    const progress = newProgress.get(file.id)
    if (progress) {
      newProgress.set(file.id, {
        ...progress,
        status: 'downloading',
        progress: 0,
        speed: 0,
      })
    }
    fileProgress.value = newProgress
    currentFile.value = file.name

    try {
      await downloadAndSaveFileOnServer(
        file,
        cookiesObj,
        authStore.user.username,
        saveMode.value,
        (progressPercent) => {
          const updatedProgress = new Map(fileProgress.value)
          const fileProgressItem = updatedProgress.get(file.id)
          if (fileProgressItem) {
            updatedProgress.set(file.id, {
              ...fileProgressItem,
              progress: progressPercent,
              speed: 0,
            })
          }
          fileProgress.value = updatedProgress
        }
      )

      const completedProgress = new Map(fileProgress.value)
      const completedProgressItem = completedProgress.get(file.id)
      if (completedProgressItem) {
        completedProgress.set(file.id, {
          ...completedProgressItem,
          progress: 100,
          speed: 0,
          status: 'completed',
        })
      }
      fileProgress.value = completedProgress
      downloadedFiles.value += 1
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      const errorProgress = new Map(fileProgress.value)
      const errorProgressItem = errorProgress.get(file.id)
      if (errorProgressItem) {
        errorProgress.set(file.id, {
          ...errorProgressItem,
          status: 'error',
        })
      }
      fileProgress.value = errorProgress
      errors.value = errors.value
        .filter((e) => e.file !== file.name)
        .concat({ file: file.name, error: errorMsg })
      throw error
    }
  }

  async function download() {
    if (scannedFiles.value.length === 0 || !authStore.user) return

    try {
      const cookiesObj = authStore.effectiveCookies
      status.value = 'downloading'
      downloadDuration.value = null
      const startTime = Date.now()

      for (const file of scannedFiles.value) {
        const progress = fileProgress.value.get(file.id)
        if (progress?.status === 'completed') {
          continue
        }
        try {
          await downloadSingleFile(file, cookiesObj)
          await new Promise((resolve) => setTimeout(resolve, 200))
        } catch (error) {
          console.error('Error downloading file:', error)
        }
      }

      const endTime = Date.now()
      downloadDuration.value = Math.round((endTime - startTime) / 1000)
      currentFile.value = undefined
      status.value = 'completed'
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      currentFile.value = undefined
      status.value = 'error'
      errors.value.push({ file: 'General', error: errorMsg })
    }
  }

  function setSaveMode(mode: SaveMode) {
    saveMode.value = mode
  }

  function setCurrentPage(page: number) {
    currentPage.value = page
  }

  function retryFile(fileId: string) {
    const file = scannedFiles.value.find((f) => f.id === fileId)
    if (!file || !authStore.user) return

    const cookiesObj = authStore.effectiveCookies

    downloadSingleFile(file, cookiesObj).catch(() => {
      // Error already handled in downloadSingleFile
    })
  }

  async function retryAllFailed() {
    if (failedFiles.value.length === 0 || !authStore.user) return

    const cookiesObj = authStore.effectiveCookies

    status.value = 'downloading'

    for (const file of failedFiles.value) {
      try {
        await downloadSingleFile(file, cookiesObj)
        await new Promise((resolve) => setTimeout(resolve, 200))
      } catch (error) {
        console.error('Error retrying file:', error)
      }
    }

    if (status.value === 'downloading') {
      status.value = 'idle'
    }
  }

  function getFileViewUrl(file: File): string {
    if (file.downloadUrl && file.downloadUrl.includes('/view/')) {
      return file.downloadUrl.startsWith('http') ? file.downloadUrl : `${config.baseUrl}${file.downloadUrl}`
    }

    return buildSpacesUrl(file.type, file.id, 'view')
  }

  return {
    saveMode,
    savePath,
    rootFolder,
    scannedFiles,
    currentPage,
    filesPerPage,
    totalFiles,
    downloadedFiles,
    totalSize,
    downloadedSize,
    status,
    currentFile,
    fileProgress,
    errors,
    downloadDuration,
    canScan,
    canDownload,
    inProgress,
    paginatedFiles,
    totalPages,
    failedFiles,
    hasFailedFiles,
    scan,
    scanProfile,
    loadProfileSections,
    setSelectedProfileSections,
    resetScan,
    downloadSingleFile,
    download,
    setSaveMode,
    setCurrentPage,
    retryFile,
    retryAllFailed,
    getFileViewUrl,
    profileSections,
    selectedProfileSections,
  }
})

