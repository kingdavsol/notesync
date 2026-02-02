import React, { useState, useEffect, useRef } from 'react';
import { Link2, Search, X } from 'lucide-react';
import api from '../services/api';

export default function NoteLinkPicker({ onSelect, onClose, excludeNoteId }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const searchNotes = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const data = await api.request(`/links/search?q=${encodeURIComponent(query)}`);
        // Filter out current note
        const filtered = data.notes.filter(n => n.id !== excludeNoteId);
        setResults(filtered);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchNotes, 200);
    return () => clearTimeout(debounce);
  }, [query, excludeNoteId]);

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <Link2 size={18} style={{ color: 'var(--accent)' }} />
          <span style={styles.title}>Link to Note</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={styles.searchWrapper}>
          <Search size={16} style={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes by title..."
            style={styles.input}
          />
        </div>

        <div style={styles.results}>
          {loading && (
            <div style={styles.loading}>Searching...</div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div style={styles.empty}>No notes found</div>
          )}

          {!loading && results.map((note, index) => (
            <button
              key={note.id}
              style={{
                ...styles.resultItem,
                ...(index === selectedIndex ? styles.resultActive : {})
              }}
              onClick={() => onSelect(note)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <Link2 size={14} />
              <span>{note.title}</span>
            </button>
          ))}

          {query.length < 2 && (
            <div style={styles.hint}>
              Type at least 2 characters to search
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <span style={styles.footerText}>
            ↑↓ Navigate • Enter to select • Esc to close
          </span>
        </div>
      </div>
    </div>
  );
}

// Inline link component for rendering internal links in content
export function NoteLink({ noteId, title, onClick }) {
  return (
    <span
      style={styles.inlineLink}
      onClick={() => onClick(noteId)}
      title={`Go to: ${title}`}
    >
      <Link2 size={12} />
      {title}
    </span>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '15vh',
    zIndex: 1000
  },
  modal: {
    width: '100%',
    maxWidth: '500px',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)'
  },
  title: {
    flex: 1,
    fontWeight: 500
  },
  searchWrapper: {
    position: 'relative',
    padding: '12px 16px'
  },
  searchIcon: {
    position: 'absolute',
    left: '28px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)'
  },
  input: {
    width: '100%',
    padding: '10px 12px 10px 36px',
    fontSize: '15px'
  },
  results: {
    maxHeight: '300px',
    overflow: 'auto'
  },
  resultItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px 16px',
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '14px',
    transition: 'background 0.1s ease'
  },
  resultActive: {
    background: 'var(--accent-light)'
  },
  loading: {
    padding: '16px',
    textAlign: 'center',
    color: 'var(--text-muted)'
  },
  empty: {
    padding: '16px',
    textAlign: 'center',
    color: 'var(--text-muted)'
  },
  hint: {
    padding: '16px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '13px'
  },
  footer: {
    padding: '10px 16px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-tertiary)'
  },
  footerText: {
    fontSize: '12px',
    color: 'var(--text-muted)'
  },
  inlineLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 6px',
    background: 'var(--accent-light)',
    color: 'var(--accent)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    textDecoration: 'none'
  }
};
