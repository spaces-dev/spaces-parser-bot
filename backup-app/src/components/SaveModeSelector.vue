<template>
  <div class="space-y-3">
    <h3 class="text-sm font-medium text-gray-300">Режим сохранения</h3>
    <div class="grid grid-cols-2 gap-3">
      <button
        type="button"
        @click="!disabled && $emit('update:mode', 'structure')"
        :disabled="disabled"
        :class="[
          'relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all',
          mode === 'structure'
            ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20'
            : 'bg-dark-hover border-dark-border hover:border-gray-500',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ]"
      >
        <div
          :class="[
            'w-5 h-5 rounded-full border-2 mb-3 flex items-center justify-center',
            mode === 'structure' ? 'border-blue-500 bg-blue-500' : 'border-gray-500',
          ]"
        >
          <div v-if="mode === 'structure'" class="w-2.5 h-2.5 rounded-full bg-white" />
        </div>
        <div :class="['font-medium mb-1', mode === 'structure' ? 'text-white' : 'text-gray-300']">
          Структура папок
        </div>
        <div class="text-xs text-gray-400 text-center">Сохраняет папки и подпапки</div>
      </button>

      <button
        type="button"
        @click="!disabled && $emit('update:mode', 'flat')"
        :disabled="disabled"
        :class="[
          'relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all',
          mode === 'flat'
            ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20'
            : 'bg-dark-hover border-dark-border hover:border-gray-500',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ]"
      >
        <div
          :class="[
            'w-5 h-5 rounded-full border-2 mb-3 flex items-center justify-center',
            mode === 'flat' ? 'border-blue-500 bg-blue-500' : 'border-gray-500',
          ]"
        >
          <div v-if="mode === 'flat'" class="w-2.5 h-2.5 rounded-full bg-white" />
        </div>
        <div :class="['font-medium mb-1', mode === 'flat' ? 'text-white' : 'text-gray-300']">
          Все файлы
        </div>
        <div class="text-xs text-gray-400 text-center">Все файлы в одну папку</div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SaveMode } from '@/types'

interface Props {
  mode: SaveMode
  disabled?: boolean
}

defineProps<Props>()
defineEmits<{
  'update:mode': [mode: SaveMode]
}>()
</script>

