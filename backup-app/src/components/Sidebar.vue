<template>
  <div class="w-64 bg-dark-surface bg-opacity-50 backdrop-blur-sm border-r border-dark-border p-6 min-h-screen flex flex-col">
    <div class="mb-8 text-center">
      <h1 class="text-2xl font-bold text-white">Spcs Backup</h1>
    </div>

    <div class="flex-1 space-y-6">
      <template v-if="user">
        <div class="text-center">
          <div class="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center overflow-hidden bg-dark-hover border border-dark-border">
            <img
              v-if="user.avatarUrl"
              :src="user.avatarUrl"
              :alt="user.username"
              class="w-full h-full object-cover"
              @error="handleAvatarError"
            />
            <div v-else class="w-full h-full flex items-center justify-center bg-dark-hover">
              <svg class="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          </div>
          <h3 class="text-white font-semibold text-lg mb-4">{{ user.username }}</h3>
        </div>

        <div class="space-y-2">
          <div class="text-center">
            <button
              @click="isConsoleOpen = true"
              class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors text-sm font-normal w-full"
            >
              Debug Console
            </button>
          </div>
          <div class="text-center">
            <button
              @click="handleLogout"
              class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors text-sm font-normal w-full"
            >
              Выйти
            </button>
          </div>
        </div>
      </template>
      <div v-else class="text-center text-gray-400">
        <p class="text-sm">Не авторизован</p>
      </div>
    </div>

    <DebugConsole :is-open="isConsoleOpen" @close="isConsoleOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { User } from '@/types'
import { clearCookies } from '@/utils/storage'
import DebugConsole from './DebugConsole.vue'

interface Props {
  user: User | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  logout: []
}>()

const isConsoleOpen = ref(false)

function handleLogout() {
  clearCookies()
  emit('logout')
}

function handleAvatarError(e: Event) {
  const target = e.target as HTMLImageElement
  target.style.display = 'none'
  const parent = target.parentElement
  if (parent && !parent.querySelector('.avatar-placeholder')) {
    const placeholder = document.createElement('div')
    placeholder.className = 'avatar-placeholder w-full h-full flex items-center justify-center bg-dark-hover'
    placeholder.innerHTML =
      '<svg class="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>'
    parent.appendChild(placeholder)
  }
}
</script>

