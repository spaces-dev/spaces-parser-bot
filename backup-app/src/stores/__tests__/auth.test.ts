import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import * as storage from '@/utils/storage'
import * as cookies from '@/utils/cookies'
import * as http from '@/utils/http'
import * as parser from '@/utils/parser'

vi.mock('@/utils/storage')
vi.mock('@/utils/cookies')
vi.mock('@/utils/http')
vi.mock('@/utils/parser')

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should initialize with empty state', () => {
    const store = useAuthStore()
    expect(store.sid).toBe('')
    expect(store.user).toBeNull()
    expect(store.sections).toEqual([])
    expect(store.selectedSections).toEqual([])
    expect(store.isAuthenticated).toBe(false)
  })

  it('should load saved data from localStorage', () => {
    const mockCookies = '{"sid":"test123"}'
    const mockUser = { username: 'testuser', isCurrentUser: true }
    const mockSections = [{ id: '1', name: 'Test', folderName: 'test', url: '', icon: '', count: 0, type: 'pictures' }]

    vi.mocked(storage.loadCookies).mockReturnValue(mockCookies)
    vi.mocked(storage.loadUser).mockReturnValue(mockUser)
    vi.mocked(storage.loadSections).mockReturnValue(mockSections)
    vi.mocked(cookies.parseCookies).mockReturnValue({ sid: 'test123' })

    const store = useAuthStore()
    store.loadSavedData()

    expect(store.sid).toBe('test123')
    expect(store.user).toEqual(mockUser)
    expect(store.sections).toEqual(mockSections)
  })

  it('should logout and clear state', () => {
    const store = useAuthStore()
    store.sid = 'test123'
    store.user = { username: 'test', isCurrentUser: true }
    store.sections = []
    store.selectedSections = []

    store.logout()

    expect(store.sid).toBe('')
    expect(store.user).toBeNull()
    expect(store.sections).toEqual([])
    expect(store.selectedSections).toEqual([])
    expect(storage.clearAllAuthData).toHaveBeenCalled()
  })

  it('should update selected sections', () => {
    const store = useAuthStore()
    const selected = ['1', '2', '3']

    store.setSelectedSections(selected)

    expect(store.selectedSections).toEqual(selected)
  })

  it('should update cookies', () => {
    const store = useAuthStore()
    const newCookies = { sid: 'test', user_id: '123' }

    store.updateCookies(newCookies)

    expect(store.fullCookies).toEqual(newCookies)
    expect(storage.saveCookies).toHaveBeenCalledWith(JSON.stringify(newCookies))
  })
})

