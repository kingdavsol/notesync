import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Lock, AlertCircle, Eye, Clock, User } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function SharedNote() {
  const { token } = useParams();
  const [note, setNote] = useState(null);
  const [shareInfo, setShareInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    loadSharedNote();
  }, [token]);

  const loadSharedNote = async (pwd = null) => {
    setLoading(true);
    setError(null);

    try {
      const url = pwd
        ? `${API_URL}/share/view/${token}?password=${encodeURIComponent(pwd)}`
        : `${API_URL}/share/view/${token}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setPasswordError('Invalid password');
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Failed to load note');
      }

      if (data.requires_password) {
        setRequiresPassword(true);
        setLoading(false);
        return;
      }

      setNote(data.note);
      setShareInfo(data.share);
      setRequiresPassword(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setPasswordError('');
    loadSharedNote(password);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingBox}>
          <div style={styles.spinner}></div>
          <p>Loading shared note...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>
          <AlertCircle size={48} style={{ color: 'var(--error)', marginBottom: '16px' }} />
          <h2 style={styles.errorTitle}>Unable to Load Note</h2>
          <p style={styles.errorMessage}>{error}</p>
          <a href="/" style={styles.homeLink}>Go to NoteSync</a>
        </div>
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <div style={styles.container}>
        <div style={styles.passwordBox}>
          <div style={styles.lockIcon}>
            <Lock size={32} />
          </div>
          <h2 style={styles.passwordTitle}>This note is password protected</h2>
          <p style={styles.passwordDesc}>Enter the password to view this shared note.</p>

          <form onSubmit={handlePasswordSubmit} style={styles.passwordForm}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              style={styles.passwordInput}
              autoFocus
            />
            {passwordError && (
              <p style={styles.passwordError}>{passwordError}</p>
            )}
            <button type="submit" style={styles.passwordBtn}>
              Unlock Note
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logo}>
            <FileText size={24} style={{ color: '#2dbe60' }} />
            <span style={styles.logoText}>NoteSync</span>
          </div>
          <a href="/" style={styles.signupBtn}>
            Get NoteSync Free
          </a>
        </div>
      </header>

      {/* Note Content */}
      <main style={styles.main}>
        <article style={styles.article}>
          <header style={styles.noteHeader}>
            <h1 style={styles.noteTitle}>{note?.title}</h1>
            <div style={styles.noteMeta}>
              <span style={styles.metaItem}>
                <User size={14} />
                Shared by {note?.owner}
              </span>
              <span style={styles.metaItem}>
                <Clock size={14} />
                Updated {formatDate(note?.updated_at)}
              </span>
              {shareInfo && (
                <span style={styles.metaItem}>
                  <Eye size={14} />
                  {shareInfo.view_count} views
                </span>
              )}
            </div>
          </header>

          <div
            style={styles.noteContent}
            dangerouslySetInnerHTML={{ __html: note?.content }}
          />
        </article>
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <p>
          Shared via <a href="/" style={styles.footerLink}>NoteSync</a> -
          Free cross-platform note taking with offline sync
        </p>
      </footer>

      <style>{`
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#f8f9fa'
  },
  loadingBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e0e0e0',
    borderTopColor: '#2dbe60',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px'
  },
  errorBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    textAlign: 'center'
  },
  errorTitle: {
    margin: '0 0 8px 0',
    fontSize: '24px',
    color: '#1a1a1a'
  },
  errorMessage: {
    margin: '0 0 24px 0',
    color: '#666'
  },
  homeLink: {
    padding: '10px 24px',
    background: '#2dbe60',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: 500
  },
  passwordBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    textAlign: 'center'
  },
  lockIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(45, 190, 96, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#2dbe60',
    marginBottom: '24px'
  },
  passwordTitle: {
    margin: '0 0 8px 0',
    fontSize: '24px',
    color: '#1a1a1a'
  },
  passwordDesc: {
    margin: '0 0 24px 0',
    color: '#666'
  },
  passwordForm: {
    width: '100%',
    maxWidth: '300px'
  },
  passwordInput: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    marginBottom: '12px',
    boxSizing: 'border-box'
  },
  passwordError: {
    color: '#dc3545',
    fontSize: '14px',
    marginBottom: '12px'
  },
  passwordBtn: {
    width: '100%',
    padding: '12px',
    background: '#2dbe60',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer'
  },
  header: {
    background: 'white',
    borderBottom: '1px solid #eee',
    padding: '16px 0'
  },
  headerContent: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  logoText: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1a1a1a'
  },
  signupBtn: {
    padding: '8px 16px',
    background: '#2dbe60',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500
  },
  main: {
    flex: 1,
    maxWidth: '800px',
    margin: '0 auto',
    padding: '40px 24px',
    width: '100%',
    boxSizing: 'border-box'
  },
  article: {
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    overflow: 'hidden'
  },
  noteHeader: {
    padding: '32px 32px 24px',
    borderBottom: '1px solid #eee'
  },
  noteTitle: {
    margin: '0 0 16px 0',
    fontSize: '28px',
    fontWeight: 600,
    color: '#1a1a1a',
    lineHeight: 1.3
  },
  noteMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px'
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    color: '#666'
  },
  noteContent: {
    padding: '32px',
    fontSize: '16px',
    lineHeight: 1.8,
    color: '#333'
  },
  footer: {
    padding: '24px',
    textAlign: 'center',
    color: '#999',
    fontSize: '14px'
  },
  footerLink: {
    color: '#2dbe60',
    textDecoration: 'none'
  }
};
