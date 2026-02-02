import React, { useState, useEffect } from 'react';
import {
  X, Link2, Copy, Check, Lock, Unlock, Globe, Users,
  Trash2, Clock, Eye, Edit3, Mail, AlertCircle
} from 'lucide-react';
import api from '../services/api';

export default function ShareModal({ note, onClose }) {
  const [shares, setShares] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState('view');
  const [inviteError, setInviteError] = useState('');
  const [shareSettings, setShareSettings] = useState({
    allowEdit: false,
    password: '',
    expiresInDays: null
  });

  useEffect(() => {
    loadShareSettings();
  }, [note.id]);

  const loadShareSettings = async () => {
    try {
      const data = await api.request(`/share/note/${note.id}`);
      setShares(data.shares || []);
      setCollaborators(data.collaborators || []);
    } catch (err) {
      console.error('Failed to load share settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const createShareLink = async () => {
    setCreating(true);
    try {
      const data = await api.request('/share/create', {
        method: 'POST',
        body: JSON.stringify({
          note_id: note.id,
          allow_edit: shareSettings.allowEdit,
          password: shareSettings.password || null,
          expires_in_days: shareSettings.expiresInDays
        })
      });
      setShares([...shares, data.share]);
      copyToClipboard(data.share.url);
    } catch (err) {
      console.error('Failed to create share link:', err);
    } finally {
      setCreating(false);
    }
  };

  const deleteShare = async (shareId) => {
    try {
      await api.request(`/share/${shareId}`, { method: 'DELETE' });
      setShares(shares.filter(s => s.id !== shareId));
    } catch (err) {
      console.error('Failed to delete share:', err);
    }
  };

  const inviteCollaborator = async (e) => {
    e.preventDefault();
    setInviteError('');

    if (!inviteEmail.trim()) return;

    try {
      const data = await api.request('/share/invite', {
        method: 'POST',
        body: JSON.stringify({
          note_id: note.id,
          email: inviteEmail.trim(),
          permission: invitePermission
        })
      });
      setCollaborators([...collaborators, data.collaborator]);
      setInviteEmail('');
    } catch (err) {
      setInviteError(err.message || 'Failed to invite user');
    }
  };

  const removeCollaborator = async (id) => {
    try {
      await api.request(`/share/collaborator/${id}`, { method: 'DELETE' });
      setCollaborators(collaborators.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to remove collaborator:', err);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>Share "{note.title}"</h2>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={styles.loading}>Loading...</div>
        ) : (
          <>
            {/* Public Link Section */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                <Globe size={18} />
                Public Link
              </h3>

              {shares.length > 0 ? (
                <div style={styles.shareLinks}>
                  {shares.map(share => (
                    <div key={share.id} style={styles.shareItem}>
                      <div style={styles.shareUrl}>
                        <input
                          type="text"
                          value={share.url}
                          readOnly
                          style={styles.urlInput}
                        />
                        <button
                          onClick={() => copyToClipboard(share.url)}
                          style={styles.copyBtn}
                          title="Copy link"
                        >
                          {copied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                      <div style={styles.shareInfo}>
                        <span style={styles.shareMeta}>
                          <Eye size={12} /> {share.view_count} views
                        </span>
                        {share.allow_edit && (
                          <span style={styles.shareMeta}>
                            <Edit3 size={12} /> Editing allowed
                          </span>
                        )}
                        {share.has_password && (
                          <span style={styles.shareMeta}>
                            <Lock size={12} /> Password protected
                          </span>
                        )}
                        {share.expires_at && (
                          <span style={styles.shareMeta}>
                            <Clock size={12} /> Expires {new Date(share.expires_at).toLocaleDateString()}
                          </span>
                        )}
                        <button
                          onClick={() => deleteShare(share.id)}
                          style={styles.deleteBtn}
                          title="Remove share link"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.createShare}>
                  <div style={styles.shareOptions}>
                    <label style={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={shareSettings.allowEdit}
                        onChange={e => setShareSettings({
                          ...shareSettings,
                          allowEdit: e.target.checked
                        })}
                      />
                      Allow editing
                    </label>

                    <div style={styles.option}>
                      <input
                        type="password"
                        placeholder="Password (optional)"
                        value={shareSettings.password}
                        onChange={e => setShareSettings({
                          ...shareSettings,
                          password: e.target.value
                        })}
                        style={styles.input}
                      />
                    </div>

                    <div style={styles.option}>
                      <select
                        value={shareSettings.expiresInDays || ''}
                        onChange={e => setShareSettings({
                          ...shareSettings,
                          expiresInDays: e.target.value ? parseInt(e.target.value) : null
                        })}
                        style={styles.select}
                      >
                        <option value="">Never expires</option>
                        <option value="1">Expires in 1 day</option>
                        <option value="7">Expires in 7 days</option>
                        <option value="30">Expires in 30 days</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={createShareLink}
                    disabled={creating}
                    style={styles.createBtn}
                  >
                    <Link2 size={16} />
                    {creating ? 'Creating...' : 'Create Share Link'}
                  </button>
                </div>
              )}
            </div>

            {/* Collaborators Section */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                <Users size={18} />
                Share with People
              </h3>

              <form onSubmit={inviteCollaborator} style={styles.inviteForm}>
                <div style={styles.inviteInputs}>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    style={styles.emailInput}
                  />
                  <select
                    value={invitePermission}
                    onChange={e => setInvitePermission(e.target.value)}
                    style={styles.permSelect}
                  >
                    <option value="view">Can view</option>
                    <option value="edit">Can edit</option>
                  </select>
                  <button type="submit" style={styles.inviteBtn}>
                    <Mail size={16} />
                    Invite
                  </button>
                </div>
                {inviteError && (
                  <div style={styles.error}>
                    <AlertCircle size={14} />
                    {inviteError}
                  </div>
                )}
              </form>

              {collaborators.length > 0 && (
                <div style={styles.collaboratorsList}>
                  {collaborators.map(collab => (
                    <div key={collab.id} style={styles.collaborator}>
                      <div style={styles.collabAvatar}>
                        {collab.email[0].toUpperCase()}
                      </div>
                      <div style={styles.collabInfo}>
                        <span style={styles.collabEmail}>{collab.email}</span>
                        <span style={styles.collabPerm}>
                          {collab.permission === 'edit' ? 'Can edit' : 'Can view'}
                          {!collab.accepted && ' (pending)'}
                        </span>
                      </div>
                      <button
                        onClick={() => removeCollaborator(collab.id)}
                        style={styles.removeBtn}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  modal: {
    width: '500px',
    maxHeight: '80vh',
    overflow: 'auto'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px'
  },
  title: {
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
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: 'var(--text-muted)'
  },
  section: {
    marginBottom: '24px'
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '12px'
  },
  shareLinks: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  shareItem: {
    background: 'var(--bg-secondary)',
    borderRadius: '8px',
    padding: '12px'
  },
  shareUrl: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px'
  },
  urlInput: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '13px',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    background: 'var(--bg-primary)'
  },
  copyBtn: {
    padding: '8px 12px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  shareInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap'
  },
  shareMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    color: 'var(--text-muted)'
  },
  deleteBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px'
  },
  createShare: {
    background: 'var(--bg-secondary)',
    borderRadius: '8px',
    padding: '16px'
  },
  shareOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid var(--border)',
    borderRadius: '6px'
  },
  select: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid var(--border)',
    borderRadius: '6px'
  },
  createBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer'
  },
  inviteForm: {
    marginBottom: '16px'
  },
  inviteInputs: {
    display: 'flex',
    gap: '8px'
  },
  emailInput: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid var(--border)',
    borderRadius: '6px'
  },
  permSelect: {
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid var(--border)',
    borderRadius: '6px'
  },
  inviteBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '8px',
    color: 'var(--error)',
    fontSize: '13px'
  },
  collaboratorsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  collaborator: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    borderRadius: '6px'
  },
  collabAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'var(--accent)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600
  },
  collabInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  collabEmail: {
    fontSize: '14px',
    fontWeight: 500
  },
  collabPerm: {
    fontSize: '12px',
    color: 'var(--text-muted)'
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px'
  }
};
