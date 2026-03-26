import React from 'react';
import { Handle, Position } from '@xyflow/react';

export default function SplitNode({ data, selected }) {
  const paths = data.paths || [
    { label: 'Path A', percentage: 50 },
    { label: 'Path B', percentage: 50 },
  ];

  return (
    <div style={{
      ...styles.node,
      borderColor: selected ? '#06b6d4' : '#e5e5e5',
      boxShadow: selected ? '0 0 0 2px rgba(6,182,212,0.2)' : '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      {/* Target handles: top + left */}
      <Handle type="target" position={Position.Top} id="top" style={styles.handle} />
      <Handle type="target" position={Position.Left} id="left" style={styles.handleTarget} />
      <div style={styles.header}>
        <span style={styles.icon}>⑂</span>
        <span style={{ ...styles.type, color: '#0891b2' }}>A/B Split</span>
      </div>
      <div style={styles.label}>{data.name || 'A/B Split'}</div>
      <div style={styles.paths}>
        {paths.map((p, i) => (
          <div key={i} style={styles.pathBadge}>
            {p.label}: {p.percentage}%
          </div>
        ))}
      </div>
      {/* Source handles: bottom (a/b) + right (a/b) */}
      <Handle type="source" position={Position.Bottom} id="a" style={{ ...styles.handle, left: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="b" style={{ ...styles.handle, left: '70%' }} />
      <Handle type="source" position={Position.Right} id="right-a" style={{ ...styles.handle, top: '35%' }} />
      <Handle type="source" position={Position.Right} id="right-b" style={{ ...styles.handle, top: '65%' }} />
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
  paths: {
    display: 'flex',
    gap: '6px',
    marginTop: '8px',
  },
  pathBadge: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#0891b2',
    background: '#ecfeff',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  handle: {
    background: '#06b6d4',
    width: '10px',
    height: '10px',
    border: '2px solid #fff',
  },
  handleTarget: {
    background: '#06b6d4',
    width: '10px',
    height: '10px',
    border: '2px solid #fff',
  },
};
