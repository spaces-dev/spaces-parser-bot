<template>
  <div
    class="min-h-screen bg-dark-bg flex relative"
    :style="showNewYearBg ? newYearStyle : {}"
  >
    <div class="absolute inset-0 bg-dark-bg/80" />
    <div class="relative z-10 flex w-full">
      <Sidebar :user="authStore.user" @logout="handleLogout" />

      <div class="flex-1 p-8">
        <div class="max-w-4xl mx-auto">
          <div class="bg-dark-surface/50 backdrop-blur-sm rounded-lg border border-dark-border p-6 mb-6">
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-white">Авторизация</h2>
                <button
                  @click="authCollapsed = !authCollapsed"
                  class="text-gray-400 hover:text-white transition-colors"
                >
                  <svg
                    v-if="authCollapsed"
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                  <svg
                    v-else
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                </button>
              </div>

              <div v-if="!authCollapsed">
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2"> SID </label>
                  <input
                    v-model="displaySid"
                    type="text"
                    placeholder="Введите значение cookie sid"
                    :disabled="backupStore.inProgress || !!authStore.user"
                    class="w-full px-4 py-2 bg-dark-hover border border-dark-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 font-mono text-sm"
                  />
                  <p v-if="Object.keys(authStore.fullCookies).length > 1" class="text-xs text-gray-400 mt-2">
                    Получено cookies: {{ Object.keys(authStore.fullCookies).join(', ') }}
                  </p>
                </div>

                <button
                  v-if="!authStore.user"
                  @click="authStore.loadUserData()"
                  :disabled="!canLoad || backupStore.inProgress"
                  class="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white text-sm font-normal rounded-md transition-colors"
                >
                  Войти
                </button>
              </div>

              <div v-if="authStore.user" class="pt-4 border-t border-dark-border space-y-4">
                <SectionSelector
                  :sections="authStore.sections"
                  :selected="authStore.selectedSections"
                  :disabled="backupStore.inProgress"
                  @update:selected="authStore.setSelectedSections"
                />

                <SaveModeSelector
                  :mode="backupStore.saveMode"
                  :disabled="backupStore.inProgress"
                  @update:mode="backupStore.setSaveMode"
                />

                <div class="flex gap-2">
                  <button
                    v-if="backupStore.scannedFiles.length === 0"
                    @click="backupStore.scan()"
                    :disabled="!backupStore.canScan || backupStore.inProgress"
                    class="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                  >
                    {{ backupStore.status === 'scanning' ? 'Сканирование...' : 'Сканировать файлы' }}
                  </button>
                  <template v-else>
                    <button
                      @click="backupStore.resetScan()"
                      :disabled="backupStore.inProgress"
                      class="px-4 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                    >
                      Сбросить
                    </button>
                    <button
                      @click="backupStore.download()"
                      :disabled="!backupStore.canDownload || backupStore.inProgress"
                      class="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                    >
                      <template v-if="backupStore.status === 'downloading'">Скачивание...</template>
                      <template v-else-if="backupStore.status === 'saving'">Сохранение...</template>
                      <template v-else-if="backupStore.status === 'completed'">Завершено</template>
                      <template v-else-if="backupStore.status === 'error'">Ошибка</template>
                      <template v-else>Сохранить ({{ backupStore.scannedFiles.length }} файлов)</template>
                    </button>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <FilesList
            v-if="backupStore.scannedFiles.length > 0"
            :files="backupStore.scannedFiles"
            :current-page="backupStore.currentPage"
            :files-per-page="backupStore.filesPerPage"
            :file-progress="backupStore.fileProgress"
            :on-retry-file="backupStore.retryFile"
            @update:current-page="backupStore.setCurrentPage"
          />

          <div
            v-if="authStore.user && backupStore.status !== 'idle'"
            class="bg-dark-surface bg-opacity-50 backdrop-blur-sm rounded-lg border border-dark-border p-6 mb-6"
          >
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-lg font-semibold text-white">Прогресс</h2>
              </div>
              <StatusBadge :status="backupStore.status" />
            </div>

            <div v-if="backupStore.totalFiles > 0" class="space-y-4">
              <ProgressBar
                :value="backupStore.downloadedFiles"
                :max="backupStore.totalFiles"
                label="Файлы"
              />

              <ProgressBar
                v-if="backupStore.downloadedSize > 0"
                :value="backupStore.downloadedSize"
                :max="backupStore.totalSize || backupStore.downloadedSize"
                label="Размер"
                :format-value="formatBytes"
              />

              <div v-if="backupStore.currentFile" class="text-sm text-gray-400">
                Текущий файл: <span class="text-white">{{ backupStore.currentFile }}</span>
              </div>
            </div>
          </div>

          <div
            v-if="backupStore.errors.length > 0"
            class="bg-dark-surface/50 backdrop-blur-sm rounded-lg border border-red-500/30 p-6"
          >
            <h3 class="text-lg font-semibold text-red-400 mb-3">Ошибки</h3>
            <div class="space-y-2">
              <div
                v-for="(error, index) in backupStore.errors"
                :key="index"
                class="text-sm text-gray-300"
              >
                <span class="text-red-400">{{ error.file }}:</span> {{ error.error }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBackupStore } from '@/stores/backup'
import { isNewYearPeriod } from '@/utils/date'
import { formatBytes } from '@/utils/formatters'
import Sidebar from './components/Sidebar.vue'
import ProgressBar from './components/ProgressBar.vue'
import StatusBadge from './components/StatusBadge.vue'
import SectionSelector from './components/SectionSelector.vue'
import SaveModeSelector from './components/SaveModeSelector.vue'
import FilesList from './components/FilesList.vue'

const authStore = useAuthStore()
const backupStore = useBackupStore()

const authCollapsed = ref(false)

const showNewYearBg = computed(() => isNewYearPeriod())

const newYearStyle = {
  backgroundImage: 'url(https://spaces.im/i/bg/newyear_dark.png?r=1)',
  backgroundAttachment: 'fixed',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
}

const canLoad = computed(() => authStore.sid.trim() && !authStore.user && backupStore.status === 'idle')

const displaySid = computed({
  get: () => {
    if (authStore.user && authStore.sid.trim()) {
      return '*'.repeat(Math.min(authStore.sid.length, 50))
    }
    return authStore.sid
  },
  set: (value: string) => {
    authStore.sid = value
  },
})

function handleLogout() {
  authStore.logout()
  backupStore.resetScan()
}

onMounted(() => {
  authStore.loadSavedData()
})

watch(
  () => authStore.sid,
  () => {
    if (authStore.sid.trim() && !authStore.isLoading) {
      if (!authStore.user && backupStore.status !== 'loading') {
        authStore.loadUserData()
      } else if (authStore.user && authStore.sections.length === 0 && backupStore.status !== 'loading') {
        authStore.loadUserData()
      }
    }
  }
)
</script>
