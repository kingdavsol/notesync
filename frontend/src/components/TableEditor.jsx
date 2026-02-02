import React, { useState } from 'react';
import { X, Plus, Minus, Grid3X3 } from 'lucide-react';

export default function TableEditor({ onInsert, onClose }) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [hasHeader, setHasHeader] = useState(true);

  const generateTable = () => {
    let html = '<table class="note-table" style="width: 100%; border-collapse: collapse; margin: 16px 0;">';

    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        const isHeader = hasHeader && r === 0;
        const tag = isHeader ? 'th' : 'td';
        const style = `border: 1px solid #ddd; padding: 8px 12px; ${isHeader ? 'background: #f5f5f5; font-weight: 600;' : ''}`;
        html += `<${tag} style="${style}" contenteditable="true">${isHeader ? `Header ${c + 1}` : ''}</${tag}>`;
      }
      html += '</tr>';
    }

    html += '</table><p><br></p>';
    return html;
  };

  const handleInsert = () => {
    onInsert(generateTable());
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            <Grid3X3 size={20} />
            Insert Table
          </h2>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        <div style={styles.content}>
          {/* Size selector */}
          <div style={styles.sizeSelector}>
            <div style={styles.sizeControl}>
              <label style={styles.label}>Rows</label>
              <div style={styles.counter}>
                <button
                  onClick={() => setRows(Math.max(1, rows - 1))}
                  style={styles.counterBtn}
                  disabled={rows <= 1}
                >
                  <Minus size={16} />
                </button>
                <span style={styles.counterValue}>{rows}</span>
                <button
                  onClick={() => setRows(Math.min(20, rows + 1))}
                  style={styles.counterBtn}
                  disabled={rows >= 20}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div style={styles.sizeControl}>
              <label style={styles.label}>Columns</label>
              <div style={styles.counter}>
                <button
                  onClick={() => setCols(Math.max(1, cols - 1))}
                  style={styles.counterBtn}
                  disabled={cols <= 1}
                >
                  <Minus size={16} />
                </button>
                <span style={styles.counterValue}>{cols}</span>
                <button
                  onClick={() => setCols(Math.min(10, cols + 1))}
                  style={styles.counterBtn}
                  disabled={cols >= 10}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Header option */}
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={hasHeader}
              onChange={e => setHasHeader(e.target.checked)}
            />
            Include header row
          </label>

          {/* Preview */}
          <div style={styles.preview}>
            <div style={styles.previewLabel}>Preview</div>
            <div style={styles.previewTable}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {Array.from({ length: Math.min(rows, 5) }).map((_, r) => (
                    <tr key={r}>
                      {Array.from({ length: Math.min(cols, 5) }).map((_, c) => {
                        const isHeader = hasHeader && r === 0;
                        return isHeader ? (
                          <th key={c} style={styles.previewTh}>H{c + 1}</th>
                        ) : (
                          <td key={c} style={styles.previewTd}></td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {(rows > 5 || cols > 5) && (
                <div style={styles.previewMore}>
                  {rows > 5 && `+${rows - 5} more rows`}
                  {rows > 5 && cols > 5 && ', '}
                  {cols > 5 && `+${cols - 5} more columns`}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>
            Cancel
          </button>
          <button onClick={handleInsert} style={styles.insertBtn}>
            Insert Table
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  modal: {
    width: '400px',
    maxWidth: '90vw'
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
    gap: '20px'
  },
  sizeSelector: {
    display: 'flex',
    gap: '24px'
  },
  sizeControl: {
    flex: 1
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: '8px'
  },
  counter: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  counterBtn: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    cursor: 'pointer',
    color: 'var(--text-primary)'
  },
  counterValue: {
    width: '40px',
    textAlign: 'center',
    fontSize: '18px',
    fontWeight: 600
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    cursor: 'pointer'
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
  previewTable: {
    overflow: 'auto'
  },
  previewTh: {
    border: '1px solid var(--border)',
    padding: '6px 10px',
    background: 'var(--bg-tertiary)',
    fontSize: '12px',
    fontWeight: 600
  },
  previewTd: {
    border: '1px solid var(--border)',
    padding: '6px 10px',
    height: '24px'
  },
  previewMore: {
    marginTop: '8px',
    fontSize: '12px',
    color: 'var(--text-muted)',
    textAlign: 'center'
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
