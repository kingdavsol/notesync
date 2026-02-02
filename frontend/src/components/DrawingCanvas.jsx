import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Pencil, Eraser, Undo, Redo, Trash2, Save, X, Palette } from 'lucide-react';

export default function DrawingCanvas({ 
  initialData, 
  onSave, 
  onClose,
  width = 800,
  height = 600 
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pen'); // pen, eraser
  const [color, setColor] = useState('#6366f1');
  const [lineWidth, setLineWidth] = useState(3);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showColors, setShowColors] = useState(false);

  const colors = [
    '#000000', '#ffffff', '#6366f1', '#ef4444', '#22c55e', 
    '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6'
  ];

  const sizes = [1, 2, 3, 5, 8, 12];

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set white background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Load initial data if provided
    if (initialData) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        saveToHistory();
      };
      img.src = initialData;
    } else {
      saveToHistory();
    }
  }, []);

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL();
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(dataUrl);
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getCoords(e);
    const ctx = canvasRef.current.getContext('2d');
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const { x, y } = getCoords(e);
    const ctx = canvasRef.current.getContext('2d');

    ctx.lineTo(x, y);
    ctx.strokeStyle = tool === 'eraser' ? '#1a1a2e' : color;
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 3 : lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveToHistory();
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      loadFromHistory(history[newIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      loadFromHistory(history[newIndex]);
    }
  };

  const loadFromHistory = (dataUrl) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  };

  const clearCanvas = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    saveToHistory();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    
    // Create thumbnail
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 200;
    thumbCanvas.height = 150;
    const thumbCtx = thumbCanvas.getContext('2d');
    thumbCtx.drawImage(canvas, 0, 0, 200, 150);
    const thumbnail = thumbCanvas.toDataURL('image/png');

    onSave({ drawing_data: dataUrl, thumbnail });
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {/* Toolbar */}
        <div style={styles.toolbar}>
          <div style={styles.toolGroup}>
            <button
              style={{...styles.toolBtn, ...(tool === 'pen' ? styles.toolActive : {})}}
              onClick={() => setTool('pen')}
              title="Pen"
            >
              <Pencil size={18} />
            </button>
            <button
              style={{...styles.toolBtn, ...(tool === 'eraser' ? styles.toolActive : {})}}
              onClick={() => setTool('eraser')}
              title="Eraser"
            >
              <Eraser size={18} />
            </button>
          </div>

          <div style={styles.divider} />

          {/* Color picker */}
          <div style={{ position: 'relative' }}>
            <button
              style={{...styles.toolBtn, background: color}}
              onClick={() => setShowColors(!showColors)}
              title="Color"
            >
              <Palette size={18} style={{ color: '#fff' }} />
            </button>
            {showColors && (
              <div style={styles.colorPicker}>
                {colors.map(c => (
                  <button
                    key={c}
                    style={{
                      ...styles.colorSwatch,
                      background: c,
                      border: c === color ? '2px solid #fff' : '2px solid transparent'
                    }}
                    onClick={() => { setColor(c); setShowColors(false); }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Line width */}
          <select
            value={lineWidth}
            onChange={e => setLineWidth(parseInt(e.target.value))}
            style={styles.sizeSelect}
          >
            {sizes.map(s => (
              <option key={s} value={s}>{s}px</option>
            ))}
          </select>

          <div style={styles.divider} />

          {/* Undo/Redo */}
          <button
            style={styles.toolBtn}
            onClick={undo}
            disabled={historyIndex <= 0}
            title="Undo"
          >
            <Undo size={18} />
          </button>
          <button
            style={styles.toolBtn}
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="Redo"
          >
            <Redo size={18} />
          </button>

          <button
            style={styles.toolBtn}
            onClick={clearCanvas}
            title="Clear"
          >
            <Trash2 size={18} />
          </button>

          <div style={{ flex: 1 }} />

          {/* Save/Close */}
          <button
            className="btn btn-primary"
            onClick={handleSave}
            style={{ marginRight: '8px' }}
          >
            <Save size={16} />
            Save Drawing
          </button>
          <button
            className="btn btn-ghost"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Canvas */}
        <div style={styles.canvasWrapper}>
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={styles.canvas}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  container: {
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-lg)'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-tertiary)'
  },
  toolGroup: {
    display: 'flex',
    gap: '4px'
  },
  toolBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  toolActive: {
    background: 'var(--accent)',
    color: 'white'
  },
  divider: {
    width: '1px',
    height: '24px',
    background: 'var(--border)',
    margin: '0 4px'
  },
  colorPicker: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '8px',
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '4px',
    padding: '8px',
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    zIndex: 10
  },
  colorSwatch: {
    width: '28px',
    height: '28px',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  sizeSelect: {
    padding: '6px 8px',
    fontSize: '13px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)'
  },
  canvasWrapper: {
    padding: '16px',
    background: 'var(--bg-primary)'
  },
  canvas: {
    display: 'block',
    borderRadius: 'var(--radius-md)',
    cursor: 'crosshair',
    touchAction: 'none'
  }
};
