import React, { useState } from 'react';
import { useSalesforceFields } from '../../hooks/useSalesforceFields';

export default function PersonalizationPicker({ objectName, onInsert }) {
  const { fields, loading, error } = useSalesforceFields(objectName);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  if (!objectName) return null;

  const allFields = fields?.allFields || [];
  const filtered = search
    ? allFields.filter(
        (f) =>
          f.label.toLowerCase().includes(search.toLowerCase()) ||
          f.name.toLowerCase().includes(search.toLowerCase())
      )
    : allFields.slice(0, 20);

  return (
    <div style={styles.container}>
      <button
        style={styles.toggleBtn}
        onClick={() => setExpanded(!expanded)}
      >
        🏷 Insert Merge Field {expanded ? '▴' : '▾'}
      </button>

      {expanded && (
        <div style={styles.dropdown}>
          <input
            style={styles.search}
            placeholder="Search fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />

          {loading && <div style={styles.loading}>Loading fields...</div>}
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.fieldList}>
            {filtered.map((field) => (
              <div
                key={field.name}
                style={styles.fieldItem}
                onClick={() => {
                  onInsert(field.mergeField);
                  setExpanded(false);
                  setSearch('');
                }}
              >
                <span style={styles.fieldName}>{field.label}</span>
                <span style={styles.fieldMerge}>{field.mergeField}</span>
              </div>
            ))}
            {!loading && filtered.length === 0 && (
              <div style={styles.empty}>No fields found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    marginTop: '8px',
  },
  toggleBtn: {
    background: '#f8fafc',
    border: '1px solid #e5e5e5',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#0176d3',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
  },
  dropdown: {
    marginTop: '4px',
    border: '1px solid #e5e5e5',
    borderRadius: '8px',
    background: '#fff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
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
  fieldList: {
    maxHeight: '200px',
    overflowY: 'auto',
  },
  fieldItem: {
    padding: '6px 10px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'background 0.1s',
    borderBottom: '1px solid #f8fafc',
  },
  fieldName: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#181818',
  },
  fieldMerge: {
    fontSize: '10px',
    fontFamily: 'monospace',
    color: '#94a3b8',
  },
  loading: {
    padding: '12px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#6b7280',
  },
  error: {
    padding: '12px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#ea001e',
  },
  empty: {
    padding: '12px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#94a3b8',
  },
};
