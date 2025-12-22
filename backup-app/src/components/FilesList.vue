<template>
  <div v-if="files.length > 0" class="bg-dark-surface/50 backdrop-blur-sm rounded-lg border border-dark-border p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-white">Найдено файлов: {{ files.length }}</h3>
      <div v-if="totalPages > 1" class="flex items-center gap-2">
        <button
          @click="$emit('update:currentPage', currentPage - 1)"
          :disabled="currentPage === 1"
          class="px-3 py-1 bg-dark-hover border border-dark-border rounded disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
        >
          ←
        </button>
        <span class="text-gray-400 text-sm">
          {{ currentPage }} / {{ totalPages }}
        </span>
        <button
          @click="$emit('update:currentPage', currentPage + 1)"
          :disabled="currentPage === totalPages"
          class="px-3 py-1 bg-dark-hover border border-dark-border rounded disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
        >
          →
        </button>
      </div>
    </div>

    <div class="space-y-2 max-h-96 overflow-y-auto">
      <div
        v-for="file in paginatedFiles"
        :key="file.id"
        v-memo="[file.id, getFileProgress(file.id)?.status, getFileProgress(file.id)?.progress]"
        :class="[
          'p-3 bg-dark-hover rounded border',
          getFileBorderClass(file.id),
        ]"
      >
        <div class="flex items-center justify-between">
          <div class="flex-1 min-w-0">
            <div class="text-white text-sm truncate">
              {{ file.name }}<span class="text-gray-400">{{ file.extension }}</span>
            </div>
            <div class="text-gray-500 text-xs mt-1 truncate">{{ file.path }}</div>
            <div v-if="getFileProgress(file.id)" class="mt-2">
              <div v-if="isDownloading(file.id)" class="space-y-1">
                <div class="flex justify-between text-xs text-gray-400">
                  <span>{{ getFileProgress(file.id)?.progress.toFixed(1) }}%</span>
                  <span>{{ formatBytes(getFileProgress(file.id)?.speed || 0) }}/s</span>
                </div>
                <div class="w-full h-1 bg-dark-surface rounded-full overflow-hidden">
                  <div
                    class="h-full bg-blue-500 transition-all duration-300"
                    :style="{ width: `${getFileProgress(file.id)?.progress || 0}%` }"
                  />
                </div>
              </div>
              <div v-if="isCompleted(file.id)" class="text-xs text-green-400">✓ Загружено</div>
              <div v-if="isError(file.id)" class="flex items-center justify-between">
                <div class="text-xs text-red-400">✗ Ошибка</div>
                <button
                  v-if="onRetryFile"
                  @click="onRetryFile(file.id)"
                  class="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                >
                  Повторить
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { File, FileDownloadProgress } from '@/types'
import { formatBytes } from '@/utils/formatters'

interface Props {
  files: File[]
  currentPage: number
  filesPerPage: number
  fileProgress: Map<string, FileDownloadProgress>
  onRetryFile?: (fileId: string) => void
}

const props = defineProps<Props>()

defineEmits<{
  'update:currentPage': [page: number]
}>()

const totalPages = computed(() => Math.ceil(props.files.length / props.filesPerPage))
const startIndex = computed(() => (props.currentPage - 1) * props.filesPerPage)
const endIndex = computed(() => startIndex.value + props.filesPerPage)
const paginatedFiles = computed(() => props.files.slice(startIndex.value, endIndex.value))

function getFileProgress(fileId: string): FileDownloadProgress | undefined {
  return props.fileProgress.get(fileId)
}

function isDownloading(fileId: string): boolean {
  return getFileProgress(fileId)?.status === 'downloading'
}

function isCompleted(fileId: string): boolean {
  return getFileProgress(fileId)?.status === 'completed'
}

function isError(fileId: string): boolean {
  return getFileProgress(fileId)?.status === 'error'
}

function getFileBorderClass(fileId: string): string {
  const progress = getFileProgress(fileId)
  if (progress?.status === 'downloading') return 'border-blue-500'
  if (progress?.status === 'completed') return 'border-green-500'
  if (progress?.status === 'error') return 'border-red-500'
  return 'border-dark-border'
}
</script>

