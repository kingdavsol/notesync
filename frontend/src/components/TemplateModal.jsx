import React, { useState, useEffect } from 'react';
import {
  X, FileText, Users, BookOpen, ChefHat, Briefcase, Plus,
  Layout, Search
} from 'lucide-react';
import api from '../services/api';

const CATEGORY_ICONS = {
  Work: Briefcase,
  Personal: BookOpen,
  Custom: FileText,
  General: Layout
};

export default function TemplateModal({ onSelect, onCreate, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const [templatesData, categoriesData] = await Promise.all([
        api.request('/templates'),
        api.request('/templates/categories')
      ]);
      setTemplates(templatesData.templates || []);
      setCategories(categoriesData.categories || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (template) => {
    try {
      // Create note from template
      const data = await api.request(`/templates/${template.id}/create-note`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      onSelect(data.note);
      onClose();
    } catch (err) {
      console.error('Failed to create note from template:', err);
    }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesCategory = !selectedCategory || t.category === selectedCategory;
    const matchesSearch = !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            <Layout size={20} />
            Choose a Template
          </h2>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div style={styles.searchBar}>
          <Search size={18} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        {/* Categories */}
        <div style={styles.categories}>
          <button
            style={{
              ...styles.categoryBtn,
              ...(selectedCategory === null ? styles.categoryActive : {})
            }}
            onClick={() => setSelectedCategory(null)}
          >
            All
          </button>
          {categories.map(cat => {
            const Icon = CATEGORY_ICONS[cat.category] || FileText;
            return (
              <button
                key={cat.category}
                style={{
                  ...styles.categoryBtn,
                  ...(selectedCategory === cat.category ? styles.categoryActive : {})
                }}
                onClick={() => setSelectedCategory(cat.category)}
              >
                <Icon size={14} />
                {cat.category}
                <span style={styles.catCount}>{cat.count}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={styles.loading}>Loading templates...</div>
        ) : (
          <div style={styles.templatesGrid}>
            {/* Blank Note Option */}
            <div
              style={styles.templateCard}
              onClick={() => {
                onCreate();
                onClose();
              }}
            >
              <div style={styles.templateIcon}>
                <Plus size={24} />
              </div>
              <div style={styles.templateInfo}>
                <h3 style={styles.templateName}>Blank Note</h3>
                <p style={styles.templateDesc}>Start with an empty note</p>
              </div>
            </div>

            {/* Templates */}
            {filteredTemplates.map(template => {
              const Icon = CATEGORY_ICONS[template.category] || FileText;
              return (
                <div
                  key={template.id}
                  style={styles.templateCard}
                  onClick={() => handleSelect(template)}
                >
                  <div style={{
                    ...styles.templateIcon,
                    background: template.is_default ? 'rgba(45, 190, 96, 0.1)' : 'var(--bg-tertiary)'
                  }}>
                    <Icon size={24} style={{ color: template.is_default ? 'var(--accent)' : 'var(--text-secondary)' }} />
                  </div>
                  <div style={styles.templateInfo}>
                    <h3 style={styles.templateName}>{template.name}</h3>
                    <p style={styles.templateDesc}>{template.description || template.category}</p>
                    {template.is_default && (
                      <span style={styles.builtIn}>Built-in</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredTemplates.length === 0 && !loading && (
          <div style={styles.noResults}>
            <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p>No templates found</p>
            {search && <p style={styles.hint}>Try adjusting your search</p>}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  modal: {
    width: '600px',
    maxWidth: '90vw',
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
  searchBar: {
    position: 'relative',
    marginBottom: '16px'
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)'
  },
  searchInput: {
    width: '100%',
    padding: '10px 12px 10px 40px',
    fontSize: '14px',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    boxSizing: 'border-box'
  },
  categories: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  categoryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    fontSize: '13px',
    cursor: 'pointer',
    color: 'var(--text-secondary)'
  },
  categoryActive: {
    background: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: 'white'
  },
  catCount: {
    fontSize: '11px',
    opacity: 0.7
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: 'var(--text-muted)'
  },
  templatesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
    gap: '12px'
  },
  templateCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px 16px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    textAlign: 'center'
  },
  templateIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '12px',
    background: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
    color: 'var(--text-secondary)'
  },
  templateInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  templateName: {
    margin: '0 0 4px 0',
    fontSize: '14px',
    fontWeight: 600
  },
  templateDesc: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--text-muted)',
    lineHeight: 1.4
  },
  builtIn: {
    marginTop: '8px',
    padding: '2px 8px',
    background: 'rgba(45, 190, 96, 0.1)',
    color: 'var(--accent)',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: 600
  },
  noResults: {
    textAlign: 'center',
    padding: '40px',
    color: 'var(--text-muted)'
  },
  hint: {
    fontSize: '13px',
    marginTop: '8px'
  }
};
