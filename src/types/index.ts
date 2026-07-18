export interface User {
  login: string
  id: number
  avatar_url: string
  html_url: string
}

export interface Repository {
  full_name: string
  name: string
  owner: {
    login: string
  }
  default_branch: string
  permissions?: {
    push: boolean
    pull: boolean
    admin: boolean
  }
}

export interface Document {
  id: string
  name: string
  content: string
  path: string
  oldPath?: string
  sha?: string
  lastModified?: number
  isNew?: boolean
  hasDraft?: boolean
}

export interface PushConflictOption {
  type: 'fork' | 'branch' | 'cancel'
  label: string
  description: string
  icon: string
}
