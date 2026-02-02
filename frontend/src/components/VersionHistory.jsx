import React, { useState, useEffect } from 'react';
import {
  X, History, Clock, RotateCcw, Eye, User, ChevronRight
} from 'lucide-react';
import api from '../services/api';

export default function VersionHistory({ note, onRestore, onClose }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    loadVersions();
  }, [note.id]);

  const loadVersions = async () => {
    try {
      const data = await api.request(`/versions/note/${note.id}`);
      setVersions(data.versions || []);
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setLoading(false);
    }
  };

  const restoreVersion = async (versionId) => {
    if (!confirm('Restore this version? Current content will be saved as a new version.')) {
      return;
    }

    setRestoring(true);
    try {
      const data = await api.request(`/versions/${versionId}/restore`, {
        method: 'POST'
      });
      onRestore(data.note);
      onClose();
    } catch (err) {
      console.error('Failed to restore version:', err);
      alert('Failed to restore version');
    } finally {
      setRestoring(false);
    }
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;

    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getContentPreview = (content, maxLength = 150) => {
    if (!content) return 'No content';
    const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            <History size={20} />
            Version History
          </h2>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        <div style={styles.content}>
          {/* Version List */}
          <div style={styles.versionList}>
            {loading ? (
              <div style={styles.loading}>Loading history...</div>
            ) : versions.length === 0 ? (
              <div style={styles.empty}>
                <History size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                <p>No version history yet</p>
                <p style={styles.hint}>Versions are saved automatically when you make changes</p>
              </div>
            ) : (
              <>
                {/* Current Version */}
                <div
                  style={{
                    ...styles.versionItem,
                    ...styles.currentVersion
                  }}
                  onClick={() => setSelectedVersion(null)}
                >
                  <div style={styles.versionIcon}>
                    <Clock size={18} />
                  </div>
                  <div style={styles.versionInfo}>
                    <div style={styles.versionTitle}>
                      Current Version
                      <span style={styles.currentBadge}>Now</span>
                    </div>
                    <div style={styles.versionMeta}>
                      {note.title}
                    </div>
                  </div>
                </div>

                {/* Previous Versions */}
                {versions.map((version, index) => (
                  <div
                    key={version.id}
                    style={{
                      ...styles.versionItem,
                      ...(selectedVersion?.id === version.id ? styles.versionSelected : {})
                    }}
                    onClick={() => setSelectedVersion(version)}
                  >
                    <div style={styles.versionIcon}>
                      <Clock size={18} />
                    </div>
                    <div style={styles.versionInfo}>
                      <div style={styles.versionTitle}>
                        Version {version.version_number}
                        {version.change_summary && (
                          <span style={styles.changeSummary}>{version.change_summary}</span>
                        )}
                      </div>
                      <div style={styles.versionMeta}>
                        <Clock size={12} />
                        {formatDate(version.created_at)}
                        {version.created_by_email && (
                          <>
                            <User size={12} style={{ marginLeft: '12px' }} />
                            {version.created_by_email.split('@')[0]}
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Preview Panel */}
          {selectedVersion && (
            <div style={styles.previewPanel}>
              <div style={styles.previewHeader}>
                <h3 style={styles.previewTitle}>Version {selectedVersion.version_number}</h3>
                <button
                  onClick={() => restoreVersion(selectedVersion.id)}
                  disabled={restoring}
                  style={styles.restoreBtn}
                >
                  <RotateCcw size={16} />
                  {restoring ? 'Restoring...' : 'Restore This Version'}
                </button>
              </div>

              <div style={styles.previewMeta}>
                <span>
                  <Clock size={14} />
                  {formatDate(selectedVersion.created_at)}
                </span>
                {selectedVersion.change_summary && (
                  <span style={styles.previewChange}>
                    {selectedVersion.change_summary}
                  </span>
                )}
              </div>

              <div style={styles.previewContent}>
                <h4 style={styles.previewLabel}>Title</h4>
                <div style={styles.previewText}>{selectedVersion.title}</div>

                <h4 style={styles.previewLabel}>Content Preview</h4>
                <div style={styles.previewText}>
                  {getContentPreview(selectedVersion.content, 500)}
                </div>

                <h4 style={styles.previewLabel}>Full Content</h4>
                <div
                  style={styles.fullContent}
                  dangerouslySetInnerHTML={{ __html: selectedVersion.content }}
                />
              </div>
            </div>
          )}
        </div>

        {versions.length > 0 && !selectedVersion && (
          <div style={styles.footer}>
            <p style={styles.footerText}>
              Select a version to preview and restore
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  modal: {
    width: '800px',
    maxWidth: '95vw',
    maxHeight: '85vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px',
    borderBottom: '1px solid var(--border)'
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: 0,
    fontSize: '18px',
    fontWeight: 600
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    padding: '4px'
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
  },
  versionList: {
    width: '280px',
    borderRight: '1px solid var(--border)',
    overflow: 'auto',
    flexShrink: 0
  },
  loading: {
    padding: '40px',
    textAlign: 'center',
    color: 'var(--text-muted)'
  },
  empty: {
    padding: '40px 20px',
    textAlign: 'center',
    color: 'var(--text-muted)'
  },
  hint: {
    fontSize: '13px',
    marginTop: '8px'
  },
  versionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'background 0.1s ease'
  },
  currentVersion: {
    background: 'rgba(45, 190, 96, 0.05)',
    borderLeft: '3px solid var(--accent)'
  },
  versionSelected: {
    background: 'var(--bg-secondary)'
  },
  versionIcon: {
    color: 'var(--text-muted)'
  },
  versionInfo: {
    flex: 1,
    minWidth: 0
  },
  versionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 500
  },
  currentBadge: {
    padding: '2px 6px',
    background: 'var(--accent)',
    color: 'white',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 600
  },
  changeSummary: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: 400
  },
  versionMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '4px',
    fontSize: '12px',
    color: 'var(--text-muted)'
  },
  previewPanel: {
    flex: 1,
    overflow: 'auto',
    padding: '20px'
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px'
  },
  previewTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600
  },
  restoreBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer'
  },
  previewMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '20px',
    fontSize: '13px',
    color: 'var(--text-muted)'
  },
  previewChange: {
    padding: '2px 8px',
    background: 'var(--bg-secondary)',
    borderRadius: '4px'
  },
  previewContent: {
    overflow: 'auto'
  },
  previewLabel: {
    margin: '16px 0 8px 0',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase'
  },
  previewText: {
    padding: '12px',
    background: 'var(--bg-secondary)',
    borderRadius: '6px',
    fontSize: '14px',
    lineHeight: 1.6
  },
  fullContent: {
    padding: '16px',
    background: 'var(--bg-secondary)',
    borderRadius: '6px',
    fontSize: '14px',
    lineHeight: 1.7,
    maxHeight: '300px',
    overflow: 'auto'
  },
  footer: {
    padding: '12px 20px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)'
  },
  footerText: {
    margin: 0,
    textAlign: 'center',
    fontSize: '13px',
    color: 'var(--text-muted)'
  }
};
