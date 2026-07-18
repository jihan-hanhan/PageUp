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

export interface RepoHistory {
  fullName: string
  owner: string
  name: string
  lastUsed: number
}

const PAT_KEY = 'pageup-pat'
const REPO_HISTORY_KEY = 'pageup-repo-history'

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

export function saveRepoToHistory(fullName: string, owner: string, name: string) {
  const history = getRepoHistory()
  const existingIndex = history.findIndex(h => h.fullName === fullName)
  
  if (existingIndex >= 0) {
    history[existingIndex].lastUsed = Date.now()
  } else {
    history.push({ fullName, owner, name, lastUsed: Date.now() })
  }
  
  history.sort((a, b) => b.lastUsed - a.lastUsed)
  
  const trimmedHistory = history.slice(0, 10)
  localStorage.setItem(REPO_HISTORY_KEY, JSON.stringify(trimmedHistory))
}

export function getRepoHistory(): RepoHistory[] {
  const data = localStorage.getItem(REPO_HISTORY_KEY)
  return data ? JSON.parse(data) : []
}

export function removeFromRepoHistory(fullName: string) {
  const history = getRepoHistory().filter(h => h.fullName !== fullName)
  localStorage.setItem(REPO_HISTORY_KEY, JSON.stringify(history))
}

export function clearRepoHistory() {
  localStorage.removeItem(REPO_HISTORY_KEY)
}
