const API_BASE = '/api';

// Secure storage for tokens
const secureStorage = {
    _token: null,
    _csrfToken: null,
    
    setToken(token) {
        this._token = token;
        // Use sessionStorage for better security (cleared on tab close)
        // Or localStorage if persistence across sessions is needed
        if (token) {
            sessionStorage.setItem('auth_token', token);
        } else {
            sessionStorage.removeItem('auth_token');
        }
    },
    
    getToken() {
        if (this._token) return this._token;
        this._token = sessionStorage.getItem('auth_token');
        return this._token;
    },
    
    setCsrfToken(token) {
        this._csrfToken = token;
        if (token) {
            sessionStorage.setItem('csrf_token', token);
        } else {
            sessionStorage.removeItem('csrf_token');
        }
    },
    
    getCsrfToken() {
        if (this._csrfToken) return this._csrfToken;
        this._csrfToken = sessionStorage.getItem('csrf_token');
        return this._csrfToken;
    },
    
    clear() {
        this._token = null;
        this._csrfToken = null;
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('csrf_token');
    }
};

// Input sanitization for XSS prevention
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

// Sanitize object recursively (skip content fields for notes)
function sanitizeObject(obj, skipFields = ['content', 'drawing_data']) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return sanitizeInput(obj);
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item, skipFields));
    
    const sanitized = {};
    for (const key of Object.keys(obj)) {
        if (skipFields.includes(key)) {
            sanitized[key] = obj[key];
        } else {
            sanitized[key] = sanitizeObject(obj[key], skipFields);
        }
    }
    return sanitized;
}

class ApiService {
    constructor() {
        // Attempt to restore token from storage
        this.token = secureStorage.getToken();
        this.csrfToken = secureStorage.getCsrfToken();
    }

    setToken(token) {
        this.token = token;
        secureStorage.setToken(token);
    }

    setCsrfToken(token) {
        this.csrfToken = token;
        secureStorage.setCsrfToken(token);
    }

    getToken() {
        return this.token;
    }

