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
        <span style={{ ...styles.type, color: '#0891b2' }}>
          {data.winnerEnabled ? 'Experiment' : 'A/B Split'}
        </span>
      </div>
      <div style={styles.label}>{data.name || 'A/B Split'}</div>
      <div style={styles.paths}>
        {paths.map((p, i) => (
          <div key={i} style={styles.pathBadge}>
            {p.label}: {p.percentage}%
          </div>
        ))}
      </div>
      {data.winnerEnabled && (
        <div style={styles.winnerBadge}>
          🏆 Winner: {data.winnerMetric === 'open_rate' ? 'Open Rate' :
            data.winnerMetric === 'click_rate' ? 'Click Rate' :
            data.winnerMetric === 'conversion_rate' ? 'Conversion' :
            data.winnerMetric === 'unsubscribe_rate' ? 'Lowest Unsub' :
            'Open Rate'}
        </div>
      )}

      {/* Dynamic source handles along bottom */}
      {paths.map((p, i) => {
        const pathId = p.label ? p.label.toLowerCase().replace(/\s+/g, '-') : `path-${i}`;
        const pct = ((i + 1) / (paths.length + 1)) * 100;
        return (
          <Handle
            key={pathId}
            type="source"
            position={Position.Bottom}
            id={pathId}
            style={{ ...styles.handle, left: `${pct}%` }}
          />
        );
      })}

      {/* Right-side handles for horizontal layout (first and last path) */}
      {paths.length >= 2 && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id={`right-${paths[0].label ? paths[0].label.toLowerCase().replace(/\s+/g, '-') : 'path-0'}`}
            style={{ ...styles.handle, top: '35%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id={`right-${paths[paths.length - 1].label ? paths[paths.length - 1].label.toLowerCase().replace(/\s+/g, '-') : `path-${paths.length - 1}`}`}
            style={{ ...styles.handle, top: '65%' }}
          />
        </>
      )}
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
    flexWrap: 'wrap',
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
  winnerBadge: {
    fontSize: '10px',
    color: '#c05600',
    background: '#fef4e8',
    padding: '3px 8px',
    borderRadius: '6px',
    marginTop: '6px',
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
