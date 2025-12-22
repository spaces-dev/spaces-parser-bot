<template>
  <span
    :class="[
      'px-3 py-1 rounded-full text-xs font-medium',
      statusClasses[status] || statusClasses.idle,
    ]"
  >
    {{ statusLabels[status] || status }}
  </span>
</template>

<script setup lang="ts">
import type { BackupStatus } from '@/types'

interface Props {
  status: BackupStatus
}

defineProps<Props>()

const statusClasses: Record<BackupStatus, string> = {
  idle: 'bg-gray-600 text-gray-200',
  loading: 'bg-blue-600 text-white',
  scanning: 'bg-yellow-600 text-white',
  downloading: 'bg-green-600 text-white',
  saving: 'bg-purple-600 text-white',
  completed: 'bg-green-700 text-white',
  error: 'bg-red-600 text-white',
}

const statusLabels: Record<BackupStatus, string> = {
  idle: 'Ожидание',
  loading: 'Загрузка',
  scanning: 'Сканирование',
  downloading: 'Скачивание',
  saving: 'Сохранение',
  completed: 'Завершено',
  error: 'Ошибка',
}
</script>

