<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { Document, Repository } from '@/types'
import { store, clearAuth } from '@/services/store'
import { getRepository, listDocuments, getDocument, saveDocument, deleteDocument } from '@/services/github'

const emit = defineEmits<{
  (e: 'logout'): void
}>()

const repoInput = ref('')
const isConnecting = ref(false)
const sidebarOpen = ref(false)
const isMobile = ref(false)
const sidebarWidth = ref('280px')
const isResizing = ref(false)
const documents = ref<Document[]>([])
const selectedDocIndex = ref<number | null>(null)
const isLoading = ref(false)
const editorTab = ref<'edit' | 'preview'>('edit')
const pendingCount = ref(0)
const showSaveMessage = ref(false)
const saveMessageText = ref('')
const saveMessageType = ref<'success' | 'error'>('success')
const editingNameIndex = ref<number | null>(null)
const editingNameValue = ref('')

function checkMobile() {
  isMobile.value = window.innerWidth <= 768
  if (isMobile.value) {
    sidebarWidth.value = ''
    sidebarOpen.value = false
  } else {
    const savedWidth = localStorage.getItem('pageup-sidebar-width')
    if (savedWidth) sidebarWidth.value = savedWidth
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  initSidebarResizer()
  initMobileSwipe()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

async function handleConnect() {
  if (!repoInput.value.trim() || !store.token) return
  
  const [owner, repo] = repoInput.value.trim().split('/')
  if (!owner || !repo) {
    showToast('Please enter repository in format: owner/repo', 'error')
    return
  }
  
  isConnecting.value = true
  try {
    const repository = await getRepository(store.token, owner, repo)
    store.currentRepository = repository
    await loadDocuments()
    showToast(`Connected to ${owner}/${repo}`, 'success')
  } catch (error) {
    showToast('Failed to connect to repository', 'error')
  } finally {
    isConnecting.value = false
  }
}

async function loadDocuments() {
  if (!store.currentRepository || !store.token) return
  
  isLoading.value = true
  try {
    const docs = await listDocuments(store.token, store.currentRepository.owner.login, store.currentRepository.name)
    documents.value = docs.map(doc => ({ ...doc, hasDraft: false, content: '' }))
    updatePendingCount()
  } catch (error) {
    documents.value = []
  } finally {
    isLoading.value = false
  }
}

async function selectDoc(index: number) {
  const doc = documents.value[index]
  if (!store.currentRepository || !store.token) return
  
  isLoading.value = true
  try {
    if (!doc.content) {
      const content = await getDocument(store.token, store.currentRepository.owner.login, store.currentRepository.name, doc.path)
      doc.content = content
    }
    selectedDocIndex.value = index
    
    if (isMobile.value) {
      sidebarOpen.value = false
    }
  } catch (error) {
    doc.content = ''
    selectedDocIndex.value = index
  } finally {
    isLoading.value = false
  }
}

function createDoc() {
  let name = 'new-document.md'
  let counter = 1
  while (documents.value.some(d => d.name === name)) {
    name = `new-document-${counter}.md`
    counter++
  }
  const newDoc: Document = {
    id: Date.now().toString(),
    name,
    content: '',
    path: `docs/${name}`,
    isNew: true,
    hasDraft: false
  }
  documents.value.push(newDoc)
  selectedDocIndex.value = documents.value.length - 1
  
  if (isMobile.value) {
    sidebarOpen.value = false
  }
}

function updateDocumentContent(content: string) {
  if (selectedDocIndex.value !== null) {
    documents.value[selectedDocIndex.value].content = content
  }
}

function saveLocal() {
  if (selectedDocIndex.value !== null) {
    documents.value[selectedDocIndex.value].hasDraft = true
    updatePendingCount()
    showToast('Saved to local draft ✓', 'success')
  }
}

async function pushDoc() {
  if (selectedDocIndex.value === null || !store.currentRepository || !store.token) return
  
  const doc = documents.value[selectedDocIndex.value]
  isLoading.value = true
  
  try {
    await saveDocument(store.token, store.currentRepository.owner.login, store.currentRepository.name, doc.path, doc.content, doc.sha)
    doc.hasDraft = false
    updatePendingCount()
    showToast('Pushed to GitHub ✓', 'success')
  } catch (error) {
    showToast('Push failed. Check your permissions.', 'error')
  } finally {
    isLoading.value = false
  }
}

async function pushAll() {
  if (!store.currentRepository || !store.token) return
  
  showToast('Pushing all changes...', 'success')
  
  const draftDocs = documents.value.filter(d => d.hasDraft)
  
  for (const doc of draftDocs) {
    try {
      await saveDocument(store.token, store.currentRepository.owner.login, store.currentRepository.name, doc.path, doc.content, doc.sha)
      doc.hasDraft = false
    } catch {
      showToast('Some files failed to push', 'error')
      break
    }
  }
  
  updatePendingCount()
  showToast('All changes pushed ✓', 'success')
}

function backToList() {
  selectedDocIndex.value = null
}

function startRename(index: number, event: MouseEvent) {
  event.stopPropagation()
  editingNameIndex.value = index
  editingNameValue.value = documents.value[index].name
}

function cancelRename() {
  editingNameIndex.value = null
  editingNameValue.value = ''
}

function confirmRename(index: number) {
  const newName = editingNameValue.value.trim()
  if (!newName) {
    cancelRename()
    return
  }
  
  if (documents.value.some((doc, i) => i !== index && doc.name === newName)) {
    showToast('A document with this name already exists', 'error')
    return
  }
  
  const oldName = documents.value[index].name
  const oldPath = documents.value[index].path
  documents.value[index].name = newName
  documents.value[index].path = oldPath.replace(oldName, newName)
  documents.value[index].hasDraft = true
  updatePendingCount()
  
  editingNameIndex.value = null
  editingNameValue.value = ''
  showToast('Renamed', 'success')
}

function deleteDoc(index: number, event: MouseEvent) {
  event.stopPropagation()
  if (!confirm(`Are you sure you want to delete "${documents.value[index].name}"?`)) {
    return
  }
  
  if (selectedDocIndex.value === index) {
    selectedDocIndex.value = null
  }
  
  documents.value.splice(index, 1)
  updatePendingCount()
  showToast('Deleted', 'success')
}

async function deleteDocFromRepo(index: number, event: MouseEvent) {
  event.stopPropagation()
  if (!store.currentRepository || !store.token) return
  
  const doc = documents.value[index]
  if (!doc.sha) {
    deleteDoc(index, event)
    return
  }
  
  if (!confirm(`Are you sure you want to delete "${doc.name}" from GitHub?`)) {
    return
  }
  
  isLoading.value = true
  try {
    await deleteDocument(store.token, store.currentRepository.owner.login, store.currentRepository.name, doc.path, doc.sha)
    if (selectedDocIndex.value === index) {
      selectedDocIndex.value = null
    }
    documents.value.splice(index, 1)
    updatePendingCount()
    showToast('Deleted from GitHub', 'success')
  } catch (error) {
    showToast('Failed to delete from GitHub', 'error')
  } finally {
    isLoading.value = false
  }
}

function handleLogout() {
  clearAuth()
  documents.value = []
  selectedDocIndex.value = null
  emit('logout')
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function updatePendingCount() {
  pendingCount.value = documents.value.filter(d => d.hasDraft).length
}

function showToast(message: string, type: 'success' | 'error') {
  saveMessageText.value = message
  saveMessageType.value = type
  showSaveMessage.value = true
  setTimeout(() => {
    showSaveMessage.value = false
  }, 2500)
}

function switchTab(tab: 'edit' | 'preview') {
  editorTab.value = tab
}

function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
  
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
  
  html = html.replace(/^-{3,}$/gm, '<hr>')
  
  html = html.split(/\n\n+/).map(block => {
    if (block.startsWith('<')) return block
    
    const lines = block.split('\n')
    const isOrderedList = lines.every(line => /^\d+\.\s/.test(line))
    const isUnorderedList = lines.every(line => /^[-*+]\s/.test(line))
    
    if (isOrderedList) {
      return '<ol>\n' + lines.map(line => line.replace(/^\d+\.\s(.+)$/, '<li>$1</li>')).join('\n') + '\n</ol>'
    }
    if (isUnorderedList) {
      return '<ul>\n' + lines.map(line => line.replace(/^[-*+]\s(.+)$/, '<li>$1</li>')).join('\n') + '\n</ul>'
    }
    
    return '<p>' + block.replace(/\n/g, '<br>') + '</p>'
  }).join('\n')

  return html
}

function initSidebarResizer() {
  const resizer = document.getElementById('sidebar-resizer')
  const sidebar = document.getElementById('sidebar')
  const mainContent = document.getElementById('main-content')
  let startX = 0
  let startWidth = 0

  resizer?.addEventListener('mousedown', (e) => {
    if (window.innerWidth <= 768) return
    isResizing.value = true
    startX = e.clientX
    startWidth = sidebar?.offsetWidth || 280
    resizer.classList.add('dragging')
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  })

  document.addEventListener('mousemove', (e) => {
    if (!isResizing.value) return
    
    const delta = e.clientX - startX
    let newWidth = startWidth + delta
    const minWidth = 180
    const maxWidth = Math.min(500, (mainContent?.offsetWidth || 800) - 300)
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
    sidebarWidth.value = newWidth + 'px'
  })

  document.addEventListener('mouseup', () => {
    if (isResizing.value) {
      isResizing.value = false
      resizer?.classList.remove('dragging')
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem('pageup-sidebar-width', sidebarWidth.value)
    }
  })

  resizer?.addEventListener('touchstart', (e) => {
    if (window.innerWidth <= 768) return
    isResizing.value = true
    startX = e.touches[0].clientX
    startWidth = sidebar?.offsetWidth || 280
    resizer.classList.add('dragging')
    e.preventDefault()
  }, { passive: false })

  document.addEventListener('touchmove', (e) => {
    if (!isResizing.value) return
    const delta = e.touches[0].clientX - startX
    let newWidth = startWidth + delta
    const minWidth = 180
    const maxWidth = Math.min(500, (mainContent?.offsetWidth || 800) - 300)
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
    sidebarWidth.value = newWidth + 'px'
  }, { passive: false })

  document.addEventListener('touchend', () => {
    if (isResizing.value) {
      isResizing.value = false
      resizer?.classList.remove('dragging')
      localStorage.setItem('pageup-sidebar-width', sidebarWidth.value)
    }
  })
}

function initMobileSwipe() {
  const mainEl = document.getElementById('main-content')
  const sidebarEl = document.getElementById('sidebar')
  const backdrop = document.getElementById('backdrop')
  if (!mainEl || !sidebarEl || !backdrop) return

  const EDGE_ZONE = 30
  let touchStartX = 0
  let touchStartY = 0
  let touchCurrentX = 0
  let isHorizontalSwipe = false
  let swipeMode: 'open' | 'close' | null = null
  let sidebarWidth = 0

  const elMain = mainEl
  const elSidebar = sidebarEl
  const elBackdrop = backdrop

  function onTouchStart(e: TouchEvent) {
    if (!isMobile.value) return
    touchStartX = e.touches[0].clientX
    touchStartY = e.touches[0].clientY
    touchCurrentX = touchStartX
    isHorizontalSwipe = false
    swipeMode = null

    if (sidebarOpen.value) {
      swipeMode = 'close'
      sidebarWidth = elSidebar.offsetWidth
    } else if (touchStartX <= EDGE_ZONE) {
      swipeMode = 'open'
      sidebarWidth = Math.min(elMain.offsetWidth * 0.85, 320)
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (!isMobile.value || !swipeMode) return
    touchCurrentX = e.touches[0].clientX
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY)
    const deltaX = touchCurrentX - touchStartX

    if (!isHorizontalSwipe) {
      if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > 10) {
        isHorizontalSwipe = true
        elSidebar.classList.add('dragging')
        elBackdrop.style.display = 'block'
      } else if (deltaY > 10) {
        swipeMode = null
        return
      } else {
        return
      }
    }

    e.preventDefault()

    let translateX = 0
    if (swipeMode === 'open') {
      translateX = Math.min(0, deltaX - sidebarWidth)
      elBackdrop.style.opacity = Math.max(0, Math.min(1, deltaX / sidebarWidth)).toString()
    } else {
      translateX = Math.max(-sidebarWidth, deltaX)
      elBackdrop.style.opacity = Math.max(0, Math.min(1, 1 + deltaX / sidebarWidth)).toString()
    }
    elSidebar.style.transform = 'translateX(' + translateX + 'px)'
  }

  function onTouchEnd() {
    if (!isMobile.value || !swipeMode || !isHorizontalSwipe) {
      swipeMode = null
      isHorizontalSwipe = false
      return
    }

    const deltaX = touchCurrentX - touchStartX
    const threshold = sidebarWidth * 0.4

    elSidebar.classList.remove('dragging')
    elSidebar.style.transform = ''
    elBackdrop.style.opacity = ''

    if (swipeMode === 'open' && deltaX > threshold) {
      sidebarOpen.value = true
      elBackdrop.style.display = 'block'
    } else if (swipeMode === 'close' && deltaX < -threshold) {
      sidebarOpen.value = false
      elBackdrop.style.display = 'none'
    } else if (swipeMode === 'open') {
      elBackdrop.style.display = 'none'
    }

    swipeMode = null
    isHorizontalSwipe = false
  }

  elMain.addEventListener('touchstart', onTouchStart, { passive: true })
  elMain.addEventListener('touchmove', onTouchMove, { passive: false })
  elMain.addEventListener('touchend', onTouchEnd)
  elSidebar.addEventListener('touchstart', onTouchStart, { passive: true })
  elSidebar.addEventListener('touchmove', onTouchMove, { passive: false })
  elSidebar.addEventListener('touchend', onTouchEnd)
}

const currentDocument = computed(() => {
  if (selectedDocIndex.value === null) return null
  return documents.value[selectedDocIndex.value]
})

const hasPushPermission = computed(() => {
  return store.currentRepository?.permissions?.push || false
})

const repoName = computed(() => {
  return store.currentRepository?.full_name || 'Not connected'
})

watch(() => store.theme, (newTheme) => {
  document.documentElement.setAttribute('data-theme', newTheme)
})
</script>

<template>
  <div class="main-view">
    <header class="header">
      <div class="header-left">
        <button class="menu-btn" @click="toggleSidebar">☰</button>
        <h1 class="app-title">PageUp</h1>
      </div>

      <div class="header-center">
        <button class="theme-toggle" @click="store.theme = store.theme === 'light' ? 'dark' : 'light'" title="Toggle dark/light mode">
          <span class="icon-moon">🌙</span>
          <span class="icon-sun">☀️</span>
        </button>
        <input
          v-model="repoInput"
          type="text"
          placeholder="owner/repo"
          class="repo-select"
          @keyup.enter="handleConnect"
        />
        <button @click="handleConnect" :disabled="isConnecting" class="btn btn-primary btn-sm">
          <span v-if="isConnecting"><span class="spinner"></span></span>
          <span v-else>Connect</span>
        </button>
      </div>

      <div class="header-right">
        <button class="btn btn-push-all" @click="pushAll" title="Push all pending changes">
          <span>↑</span>
          <span class="btn-text">Push All</span>
          <span class="badge" v-if="pendingCount > 0">{{ pendingCount }}</span>
        </button>
        <button class="btn btn-icon" @click="handleLogout" title="Logout">⏻</button>
      </div>
    </header>

    <div class="main-content" id="main-content">
      <aside
        class="sidebar"
        id="sidebar"
        :class="{ open: sidebarOpen }"
        :style="{ width: sidebarWidth }"
      >
        <div class="sidebar-header">
          <h2>Documents</h2>
          <button class="btn btn-sm btn-primary" @click="createDoc">+ New</button>
        </div>

        <div class="doc-list" id="doc-list">
          <div v-if="isLoading" class="empty-state">
            <p>Loading...</p>
          </div>
          <div v-else-if="documents.length === 0" class="empty-state">
            <p>No documents found</p>
            <p class="hint">Create a new document to get started</p>
          </div>
          <div
            v-for="(doc, idx) in documents"
            :key="doc.id"
            @click="selectDoc(idx)"
            :class="['doc-item', { active: selectedDocIndex === idx, 'has-draft': doc.hasDraft }]"
          >
            <div v-if="editingNameIndex === idx" class="rename-input-container">
              <input
                v-model="editingNameValue"
                type="text"
                class="rename-input"
                @blur="confirmRename(idx)"
                @keyup.enter="confirmRename(idx)"
                @keyup.escape="cancelRename"
                autofocus
              />
              <button class="btn btn-xs btn-confirm" @click.stop="confirmRename(idx)">✓</button>
              <button class="btn btn-xs btn-cancel" @click.stop="cancelRename">✕</button>
            </div>
            <div v-else class="doc-info">
              <span class="doc-name">{{ doc.name }}</span>
              <span v-if="doc.hasDraft" class="draft-badge">draft</span>
            </div>
            <div class="doc-actions">
              <button class="btn btn-icon btn-sm" @click="startRename(idx, $event)" title="Rename">✏️</button>
              <button class="btn btn-icon btn-sm btn-danger" @click="deleteDoc(idx, $event)" title="Delete local">🗑️</button>
            </div>
          </div>
        </div>
      </aside>

      <div class="sidebar-resizer" id="sidebar-resizer" title="Drag to resize"></div>

      <main class="editor-area" id="editor-area">
        <div class="editor-wrapper" id="editor-wrapper">
          <div v-if="!currentDocument" class="no-doc-selected" id="no-doc">
            <div class="icon">📄</div>
            <h2>Select a document</h2>
            <p>Choose a document from the list or create a new one</p>
          </div>

          <div v-else class="editor-wrapper" id="editor">
            <div class="editor-header">
              <button class="back-btn" @click="backToList">‹</button>
              <input class="doc-title-input" :value="currentDocument.name" disabled />
              <div class="editor-actions">
                <button class="btn btn-save" @click="saveLocal" title="Save to local draft">
                  <span>💾</span>
                  <span class="btn-text">Save</span>
                </button>
                <button class="btn btn-push" @click="pushDoc" :disabled="!hasPushPermission" title="Push to GitHub">
                  <span>↑</span>
                  <span class="btn-text">Push</span>
                </button>
              </div>
            </div>

            <div class="status-bar">
              <span v-if="currentDocument.hasDraft" class="status-pill status-draft">● Local draft saved</span>
              <span v-else class="status-pill status-clean">● Clean</span>
            </div>

            <div class="editor-body">
              <div class="editor-tabs">
                <button
                  class="tab"
                  :class="{ active: editorTab === 'edit' }"
                  @click="switchTab('edit')"
                >Edit</button>
                <button
                  class="tab"
                  :class="{ active: editorTab === 'preview' }"
                  @click="switchTab('preview')"
                >Preview</button>
              </div>

              <div class="editor-content">
                <textarea
                  class="text-editor"
                  :value="currentDocument.content"
                  @input="updateDocumentContent(($event.target as HTMLTextAreaElement).value)"
                  placeholder="Start writing your document here..."
                ></textarea>
                <div
                  v-if="editorTab === 'preview'"
                  class="preview-content"
                  v-html="renderMarkdown(currentDocument.content)"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <div
      class="backdrop"
      id="backdrop"
      @click="toggleSidebar"
      :style="{ display: sidebarOpen ? 'block' : 'none' }"
    ></div>

    <div
      v-if="showSaveMessage"
      class="save-message"
      :class="saveMessageType"
    >
      <span>{{ saveMessageText }}</span>
      <button class="close-btn" @click="showSaveMessage = false">×</button>
    </div>
  </div>
</template>

<style scoped>
.main-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-main);
  transition: background-color 0.3s;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 2px 4px var(--shadow-color);
  flex-shrink: 0;
  transition: background-color 0.3s, border-color 0.3s;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.menu-btn {
  display: none;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-primary);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: inherit;
}

