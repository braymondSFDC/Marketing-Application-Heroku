import React, { useState } from 'react';
import useJourneyStore from '../store/journeyStore';

const STATUS_COLORS = {
  draft: { bg: '#f1f5f9', text: '#475569' },
  launching: { bg: '#fef4e8', text: '#c05600' },
  active: { bg: '#e6f9ec', text: '#2e844a' },
  paused: { bg: '#fef4e8', text: '#fe9339' },
  completed: { bg: '#e0f0ff', text: '#0176d3' },
  failed: { bg: '#fce4e4', text: '#ea001e' },
};

export default function JourneyList({ onSelectJourney }) {
  const journeys = useJourneyStore((s) => s.journeys);
  const createJourney = useJourneyStore((s) => s.createJourney);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSegment, setNewSegment] = useState('Contact');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const journey = await createJourney({
        name: newName.trim(),
        segment_object: newSegment,
      });
      if (journey && journey.id) {
        onSelectJourney(journey.id);
      }
    } catch (err) {
      console.error('Failed to create journey:', err);
    }
    setNewName('');
    setShowCreate(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Journey Builder</h1>
          <p style={styles.subtitle}>Design, build, and launch multi-step marketing journeys</p>
        </div>
        <button style={styles.createBtn} onClick={() => setShowCreate(true)}>
          + New Journey
        </button>
      </div>

      {showCreate && (
        <div style={styles.createPanel}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Create New Journey</h3>
          <input
            style={styles.input}
            placeholder="Journey name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <select
              style={styles.select}
              value={newSegment}
              onChange={(e) => setNewSegment(e.target.value)}
            >
              <option value="Contact">Contact</option>
              <option value="Lead">Lead</option>
            </select>
            <button style={styles.createBtn} onClick={handleCreate}>Create</button>
            <button style={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={styles.grid}>
        {journeys.length === 0 ? (
          <div style={styles.empty}>
            <p style={{ fontSize: '48px', margin: '0' }}>🚀</p>
            <p style={{ color: '#6b7280', marginTop: '8px' }}>No journeys yet. Create your first one!</p>
          </div>
        ) : (
          journeys.map((j) => {
            const sc = STATUS_COLORS[j.status] || STATUS_COLORS.draft;
            return (
              <div
                key={j.id}
                style={styles.card}
                onClick={() => onSelectJourney(j.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={styles.cardTitle}>{j.name}</h3>
                  <span style={{ ...styles.badge, background: sc.bg, color: sc.text }}>
                    {j.status}
                  </span>
                </div>
                <div style={styles.cardMeta}>
                  <span>📊 {j.segment_object || 'No segment'}</span>
                  <span>📅 {new Date(j.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '24px', fontWeight: '700', color: '#181818', margin: '0' },
  subtitle: { fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' },
  createBtn: {
    background: '#0176d3', color: '#fff', border: 'none', borderRadius: '8px',
    padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
  },
  cancelBtn: {
    background: '#f1f5f9', color: '#475569', border: '1px solid #e5e5e5', borderRadius: '8px',
    padding: '10px 20px', fontSize: '14px', cursor: 'pointer',
  },
  createPanel: {
    background: '#fff', border: '1px solid #e5e5e5', borderRadius: '12px',
    padding: '20px', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  input: {
    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
    borderRadius: '8px', fontSize: '14px', outline: 'none',
  },
  select: {
    padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
    fontSize: '14px', background: '#fff',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' },
  card: {
    background: '#fff', border: '1px solid #e5e5e5', borderRadius: '12px',
    padding: '20px', cursor: 'pointer', transition: 'box-shadow 0.15s',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  },
  cardTitle: { fontSize: '16px', fontWeight: '600', margin: '0' },
  cardMeta: { display: 'flex', gap: '16px', marginTop: '12px', fontSize: '13px', color: '#6b7280' },
  badge: { fontSize: '12px', fontWeight: '600', padding: '3px 10px', borderRadius: '12px', textTransform: 'capitalize' },
  empty: { gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px' },
};
