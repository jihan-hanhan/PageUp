<script setup lang="ts">
defineProps<{
  error: Error | null
}>()

const emit = defineEmits<{
  (e: 'resolve', type: 'fork' | 'branch'): void
  (e: 'cancel'): void
}>()

const options = [
  {
    type: 'fork' as const,
    icon: '🔀',
    label: 'Fork & PR',
    description: 'Create a fork of this repository and submit a Pull Request with your changes'
  },
  {
    type: 'branch' as const,
    icon: '🌿',
    label: 'Branch & PR',
    description: 'Create a new branch and submit a Pull Request for review'
  }
]
</script>

<template>
  <div class="modal-overlay" @click.self="emit('cancel')">
    <div class="modal-content">
      <div class="modal-header">
        <span class="error-icon">⚠️</span>
        <h3>Permission Denied</h3>
      </div>

      <div class="modal-body">
        <p>You don't have permission to push to this repository. Choose how to proceed:</p>
        <div class="options-list">
          <div
            v-for="option in options"
            :key="option.type"
            @click="emit('resolve', option.type)"
            class="option-card"
          >
            <span class="option-icon">{{ option.icon }}</span>
            <div class="option-info">
              <span class="option-label">{{ option.label }}</span>
              <span class="option-desc">{{ option.description }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="emit('cancel')" class="btn btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-surface);
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.error-icon {
  font-size: 24px;
}

.modal-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
}

.modal-body p {
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--bg-main);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.option-card:hover {
  background: var(--bg-hover);
  border-color: var(--border-color);
}

.option-icon {
  font-size: 28px;
}

.option-info {
  flex: 1;
}

.option-label {
  display: block;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.option-desc {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
}

.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--border-color);
}
</style>
