// NoteSync Web Clipper - Background Service Worker

const API_URL = 'https://notesync.example.com/api'; // Update with your API URL

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  // Context menu for selected text
  chrome.contextMenus.create({
    id: 'clip-selection',
    title: 'Clip selection to NoteSync',
    contexts: ['selection']
  });

  // Context menu for page
  chrome.contextMenus.create({
    id: 'clip-page',
    title: 'Clip page to NoteSync',
    contexts: ['page']
  });

  // Context menu for links
  chrome.contextMenus.create({
    id: 'clip-link',
    title: 'Save link to NoteSync',
    contexts: ['link']
  });

  // Context menu for images
  chrome.contextMenus.create({
    id: 'clip-image',
    title: 'Save image to NoteSync',
    contexts: ['image']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const { token } = await chrome.storage.local.get('token');

  if (!token) {
    // Open popup to login
    chrome.action.openPopup();
    return;
  }

  let content = '';
  let title = tab.title;

  switch (info.menuItemId) {
    case 'clip-selection':
      content = await clipSelection(tab, info.selectionText);
      title = `Selection from: ${tab.title}`;
      break;

    case 'clip-page':
      content = await clipPage(tab);
      break;

    case 'clip-link':
      content = createLinkNote(info.linkUrl, info.selectionText || info.linkUrl);
      title = info.selectionText || info.linkUrl;
      break;

    case 'clip-image':
      content = createImageNote(info.srcUrl, tab.url);
      title = `Image from: ${tab.title}`;
      break;
  }

  try {
    const response = await fetch(`${API_URL}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title, content })
    });

    if (response.ok) {
      // Show success notification
      showNotification('Clipped!', 'Content saved to NoteSync');
    } else {
      const data = await response.json();
      showNotification('Error', data.error || 'Failed to save');
    }
  } catch (err) {
    showNotification('Error', 'Failed to connect to NoteSync');
  }
});

// Clip selection
async function clipSelection(tab, selectionText) {
  // Try to get HTML selection
  let content = selectionText;

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return null;

        const range = selection.getRangeAt(0);
        const div = document.createElement('div');
        div.appendChild(range.cloneContents());
        return div.innerHTML;
      }
    });

    if (result?.result) {
      content = result.result;
    }
  } catch (err) {
    // Use plain text
  }

  return wrapContent(content, tab.url, tab.title, 'selection');
}

// Clip full page
async function clipPage(tab) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Try article first
        const article = document.querySelector('article') ||
                       document.querySelector('[role="main"]') ||
                       document.querySelector('main');

        const content = article || document.body;
        const clone = content.cloneNode(true);

        // Remove unwanted elements
        clone.querySelectorAll('script, style, nav, .ad, .ads').forEach(el => el.remove());

        return clone.innerHTML;
      }
    });

    return wrapContent(result?.result || '', tab.url, tab.title, 'full_page');
  } catch (err) {
    return wrapContent('', tab.url, tab.title, 'bookmark');
  }
}

// Create link note
function createLinkNote(url, text) {
  return `
    <div class="web-clip-link" style="padding: 16px; background: #f8f9fa; border-radius: 8px;">
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="font-size: 16px; font-weight: 500;">
        ${escapeHtml(text)}
      </a>
      <p style="margin: 8px 0 0 0; color: #666; font-size: 13px; word-break: break-all;">
        ${escapeHtml(url)}
      </p>
    </div>
  `;
}

// Create image note
function createImageNote(imageUrl, pageUrl) {
  return `
    <div class="web-clip-image">
      <img src="${escapeHtml(imageUrl)}" alt="Clipped image" style="max-width: 100%; border-radius: 8px;">
      <p style="margin: 12px 0 0 0; color: #666; font-size: 13px;">
        Source: <a href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pageUrl)}</a>
      </p>
    </div>
  `;
}

// Wrap content with source info
function wrapContent(content, url, title, clipType) {
  return `
    <div class="web-clip" data-clip-type="${clipType}">
      <div class="web-clip-source" style="margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 6px; font-size: 13px;">
        <strong>Clipped from:</strong>
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(title)}
        </a>
        <br>
        <span style="color: #999;">
          ${new Date().toLocaleString()}
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
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Show notification
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: title,
    message: message
  });
}

// Handle keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === 'clip-page') {
    chrome.action.openPopup();
  }
});
