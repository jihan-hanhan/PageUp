<script setup lang="ts">
import { ref } from 'vue'
import { getCurrentUser } from '@/services/github'
import { setAuthToken, store } from '@/services/store'

const emit = defineEmits<{
  (e: 'login', token: string): void
  (e: 'error', message: string): void
}>()

const pat = ref('')
const isLoading = ref(false)

async function handleLogin() {
  if (!pat.value.trim()) {
    emit('error', 'Please enter a Personal Access Token')
    return
  }
  isLoading.value = true
  try {
    const user = await getCurrentUser(pat.value.trim())
    store.user = user
    store.token = pat.value.trim()
    setAuthToken(pat.value.trim())
    emit('login', pat.value.trim())
  } catch (error) {
      const msg = error instanceof Error ? error.message : 'Invalid token or authentication failed'
      emit('error', msg)
    } finally {
    isLoading.value = false
  }
}

function handleGitHubLogin() {
  emit('error', 'OAuth login is not available. Please use a Personal Access Token.')
}
</script>

<template>
  <div class="auth-view">
    <div class="auth-container">
      <div class="logo">
        <h1>PageUp</h1>
        <p>A lightweight document management tool for GitHub</p>
      </div>

      <div class="auth-form">
        <button class="btn-github" @click="handleGitHubLogin">
          <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          Login with GitHub
        </button>

        <div class="divider"><span>or</span></div>

        <div class="form-group">
          <label for="token">Personal Access Token</label>
          <input id="token" v-model="pat" type="password" placeholder="Enter your GitHub PAT" />
          <small class="hint">Create one at https://github.com/settings/tokens</small>
        </div>

        <button class="btn-full btn-primary" @click="handleLogin" :disabled="isLoading">
          <span v-if="isLoading"><span class="spinner"></span></span>
          <span v-else>Login with Token</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-view {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--auth-bg);
  padding: 16px;
  transition: background-color 0.3s;
}

.auth-container {
  background: var(--auth-container-bg);
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 450px;
  transition: background-color 0.3s;
}

.logo {
  text-align: center;
  margin-bottom: 30px;
}

.logo h1 {
  font-size: 2.5rem;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.logo p {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--text-primary);
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--input-border);
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s;
  font-family: inherit;
  background: var(--input-bg);
  color: var(--text-primary);
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent);
}

.form-group input::placeholder {
  color: var(--text-muted);
}

.form-group .hint {
  display: block;
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.btn-github {
  width: 100%;
  padding: 14px 20px;
  background: #24292e;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-family: inherit;
}

.btn-github:hover {
  background: #30363d;
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(36, 41, 46, 0.4);
}

.github-icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.divider::before, .divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--divider-line);
}

.divider::before { margin-right: 16px; }
.divider::after { margin-left: 16px; }

.btn-full {
  width: 100%;
  padding: 14px 20px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

@media (max-width: 768px) {
  .auth-view {
    padding: 16px;
    align-items: flex-start;
    overflow-y: auto;
  }

  .auth-container {
    padding: 24px 20px;
    border-radius: 10px;
    margin-top: 5vh;
    max-width: 100%;
  }

  .logo h1 { font-size: 2rem; }
  .logo p { font-size: 0.85rem; }

  .btn-github, .btn-full {
    padding: 14px 16px;
    font-size: 0.95rem;
  }

  .form-group input {
    padding: 12px 14px;
    font-size: 16px;
  }
}
</style>
