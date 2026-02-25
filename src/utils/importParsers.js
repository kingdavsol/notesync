/**
 * Import parsers for various note formats
 */

/**
 * Strip HTML/XML tags and decode entities
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<en-todo\s+checked="true"\s*\/?>/gi, '☑ ')
    .replace(/<en-todo\s+checked="false"\s*\/?>/gi, '☐ ')
    .replace(/<en-media[^>]*\/>/gi, '[attachment]')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parse Evernote ENEX XML
 */
export function parseEnex(xmlString) {
  const notes = [];
  const noteRegex = /<note>([\s\S]*?)<\/note>/gi;
  let noteMatch;

  while ((noteMatch = noteRegex.exec(xmlString)) !== null) {
    const noteXml = noteMatch[1];

    const title = extractTag(noteXml, 'title') || 'Untitled';
    const content = extractTag(noteXml, 'content') || '';
    const created = extractTag(noteXml, 'created');
    const updated = extractTag(noteXml, 'updated');

    // Extract tags
    const tags = [];
    const tagRegex = /<tag>([\s\S]*?)<\/tag>/gi;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(noteXml)) !== null) {
      tags.push(tagMatch[1].trim());
    }

    // Extract notebook from source-url or note-attributes
    const notebook = extractTag(noteXml, 'source-url') || '';

    // Clean ENML content
    const contentCdata = content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    const plainText = stripHtml(contentCdata);

    notes.push({
      title: title.trim(),
      content: plainText,
      contentHtml: contentCdata,
      tags,
      notebook: notebook ? decodeURIComponent(notebook.split('/').pop() || '') : '',
      createdAt: created ? parseEvernoteDate(created) : new Date(),
      updatedAt: updated ? parseEvernoteDate(updated) : new Date(),
      source: 'evernote',
      selected: true,
    });
  }

  return notes;
}

function extractTag(xml, tagName) {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = regex.exec(xml);
  return match ? match[1] : null;
}

function parseEvernoteDate(dateStr) {
  // Format: 20231215T120000Z
  if (!dateStr || dateStr.length < 15) return new Date();
  try {
    const y = dateStr.substr(0, 4);
    const m = dateStr.substr(4, 2);
    const d = dateStr.substr(6, 2);
    const h = dateStr.substr(9, 2);
    const min = dateStr.substr(11, 2);
    const s = dateStr.substr(13, 2);
    return new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`);
  } catch {
    return new Date();
  }
}

/**
 * Parse Google Keep JSON
 */
export function parseKeepJson(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    // Could be single note or array
    const items = Array.isArray(data) ? data : [data];

    return items
      .filter(item => item.textContent || item.title)
      .map(item => ({
        title: item.title || 'Untitled',
        content: item.textContent || '',
        tags: (item.labels || []).map(l => l.name || l),
        isPinned: item.isPinned || false,
        isTrashed: item.isTrashed || false,
        isArchived: item.isArchived || false,
        notebook: '',
        createdAt: item.createdTimestampUsec
          ? new Date(item.createdTimestampUsec / 1000)
          : new Date(),
        updatedAt: item.userEditedTimestampUsec
          ? new Date(item.userEditedTimestampUsec / 1000)
          : new Date(),
        source: 'google-keep',
        selected: true,
      }));
  } catch (e) {
    console.error('Failed to parse Keep JSON:', e);
    return [];
  }
}

/**
 * Parse HTML files (Apple Notes, OneNote)
 */
export function parseHtml(htmlString, filename, source = 'html') {
  const plainText = stripHtml(htmlString);

  // Try to extract title from first <h1> or <title>
  let title = extractTag(htmlString, 'title') || extractTag(htmlString, 'h1');
  if (!title && filename) {
    title = filename.replace(/\.(html?|htm)$/i, '');
  }
  if (!title) {
    // Use first line
    title = plainText.split('\n')[0]?.substring(0, 100) || 'Untitled';
  }

  // For OneNote, try to get section from path
  const notebook = '';

  return [{
    title: title.trim(),
    content: plainText,
    tags: [],
    notebook,
    isPinned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    source,
    selected: true,
  }];
}

/**
 * Parse plain text / markdown
 */
export function parsePlainText(text, filename) {
  const title = filename
    ? filename.replace(/\.(txt|md|markdown)$/i, '')
    : text.split('\n')[0]?.substring(0, 100) || 'Untitled';

  return [{
    title: title.trim(),
    content: text,
    tags: [],
    notebook: '',
    isPinned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    source: 'text',
    selected: true,
  }];
}

/**
 * Simple duplicate detection - check title similarity
 */
export function findDuplicates(importedNotes, existingNotes) {
  const existingTitles = new Map();
  existingNotes.forEach(n => {
    existingTitles.set(n.title?.toLowerCase().trim(), n);
  });

  return importedNotes.map(note => {
    const key = note.title?.toLowerCase().trim();
    const existing = existingTitles.get(key);
    if (existing) {
      // Check content similarity (simple: first 200 chars)
      const importSnip = (note.content || '').substring(0, 200).trim();
      const existSnip = (existing.contentPlain || existing.content || '').substring(0, 200).trim();
      const similar = importSnip === existSnip;
      return { ...note, isDuplicate: true, exactMatch: similar };
    }
    return { ...note, isDuplicate: false, exactMatch: false };
  });
}

/**
 * Detect file type from name/extension
 */
export function detectFileType(filename) {
  const ext = (filename || '').toLowerCase().split('.').pop();
  switch (ext) {
    case 'enex': return 'evernote';
    case 'json': return 'google-keep';
    case 'html':
    case 'htm': return 'html';
    case 'txt': return 'text';
    case 'md':
    case 'markdown': return 'markdown';
    case 'zip': return 'zip';
    default: return 'unknown';
  }
}
