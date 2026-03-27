import React, { useState, useEffect, useRef } from 'react';
import { useSalesforceFields } from '../../hooks/useSalesforceFields';

/**
 * FieldPicker — Searchable dropdown for selecting Salesforce object fields.
 * Used by ConditionConfig to pick fields for condition rules.
 *
 * Props:
 *  - objectName: Salesforce object name (e.g. 'Contact', 'Lead')
 *  - value: Currently selected field name
 *  - onChange: Callback with selected field name
 */
export default function FieldPicker({ objectName, value, onChange }) {
  const { fields, loading } = useSalesforceFields(objectName);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allFields = fields?.allFields || [];

  // Find current field label
  const currentField = allFields.find((f) => f.name === value);
  const displayText = currentField ? currentField.label : value || 'Select a field...';

  // Filter by search
  const filtered = search
    ? allFields.filter(
        (f) =>
          f.label.toLowerCase().includes(search.toLowerCase()) ||
          f.name.toLowerCase().includes(search.toLowerCase())
      )
    : allFields;

  // Group filtered fields
  const standardFields = filtered.filter((f) => !f.custom);
  const customFields = filtered.filter((f) => f.custom);

  const handleSelect = (fieldName) => {
    onChange(fieldName);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div style={styles.container} ref={dropdownRef}>
      <button
        style={{
          ...styles.trigger,
          ...(value ? styles.triggerSelected : {}),
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={styles.triggerText}>{displayText}</span>
        <span style={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div style={styles.dropdown}>
          <input
            style={styles.search}
            placeholder="Search fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />

          {loading && (
            <div style={styles.emptyState}>Loading fields...</div>
          )}

          <div style={styles.list}>
            {standardFields.length > 0 && (
              <>
                <div style={styles.groupHeader}>Standard Fields</div>
                {standardFields.map((f) => (
                  <button
                    key={f.name}
                    style={{
                      ...styles.item,
                      ...(f.name === value ? styles.itemSelected : {}),
                    }}
                    onClick={() => handleSelect(f.name)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = f.name === value ? '#f0f7ff' : 'transparent';
                    }}
                  >
                    <span style={styles.itemLabel}>{f.label}</span>
                    <span style={styles.itemType}>{f.type}</span>
                  </button>
                ))}
              </>
            )}

            {customFields.length > 0 && (
              <>
                <div style={styles.groupHeader}>Custom Fields</div>
                {customFields.map((f) => (
                  <button
                    key={f.name}
                    style={{
                      ...styles.item,
                      ...(f.name === value ? styles.itemSelected : {}),
                    }}
                    onClick={() => handleSelect(f.name)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = f.name === value ? '#f0f7ff' : 'transparent';
                    }}
                  >
                    <span style={styles.itemLabel}>{f.label}</span>
                    <span style={styles.itemType}>{f.type}</span>
                  </button>
                ))}
              </>
            )}

            {!loading && filtered.length === 0 && (
              <div style={styles.emptyState}>No fields found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
  },
  trigger: {
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
    color: '#181818',
    borderColor: '#0176d3',
  },
  triggerText: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chevron: {
    fontSize: '9px',
    color: '#6b7280',
    flexShrink: 0,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    background: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    zIndex: 50,
    overflow: 'hidden',
  },
  search: {
    width: '100%',
    padding: '8px 10px',
    border: 'none',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  list: {
    maxHeight: '220px',
    overflowY: 'auto',
  },
  groupHeader: {
    padding: '6px 10px',
    fontSize: '10px',
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    background: '#f8fafc',
    borderBottom: '1px solid #f1f5f9',
  },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '6px 10px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.1s',
  },
  itemSelected: {
    background: '#f0f7ff',
  },
  itemLabel: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#181818',
  },
  itemType: {
    fontSize: '10px',
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  emptyState: {
    padding: '12px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#94a3b8',
  },
};
