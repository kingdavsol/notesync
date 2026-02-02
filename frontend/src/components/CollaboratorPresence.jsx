import React from 'react';
import { Users, Wifi, WifiOff } from 'lucide-react';

export default function CollaboratorPresence({
  collaborators = [],
  typingUsers = new Set(),
  connected = false
}) {
  if (collaborators.length === 0) {
    return null;
  }

  const typingCollaborators = collaborators.filter(c => typingUsers.has(c.socketId));

  return (
    <div style={styles.container}>
      {/* Connection status */}
      <div style={styles.connectionStatus}>
        {connected ? (
          <Wifi size={14} style={{ color: 'var(--accent)' }} />
        ) : (
          <WifiOff size={14} style={{ color: 'var(--warning)' }} />
        )}
      </div>

      {/* Collaborator avatars */}
      <div style={styles.avatars}>
        {collaborators.slice(0, 5).map((collaborator, index) => (
          <div
            key={collaborator.socketId}
            style={{
              ...styles.avatar,
              backgroundColor: collaborator.color,
              zIndex: collaborators.length - index,
              marginLeft: index > 0 ? '-8px' : 0
            }}
            title={collaborator.email}
          >
            {collaborator.name?.charAt(0).toUpperCase() || '?'}
          </div>
        ))}

        {collaborators.length > 5 && (
          <div style={styles.moreCount}>
            +{collaborators.length - 5}
          </div>
        )}
      </div>

      {/* Collaborator count */}
      <div style={styles.count}>
        <Users size={14} />
        <span>{collaborators.length}</span>
      </div>

      {/* Typing indicator */}
      {typingCollaborators.length > 0 && (
        <div style={styles.typingIndicator}>
          <span style={styles.typingDots}>
            <span style={styles.dot} />
            <span style={{ ...styles.dot, animationDelay: '0.2s' }} />
            <span style={{ ...styles.dot, animationDelay: '0.4s' }} />
          </span>
          <span style={styles.typingText}>
            {typingCollaborators.length === 1
              ? `${typingCollaborators[0].name} is typing`
              : `${typingCollaborators.length} people typing`}
          </span>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px'
  },
  connectionStatus: {
    display: 'flex',
    alignItems: 'center'
  },
  avatars: {
    display: 'flex',
    alignItems: 'center'
  },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
    border: '2px solid var(--bg-primary)',
    cursor: 'pointer',
    transition: 'transform 0.15s ease'
  },
  moreCount: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    fontWeight: 600,
    marginLeft: '-8px',
    border: '2px solid var(--bg-primary)'
  },
  count: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: 'var(--text-muted)'
  },
  typingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--text-muted)',
    fontSize: '12px'
  },
  typingDots: {
    display: 'flex',
    gap: '2px'
  },
  dot: {
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    background: 'var(--accent)',
    animation: 'bounce 1.4s infinite ease-in-out'
  },
  typingText: {
    fontStyle: 'italic'
  }
};

// Add keyframe animation to document
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
  `;
  document.head.appendChild(styleSheet);
}
