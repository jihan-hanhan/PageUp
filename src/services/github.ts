import type { User, Repository, Document } from '@/types'

const BASE_URL = 'https://api.github.com'

export async function getCurrentUser(token: string): Promise<User> {
  try {
    const response = await fetch(`${BASE_URL}/user`, {
      headers: {
        Authorization: `token ${token}`
      }
    })
    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`
      try {
        const data = await response.json()
        if (data.message) errorMsg += `: ${data.message}`
      } catch {
        errorMsg += ': Unknown error'
      }
      throw new Error(errorMsg)
    }
    return response.json()
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Cannot connect to GitHub API. Check your internet connection or try using a proxy.')
    }
    if (error instanceof Error && error.message.includes('401')) {
      throw new Error('Authentication failed: Invalid or expired token.\n\nPlease check:\n• Token format (should start with ghp_ or github_pat_)\n• Token has not expired\n• Token has "repo" and "read:user" scopes')
    }
    throw error
  }
}

export async function getRepositories(token: string): Promise<Repository[]> {
  const response = await fetch(`${BASE_URL}/user/repos?per_page=100`, {
    headers: {
      Authorization: `token ${token}`
    }
  })
  if (!response.ok) throw new Error('Failed to get repositories')
  return response.json()
}

export async function getRepository(token: string, owner: string, repo: string): Promise<Repository> {
  const response = await fetch(`${BASE_URL}/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `token ${token}`
    }
  })
  if (!response.ok) throw new Error('Repository not found')
  return response.json()
}

export async function getDocument(token: string, owner: string, repo: string, path: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      Authorization: `token ${token}`
    }
  })
  if (!response.ok) throw new Error('Document not found')
  const data = await response.json()
  return typeof data.content === 'string' ? atob(data.content) : ''
}

export async function saveDocument(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  sha?: string,
  branch?: string
): Promise<void> {
  const body: Record<string, unknown> = {
    message: `Update ${path}`,
    content: btoa(content),
    branch: branch || 'main'
  }
  if (sha) body.sha = sha

  const response = await fetch(`${BASE_URL}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  if (!response.ok) throw new Error(`Failed to save document: ${response.status}`)
}

export async function deleteDocument(
  token: string,
  owner: string,
  repo: string,
  path: string,
  sha: string
): Promise<void> {
  const response = await fetch(`${BASE_URL}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `Delete ${path}`,
      sha
    })
  })
  if (!response.ok) throw new Error('Failed to delete document')
}

export async function listDocuments(token: string, owner: string, repo: string): Promise<Document[]> {
  const response = await fetch(`${BASE_URL}/repos/${owner}/${repo}/contents/docs`, {
    headers: {
      Authorization: `token ${token}`
    }
  })
  if (!response.ok) {
    if (response.status === 404) return []
    throw new Error('Failed to list documents')
  }
  const data = await response.json()
  return (data as Array<{ name: string; path: string; sha: string }>).map(item => ({
    id: item.sha,
    name: item.name,
    content: '',
    path: item.path,
    sha: item.sha
  }))
}

export async function forkRepository(token: string, owner: string, repo: string): Promise<Repository> {
  const response = await fetch(`${BASE_URL}/repos/${owner}/${repo}/forks`, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ organization: null })
  })
  if (!response.ok) throw new Error('Failed to fork repository')
  return response.json()
}

export async function getDefaultBranchRef(token: string, owner: string, repo: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/repos/${owner}/${repo}/git/ref/heads/main`, {
    headers: {
      Authorization: `token ${token}`
    }
  })
  if (!response.ok) {
    const repoData = await getRepository(token, owner, repo)
    const defaultBranch = repoData.default_branch || 'main'
    const altResponse = await fetch(`${BASE_URL}/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`, {
      headers: {
        Authorization: `token ${token}`
      }
    })
    if (!altResponse.ok) throw new Error('Failed to get default branch')
    const altData = await altResponse.json()
    return altData.object.sha
  }
  const data = await response.json()
  return data.object.sha
}

export async function createBranch(token: string, owner: string, repo: string, branchName: string, baseSha: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: baseSha
    })
  })
  if (!response.ok) throw new Error('Failed to create branch')
}
