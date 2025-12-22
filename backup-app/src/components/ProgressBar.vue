<template>
  <div class="w-full">
    <div v-if="label" class="flex justify-between text-sm text-gray-400 mb-1">
      <span>{{ label }}</span>
      <span>{{ displayValue }} / {{ displayMax }} ({{ percentage.toFixed(1) }}%)</span>
    </div>
    <div class="w-full h-2 bg-dark-surface rounded-full overflow-hidden">
      <div
        class="h-full bg-blue-500 transition-all duration-300 rounded-full"
        :style="{ width: `${percentage}%` }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  value: number
  max: number
  label?: string
  formatValue?: (value: number) => string
}

const props = defineProps<Props>()

const percentage = computed(() => (props.max > 0 ? Math.min((props.value / props.max) * 100, 100) : 0))
const displayValue = computed(() =>
  props.formatValue ? props.formatValue(props.value) : props.value.toString()
)
const displayMax = computed(() =>
  props.formatValue ? props.formatValue(props.max) : props.max.toString()
)
</script>

