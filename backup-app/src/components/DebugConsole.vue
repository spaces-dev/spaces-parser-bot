<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[9999] pointer-events-none">
      <div
        ref="containerRef"
        class="bg-dark-surface border border-dark-border rounded-lg flex flex-col shadow-2xl pointer-events-auto"
        :style="containerStyle"
      >
        <div
          class="flex items-center justify-between p-4 border-b border-dark-border cursor-move select-none"
          @mousedown="handleDragStart"
        >
          <h2 class="text-xl font-semibold text-white">Debug Console</h2>
          <div class="flex items-center gap-2">
            <button
              @click="logger.clear()"
              class="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              Очистить
            </button>
            <button
              @click="$emit('close')"
              class="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>

        <div class="p-4 border-b border-dark-border flex gap-2">
          <input
            v-model="filter"
            type="text"
            placeholder="Поиск в логах..."
            class="flex-1 px-3 py-2 bg-dark-hover border border-dark-border rounded text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            v-model="levelFilter"
            class="px-3 py-2 bg-dark-hover border border-dark-border rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все</option>
            <option value="log">Log</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div ref="scrollRef" class="flex-1 overflow-y-auto p-4 font-mono text-xs">
          <div v-if="filteredLogs.length === 0" class="text-gray-500 text-center py-8">
            {{ logs.length === 0 ? 'Логи отсутствуют' : 'Нет логов, соответствующих фильтрам' }}
          </div>
          <div v-else class="space-y-1">
            <div
              v-for="log in filteredLogs"
              :key="log.id"
              :class="['p-2 rounded hover:bg-dark-hover transition-colors', getLevelBg(log.level)]"
            >
              <div class="flex items-start gap-2">
                <span class="text-gray-500 flex-shrink-0">
                  {{ formatTime(log.timestamp) }}
                </span>
                <span :class="['flex-shrink-0 font-semibold', getLevelColor(log.level)]">
                  [{{ log.level.toUpperCase() }}]
                </span>
                <span class="text-gray-300 flex-1 break-words">
                  {{ log.message }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="p-2 border-t border-dark-border text-xs text-gray-500 text-center">
          Всего логов: {{ logs.length }} | Отфильтровано: {{ filteredLogs.length }}
        </div>

        <div
          class="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize group"
          @mousedown.stop="handleResizeStart"
        >
          <div class="absolute bottom-0 right-0 w-0 h-0 border-l-[12px] border-l-transparent border-b-[12px] border-b-gray-600 group-hover:border-b-gray-500 transition-colors" />
          <div class="absolute bottom-1 right-1 w-0 h-0 border-l-[8px] border-l-transparent border-b-[8px] border-b-gray-700 group-hover:border-b-gray-600 transition-colors" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { logger, type LogEntry } from '@/utils/logger'

interface Props {
  isOpen: boolean
}

const props = defineProps<Props>()
defineEmits<{
  close: []
}>()

const logs = ref<LogEntry[]>([])
const filter = ref('')
const levelFilter = ref<LogEntry['level'] | 'all'>('all')
const scrollRef = ref<HTMLDivElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

const position = ref({ x: 0, y: 0 })
const size = ref({ width: 1024, height: 640 })
const isDragging = ref(false)
const isResizing = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 })

const containerStyle = computed(() => ({
  position: 'absolute',
  left: position.value.x || '50%',
  top: position.value.y || '50%',
  transform: position.value.x || position.value.y ? 'none' : 'translate(-50%, -50%)',
  width: `${size.value.width}px`,
  height: `${size.value.height}px`,
  maxWidth: '95vw',
  maxHeight: '95vh',
}))

const filteredLogs = computed(() => {
  return logs.value.filter((log) => {
    const matchesText = filter.value === '' || log.message.toLowerCase().includes(filter.value.toLowerCase())
    const matchesLevel = levelFilter.value === 'all' || log.level === levelFilter.value
    return matchesText && matchesLevel
  })
})

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ru-RU', { hour12: false })
}

function getLevelColor(level: LogEntry['level']): string {
  switch (level) {
    case 'error':
      return 'text-red-400'
    case 'warn':
      return 'text-yellow-400'
    case 'info':
      return 'text-blue-400'
    default:
      return 'text-gray-300'
  }
}

function getLevelBg(level: LogEntry['level']): string {
  switch (level) {
    case 'error':
      return 'bg-red-500/10'
    case 'warn':
      return 'bg-yellow-500/10'
    case 'info':
      return 'bg-blue-500/10'
    default:
      return ''
  }
}

function handleDragStart(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('button')) return
  
  const container = containerRef.value
  if (container) {
    const rect = container.getBoundingClientRect()
    if (position.value.x === 0 && position.value.y === 0) {
      position.value = { x: rect.left, y: rect.top }
    }
  }
  
  isDragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY }
}

function handleResizeStart(e: MouseEvent) {
  e.stopPropagation()
  isResizing.value = true
  resizeStart.value = { x: e.clientX, y: e.clientY, width: size.value.width, height: size.value.height }
}

function handleMouseMove(e: MouseEvent) {
  if (isDragging.value) {
    const deltaX = e.clientX - dragStart.value.x
    const deltaY = e.clientY - dragStart.value.y
    
    const container = containerRef.value
    if (container) {
      const rect = container.getBoundingClientRect()
      const currentX = position.value.x || rect.left
      const currentY = position.value.y || rect.top
      
      const newX = currentX + deltaX
      const newY = currentY + deltaY
      
      const maxX = window.innerWidth - rect.width
      const maxY = window.innerHeight - rect.height
      
      position.value = {
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      }
    }
    
    dragStart.value = { x: e.clientX, y: e.clientY }
  } else if (isResizing.value) {
    const deltaX = e.clientX - resizeStart.value.x
    const deltaY = e.clientY - resizeStart.value.y
    const newWidth = Math.max(400, Math.min(resizeStart.value.width + deltaX, window.innerWidth))
    const newHeight = Math.max(300, Math.min(resizeStart.value.height + deltaY, window.innerHeight))
    size.value = { width: newWidth, height: newHeight }
  }
}

function handleMouseUp() {
  isDragging.value = false
  isResizing.value = false
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) return

    const savedPosition = localStorage.getItem('debugConsole_position')
    const savedSize = localStorage.getItem('debugConsole_size')

    if (savedPosition) {
      try {
        position.value = JSON.parse(savedPosition)
      } catch {
        // ignore
      }
    }

    if (savedSize) {
      try {
        size.value = JSON.parse(savedSize)
      } catch {
        // ignore
      }
    }

    logs.value = logger.getLogs()
    const unsubscribe = logger.subscribe((newLogs) => {
      logs.value = newLogs
    })

    return () => {
      unsubscribe()
    }
  },
  { immediate: true }
)

watch(
  () => position.value,
  (newPosition) => {
    if (props.isOpen && (newPosition.x !== 0 || newPosition.y !== 0)) {
      localStorage.setItem('debugConsole_position', JSON.stringify(newPosition))
    }
  },
  { deep: true }
)

watch(
  () => size.value,
  (newSize) => {
    if (props.isOpen) {
      localStorage.setItem('debugConsole_size', JSON.stringify(newSize))
    }
  },
  { deep: true }
)

watch(
  () => logs.value,
  () => {
    if (scrollRef.value && props.isOpen) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight
    }
  }
)

watch(
  [() => isDragging.value, () => isResizing.value],
  ([dragging, resizing]) => {
    if (dragging || resizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    } else {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
})
</script>

