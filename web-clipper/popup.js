// NoteSync Web Clipper - Popup Script

const API_URL = 'https://notesync.example.com/api'; // Update with your API URL

// DOM Elements
const loginView = document.getElementById('login-view');
const clipView = document.getElementById('clip-view');
const successView = document.getElementById('success-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const clipBtn = document.getElementById('clip-btn');
const clipStatus = document.getElementById('clip-status');
const openRegister = document.getElementById('open-register');
const openNoteBtn = document.getElementById('open-note-btn');
const clipAnotherBtn = document.getElementById('clip-another-btn');

let currentTab = null;
let lastClippedNoteId = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  // Check if logged in
  const { token, user } = await chrome.storage.local.get(['token', 'user']);

  if (token && user) {
    showClipView(user);
    loadFolders();
    prefillFromPage();
  } else {
    showLoginView();
  }
});

// Show/Hide Views
function showLoginView() {
  loginView.classList.remove('hidden');
  clipView.classList.add('hidden');
  successView.classList.add('hidden');
}

function showClipView(user) {
  loginView.classList.add('hidden');
  clipView.classList.remove('hidden');
  successView.classList.add('hidden');
  document.querySelector('.user-email').textContent = user.email;
}

function showSuccessView() {
  loginView.classList.add('hidden');
  clipView.classList.add('hidden');
  successView.classList.remove('hidden');
}

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Save auth data
    await chrome.storage.local.set({
      token: data.token,
      user: data.user
    });

    showClipView(data.user);
    loadFolders();
    prefillFromPage();
  } catch (err) {
    loginError.textContent = err.message;
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove(['token', 'user']);
  showLoginView();
});

// Open register page
openRegister.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: `${API_URL.replace('/api', '')}/register` });
});

// Load folders
async function loadFolders() {
  try {
    const { token } = await chrome.storage.local.get('token');
    const response = await fetch(`${API_URL}/folders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      const select = document.getElementById('clip-folder');
      select.innerHTML = '<option value="">No notebook</option>';

      data.folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder.id;
        option.textContent = folder.name;
        select.appendChild(option);
      });
    }
  } catch (err) {
    console.error('Failed to load folders:', err);
  }
}

// Prefill from current page
async function prefillFromPage() {
  if (!currentTab) return;

  document.getElementById('clip-title').value = currentTab.title || '';

  // Try to get selected text
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: () => window.getSelection().toString()
    });

    if (result?.result) {
      // If there's selected text, default to selection mode
      document.querySelector('input[value="selection"]').checked = true;
    }
  } catch (err) {
    // Content script might not be available
    console.log('Could not get selection');
  }
}

// Clip page
clipBtn.addEventListener('click', async () => {
  const clipType = document.querySelector('input[name="clip-type"]:checked').value;
  const title = document.getElementById('clip-title').value || currentTab.title;
  const folderId = document.getElementById('clip-folder').value || null;
  const tagsInput = document.getElementById('clip-tags').value;
  const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];

  clipBtn.disabled = true;
  clipStatus.textContent = 'Clipping...';
  clipStatus.className = 'status loading';

  try {
    let content = '';

    switch (clipType) {
      case 'article':
        content = await getArticleContent();
        break;
      case 'full_page':
        content = await getFullPageContent();
        break;
      case 'selection':
        content = await getSelectionContent();
        break;
      case 'bookmark':
        content = createBookmark();
        break;
    }

    // Save to NoteSync
    const { token } = await chrome.storage.local.get('token');
    const response = await fetch(`${API_URL}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title,
        content,
        folder_id: folderId,
        tags
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save note');
    }

    const data = await response.json();
    lastClippedNoteId = data.note.id;

    // Save web clip metadata
    await fetch(`${API_URL}/import/webclip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        note_id: data.note.id,
        source_url: currentTab.url,
        source_title: currentTab.title,
        clip_type: clipType
      })
    }).catch(() => {}); // Don't fail if webclip endpoint doesn't exist

    showSuccessView();
  } catch (err) {
    clipStatus.textContent = err.message;
    clipStatus.className = 'status error';
  } finally {
    clipBtn.disabled = false;
  }
});

// Get article content (main content only)
async function getArticleContent() {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    func: () => {
      // Try to find main content
      const selectors = [
        'article',
        '[role="main"]',
        'main',
        '.post-content',
        '.article-content',
        '.entry-content',
        '.content',
        '#content'
      ];

      let content = null;
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText.length > 200) {
          content = el;
          break;
        }
      }

      if (!content) {
        // Fallback to body
        content = document.body;
      }

      // Clone and clean up
      const clone = content.cloneNode(true);

      // Remove unwanted elements
      const removeSelectors = [
        'script', 'style', 'nav', 'header', 'footer',
        '.ad', '.ads', '.advertisement', '.social-share',
        '.comments', '.sidebar', '.related-posts'
      ];

      removeSelectors.forEach(sel => {
        clone.querySelectorAll(sel).forEach(el => el.remove());
      });

      return clone.innerHTML;
    }
  });

  return wrapContent(result?.result || '', 'article');
}

// Get full page content
async function getFullPageContent() {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    func: () => {
      const clone = document.body.cloneNode(true);

      // Remove scripts and styles
      clone.querySelectorAll('script, style').forEach(el => el.remove());

      return clone.innerHTML;
    }
  });

  return wrapContent(result?.result || '', 'full_page');
}

// Get selected text
async function getSelectionContent() {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    func: () => {
      const selection = window.getSelection();
      if (selection.rangeCount === 0) return '';

      const range = selection.getRangeAt(0);
      const div = document.createElement('div');
      div.appendChild(range.cloneContents());

      return div.innerHTML || selection.toString();
    }
  });

  const content = result?.result || '';
  if (!content) {
    throw new Error('No text selected. Please select some text first.');
  }

  return wrapContent(content, 'selection');
}

// Create bookmark
function createBookmark() {
  return `
    <div class="web-clip-bookmark" style="padding: 16px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #2dbe60;">
      <h3 style="margin: 0 0 8px 0;">
        <a href="${escapeHtml(currentTab.url)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(currentTab.title)}
        </a>
      </h3>
      <p style="margin: 0; color: #666; font-size: 13px;">
        ${escapeHtml(currentTab.url)}
      </p>
      <p style="margin: 8px 0 0 0; color: #999; font-size: 12px;">
        Saved on ${new Date().toLocaleDateString()}
      </p>
    </div>
  `;
}

// Wrap content with source info
function wrapContent(content, clipType) {
  return `
    <div class="web-clip" data-clip-type="${clipType}" data-source-url="${escapeHtml(currentTab.url)}">
      <div class="web-clip-source" style="margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 6px; font-size: 13px;">
        <strong>Clipped from:</strong>
        <a href="${escapeHtml(currentTab.url)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(currentTab.title)}
        </a>
        <br>
        <span style="color: #999;">
          ${new Date().toLocaleString()} | ${clipType.replace('_', ' ')}
        </span>
      </div>
      <div class="web-clip-content">
        ${content}
      </div>
    </div>
  `;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Open note in NoteSync
openNoteBtn.addEventListener('click', () => {
  const noteUrl = `${API_URL.replace('/api', '')}/?note=${lastClippedNoteId}`;
  chrome.tabs.create({ url: noteUrl });
});

// Clip another page
clipAnotherBtn.addEventListener('click', async () => {
  const { user } = await chrome.storage.local.get('user');
  showClipView(user);
  prefillFromPage();
  clipStatus.textContent = '';
});
