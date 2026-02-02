import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, X, Filter, Calendar, Tag, Folder, 
  CheckSquare, Pencil, Link2, ChevronDown 
} from 'lucide-react';
import api from '../services/api';

export default function AdvancedSearch({ 
  folders, 
  tags, 
  onSelectNote, 
  onClose 
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [selectedFolder, setSelectedFolder] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [hasChecklist, setHasChecklist] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [hasLinks, setHasLinks] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('relevance');

  const performSearch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (selectedFolder) params.set('folder_id', selectedFolder);
      if (selectedTags.length) params.set('tags', selectedTags.join(','));
      if (hasChecklist) params.set('has_checklist', 'true');
      if (hasDrawing) params.set('has_drawing', 'true');
      if (hasLinks) params.set('has_links', 'true');
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (sortBy) params.set('sort', sortBy);

      const data = await api.request(`/search?${params.toString()}`);
      setResults(data.notes);
      setTotal(data.total);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [query, selectedFolder, selectedTags, hasChecklist, hasDrawing, hasLinks, dateFrom, dateTo, sortBy]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(performSearch, 300);
    return () => clearTimeout(timer);
  }, [performSearch]);

  const clearFilters = () => {
    setSelectedFolder('');
    setSelectedTags([]);
    setHasChecklist(false);
    setHasDrawing(false);
    setHasLinks(false);
    setDateFrom('');
    setDateTo('');
    setSortBy('relevance');
  };

  const toggleTag = (tagName) => {
    setSelectedTags(prev => 
      prev.includes(tagName) 
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  const activeFilterCount = [
    selectedFolder,
    selectedTags.length > 0,
    hasChecklist,
    hasDrawing,
    hasLinks,
    dateFrom,
    dateTo
  ].filter(Boolean).length;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString();
  };

  const stripHtml = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.searchBar}>
            <Search size={20} style={styles.searchIcon} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search all notes..."
              style={styles.searchInput}
              autoFocus
            />
            {query && (
              <button 
                style={styles.clearBtn}
                onClick={() => setQuery('')}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowFilters(!showFilters)}
            style={{ position: 'relative' }}
          >
            <Filter size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span style={styles.filterBadge}>{activeFilterCount}</span>
            )}
          </button>

          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div style={styles.filtersPanel}>
            <div style={styles.filterRow}>
              {/* Folder filter */}
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>
                  <Folder size={14} /> Folder
                </label>
                <select
                  value={selectedFolder}
                  onChange={e => setSelectedFolder(e.target.value)}
                  style={styles.filterSelect}
                >
                  <option value="">All folders</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* Date range */}
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>
                  <Calendar size={14} /> Date range
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    style={styles.dateInput}
                  />
                  <span style={{ color: 'var(--text-muted)' }}>to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    style={styles.dateInput}
                  />
                </div>
              </div>

              {/* Sort */}
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Sort by</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  style={styles.filterSelect}
                >
                  <option value="relevance">Relevance</option>
                  <option value="updated">Last updated</option>
                  <option value="created">Date created</option>
                </select>
              </div>
            </div>

            {/* Content type filters */}
            <div style={styles.filterRow}>
              <label style={styles.filterLabel}>Contains:</label>
              <div style={styles.checkboxGroup}>
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={hasChecklist}
                    onChange={e => setHasChecklist(e.target.checked)}
                  />
                  <CheckSquare size={14} />
                  Checklists
                </label>
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={hasDrawing}
                    onChange={e => setHasDrawing(e.target.checked)}
                  />
                  <Pencil size={14} />
                  Drawings
                </label>
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={hasLinks}
                    onChange={e => setHasLinks(e.target.checked)}
                  />
                  <Link2 size={14} />
                  Note links
                </label>
              </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div style={styles.filterRow}>
                <label style={styles.filterLabel}>
                  <Tag size={14} /> Tags
                </label>
                <div style={styles.tagsList}>
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      className={`tag ${selectedTags.includes(tag.name) ? 'active' : ''}`}
                      onClick={() => toggleTag(tag.name)}
                      style={selectedTags.includes(tag.name) ? styles.tagActive : {}}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeFilterCount > 0 && (
              <button
                className="btn btn-ghost"
                onClick={clearFilters}
                style={{ marginTop: '8px' }}
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Results */}
        <div style={styles.results}>
          <div style={styles.resultsHeader}>
            <span style={styles.resultCount}>
              {loading ? 'Searching...' : `${total} result${total !== 1 ? 's' : ''}`}
            </span>
          </div>

          <div style={styles.resultsList}>
            {results.map(note => (
              <div
                key={note.id}
                style={styles.resultItem}
                onClick={() => { onSelectNote(note); onClose(); }}
              >
                <div style={styles.resultTitle}>
                  {note.title || 'Untitled'}
                  {note.drawing_count > 0 && (
                    <Pencil size={12} style={{ color: 'var(--accent)', marginLeft: '6px' }} />
                  )}
                  {note.link_count > 0 && (
                    <Link2 size={12} style={{ color: 'var(--accent)', marginLeft: '6px' }} />
                  )}
                </div>
                <div style={styles.resultPreview}>
                  {stripHtml(note.content) || 'No content'}
                </div>
                <div style={styles.resultMeta}>
                  <span>{formatDate(note.updated_at)}</span>
                  {note.folder_name && (
                    <span style={styles.resultFolder}>
                      <Folder size={12} /> {note.folder_name}
                    </span>
                  )}
                  {note.tags && note.tags.length > 0 && (
                    <span style={styles.resultTags}>
                      {note.tags.slice(0, 3).map((t, i) => (
                        <span key={i} className="tag" style={{ fontSize: '10px', padding: '1px 4px' }}>
                          {typeof t === 'string' ? t : t.name}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {!loading && results.length === 0 && (
              <div style={styles.empty}>
                {query || activeFilterCount > 0
                  ? 'No notes match your search'
                  : 'Start typing to search'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '5vh',
    zIndex: 1000,
    overflow: 'auto'
  },
  container: {
    width: '100%',
    maxWidth: '700px',
    maxHeight: '85vh',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-lg)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    borderBottom: '1px solid var(--border)'
  },
  searchBar: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--text-muted)'
  },
  searchInput: {
    width: '100%',
    padding: '12px 40px 12px 44px',
    fontSize: '16px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)'
  },
  clearBtn: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer'
  },
  filterBadge: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    width: '18px',
    height: '18px',
    background: 'var(--accent)',
    color: 'white',
    borderRadius: '50%',
    fontSize: '11px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  filtersPanel: {
    padding: '16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-tertiary)'
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '12px'
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  filterLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary)'
  },
  filterSelect: {
    padding: '6px 10px',
    fontSize: '13px',
    minWidth: '140px'
  },
  dateInput: {
    padding: '6px 10px',
    fontSize: '13px',
    width: '140px'
  },
  checkboxGroup: {
    display: 'flex',
    gap: '16px'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    cursor: 'pointer'
  },
  tagsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px'
  },
  tagActive: {
    background: 'var(--accent)',
    color: 'white'
  },
  results: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  resultsHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)'
  },
  resultCount: {
    fontSize: '13px',
    color: 'var(--text-muted)'
  },
  resultsList: {
    flex: 1,
    overflow: 'auto'
  },
  resultItem: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'background 0.1s ease'
  },
  resultTitle: {
    fontWeight: 500,
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center'
  },
  resultPreview: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    lineHeight: 1.4
  },
  resultMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '12px',
    color: 'var(--text-muted)'
  },
  resultFolder: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  resultTags: {
    display: 'flex',
    gap: '4px'
  },
  empty: {
    padding: '48px 16px',
    textAlign: 'center',
    color: 'var(--text-muted)'
  }
};
