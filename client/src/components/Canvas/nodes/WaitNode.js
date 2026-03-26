import React from 'react';
import { Handle, Position } from '@xyflow/react';

export default function WaitNode({ data, selected }) {
  const duration = data.duration || 1;
  const unit = data.unit || 'Days';

  return (
    <div style={{
      ...styles.node,
      borderColor: selected ? '#f59e0b' : '#e5e5e5',
      boxShadow: selected ? '0 0 0 2px rgba(245,158,11,0.2)' : '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      {/* Target handles: top + left */}
      <Handle type="target" position={Position.Top} id="top" style={styles.handle} />
      <Handle type="target" position={Position.Left} id="left" style={styles.handleTarget} />
      <div style={styles.header}>
        <span style={styles.icon}>⏱</span>
        <span style={{ ...styles.type, color: '#d97706' }}>Wait</span>
      </div>
      <div style={styles.label}>{data.name || `Wait ${duration} ${unit}`}</div>
      <div style={styles.duration}>
        <span style={styles.durationValue}>{duration}</span>
        <span style={styles.durationUnit}>{unit.toLowerCase()}</span>
      </div>
      {/* Source handles: bottom + right */}
      <Handle type="source" position={Position.Bottom} id="bottom" style={styles.handle} />
      <Handle type="source" position={Position.Right} id="right" style={styles.handle} />
    </div>
  );
}

const styles = {
  node: {
    background: '#fff',
    border: '2px solid',
    borderRadius: '12px',
    padding: '12px 16px',
    minWidth: '160px',
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
  duration: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
    marginTop: '4px',
  },
  durationValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#d97706',
  },
  durationUnit: {
    fontSize: '12px',
    color: '#6b7280',
  },
  handle: {
    background: '#f59e0b',
    width: '10px',
    height: '10px',
    border: '2px solid #fff',
  },
  handleTarget: {
    background: '#f59e0b',
    width: '10px',
    height: '10px',
    border: '2px solid #fff',
  },
};