    async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Add auth token
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        // Add CSRF token for non-GET requests
        if (this.csrfToken && options.method && options.method !== 'GET') {
            headers['X-CSRF-Token'] = this.csrfToken;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'same-origin'
            });

            // Handle 401 Unauthorized
            if (response.status === 401) {
                this.logout();
                window.location.href = '/login';
                throw new Error('Session expired');
            }

            // Handle 403 Forbidden (CSRF error)
            if (response.status === 403) {
                const data = await response.json();
                if (data.error?.includes('CSRF')) {
                    // Try to refresh CSRF token
                    await this.refreshCsrfToken();
                    throw new Error('Please try again');
                }
                throw new Error(data.error || 'Forbidden');
            }

            // Handle rate limiting
            if (response.status === 429) {
                const data = await response.json();
                throw new Error(data.error || 'Too many requests. Please wait and try again.');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            // Update CSRF token if provided in response
            if (data.csrfToken) {
                this.setCsrfToken(data.csrfToken);
            }

            return data;
        } catch (err) {
            // Network error
            if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
                throw new Error('Network error. Please check your connection.');
            }
            throw err;
        }
    }

    async refreshCsrfToken() {
        if (!this.token) return;
        
        try {
            const data = await this.request('/auth/me');
            if (data.csrfToken) {
                this.setCsrfToken(data.csrfToken);
            }
        } catch (err) {
            console.error('Failed to refresh CSRF token:', err);
        }
    }

    // Auth
    async register(email, password) {
        // Validate inputs locally first
        if (!email || !password) {
            throw new Error('Email and password are required');
        }
        
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters');
        }

        const data = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ 
                email: sanitizeInput(email), 
                password 
            })
        });
        
        this.setToken(data.token);
        if (data.csrfToken) {
            this.setCsrfToken(data.csrfToken);
        }
        
        return data;
    }

    async login(email, password) {
        if (!email || !password) {
            throw new Error('Email and password are required');
        }

        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ 
                email: sanitizeInput(email), 
                password 
            })
        });
        
        this.setToken(data.token);
        if (data.csrfToken) {
            this.setCsrfToken(data.csrfToken);
        }
        
        return data;
    }

    async getMe() {
        return this.request('/auth/me');
    }

    logout() {
        // Call logout endpoint to invalidate server-side
        this.request('/auth/logout', { method: 'POST' }).catch(() => {});
        
        this.token = null;
        this.csrfToken = null;
        secureStorage.clear();
    }

    // Notes
    async getNotes(params = {}) {
        const query = new URLSearchParams(sanitizeObject(params)).toString();
        return this.request(`/notes${query ? `?${query}` : ''}`);
    }

    async getNote(id) {
        return this.request(`/notes/${encodeURIComponent(id)}`);
    }

    async createNote(note) {
        return this.request('/notes', {
            method: 'POST',
            body: JSON.stringify(note)
        });
    }

    async updateNote(id, note) {
        return this.request(`/notes/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(note)
        });
    }

    async deleteNote(id) {
        return this.request(`/notes/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
    }

    async toggleOffline(id) {
        return this.request(`/notes/${encodeURIComponent(id)}/toggle-offline`, {
            method: 'POST'
        });
    }

    // Folders
    async getFolders() {
        return this.request('/folders');
    }

    async createFolder(name, parentId = null) {
        return this.request('/folders', {
            method: 'POST',
            body: JSON.stringify({ 
                name: sanitizeInput(name), 
                parent_id: parentId 
            })
        });
    }

    async updateFolder(id, data) {
        return this.request(`/folders/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(sanitizeObject(data))
        });
    }

    async deleteFolder(id) {
        return this.request(`/folders/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
    }

    // Tags
    async getTags() {
        return this.request('/tags');
    }

    async createTag(name) {
        return this.request('/tags', {
            method: 'POST',
            body: JSON.stringify({ name: sanitizeInput(name) })
        });
    }

    async deleteTag(id) {
        return this.request(`/tags/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
    }

    // Sync
    async syncPull(lastSyncAt) {
        return this.request('/sync/pull', {
            method: 'POST',
            body: JSON.stringify({ last_sync_at: lastSyncAt })
        });
    }

    async syncPush(data) {
        return this.request('/sync/push', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getOfflineNotes() {
        return this.request('/sync/offline');
    }

    // Import
    async importEvernote(file) {
        const formData = new FormData();
        formData.append('file', file);

        const headers = {};
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        if (this.csrfToken) {
            headers['X-CSRF-Token'] = this.csrfToken;
        }

        const response = await fetch(`${API_BASE}/import/evernote`, {
            method: 'POST',
            headers,
            body: formData,
            credentials: 'same-origin'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Import failed');
        }

        return data;
    }

    // Drawings
    async getDrawings(noteId) {
        return this.request(`/drawings/note/${encodeURIComponent(noteId)}`);
    }

    async createDrawing(data) {
        return this.request('/drawings', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async deleteDrawing(id) {
        return this.request(`/drawings/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
    }

    // Note Links
    async getOutgoingLinks(noteId) {
        return this.request(`/links/from/${encodeURIComponent(noteId)}`);
    }

    async getBacklinks(noteId) {
        return this.request(`/links/to/${encodeURIComponent(noteId)}`);
    }

    async createLink(data) {
        return this.request('/links', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async searchNotesForLinking(query) {
        return this.request(`/links/search?q=${encodeURIComponent(query)}`);
    }

    // Advanced Search
    async advancedSearch(params) {
        const query = new URLSearchParams(sanitizeObject(params)).toString();
        return this.request(`/search?${query}`);
    }

    async searchSuggestions(query) {
        return this.request(`/search/suggest?q=${encodeURIComponent(query)}`);
    }
}

export const api = new ApiService();
export default api;
