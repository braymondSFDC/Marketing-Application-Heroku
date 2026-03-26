import React, { useState } from 'react';
import useJourneyStore from '../../store/journeyStore';

export default function LaunchButton({ journey }) {
  const launchJourney = useJourneyStore((s) => s.launchJourney);
  const saveCanvas = useJourneyStore((s) => s.saveCanvas);
  const status = useJourneyStore((s) => s.status);
  const nodes = useJourneyStore((s) => s.nodes);
  const [showConfirm, setShowConfirm] = useState(false);

  const canLaunch =
    journey?.status === 'draft' &&
    nodes.length > 0 &&
    status !== 'launching';

  const handleLaunch = async () => {
    setShowConfirm(false);
    try {
      // Save canvas first
      await saveCanvas();
      // Then launch
      await launchJourney();
    } catch (err) {
      console.error('Launch failed:', err);
    }
  };

  if (journey?.status === 'active') {
    return (
      <button style={styles.activeBtn} disabled>
        🟢 Live
      </button>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        style={canLaunch ? styles.launchBtn : styles.disabledBtn}
        onClick={() => canLaunch && setShowConfirm(true)}
        disabled={!canLaunch || status === 'launching'}
      >
        {status === 'launching' ? '⏳ Launching...' : '🚀 Launch'}
      </button>

      {showConfirm && (
        <div style={styles.confirmOverlay}>
          <div style={styles.confirmCard}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Launch Journey?</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#6b7280' }}>
              This will activate the journey and begin the launch sequence.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={styles.confirmBtn} onClick={handleLaunch}>
                Confirm Launch
              </button>
              <button style={styles.cancelBtn} onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  launchBtn: {
    background: '#0176d3',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 20px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  disabledBtn: {
    background: '#cbd5e1',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 20px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'not-allowed',
  },
  activeBtn: {
    background: '#e6f9ec',
    color: '#2e844a',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    padding: '8px 20px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'default',
  },
  confirmOverlay: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '8px',
    zIndex: 100,
  },
  confirmCard: {
    background: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    width: '280px',
  },
  confirmBtn: {
    background: '#0176d3',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  cancelBtn: {
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e5e5e5',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    cursor: 'pointer',
  },
};
