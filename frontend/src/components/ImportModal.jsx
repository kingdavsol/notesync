import React, { useState, useRef } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import api from '../services/api';

export default function ImportModal({ onClose, onComplete }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.enex')) {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('Please select a valid .enex file');
    }
  }

  function handleFileSelect(e) {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  }

  async function handleImport() {
    if (!file) return;

    setImporting(true);
    setError(null);

    try {
      const data = await api.importEvernote(file);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Import from Evernote</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {result ? (
            // Success state
            <div style={styles.result}>
              <CheckCircle size={48} style={{ color: 'var(--success)' }} />
              <h4 style={{ marginTop: '16px' }}>Import Complete!</h4>
              <p style={styles.resultText}>
                Successfully imported <strong>{result.imported}</strong> notes
              </p>
              
              {result.tags && result.tags.length > 0 && (
                <div style={styles.resultSection}>
                  <p style={styles.resultLabel}>Tags imported:</p>
                  <div style={styles.tagList}>
                    {result.tags.slice(0, 10).map((tag, i) => (
                      <span key={i} className="tag">{tag}</span>
                    ))}
                    {result.tags.length > 10 && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        +{result.tags.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {result.errors && result.errors.length > 0 && (
                <div style={styles.warnings}>
                  <AlertCircle size={16} style={{ color: 'var(--warning)' }} />
                  <span>{result.errors.length} items had issues</span>
                </div>
              )}
            </div>
          ) : (
            // Upload state
            <>
              <p style={styles.description}>
                Export your notes from Evernote as an .enex file, then upload it here.
              </p>

              <div style={styles.instructions}>
                <h4>How to export from Evernote:</h4>
                <ol>
                  <li>Open Evernote on your computer</li>
                  <li>Select the notes or notebook you want to export</li>
                  <li>Go to File → Export Notes</li>
                  <li>Choose "ENEX format (.enex)"</li>
                  <li>Save and upload the file here</li>
                </ol>
              </div>

              <div
                style={{
                  ...styles.dropzone,
                  ...(dragOver ? styles.dropzoneActive : {}),
                  ...(file ? styles.dropzoneHasFile : {})
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".enex"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />

                {file ? (
                  <div style={styles.fileInfo}>
                    <FileText size={32} style={{ color: 'var(--accent)' }} />
                    <div>
                      <p style={styles.fileName}>{file.name}</p>
                      <p style={styles.fileSize}>{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={e => { e.stopPropagation(); setFile(null); }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={32} style={{ color: 'var(--text-muted)' }} />
                    <p style={styles.dropText}>
                      Drag & drop your .enex file here
                    </p>
                    <p style={styles.dropSubtext}>
                      or click to browse
                    </p>
                  </>
                )}
              </div>

              {error && (
                <div style={styles.error}>
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          {result ? (
            <button className="btn btn-primary" onClick={onComplete}>
              Done
            </button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={!file || importing}
              >
                {importing ? (
                  <>
                    <Loader size={16} className="spinning" />
                    Importing...
                  </>
                ) : (
                  'Import Notes'
                )}
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles = {
  description: {
    color: 'var(--text-secondary)',
    marginBottom: '16px'
  },
  instructions: {
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
    marginBottom: '20px',
    fontSize: '14px'
  },
  dropzone: {
    border: '2px dashed var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '32px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px'
  },
  dropzoneActive: {
    borderColor: 'var(--accent)',
    background: 'var(--accent-light)'
  },
  dropzoneHasFile: {
    borderStyle: 'solid',
    borderColor: 'var(--accent)'
  },
  dropText: {
    fontWeight: 500,
    marginTop: '8px'
  },
  dropSubtext: {
    fontSize: '13px',
    color: 'var(--text-muted)'
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    width: '100%',
    textAlign: 'left'
  },
  fileName: {
    fontWeight: 500
  },
  fileSize: {
    fontSize: '13px',
    color: 'var(--text-muted)'
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '16px',
    padding: '12px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid var(--error)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--error)',
    fontSize: '14px'
  },
  result: {
    textAlign: 'center',
    padding: '24px 0'
  },
  resultText: {
    color: 'var(--text-secondary)',
    marginTop: '8px'
  },
  resultSection: {
    marginTop: '20px',
    textAlign: 'left'
  },
  resultLabel: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    marginBottom: '8px'
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  warnings: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '20px',
    color: 'var(--warning)',
    fontSize: '14px'
  }
};
