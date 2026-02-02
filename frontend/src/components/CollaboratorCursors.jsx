import React, { useEffect, useState, useRef } from 'react';

export default function CollaboratorCursors({
  remoteCursors = new Map(),
  containerRef
}) {
  const [cursorPositions, setCursorPositions] = useState([]);
  const animationRef = useRef();

  useEffect(() => {
    // Convert cursor positions to screen coordinates
    const updatePositions = () => {
      if (!containerRef?.current) return;

      const positions = [];
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();

      remoteCursors.forEach((cursor, socketId) => {
        if (!cursor.position) return;

        // Try to find the position in the DOM
        // This is a simplified version - in production you'd want
        // more sophisticated position calculation based on text offset
        const { line, column, offset } = cursor.position;

        // For contentEditable, we can use Range API
        try {
          const selection = window.getSelection();
          const range = document.createRange();

          // Find the text node at the offset
          const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );

          let currentOffset = 0;
          let targetNode = null;
          let nodeOffset = 0;

          while (walker.nextNode()) {
            const node = walker.currentNode;
            const nodeLength = node.textContent.length;

            if (currentOffset + nodeLength >= offset) {
              targetNode = node;
              nodeOffset = offset - currentOffset;
              break;
            }
            currentOffset += nodeLength;
          }

          if (targetNode) {
            range.setStart(targetNode, Math.min(nodeOffset, targetNode.textContent.length));
            range.collapse(true);

            const rects = range.getClientRects();
            if (rects.length > 0) {
              const rect = rects[0];
              positions.push({
                socketId,
                user: cursor.user,
                x: rect.left - containerRect.left,
                y: rect.top - containerRect.top,
                selection: cursor.selection
              });
            }
          }
        } catch (e) {
          // Fallback to approximate position
          console.warn('Could not calculate cursor position:', e);
        }
      });

      setCursorPositions(positions);
    };

    updatePositions();

    // Update positions periodically and on scroll
    const interval = setInterval(updatePositions, 100);
    containerRef?.current?.addEventListener('scroll', updatePositions);

    return () => {
      clearInterval(interval);
      containerRef?.current?.removeEventListener('scroll', updatePositions);
    };
  }, [remoteCursors, containerRef]);

  return (
    <>
      {cursorPositions.map(({ socketId, user, x, y, selection }) => (
        <div key={socketId}>
          {/* Cursor line */}
          <div
            style={{
              ...styles.cursor,
              left: x,
              top: y,
              borderColor: user?.color || '#666'
            }}
          />

          {/* User label */}
          <div
            style={{
              ...styles.label,
              left: x,
              top: y - 20,
              backgroundColor: user?.color || '#666'
            }}
          >
            {user?.name || 'Anonymous'}
          </div>

          {/* Selection highlight */}
          {selection && selection.start !== selection.end && (
            <div
              style={{
                ...styles.selection,
                backgroundColor: `${user?.color}33` || 'rgba(102, 102, 102, 0.2)'
              }}
            />
          )}
        </div>
      ))}
    </>
  );
}

const styles = {
  cursor: {
    position: 'absolute',
    width: '2px',
    height: '20px',
    borderLeft: '2px solid',
    pointerEvents: 'none',
    zIndex: 100,
    animation: 'blink 1s infinite'
  },
  label: {
    position: 'absolute',
    padding: '2px 6px',
    borderRadius: '3px',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    zIndex: 101,
    transform: 'translateY(-100%)'
  },
  selection: {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 99
  }
};

// Add blink animation
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
  `;
  document.head.appendChild(styleSheet);
}
