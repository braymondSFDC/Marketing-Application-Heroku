import React from 'react';
import { Handle, Position } from '@xyflow/react';

export default function SmsNode({ data, selected }) {
  return (
    <div style={{
      ...styles.node,
      borderColor: selected ? '#16a34a' : '#e5e5e5',
      boxShadow: selected ? '0 0 0 2px rgba(22,163,74,0.2)' : '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      {/* Target handles: top + left */}
      <Handle type="target" position={Position.Top} id="top" style={styles.handle} />
      <Handle type="target" position={Position.Left} id="left" style={styles.handleTarget} />
      <div style={styles.header}>
        <span style={styles.icon}>💬</span>
        <span style={{ ...styles.type, color: '#16a34a' }}>SMS</span>
      </div>
      <div style={styles.label}>{data.name || 'Send SMS'}</div>
      {data.contentName && (
        <div style={styles.contentBadge}>
          📄 {data.contentName}
        </div>
      )}
      {data.messageBody && !data.contentName && (
        <div style={styles.preview}>
          {data.messageBody.substring(0, 50)}{data.messageBody.length > 50 ? '...' : ''}
        </div>
      )}
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
  contentBadge: {
    fontSize: '11px',
    color: '#16a34a',
    background: '#f0fdf4',
    padding: '3px 8px',
    borderRadius: '6px',
    marginTop: '6px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  preview: {
    fontSize: '11px',
    color: '#6b7280',
    background: '#f8fafc',
    padding: '4px 8px',
    borderRadius: '6px',
    marginTop: '6px',
    fontStyle: 'italic',
  },
  handle: {
    background: '#16a34a',
    width: '10px',
    height: '10px',
    border: '2px solid #fff',
  },
  handleTarget: {
    background: '#16a34a',
    width: '10px',
    height: '10px',
    border: '2px solid #fff',
  },
};