.menu-btn:hover { background: var(--bg-hover); }

.app-title {
  font-size: 1.2rem;
  color: var(--text-primary);
  white-space: nowrap;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  min-width: 0;
  gap: 8px;
  align-items: center;
}

.repo-select {
  width: 100%;
  max-width: 300px;
  padding: 8px 12px;
  border: 2px solid var(--input-border);
  border-radius: 8px;
  font-size: 0.9rem;
  background: var(--input-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.3s, background-color 0.3s;
}

.repo-select:focus {
  outline: none;
  border-color: var(--accent);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.sidebar {
  min-width: 180px;
  max-width: 500px;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: background-color 0.3s, border-color 0.3s;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.sidebar-header h2 {
  font-size: 0.95rem;
  color: var(--text-primary);
}

.doc-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.doc-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.doc-item:hover { background: var(--bg-hover); }
.doc-item.active { background: var(--bg-active); }

.doc-item.has-draft {
  position: relative;
}

.doc-item.has-draft::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: #f59e0b;
  border-radius: 2px;
}

.doc-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.doc-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.doc-item:hover .doc-actions {
  opacity: 1;
}

.btn-xs {
  padding: 2px 6px;
  font-size: 0.75rem;
}

.btn-danger {
  color: #ef4444;
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.rename-input-container {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.rename-input {
  flex: 1;
  padding: 4px 8px;
  border: 2px solid var(--accent);
  border-radius: 4px;
  font-size: 0.88rem;
  background: var(--bg-surface-alt);
  color: var(--text-primary);
  font-family: inherit;
}

.rename-input:focus {
  outline: none;
}

.doc-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.88rem;
  color: var(--text-primary);
}

.draft-badge {
  background: var(--draft-badge-bg);
  color: var(--draft-badge-text);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
}

.empty-state p { margin-bottom: 8px; }

.empty-state .hint {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.sidebar-resizer {
  width: 6px;
  cursor: col-resize;
  background: transparent;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
  transition: background 0.2s;
}

.sidebar-resizer::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 1px;
  background: var(--border);
  transition: background 0.2s, width 0.2s;
}

.sidebar-resizer:hover::after,
.sidebar-resizer.dragging::after {
  background: var(--accent);
  width: 3px;
}

.sidebar-resizer:hover,
.sidebar-resizer.dragging {
  background: var(--bg-hover);
}

.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.backdrop {
  display: none;
}

.editor-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.no-doc-selected {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  padding: 20px;
  text-align: center;
}

.no-doc-selected .icon {
  font-size: 4rem;
  margin-bottom: 20px;
}

.no-doc-selected h2 {
  font-size: 1.5rem;
  margin-bottom: 10px;
  color: var(--text-secondary);
}

.editor-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  transition: background-color 0.3s, border-color 0.3s;
}

.back-btn {
  display: none;
  background: none;
  border: none;
  font-size: 2rem;
  line-height: 1;
  color: var(--accent);
  cursor: pointer;
  padding: 0 8px;
  font-family: inherit;
}

.doc-title-input {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border: 2px solid transparent;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  background: transparent;
  color: var(--text-primary);
  transition: border-color 0.3s, background-color 0.3s;
  font-family: inherit;
}

.doc-title-input:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--bg-surface-alt);
}

