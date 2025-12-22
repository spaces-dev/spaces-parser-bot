import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, UserSection } from '@/types'
import {
  parseCookies,
  createCookiesFromSid,
  mergeCookies,
} from '@/utils/cookies'
import { fetchPageWithCookies } from '@/utils/http'
import {
  extractUsername,
  checkIsCurrentUser,
  parseUserSections,
  extractAvatarUrl,
} from '@/utils/parser'
import { extractCKFromUrl, addCKToUrl } from '@/utils/url'
import { config } from '@/config'
import {
  saveCookies,
  loadCookies,
  saveUser,
  loadUser,
  saveSections,
  loadSections,
  clearCookies,
} from '@/utils/storage'

export const useAuthStore = defineStore('auth', () => {
  const sid = ref('')
  const fullCookies = ref<Record<string, string>>({})
  const user = ref<User | null>(null)
  const sections = ref<UserSection[]>([])
  const selectedSections = ref<string[]>([])
  const isLoading = ref(false)

  const isAuthenticated = computed(() => !!user.value)

  function loadSavedData() {
    const savedCookies = loadCookies()
    const savedUser = loadUser()
    const savedSections = loadSections()

    if (savedCookies && sid.value.trim() === '' && Object.keys(fullCookies.value).length === 0) {
      try {
        const parsed = JSON.parse(savedCookies)
        if (parsed.sid) {
          sid.value = parsed.sid
          fullCookies.value = parsed
          if (savedUser) {
            user.value = savedUser
            sections.value = savedSections || []
            selectedSections.value = savedSections ? savedSections.map((s) => s.id) : []
          }
        }
      } catch {
        const parsed = parseCookies(savedCookies)
        if (parsed.sid) {
          sid.value = parsed.sid
          fullCookies.value = parsed
          if (savedUser) {
            user.value = savedUser
            sections.value = savedSections || []
            selectedSections.value = savedSections ? savedSections.map((s) => s.id) : []
          }
        }
      }
    } else if (savedUser && !user.value) {
      user.value = savedUser
      sections.value = savedSections || []
      selectedSections.value = savedSections ? savedSections.map((s) => s.id) : []
    }
  }

  async function loadUserData() {
    if (isLoading.value) return

    const sidToUse = sid.value.trim()
    if (!sidToUse) {
      user.value = null
      sections.value = []
      selectedSections.value = []
      return
    }

    isLoading.value = true
    try {
      let currentCookies = fullCookies.value.sid ? fullCookies.value : createCookiesFromSid(sidToUse)

      const response = await fetchPageWithCookies(config.baseUrl, currentCookies)
      let html = response.html
      const newCookies = mergeCookies(currentCookies, response.cookies)
      currentCookies = newCookies
      fullCookies.value = currentCookies

      let username = extractUsername(config.baseUrl, html)
      let isCurrentUser = checkIsCurrentUser(html)

      const deviceTypeMatch = html.match(/href="([^"]*device_type[^"]*)"/)
      const deviceTypeUrl = deviceTypeMatch ? deviceTypeMatch[1] : ''
      let ck = extractCKFromUrl(deviceTypeUrl) || extractCKFromUrl(config.baseUrl)

      console.log('Extracted username from main:', username)
      console.log('Is current user:', isCurrentUser)
      console.log('CK:', ck)
      console.log('Cookies from response:', response.cookies)

      let avatarUrl: string | undefined
      let sectionsHtml = html

      if (!username && response.cookies.user_id) {
        console.log('Username not found, trying to load profile by user_id:', response.cookies.user_id)
        try {
          const profileUrl = `${config.baseUrl}/mysite/index/`
          const profileResponse = await fetchPageWithCookies(profileUrl, currentCookies)
          const profileCookies = mergeCookies(currentCookies, profileResponse.cookies)
          currentCookies = profileCookies
          fullCookies.value = currentCookies
          username = extractUsername(profileUrl, profileResponse.html)
          sectionsHtml = profileResponse.html
          console.log('Found username from profile page:', username)
        } catch (e) {
          console.log('Failed to load profile page:', e)
        }
      }

      if (username) {
        let profileUrl = `${config.baseUrl}/mysite/index/${username}/`
        if (ck) {
          profileUrl = addCKToUrl(profileUrl, ck)
        }
        try {
          const profileResponse = await fetchPageWithCookies(profileUrl, currentCookies)
          sectionsHtml = profileResponse.html
          const profileCookies = mergeCookies(currentCookies, profileResponse.cookies)
          currentCookies = profileCookies
          fullCookies.value = currentCookies
          console.log('Loaded profile page:', profileUrl)
          avatarUrl = extractAvatarUrl(profileResponse.html)
          console.log('Avatar URL from profile page:', avatarUrl)

          if (!username) {
            username = extractUsername(profileUrl, profileResponse.html)
            console.log('Extracted username from profile page:', username)
          }
        } catch (e) {
          console.log('Failed to load profile, using main page HTML for sections')
          avatarUrl = extractAvatarUrl(html)
        }
      } else {
        avatarUrl = extractAvatarUrl(html)
      }

      const parsedSections = parseUserSections(sectionsHtml, username, config.baseUrl)

      console.log('Parsed sections:', parsedSections)

      const userData: User = { username, isCurrentUser, avatarUrl }
      saveUser(userData)
      saveCookies(JSON.stringify(currentCookies))
      saveSections(parsedSections)

      user.value = userData
      sections.value = parsedSections
      selectedSections.value = parsedSections.map((s) => s.id)
    } catch (error) {
      throw error
    } finally {
      isLoading.value = false
    }
  }

  function logout() {
    isLoading.value = false
    clearCookies()
    sid.value = ''
    fullCookies.value = {}
    user.value = null
    sections.value = []
    selectedSections.value = []
  }

  function updateCookies(newCookies: Record<string, string>) {
    fullCookies.value = newCookies
    saveCookies(JSON.stringify(newCookies))
  }

  function setSelectedSections(selected: string[]) {
    selectedSections.value = selected
  }

  return {
    sid,
    fullCookies,
    user,
    sections,
    selectedSections,
    isLoading,
    isAuthenticated,
    loadSavedData,
    loadUserData,
    logout,
    updateCookies,
    setSelectedSections,
  }
})

