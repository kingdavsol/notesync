const API_URL = 'https://notesync.9gg.app/api';

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // Auth
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, password: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // Notes
  async getNotes(params?: { folder_id?: string; tag?: string; search?: string }) {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request(`/notes${query}`);
  }

  async getNote(id: number) {
    return this.request(`/notes/${id}`);
  }

  async createNote(note: { title: string; content: string; folder_id?: number; tags?: string[] }) {
    return this.request('/notes', {
      method: 'POST',
      body: JSON.stringify(note),
    });
  }

  async updateNote(id: number, note: Partial<{ title: string; content: string; folder_id: number; tags: string[]; is_pinned: boolean }>) {
    return this.request(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(note),
    });
  }

  async deleteNote(id: number) {
    return this.request(`/notes/${id}`, { method: 'DELETE' });
  }

  async toggleOffline(id: number) {
    return this.request(`/notes/${id}/toggle-offline`, { method: 'POST' });
  }

  // Folders
  async getFolders() {
    return this.request('/folders');
  }

  async createFolder(name: string) {
    return this.request('/folders', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async deleteFolder(id: number) {
    return this.request(`/folders/${id}`, { method: 'DELETE' });
  }

  // Tags
  async getTags() {
    return this.request('/tags');
  }

  // Sync
  async syncPull(lastSyncAt?: string, deviceId?: string) {
    return this.request('/sync/pull', {
      method: 'POST',
      body: JSON.stringify({ last_sync_at: lastSyncAt, device_id: deviceId }),
    });
  }

  async syncPush(changes: any) {
    return this.request('/sync/push', {
      method: 'POST',
      body: JSON.stringify(changes),
    });
  }

  // Reminders
  async getReminders() {
    return this.request('/reminders');
  }

  async createReminder(data: { note_id: number; remind_at: string; title?: string }) {
    return this.request('/reminders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Search
  async search(query: string) {
    return this.request('/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  // Transcription
  async transcribeAudio(audioBlob: Blob, duration: number) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('duration', duration.toString());

    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}/transcribe`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Transcription failed');
    }

    return data;
  }

  // Folders CRUD
  async updateFolder(id: number, data: { name: string }) {
    return this.request(`/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiService();
