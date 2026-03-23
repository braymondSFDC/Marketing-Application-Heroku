import React, { useEffect, useState } from 'react';
import useJourneyStore from '../../store/journeyStore';

export default function LiveStats({ journeyId }) {
  const stats = useJourneyStore((s) => s.stats);
  const launchProgress = useJourneyStore((s) => s.launchProgress);
  const [fetchedStats, setFetchedStats] = useState(null);

  // Fetch initial stats from API
  useEffect(() => {
    if (!journeyId) return;

    async function fetchStats() {
      try {
        const res = await fetch(`/api/webhooks/stats/${journeyId}`);
        if (res.ok) {
          const data = await res.json();
          setFetchedStats(data);
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [journeyId]);

  const overall = { ...(fetchedStats?.overall || {}), ...(stats?.overall || {}) };

  const statItems = [
    { label: 'Delivered', value: overall.delivered || 0, icon: '📤', color: '#2e844a' },
    { label: 'Opened', value: overall.open || 0, icon: '👁', color: '#0176d3' },
    { label: 'Clicked', value: overall.click || 0, icon: '🔗', color: '#7c3aed' },
    { label: 'Bounced', value: overall.bounce || 0, icon: '⚠️', color: '#ea001e' },
    { label: 'Unsubscribed', value: overall.unsubscribe || 0, icon: '🚫', color: '#6b7280' },
  ];

  // Calculate rates
  const delivered = overall.delivered || 0;
  const openRate = delivered > 0 ? ((overall.open || 0) / delivered * 100).toFixed(1) : '0.0';
  const clickRate = delivered > 0 ? ((overall.click || 0) / delivered * 100).toFixed(1) : '0.0';

  return (
    <div style={styles.panel}>
      <div style={styles.title}>Live Stats</div>

      {/* Launch Progress */}
      {launchProgress && (
        <div style={styles.progressCard}>
          <div style={styles.progressLabel}>
            {launchProgress.status === 'completed' ? '✅' : launchProgress.status === 'failed' ? '❌' : '⏳'}
            {' '}{launchProgress.detail || launchProgress.message || 'Processing...'}
          </div>
          {launchProgress.step > 0 && launchProgress.status !== 'completed' && (
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${(launchProgress.step / 7) * 100}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div style={styles.statsGrid}>
        {statItems.map((item) => (
          <div key={item.label} style={styles.statCard}>
            <div style={styles.statIcon}>{item.icon}</div>
            <div style={{ ...styles.statValue, color: item.color }}>
              {item.value.toLocaleString()}
            </div>
            <div style={styles.statLabel}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Rates */}
      <div style={styles.ratesSection}>
        <div style={styles.rateTitle}>Performance</div>
        <div style={styles.rateRow}>
          <span style={styles.rateLabel}>Open Rate</span>
          <span style={{ ...styles.rateValue, color: '#0176d3' }}>{openRate}%</span>
        </div>
        <div style={styles.rateRow}>
          <span style={styles.rateLabel}>Click Rate</span>
          <span style={{ ...styles.rateValue, color: '#7c3aed' }}>{clickRate}%</span>
        </div>
      </div>

      {/* Hint */}
      <div style={styles.hint}>
        Stats update in real-time via WebSocket when events occur.
      </div>
    </div>
  );
}

const styles = {
  panel: {
    padding: '16px',
  },
  title: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '16px',
  },
  progressCard: {
    background: '#fef4e8',
    borderRadius: '8px',
    padding: '10px 12px',
    marginBottom: '16px',
  },
  progressLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#92400e',
  },
  progressBar: {
    height: '4px',
    background: '#fed7aa',
    borderRadius: '2px',
    marginTop: '8px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#f97316',
    borderRadius: '2px',
    transition: 'width 0.5s ease',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  statCard: {
    background: '#f8fafc',
    borderRadius: '8px',
    padding: '10px',
    textAlign: 'center',
  },
  statIcon: {
    fontSize: '16px',
    marginBottom: '2px',
  },
  statValue: {
    fontSize: '18px',
    fontWeight: '700',
  },
  statLabel: {
    fontSize: '11px',
    color: '#6b7280',
    marginTop: '2px',
  },
  ratesSection: {
    marginTop: '16px',
    padding: '12px',
    background: '#f8fafc',
    borderRadius: '8px',
  },
  rateTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#475569',
    marginBottom: '8px',
  },
  rateRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
  },
  rateLabel: {
    fontSize: '13px',
    color: '#6b7280',
  },
  rateValue: {
    fontSize: '14px',
    fontWeight: '700',
  },
  hint: {
    fontSize: '11px',
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: '16px',
    padding: '8px 0',
    borderTop: '1px solid #f1f5f9',
  },
};
