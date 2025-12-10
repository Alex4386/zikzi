const API_BASE = '/api/v1'

class Api {
  private token: string | null = null

  setToken(token: string) {
    this.token = token
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || 'Request failed')
    }

    return response.json()
  }

  // Auth
  login(username: string, password: string) {
    return this.request<{ access_token: string; expires_in: number }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  }

  register(username: string, email: string, password: string, display_name: string) {
    return this.request<{ access_token: string; expires_in: number }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, display_name }),
    })
  }

  // Users
  getCurrentUser() {
    return this.request<User>('/users/me')
  }

  updateUser(data: { display_name?: string; email?: string }) {
    return this.request('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // Jobs
  getJobs(page = 1, limit = 20, status?: string, options?: { full?: boolean; userId?: string }) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (status) params.set('status', status)
    if (options?.full) params.set('full', 'true')
    if (options?.userId) params.set('user_id', options.userId)
    return this.request<{
      jobs: PrintJob[]
      total: number
      page: number
      limit: number
    }>(`/jobs?${params}`)
  }

  getOrphanedJobs(page = 1, limit = 20) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    return this.request<{
      jobs: PrintJob[]
      total: number
      page: number
      limit: number
    }>(`/jobs/orphaned?${params}`)
  }

  assignJob(jobId: string, userId: string) {
    return this.request(`/jobs/${jobId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    })
  }

  getJob(id: string) {
    return this.request<PrintJob>(`/jobs/${id}`)
  }

  deleteJob(id: string) {
    return this.request(`/jobs/${id}`, { method: 'DELETE' })
  }

  getJobDownloadUrl(id: string, type: 'original' | 'pdf' | 'thumbnail') {
    const path = type === 'original' ? 'download' : type
    return `${API_BASE}/jobs/${id}/${path}`
  }

  async downloadJob(id: string, type: 'original' | 'pdf', filename?: string): Promise<void> {
    const path = type === 'original' ? 'download' : type
    const headers: Record<string, string> = {}

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(`${API_BASE}/jobs/${id}/${path}`, { headers })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Download failed' }))
      throw new Error(error.error || 'Download failed')
    }

    const contentType = response.headers.get('Content-Type') || (type === 'pdf' ? 'application/pdf' : 'application/octet-stream')
    const data = await response.arrayBuffer()
    const blob = new Blob([data], { type: contentType })

    // Determine extension from content type or type parameter
    let extension = type === 'pdf' ? 'pdf' : 'ps'
    if (contentType.includes('postscript')) {
      extension = 'ps'
    } else if (contentType.includes('pdf')) {
      extension = 'pdf'
    }

    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url

    const fallbackName = `job-${id}.${extension}`
    a.download = filename || fallbackName

    // check if a.download has invalid names
    if (/[\/\\?%*:|"<>]/.test(a.download)) {
      a.download = fallbackName
    }

    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  // IPs
  getIPs(page = 1, limit = 20, options?: { full?: boolean }) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (options?.full) params.set('full', 'true')
    return this.request<{
      ips: IPRegistration[]
      total: number
      page: number
      limit: number
    }>(`/ips?${params}`)
  }

  registerIP(ip_address: string, description: string, user_id?: string) {
    return this.request<IPRegistration>('/ips', {
      method: 'POST',
      body: JSON.stringify({ ip_address, description, user_id }),
    })
  }

  updateIP(id: string, description: string) {
    return this.request<IPRegistration>(`/ips/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ description }),
    })
  }

  deleteIP(id: string) {
    return this.request(`/ips/${id}`, { method: 'DELETE' })
  }

  detectIP() {
    return this.request<{ ip_address: string }>('/ips/detect')
  }

  // IPP Tokens
  getTokens(page = 1, limit = 20, options?: { full?: boolean }) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (options?.full) params.set('full', 'true')
    return this.request<{
      tokens: IPPToken[]
      total: number
      page: number
      limit: number
    }>(`/tokens?${params}`)
  }

  createToken(name: string, expire_days?: number, user_id?: string) {
    return this.request<CreateIPPTokenResponse>('/tokens', {
      method: 'POST',
      body: JSON.stringify({ name, expire_days, user_id }),
    })
  }

  revokeToken(id: string) {
    return this.request<{ message: string }>(`/tokens/${id}/revoke`, {
      method: 'POST',
    })
  }

  deleteToken(id: string) {
    return this.request<{ message: string }>(`/tokens/${id}`, {
      method: 'DELETE',
    })
  }

  // Admin endpoints
  getAdminStats() {
    return this.request<AdminStats>('/admin/stats')
  }

  getAdminUsers() {
    return this.request<AdminUser[]>('/admin/users')
  }

  getAdminJobs(page = 1, limit = 20, status?: string, userId?: string) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (status) params.set('status', status)
    if (userId) params.set('user_id', userId)
    return this.request<{
      jobs: AdminJob[]
      total: number
      page: number
      limit: number
    }>(`/admin/jobs?${params}`)
  }

  getAdminJob(id: string) {
    return this.request<AdminJob>(`/admin/jobs/${id}`)
  }

  // User password change
  changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ message: string }>('/users/me/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    })
  }

  // User IPP settings
  updateIPPSettings(allowIPPPassword: boolean) {
    return this.request<User>('/users/me/ipp-settings', {
      method: 'PUT',
      body: JSON.stringify({ allow_ipp_password: allowIPPPassword }),
    })
  }

  // Admin user management
  createUser(data: { username: string; email: string; password: string; display_name?: string; is_admin?: boolean }) {
    return this.request<AdminUser>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  getAdminUser(id: string) {
    return this.request<AdminUser>(`/admin/users/${id}`)
  }

  updateAdminUser(id: string, data: { username?: string; email?: string; display_name?: string; is_admin?: boolean }) {
    return this.request<AdminUser>(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  changeUserPassword(id: string, password: string) {
    return this.request<{ message: string }>(`/admin/users/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    })
  }

  deleteUser(id: string) {
    return this.request<{ message: string }>(`/admin/users/${id}`, {
      method: 'DELETE',
    })
  }
}

export interface User {
  id: string
  username: string
  email: string
  display_name: string
  is_admin: boolean
  allow_ipp_password: boolean
}

export interface PrintJob {
  id: string
  created_at: string
  user_id: string
  source_ip: string
  hostname: string
  document_name: string
  app_name: string
  os_version: string
  page_count: number
  file_size: number
  status: 'received' | 'processing' | 'completed' | 'failed'
  processed_at?: string
  error?: string
}

export interface IPRegistration {
  id: string
  created_at: string
  user_id: string
  user?: {
    id: string
    username: string
    display_name: string
  }
  ip_address: string
  description: string
  is_active: boolean
}

export interface IPPToken {
  id: string
  created_at: string
  user_id: string
  name: string
  last_used_at?: string
  last_used_ip?: string
  expires_at?: string
  is_active: boolean
}

export interface CreateIPPTokenResponse extends IPPToken {
  token: string // Only returned on creation
}

export interface AdminStats {
  total_users: number
  total_jobs: number
  jobs_today: number
  total_pages: number
  orphaned_jobs: number
}

export interface AdminUser {
  id: string
  username: string
  email: string
  display_name: string
  is_admin: boolean
  created_at: string
  job_count: number
}

export interface AdminJob {
  id: string
  created_at: string
  user_id?: string
  user?: {
    id: string
    username: string
    display_name: string
  }
  source_ip: string
  hostname: string
  document_name: string
  app_name: string
  page_count: number
  file_size: number
  status: 'received' | 'processing' | 'completed' | 'failed'
  processed_at?: string
  error?: string
}

export const api = new Api()
