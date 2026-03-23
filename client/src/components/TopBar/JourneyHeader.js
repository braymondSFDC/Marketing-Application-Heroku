import React from 'react';
import useJourneyStore from '../../store/journeyStore';
import SegmentPicker from './SegmentPicker';
import LaunchButton from './LaunchButton';

const STATUS_CONFIG = {
  draft: { label: 'Draft', bg: '#f1f5f9', color: '#475569' },
  launching: { label: 'Launching...', bg: '#fef4e8', color: '#c05600' },
  active: { label: 'Active', bg: '#e6f9ec', color: '#2e844a' },
  paused: { label: 'Paused', bg: '#fef4e8', color: '#fe9339' },
  completed: { label: 'Completed', bg: '#e0f0ff', color: '#0176d3' },
  failed: { label: 'Failed', bg: '#fce4e4', color: '#ea001e' },
};

export default function JourneyHeader({ journey, onBack }) {
  const status = useJourneyStore((s) => s.status);
  const sc = STATUS_CONFIG[journey?.status] || STATUS_CONFIG.draft;

  return (
    <div style={styles.header}>
      <div style={styles.left}>
        <button style={styles.backBtn} onClick={onBack}>←</button>
        <h2 style={styles.title}>{journey?.name || 'Untitled Journey'}</h2>
        <span style={{ ...styles.badge, background: sc.bg, color: sc.color }}>
          {sc.label}
        </span>
        {status === 'saving' && (
          <span style={styles.savingIndicator}>Saving...</span>
        )}
      </div>
      <div style={styles.right}>
        <SegmentPicker journey={journey} />
        <LaunchButton journey={journey} />
      </div>
    </div>
  );
}

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 20px',
    background: '#fff',
    borderBottom: '1px solid #e5e5e5',
    height: '56px',
    flexShrink: 0,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  backBtn: {
    background: 'none',
    border: '1px solid #e5e5e5',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '16px',
    cursor: 'pointer',
    color: '#475569',
  },
  title: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#181818',
    margin: 0,
  },
  badge: {
    fontSize: '12px',
    fontWeight: '600',
    padding: '3px 10px',
    borderRadius: '12px',
    textTransform: 'capitalize',
  },
  savingIndicator: {
    fontSize: '12px',
    color: '#94a3b8',
    fontStyle: 'italic',
  },
};
