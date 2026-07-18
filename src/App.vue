<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import AuthView from '@/components/AuthView.vue'
import MainView from '@/components/MainView.vue'
import { store, getSavedToken, setAuthToken, getSavedTheme } from '@/services/store'
import { getCurrentUser } from '@/services/github'

const isAuthenticated = ref(false)
const isAutoLoginLoading = ref(false)
const error = ref('')

async function autoLogin() {
  const savedToken = getSavedToken()
  if (!savedToken) return

  isAutoLoginLoading.value = true
  try {
    const user = await getCurrentUser(savedToken)
    store.user = user
    setAuthToken(savedToken)
    isAuthenticated.value = true
  } catch {
    error.value = 'Session expired, please login again'
  } finally {
    isAutoLoginLoading.value = false
  }
}

function handleLogin() {
  isAuthenticated.value = true
  error.value = ''
}

function handleLogout() {
  isAuthenticated.value = false
}

function handleError(message: string) {
  error.value = message
}

watch(() => store.theme, (newTheme) => {
  document.documentElement.setAttribute('data-theme', newTheme)
})

onMounted(() => {
  const savedTheme = getSavedTheme()
  store.theme = savedTheme
  document.documentElement.setAttribute('data-theme', savedTheme)
  autoLogin()
})
</script>

<template>
  <div class="app">
    <div v-if="isAutoLoginLoading" class="loading-screen">
      <span class="loading-spinner">⏳</span>
      <p>Loading...</p>
    </div>

    <template v-else>
      <AuthView
        v-if="!isAuthenticated"
        @login="handleLogin"
        @error="handleError"
      />
      <MainView
        v-else
        @logout="handleLogout"
      />
    </template>

    <div v-if="error" class="error-message">
      {{ error }}
      <button @click="error = ''" class="close-btn">×</button>
    </div>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
}

.loading-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: var(--bg-main);
}

.loading-spinner {
  font-size: 48px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.loading-screen p {
  margin-top: 20px;
  color: var(--text-secondary);
}

.error-message {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--save-error-bg);
  color: var(--save-error-text);
  padding: 12px 24px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 1000;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { transform: translateX(-50%) translateY(20px); opacity: 0; }
  to { transform: translateX(-50%) translateY(0); opacity: 1; }
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.3rem;
  cursor: pointer;
  color: inherit;
  padding: 0;
  line-height: 1;
  font-family: inherit;
}
</style>
