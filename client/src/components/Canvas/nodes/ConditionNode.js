import React from 'react';
import { Handle, Position } from '@xyflow/react';

export default function ConditionNode({ data, selected }) {
  return (
    <div style={{
      ...styles.node,
      borderColor: selected ? '#f97316' : '#e5e5e5',
      boxShadow: selected ? '0 0 0 2px rgba(249,115,22,0.2)' : '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <Handle type="target" position={Position.Top} style={styles.handle} />
      <div style={styles.header}>
        <span style={styles.icon}>◆</span>
        <span style={{ ...styles.type, color: '#ea580c' }}>Condition</span>
      </div>
      <div style={styles.label}>{data.name || 'Condition Check'}</div>
      {data.field && (
        <div style={styles.condition}>
          {data.field} {data.operator || '='} {data.value || '?'}
        </div>
      )}
      <div style={styles.branches}>
        <span style={{ ...styles.branchLabel, color: '#2e844a' }}>✓ Yes</span>
        <span style={{ ...styles.branchLabel, color: '#ea001e' }}>✗ No</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="yes" style={{ ...styles.handle, left: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="no" style={{ ...styles.handle, left: '70%' }} />
    </div>
  );
}

const styles = {
  node: {
    background: '#fff',
    border: '2px solid',
    borderRadius: '12px',
    padding: '12px 16px',
    minWidth: '180px',
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
    color: '#181818',
  },
  condition: {
    fontSize: '12px',
    color: '#6b7280',
    background: '#f8fafc',
    padding: '4px 8px',
    borderRadius: '6px',
    marginTop: '6px',
    fontFamily: 'monospace',
  },
  branches: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid #f1f5f9',
  },
  branchLabel: {
    fontSize: '11px',
    fontWeight: '600',
  },
  handle: {
    background: '#f97316',
    width: '10px',
    height: '10px',
    border: '2px solid #fff',
  },
};
