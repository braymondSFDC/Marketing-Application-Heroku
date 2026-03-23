import React from 'react';
import { Handle, Position } from '@xyflow/react';

export default function TriggerNode({ data, selected }) {
  return (
    <div style={{
      ...styles.node,
      borderColor: selected ? '#0176d3' : '#e5e5e5',
      boxShadow: selected ? '0 0 0 2px rgba(1,118,211,0.2)' : '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <div style={styles.header}>
        <span style={styles.icon}>⚡</span>
        <span style={styles.type}>Trigger</span>
      </div>
      <div style={styles.label}>{data.name || 'Segment Trigger'}</div>
      {data.triggerType && (
        <div style={styles.meta}>{data.triggerType}</div>
      )}
      <Handle type="source" position={Position.Bottom} style={styles.handle} />
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
    color: '#0176d3',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#181818',
  },
  meta: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '2px',
  },
  handle: {
    background: '#0176d3',
    width: '10px',
    height: '10px',
    border: '2px solid #fff',
  },
};
