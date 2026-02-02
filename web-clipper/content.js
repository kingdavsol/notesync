// NoteSync Web Clipper - Content Script

// This script runs on all pages and provides helper functions
// for the popup and background scripts

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getSelection':
      sendResponse(getSelection());
      break;

    case 'getArticle':
      sendResponse(getArticleContent());
      break;

    case 'getFullPage':
      sendResponse(getFullPageContent());
      break;

    case 'getPageInfo':
      sendResponse(getPageInfo());
      break;

    case 'highlightSelection':
      highlightSelection();
      sendResponse({ success: true });
      break;
  }

  return true; // Keep channel open for async response
});

// Get selected content
function getSelection() {
  const selection = window.getSelection();

  if (selection.rangeCount === 0 || selection.toString().trim() === '') {
    return { text: '', html: '' };
  }

  const range = selection.getRangeAt(0);
  const div = document.createElement('div');
  div.appendChild(range.cloneContents());

  return {
    text: selection.toString(),
    html: div.innerHTML
  };
}

// Get article content
function getArticleContent() {
  // Try common article selectors
  const selectors = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.article-body',
    '.entry-content',
    '.post-body',
    '#article-content',
    '.story-content'
  ];

  let article = null;
  let maxLength = 0;

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const text = el.innerText || '';
      if (text.length > maxLength) {
        maxLength = text.length;
        article = el;
      }
    }
  }

  if (!article || maxLength < 200) {
    // Fallback: find largest text block
    article = findLargestTextBlock();
  }

  if (!article) {
    return { html: '', text: '' };
  }

  // Clone and clean
  const clone = article.cloneNode(true);
  cleanElement(clone);

  return {
    html: clone.innerHTML,
    text: clone.innerText
  };
}

// Get full page content
function getFullPageContent() {
  const clone = document.body.cloneNode(true);
  cleanElement(clone);

  return {
    html: clone.innerHTML,
    text: clone.innerText
  };
}

// Get page info
function getPageInfo() {
  // Try to get meta description
  const metaDesc = document.querySelector('meta[name="description"]')?.content ||
                   document.querySelector('meta[property="og:description"]')?.content ||
                   '';

  // Try to get featured image
  const ogImage = document.querySelector('meta[property="og:image"]')?.content ||
                  document.querySelector('meta[name="twitter:image"]')?.content ||
                  '';

  // Get author
  const author = document.querySelector('meta[name="author"]')?.content ||
                 document.querySelector('[rel="author"]')?.textContent ||
                 '';

  // Get publish date
  const publishDate = document.querySelector('meta[property="article:published_time"]')?.content ||
                      document.querySelector('time[datetime]')?.getAttribute('datetime') ||
                      '';

  return {
    title: document.title,
    url: window.location.href,
    description: metaDesc,
    image: ogImage,
    author: author,
    publishDate: publishDate,
    favicon: getFavicon()
  };
}

// Get favicon
function getFavicon() {
  const favicon = document.querySelector('link[rel="icon"]') ||
                  document.querySelector('link[rel="shortcut icon"]') ||
                  document.querySelector('link[rel="apple-touch-icon"]');

  if (favicon) {
    return favicon.href;
  }

  return `${window.location.origin}/favicon.ico`;
}

// Find largest text block
function findLargestTextBlock() {
  const blocks = document.querySelectorAll('div, section, article');
  let largest = null;
  let maxScore = 0;

  for (const block of blocks) {
    // Skip hidden elements
    const style = window.getComputedStyle(block);
    if (style.display === 'none' || style.visibility === 'hidden') {
      continue;
    }

    // Calculate score based on text content and paragraphs
    const text = block.innerText || '';
    const paragraphs = block.querySelectorAll('p').length;
    const score = text.length + (paragraphs * 100);

    if (score > maxScore) {
      maxScore = score;
      largest = block;
    }
  }

  return largest;
}

// Clean element of unwanted content
function cleanElement(element) {
  // Remove unwanted elements
  const removeSelectors = [
    'script',
    'style',
    'noscript',
    'iframe',
    'nav',
    'header',
    'footer',
    '.nav',
    '.navigation',
    '.menu',
    '.sidebar',
    '.ad',
    '.ads',
    '.advertisement',
    '.social',
    '.social-share',
    '.share-buttons',
    '.comments',
    '.comment-section',
    '.related',
    '.related-posts',
    '.recommended',
    '.newsletter',
    '.popup',
    '.modal',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="complementary"]'
  ];

  for (const selector of removeSelectors) {
    element.querySelectorAll(selector).forEach(el => el.remove());
  }

  // Remove hidden elements
  element.querySelectorAll('[style*="display: none"], [style*="visibility: hidden"]')
    .forEach(el => el.remove());

  // Remove empty elements
  element.querySelectorAll('div, span, p')
    .forEach(el => {
      if (!el.textContent.trim() && !el.querySelector('img, video, iframe')) {
        el.remove();
      }
    });

  // Clean up attributes
  element.querySelectorAll('*').forEach(el => {
    // Keep only essential attributes
    const keepAttrs = ['href', 'src', 'alt', 'title', 'class'];
    const attrs = Array.from(el.attributes);
    attrs.forEach(attr => {
      if (!keepAttrs.includes(attr.name)) {
        el.removeAttribute(attr.name);
      }
    });
  });
}

// Highlight current selection (visual feedback)
function highlightSelection() {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);

  // Create highlight wrapper
  const highlight = document.createElement('span');
  highlight.style.cssText = `
    background: rgba(45, 190, 96, 0.3);
    border-radius: 2px;
    animation: notesync-highlight 1s ease-out;
  `;

  // Add animation style
  if (!document.getElementById('notesync-highlight-style')) {
    const style = document.createElement('style');
    style.id = 'notesync-highlight-style';
    style.textContent = `
      @keyframes notesync-highlight {
        0% { background: rgba(45, 190, 96, 0.5); }
        100% { background: rgba(45, 190, 96, 0.3); }
      }
    `;
    document.head.appendChild(style);
  }

  try {
    range.surroundContents(highlight);

    // Remove highlight after animation
    setTimeout(() => {
      const parent = highlight.parentNode;
      while (highlight.firstChild) {
        parent.insertBefore(highlight.firstChild, highlight);
      }
      parent.removeChild(highlight);
    }, 2000);
  } catch (e) {
    // Selection spans multiple elements, can't wrap
  }
}

// Show clip indicator
function showClipIndicator(message = 'Clipped!') {
  const indicator = document.createElement('div');
  indicator.id = 'notesync-clip-indicator';
  indicator.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
    <span>${message}</span>
  `;
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: #2dbe60;
    color: white;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 999999;
    animation: notesync-slide-in 0.3s ease-out;
  `;

  // Add animation
  if (!document.getElementById('notesync-indicator-style')) {
    const style = document.createElement('style');
    style.id = 'notesync-indicator-style';
    style.textContent = `
      @keyframes notesync-slide-in {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(indicator);

  setTimeout(() => {
    indicator.style.animation = 'notesync-slide-in 0.3s ease-out reverse';
    setTimeout(() => indicator.remove(), 300);
  }, 2000);
}

// Expose to window for debugging
window.NoteSyncClipper = {
  getSelection,
  getArticleContent,
  getFullPageContent,
  getPageInfo,
  showClipIndicator
};
