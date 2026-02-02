import React, { useState, useEffect } from 'react';
import {
  X, Bell, Clock, Calendar, Repeat, Trash2, Check, Plus
} from 'lucide-react';
import api from '../services/api';

export default function ReminderModal({ note, onClose }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    title: '',
    isRecurring: false,
    recurrenceRule: ''
  });

  useEffect(() => {
    loadReminders();
  }, [note.id]);

  const loadReminders = async () => {
    try {
      const data = await api.request(`/reminders/note/${note.id}`);
      setReminders(data.reminders || []);
    } catch (err) {
      console.error('Failed to load reminders:', err);
    } finally {
      setLoading(false);
    }
  };

  const createReminder = async (e) => {
    e.preventDefault();
    if (!formData.date || !formData.time) return;

    const remindAt = new Date(`${formData.date}T${formData.time}`);
    if (remindAt <= new Date()) {
      alert('Please select a future date and time');
      return;
    }

    try {
      const data = await api.request('/reminders', {
        method: 'POST',
        body: JSON.stringify({
          note_id: note.id,
          remind_at: remindAt.toISOString(),
          title: formData.title || `Reminder: ${note.title}`,
          is_recurring: formData.isRecurring,
          recurrence_rule: formData.recurrenceRule || null
        })
      });
      setReminders([...reminders, data.reminder]);
      setShowForm(false);
      setFormData({
        date: '',
        time: '',
        title: '',
        isRecurring: false,
        recurrenceRule: ''
      });
    } catch (err) {
      console.error('Failed to create reminder:', err);
    }
  };

  const deleteReminder = async (id) => {
    try {
      await api.request(`/reminders/${id}`, { method: 'DELETE' });
      setReminders(reminders.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to delete reminder:', err);
    }
  };

  const markDone = async (id) => {
    try {
      await api.request(`/reminders/${id}/done`, { method: 'POST' });
      await loadReminders(); // Reload to get updated state
    } catch (err) {
      console.error('Failed to mark done:', err);
    }
  };

  const snooze = async (id, minutes) => {
    try {
      await api.request(`/reminders/${id}/snooze`, {
        method: 'POST',
        body: JSON.stringify({ minutes })
      });
      await loadReminders();
    } catch (err) {
      console.error('Failed to snooze:', err);
    }
  };

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const isPast = (date) => new Date(date) < new Date();

  // Set default date/time for form
  useEffect(() => {
    if (showForm) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      setFormData(f => ({
        ...f,
        date: tomorrow.toISOString().split('T')[0],
        time: '09:00'
      }));
    }
  }, [showForm]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            <Bell size={20} />
            Reminders for "{note.title}"
          </h2>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={styles.loading}>Loading...</div>
        ) : (
          <>
            {/* Existing Reminders */}
            {reminders.length > 0 && (
              <div style={styles.remindersList}>
                {reminders.map(reminder => (
                  <div
                    key={reminder.id}
                    style={{
                      ...styles.reminderItem,
                      ...(isPast(reminder.remind_at) && !reminder.notified ? styles.due : {}),
                      ...(reminder.notified ? styles.done : {})
                    }}
                  >
                    <div style={styles.reminderMain}>
                      <div style={styles.reminderIcon}>
                        {reminder.notified ? (
                          <Check size={18} />
                        ) : (
                          <Bell size={18} />
                        )}
                      </div>
                      <div style={styles.reminderInfo}>
                        <div style={styles.reminderTitle}>
                          {reminder.title || 'Reminder'}
                        </div>
                        <div style={styles.reminderTime}>
                          <Clock size={12} />
                          {formatDateTime(reminder.remind_at)}
                          {reminder.is_recurring && (
                            <span style={styles.recurring}>
                              <Repeat size={12} /> Recurring
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={styles.reminderActions}>
                      {!reminder.notified && isPast(reminder.remind_at) && (
                        <>
                          <button
                            onClick={() => markDone(reminder.id)}
                            style={styles.actionBtn}
                            title="Mark as done"
                          >
                            <Check size={16} />
                          </button>
                          <select
                            onChange={e => snooze(reminder.id, parseInt(e.target.value))}
                            style={styles.snoozeSelect}
                            defaultValue=""
                          >
                            <option value="" disabled>Snooze</option>
                            <option value="15">15 min</option>
                            <option value="60">1 hour</option>
                            <option value="1440">Tomorrow</option>
                          </select>
                        </>
                      )}
                      <button
                        onClick={() => deleteReminder(reminder.id)}
                        style={styles.deleteBtn}
                        title="Delete reminder"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Reminder */}
            {showForm ? (
              <form onSubmit={createReminder} style={styles.form}>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Date</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      style={styles.input}
                      required
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Time</label>
                    <input
                      type="time"
                      value={formData.time}
                      onChange={e => setFormData({ ...formData, time: e.target.value })}
                      style={styles.input}
                      required
                    />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Note (optional)</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Reminder note..."
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={formData.isRecurring}
                      onChange={e => setFormData({ ...formData, isRecurring: e.target.checked })}
                    />
                    Repeat this reminder
                  </label>
                </div>

                {formData.isRecurring && (
                  <div style={styles.formGroup}>
                    <select
                      value={formData.recurrenceRule}
                      onChange={e => setFormData({ ...formData, recurrenceRule: e.target.value })}
                      style={styles.input}
                    >
                      <option value="">Select frequency</option>
                      <option value="FREQ=DAILY">Daily</option>
                      <option value="FREQ=WEEKLY">Weekly</option>
                      <option value="FREQ=MONTHLY">Monthly</option>
                    </select>
                  </div>
                )}

                <div style={styles.formActions}>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    style={styles.cancelBtn}
                  >
                    Cancel
                  </button>
                  <button type="submit" style={styles.submitBtn}>
                    <Bell size={16} />
                    Set Reminder
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                style={styles.addBtn}
              >
                <Plus size={18} />
                Add Reminder
              </button>
            )}

            {/* Quick Options */}
            {!showForm && (
              <div style={styles.quickOptions}>
                <span style={styles.quickLabel}>Quick set:</span>
                {[
                  { label: 'In 1 hour', hours: 1 },
                  { label: 'Tomorrow 9am', tomorrow: true },
                  { label: 'Next week', days: 7 }
                ].map((opt, i) => (
                  <button
                    key={i}
                    onClick={async () => {
                      const remindAt = new Date();
                      if (opt.hours) {
                        remindAt.setHours(remindAt.getHours() + opt.hours);
                      } else if (opt.tomorrow) {
                        remindAt.setDate(remindAt.getDate() + 1);
                        remindAt.setHours(9, 0, 0, 0);
                      } else if (opt.days) {
                        remindAt.setDate(remindAt.getDate() + opt.days);
                      }

                      try {
                        const data = await api.request('/reminders', {
                          method: 'POST',
                          body: JSON.stringify({
                            note_id: note.id,
                            remind_at: remindAt.toISOString(),
                            title: `Reminder: ${note.title}`
                          })
                        });
                        setReminders([...reminders, data.reminder]);
                      } catch (err) {
                        console.error('Failed to create reminder:', err);
                      }
                    }}
                    style={styles.quickBtn}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  modal: {
    width: '450px',
    maxHeight: '80vh',
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
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: 'var(--text-muted)'
  },
  remindersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '16px'
  },
  reminderItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    background: 'var(--bg-secondary)',
    borderRadius: '8px',
    borderLeft: '3px solid var(--accent)'
  },
  due: {
    borderLeftColor: 'var(--warning)',
    background: 'rgba(255, 193, 7, 0.1)'
  },
  done: {
    borderLeftColor: 'var(--text-muted)',
    opacity: 0.6
  },
  reminderMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  reminderIcon: {
    color: 'var(--accent)'
  },
  reminderInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  reminderTitle: {
    fontSize: '14px',
    fontWeight: 500
  },
  reminderTime: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: 'var(--text-muted)'
  },
  recurring: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginLeft: '8px',
    color: 'var(--accent)'
  },
  reminderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  actionBtn: {
    padding: '6px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex'
  },
  snoozeSelect: {
    padding: '4px 8px',
    fontSize: '12px',
    border: '1px solid var(--border)',
    borderRadius: '4px'
  },
  deleteBtn: {
    padding: '6px',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex'
  },
  form: {
    background: 'var(--bg-secondary)',
    borderRadius: '8px',
    padding: '16px'
  },
  formRow: {
    display: 'flex',
    gap: '12px'
  },
  formGroup: {
    flex: 1,
    marginBottom: '12px'
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: '4px'
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    boxSizing: 'border-box'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '8px'
  },
  cancelBtn: {
    padding: '8px 16px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 500
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px',
    background: 'var(--bg-secondary)',
    border: '2px dashed var(--border)',
    borderRadius: '8px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    fontSize: '14px',
    fontWeight: 500
  },
  quickOptions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '16px',
    flexWrap: 'wrap'
  },
  quickLabel: {
    fontSize: '12px',
    color: 'var(--text-muted)'
  },
  quickBtn: {
    padding: '6px 12px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    fontSize: '12px',
    cursor: 'pointer',
    color: 'var(--text-secondary)'
  }
};
