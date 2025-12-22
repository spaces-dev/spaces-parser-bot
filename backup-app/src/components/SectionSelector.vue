<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold text-white">Выберите разделы для бэкапа</h3>
      <button
        @click="toggleAll"
        :disabled="disabled"
        class="text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50"
      >
        {{ selected.length === sections.length ? 'Снять все' : 'Выбрать все' }}
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label
        v-for="section in sections"
        :key="section.id"
        :class="[
          'flex items-center p-4 rounded-lg border cursor-pointer transition-colors',
          selected.includes(section.id)
            ? 'bg-blue-500 bg-opacity-20 border-blue-500'
            : 'bg-dark-hover border-dark-border hover:border-gray-600',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ]"
      >
        <input
          type="checkbox"
          :checked="selected.includes(section.id)"
          @change="toggleSection(section.id)"
          :disabled="disabled"
          class="w-4 h-4 text-blue-600 bg-dark-surface border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
        />
        <div class="ml-3 flex-1">
          <div class="text-white font-medium">{{ section.name }}</div>
          <div class="text-sm text-gray-400">
            {{ section.count > 0 ? `${section.count} элементов` : 'Нет данных' }}
          </div>
        </div>
      </label>
    </div>

    <div v-if="sections.length === 0" class="text-center text-gray-400 py-8">
      Разделы не найдены. Проверьте cookies и URL.
    </div>
  </div>
</template>

<script setup lang="ts">
import type { UserSection } from '@/types'

interface Props {
  sections: UserSection[]
  selected: string[]
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:selected': [selected: string[]]
}>()

function toggleSection(id: string) {
  if (props.disabled) return
  if (props.selected.includes(id)) {
    emit('update:selected', props.selected.filter((s) => s !== id))
  } else {
    emit('update:selected', [...props.selected, id])
  }
}

function toggleAll() {
  if (props.disabled) return
  if (props.selected.length === props.sections.length) {
    emit('update:selected', [])
  } else {
    emit('update:selected', props.sections.map((s) => s.id))
  }
}
</script>

