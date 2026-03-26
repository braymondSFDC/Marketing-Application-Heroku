import React from 'react';
import { Handle, Position } from '@xyflow/react';
import useJourneyStore from '../../../store/journeyStore';

export default function EmailNode({ id, data, selected }) {
  const nodeStats = useJourneyStore((s) => s.stats.byNode[id]);

  return (
    <div style={{
      ...styles.node,
      borderColor: selected ? '#7c3aed' : '#e5e5e5',
      boxShadow: selected ? '0 0 0 2px rgba(124,58,237,0.2)' : '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      {/* Target handles: top + left */}
      <Handle type="target" position={Position.Top} id="top" style={styles.handle} />
      <Handle type="target" position={Position.Left} id="left" style={styles.handleTarget} />
      <div style={styles.header}>
        <span style={styles.icon}>✉️</span>
        <span style={{ ...styles.type, color: '#7c3aed' }}>Email</span>
      </div>
      <div style={styles.label}>{data.name || data.subject || 'Send Email'}</div>
      {data.subject && (
        <div style={styles.meta}>Subject: {data.subject}</div>
      )}
      {/* Live stats badges */}
      {nodeStats && (
        <div style={styles.statsRow}>
          {nodeStats.delivered && <span style={{ ...styles.stat, color: '#2e844a' }}>📤 {nodeStats.delivered}</span>}
          {nodeStats.open && <span style={{ ...styles.stat, color: '#0176d3' }}>👁 {nodeStats.open}</span>}
          {nodeStats.click && <span style={{ ...styles.stat, color: '#7c3aed' }}>🔗 {nodeStats.click}</span>}
          {nodeStats.bounce && <span style={{ ...styles.stat, color: '#ea001e' }}>⚠ {nodeStats.bounce}</span>}
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
  meta: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '200px',
  },
  statsRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid #f1f5f9',
  },
  stat: {
    fontSize: '11px',
    fontWeight: '600',
  },
  handle: {
    background: '#7c3aed',
    width: '10px',
    height: '10px',
    border: '2px solid #fff',
  },
  handleTarget: {
    background: '#7c3aed',
    width: '10px',
    height: '10px',
    border: '2px solid #fff',
  },
};
