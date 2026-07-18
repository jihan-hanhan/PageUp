import { reactive } from 'vue'
import type { User, Repository, Document } from '@/types'

interface Store {
  token: string | null
  isAuthenticated: boolean
  user: User | null
  repositories: Repository[]
  currentRepository: Repository | null
  documents: Document[]
  currentDocument: Document | null
  theme: 'light' | 'dark'
}

export const store = reactive<Store>({
  token: null,
  isAuthenticated: false,
  user: null,
  repositories: [],
  currentRepository: null,
  documents: [],
  currentDocument: null,
  theme: 'light'
})

const PAT_KEY = 'pageup-pat'

export function setAuthToken(token: string) {
  store.token = token
  store.isAuthenticated = true
  localStorage.setItem(PAT_KEY, token)
}

export function clearAuth() {
  store.token = null
  store.isAuthenticated = false
  store.user = null
  store.repositories = []
  store.currentRepository = null
  store.documents = []
  store.currentDocument = null
  localStorage.removeItem(PAT_KEY)
}

export function getSavedToken(): string | null {
  return localStorage.getItem(PAT_KEY)
}

export function setTheme(theme: 'light' | 'dark') {
  store.theme = theme
  localStorage.setItem('pageup-theme', theme)
}

export function getSavedTheme(): 'light' | 'dark' {
  return (localStorage.getItem('pageup-theme') as 'light' | 'dark') || 'light'
}