.editor-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.status-bar {
  display: flex;
  padding: 6px 12px;
  background: var(--bg-surface-alt);
  border-bottom: 1px solid var(--border);
  font-size: 0.75rem;
  transition: background-color 0.3s, border-color 0.3s;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.status-draft {
  color: var(--status-draft-text);
  background: var(--status-draft-bg);
}

.status-clean {
  color: var(--status-clean-text);
  background: var(--status-clean-bg);
}

.editor-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-tabs {
  display: flex;
  background: var(--border-light);
  border-bottom: 1px solid var(--border);
  transition: background-color 0.3s;
}

.tab {
  flex: 1;
  padding: 10px 16px;
  border: none;
  background: transparent;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.3s;
  border-bottom: 2px solid transparent;
  font-family: inherit;
}

.tab:hover { background: var(--bg-hover); }

.tab.active {
  background: var(--bg-surface);
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.editor-content {
  flex: 1;
  overflow: hidden;
}

.text-editor {
  width: 100%;
  height: 100%;
  padding: 16px;
  border: none;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  background: var(--bg-surface);
  color: var(--text-primary);
  transition: background-color 0.3s, color 0.3s;
}

.text-editor:focus { outline: none; }
.text-editor::placeholder { color: var(--text-muted); }

.preview-content {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  background: var(--bg-surface);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 15px;
  line-height: 1.7;
  transition: background-color 0.3s, color 0.3s;
}

.preview-content h1,
.preview-content h2,
.preview-content h3 {
  margin-bottom: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.preview-content h1 { font-size: 1.6rem; }
.preview-content h2 { font-size: 1.3rem; }
.preview-content h3 { font-size: 1.1rem; }

.preview-content p { margin-bottom: 12px; }

.preview-content ul,
.preview-content ol {
  margin-bottom: 12px;
  padding-left: 20px;
}

.preview-content code {
  background: var(--code-bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.85rem;
}

.preview-content pre {
  background: var(--code-block-bg);
  color: var(--code-block-text);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin-bottom: 12px;
}

.preview-content pre code {
  background: transparent;
  padding: 0;
  color: inherit;
}

.preview-content blockquote {
  border-left: 4px solid var(--accent);
  padding-left: 12px;
  margin: 12px 0;
  color: var(--text-secondary);
  font-style: italic;
}

.preview-content a {
  color: var(--accent);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}

.preview-content a:hover {
  border-bottom-color: var(--accent);
}

.preview-content img {
  max-width: 100%;
  border-radius: 8px;
}

.preview-content hr {
  border: none;
  height: 1px;
  background: var(--border);
  margin: 20px 0;
}

.preview-content h4 {
  font-size: 1rem;
  margin-bottom: 10px;
  font-weight: 600;
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .menu-btn { display: block; }
  .back-btn { display: block; }

  .btn-text { display: none; }
  .btn { padding: 8px 10px; }

  .header { padding: 8px 10px; }
  .app-title { font-size: 1rem; }

  .sidebar-resizer { display: none; }

  .sidebar {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 85%;
    max-width: 320px;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.25s ease, background-color 0.3s;
    box-shadow: 2px 0 12px rgba(0, 0, 0, 0.15);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar.dragging {
    transition: none !important;
  }

  .backdrop {
    display: block;
    position: absolute;
    inset: 0;
    background: var(--backdrop-bg);
    z-index: 99;
    transition: opacity 0.25s;
  }

  .repo-select {
    font-size: 0.85rem;
    padding: 6px 10px;
  }

  .doc-item { padding: 12px 14px; }
  .doc-name { font-size: 0.9rem; }

  .editor-header { padding: 8px; }
  .doc-title-input { font-size: 0.95rem; }

  .text-editor {
    font-size: 13px;
    padding: 12px;
  }

  .theme-toggle {
    width: 32px;
    height: 32px;
    font-size: 1rem;
  }
}
</style>
