<script setup lang="ts">import { ref, watch, computed } from 'vue';
import type { Document } from '@/types';
import { store } from '@/services/store';
import { saveDocument } from '@/services/github';
import PushConflictModal from './PushConflictModal.vue';
const props = defineProps<{
 document: Document | null;
}>();
const emit = defineEmits<{
 (e: 'save', document: Document): void;
 (e: 'update', document: Document): void;
}>();
const content = ref('');
const isSaving = ref(false);
const isPushing = ref(false);
const showConflictModal = ref(false);
const currentPushError = ref<Error | null>(null);
watch(() => props.document, (newDoc) => {
 if (newDoc) {
 content.value = newDoc.content;
 }
}, { immediate: true });
function handleContentChange() {
 if (props.document) {
 emit('update', { ...props.document, content: content.value });
 }
}
async function handleSave() {
 if (!props.document || !content.value.trim())
 return;
 isSaving.value = true;
 try {
 emit('save', { ...props.document, content: content.value });
 }
 finally {
 isSaving.value = false;
 }
}
async function handlePush() {
 if (!props.document || !store.currentRepository || !store.token)
 return;
 isPushing.value = true;
 try {
 const { owner, name } = store.currentRepository;
 await saveDocument(store.token, owner.login, name, props.document.path, content.value, props.document.sha);
 }
 catch (error) {
 if (error instanceof Error && (error.message.includes('403') || error.message.includes('Resource not accessible'))) {
 currentPushError.value = error;
 showConflictModal.value = true;
 }
 else {
 throw error;
 }
 }
 finally {
 isPushing.value = false;
 }
}
async function handleConflictResolve(type: 'fork' | 'branch') {
 if (!props.document || !store.currentRepository || !store.token)
 return;
 showConflictModal.value = false;
 isPushing.value = true;
 try {
 if (type === 'fork') {
 }
 else if (type === 'branch') {
 }
 }
 finally {
 isPushing.value = false;
 }
}
const fileName = computed(() => props.document?.name || 'Untitled');
</script>

<template>
  <div class="editor-container">
    <div class="editor-header">
      <div class="file-info">
        <span class="file-icon">📝</span>
        <span class="file-name">{{ fileName }}</span>
      </div>
      <div class="editor-actions">
        <button @click="handleSave" :disabled="isSaving" class="btn btn-secondary">
          <span v-if="isSaving">Saving...</span>
          <span v-else>💾 Save</span>
        </button>
        <button @click="handlePush" :disabled="isPushing || !store.currentRepository?.permissions?.push" class="btn btn-primary">
          <span v-if="isPushing">Pushing...</span>
          <span v-else>🚀 Push</span>
        </button>
      </div>
    </div>

    <textarea
      v-model="content"
      @input="handleContentChange"
      class="editor-textarea"
      :placeholder="`Start editing ${fileName}...`"
      spellcheck="false"
    ></textarea>
  </div>

  <PushConflictModal
    v-if="showConflictModal"
    :error="currentPushError"
    @resolve="handleConflictResolve"
    @cancel="showConflictModal = false"
  />
</template>

<style scoped>
.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-surface);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-surface);
}

.file-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-icon {
  font-size: 20px;
}

.file-name {
  font-weight: 600;
  color: var(--text-primary);
}

.editor-actions {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-secondary {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--border-color);
}

.editor-textarea {
  flex: 1;
  width: 100%;
  padding: 20px;
  border: none;
  outline: none;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  background: var(--bg-surface);
  color: var(--text-primary);
  box-sizing: border-box;
}

.editor-textarea::placeholder {
  color: var(--text-secondary);
}
</style>
