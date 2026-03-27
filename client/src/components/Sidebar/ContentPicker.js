import React, { useState, useEffect } from 'react';

/**
 * ContentPicker — Dropdown to select published Email or SMS content
 * from the connected Salesforce org.
 *
 * Props:
 *   contentType — 'email' | 'sms' | 'all'
 *   value — currently selected content ID
 *   onChange — callback with selected content item
 */
export default function ContentPicker({ contentType = 'all', value, onChange }) {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen && content.length === 0) {
      fetchContent();
    }
  }, [isOpen]);

  const fetchContent = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/content?type=${contentType}`);
      const data = await res.json();
      setContent(data.content || []);
      setConnected(data.connected || false);
    } catch (err) {
      console.error('Failed to fetch content:', err);
    }
    setLoading(false);
  };

  const handleSelect = (item) => {
    setIsOpen(false);
    setSearch('');
    onChange(item);
  };

  const handleClear = () => {
    setIsOpen(false);
    onChange(null);
  };

  const selectedItem = content.find((c) => c.id === value);
  const filtered = content.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  // Group by type
  const emails = filtered.filter((c) => c.type === 'email');
  const sms = filtered.filter((c) => c.type === 'sms');

  return (
    <div style={styles.container}>
      <button
        style={{
          ...styles.triggerBtn,
          ...(value ? styles.triggerSelected : {}),
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={styles.triggerIcon}>
          {contentType === 'sms' ? '💬' : '📧'}
        </span>
        <span style={styles.triggerText}>
          {selectedItem
            ? selectedItem.name
            : value
            ? 'Content selected'
            : `Select ${contentType === 'sms' ? 'SMS' : contentType === 'email' ? 'Email' : 'Content'}`
          }
        </span>
        <span style={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div style={styles.dropdown}>
          {!connected && !loading && (
            <div style={styles.banner}>
              ℹ️ Connect to Salesforce to see content
            </div>
          )}

          <div style={styles.searchWrapper}>
            <input
              style={styles.searchInput}
              placeholder="Search content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Clear selection */}
          {value && (
            <button
              style={styles.clearBtn}
              onClick={handleClear}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#fce4e4'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              ✕ Clear selection
            </button>
          )}

          <div style={styles.list}>
            {loading && <div style={styles.empty}>Loading content...</div>}

            {/* Email section */}
            {emails.length > 0 && (
              <>
                <div style={styles.groupHeader}>📧 Email Templates</div>
                {emails.map((item) => (
                  <button
                    key={item.id}
                    style={{
                      ...styles.item,
                      ...(item.id === value ? styles.itemSelected : {}),
                    }}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = item.id === value ? '#f0f7ff' : 'none';
                    }}
                  >
                    <span style={styles.itemName}>
                      {item.id === value && '✓ '}
                      {item.name}
                    </span>
                    {item.subject && (
                      <span style={styles.itemMeta}>Subject: {item.subject}</span>
                    )}
                    {item.preview && (
                      <span style={styles.itemPreview}>{item.preview}</span>
                    )}
                    <span style={styles.itemBadge}>{item.subtype === 'cms_content' ? 'CMS' : item.templateType || 'Template'}</span>
                  </button>
                ))}
              </>
            )}

            {/* SMS section */}
            {sms.length > 0 && (
              <>
                <div style={styles.groupHeader}>💬 SMS Templates</div>
                {sms.map((item) => (
                  <button
                    key={item.id}
                    style={{
                      ...styles.item,
                      ...(item.id === value ? styles.itemSelected : {}),
                    }}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = item.id === value ? '#f0f7ff' : 'none';
                    }}
                  >
                    <span style={styles.itemName}>
                      {item.id === value && '✓ '}
                      {item.name}
                    </span>
                    {item.preview && (
                      <span style={styles.itemPreview}>{item.preview}</span>
                    )}
                    <span style={styles.itemBadge}>{item.subtype === 'messaging_template' ? 'Messaging' : 'Flow'}</span>
                  </button>
                ))}
              </>
            )}

            {!loading && filtered.length === 0 && connected && (
              <div style={styles.empty}>No content found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { position: 'relative' },
  triggerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#fff',
    fontSize: '13px',
    color: '#6b7280',
    cursor: 'pointer',
    textAlign: 'left',
    boxSizing: 'border-box',
  },
  triggerSelected: {
    borderColor: '#0176d3',
    color: '#181818',
    background: '#f0f7ff',
  },
  triggerIcon: { flexShrink: 0 },
  triggerText: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chevron: { fontSize: '9px', color: '#6b7280', flexShrink: 0 },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    background: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: '8px',
    boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
    zIndex: 200,
    overflow: 'hidden',
    minWidth: '240px',
  },
  banner: {
    padding: '8px 12px',
    background: '#fef4e8',
    color: '#c05600',
    fontSize: '11px',
    borderBottom: '1px solid #e5e5e5',
  },
  searchWrapper: {
    padding: '8px',
    borderBottom: '1px solid #f1f5f9',
  },
  searchInput: {
    width: '100%',
    padding: '7px 10px',
    border: '1px solid #e5e5e5',
    borderRadius: '6px',
    fontSize: '12px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  clearBtn: {
    display: 'block',
    width: '100%',
    padding: '6px 12px',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '12px',
    color: '#ea001e',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.1s',
  },
  list: {
    maxHeight: '260px',
    overflowY: 'auto',
    padding: '4px 0',
  },
  groupHeader: {
    padding: '6px 12px 4px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    textAlign: 'left',
    padding: '8px 12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.1s ease',
    gap: '2px',
  },
  itemSelected: { background: '#f0f7ff' },
  itemName: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#181818',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemMeta: {
    fontSize: '11px',
    color: '#6b7280',
  },
  itemPreview: {
    fontSize: '11px',
    color: '#94a3b8',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemBadge: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#0176d3',
    background: '#e0f0ff',
    padding: '1px 6px',
    borderRadius: '4px',
    alignSelf: 'flex-start',
    marginTop: '2px',
  },
  empty: {
    padding: '16px',
    textAlign: 'center',
    fontSize: '13px',
    color: '#94a3b8',
  },
};
