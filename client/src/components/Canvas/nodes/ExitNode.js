import React from 'react';
import { Handle, Position } from '@xyflow/react';

export default function ExitNode({ data, selected }) {
  return (
    <div style={{
      ...styles.node,
      borderColor: selected ? '#6b7280' : '#e5e5e5',
      boxShadow: selected ? '0 0 0 2px rgba(107,114,128,0.2)' : '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <Handle type="target" position={Position.Top} style={styles.handle} />
      <div style={styles.header}>
        <span style={styles.icon}>🔚</span>
        <span style={{ ...styles.type, color: '#6b7280' }}>Exit</span>
      </div>
      <div style={styles.label}>{data.name || 'Journey End'}</div>
    </div>
  );
}

const styles = {
  node: {
    background: '#f8fafc',
    border: '2px solid',
    borderRadius: '12px',
    padding: '12px 16px',
    minWidth: '140px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
  },
  icon: { fontSize: '16px' },
  type: {
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#6b7280',
  },
  handle: {
    background: '#6b7280',
    width: '10px',
    height: '10px',
    border: '2px solid #fff',
  },
};
