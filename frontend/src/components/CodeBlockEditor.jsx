import React, { useState } from 'react';
import { X, Code, Copy, Check } from 'lucide-react';

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', ext: 'js' },
  { id: 'typescript', name: 'TypeScript', ext: 'ts' },
  { id: 'python', name: 'Python', ext: 'py' },
  { id: 'java', name: 'Java', ext: 'java' },
  { id: 'csharp', name: 'C#', ext: 'cs' },
  { id: 'cpp', name: 'C++', ext: 'cpp' },
  { id: 'go', name: 'Go', ext: 'go' },
  { id: 'rust', name: 'Rust', ext: 'rs' },
  { id: 'ruby', name: 'Ruby', ext: 'rb' },
  { id: 'php', name: 'PHP', ext: 'php' },
  { id: 'swift', name: 'Swift', ext: 'swift' },
  { id: 'kotlin', name: 'Kotlin', ext: 'kt' },
  { id: 'html', name: 'HTML', ext: 'html' },
  { id: 'css', name: 'CSS', ext: 'css' },
  { id: 'sql', name: 'SQL', ext: 'sql' },
  { id: 'bash', name: 'Bash', ext: 'sh' },
  { id: 'json', name: 'JSON', ext: 'json' },
  { id: 'yaml', name: 'YAML', ext: 'yaml' },
  { id: 'markdown', name: 'Markdown', ext: 'md' },
  { id: 'plaintext', name: 'Plain Text', ext: 'txt' }
];

export default function CodeBlockEditor({ onInsert, onClose, initialCode = '', initialLang = 'javascript' }) {
  const [code, setCode] = useState(initialCode);
  const [language, setLanguage] = useState(initialLang);
  const [copied, setCopied] = useState(false);

  const generateCodeBlock = () => {
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return `
<div class="code-block" data-language="${language}" style="margin: 16px 0; border-radius: 8px; overflow: hidden; background: #1e1e1e;">
  <div class="code-header" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #2d2d2d; border-bottom: 1px solid #404040;">
    <span style="color: #888; font-size: 12px; font-family: monospace;">${LANGUAGES.find(l => l.id === language)?.name || language}</span>
    <button onclick="navigator.clipboard.writeText(this.closest('.code-block').querySelector('code').textContent)" style="background: none; border: none; color: #888; cursor: pointer; padding: 4px 8px; font-size: 11px;">Copy</button>
  </div>
  <pre style="margin: 0; padding: 16px; overflow-x: auto;"><code class="language-${language}" style="font-family: 'Fira Code', 'Monaco', 'Consolas', monospace; font-size: 13px; line-height: 1.5; color: #d4d4d4;">${escapedCode}</code></pre>
</div>
<p><br></p>`;
  };

  const handleInsert = () => {
    if (!code.trim()) return;
    onInsert(generateCodeBlock());
    onClose();
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            <Code size={20} />
            Insert Code Block
          </h2>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        <div style={styles.content}>
          {/* Language selector */}
          <div style={styles.field}>
            <label style={styles.label}>Language</label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              style={styles.select}
            >
              {LANGUAGES.map(lang => (
                <option key={lang.id} value={lang.id}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Code editor */}
          <div style={styles.field}>
            <div style={styles.labelRow}>
              <label style={styles.label}>Code</label>
              <button onClick={copyCode} style={styles.copyBtn}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Paste or type your code here..."
              style={styles.textarea}
              spellCheck={false}
            />
          </div>

          {/* Preview */}
          {code && (
            <div style={styles.preview}>
              <div style={styles.previewLabel}>Preview</div>
              <div style={styles.previewCode}>
                <div style={styles.previewHeader}>
                  <span>{LANGUAGES.find(l => l.id === language)?.name}</span>
                </div>
                <pre style={styles.previewPre}>
                  <code>{code}</code>
                </pre>
              </div>
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>
            Cancel
          </button>
          <button
            onClick={handleInsert}
            disabled={!code.trim()}
            style={{
              ...styles.insertBtn,
              opacity: code.trim() ? 1 : 0.5
            }}
          >
            Insert Code Block
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  modal: {
    width: '600px',
    maxWidth: '90vw',
    maxHeight: '85vh',
    overflow: 'auto'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px'
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
    flexDirection: 'column',
    gap: '16px'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-secondary)'
  },
  copyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '12px',
    cursor: 'pointer'
  },
  select: {
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    background: 'var(--bg-primary)'
  },
  textarea: {
    padding: '12px',
    fontSize: '13px',
    fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
    lineHeight: 1.5,
    border: '1px solid var(--border)',
    borderRadius: '6px',
    minHeight: '200px',
    resize: 'vertical',
    background: '#1e1e1e',
    color: '#d4d4d4'
  },
  preview: {
    background: 'var(--bg-secondary)',
    borderRadius: '8px',
    padding: '16px'
  },
  previewLabel: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-muted)',
    marginBottom: '12px',
    textTransform: 'uppercase'
  },
  previewCode: {
    borderRadius: '8px',
    overflow: 'hidden',
    background: '#1e1e1e'
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: '#2d2d2d',
    borderBottom: '1px solid #404040',
    color: '#888',
    fontSize: '12px',
    fontFamily: 'monospace'
  },
  previewPre: {
    margin: 0,
    padding: '12px',
    overflow: 'auto',
    maxHeight: '150px',
    fontSize: '12px',
    lineHeight: 1.5,
    color: '#d4d4d4',
    fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace"
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid var(--border)'
  },
  cancelBtn: {
    padding: '8px 16px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  insertBtn: {
    padding: '8px 20px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500
  }
};
