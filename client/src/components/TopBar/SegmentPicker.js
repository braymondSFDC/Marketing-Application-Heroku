import React from 'react';
import useJourneyStore from '../../store/journeyStore';

export default function SegmentPicker({ journey }) {
  const currentJourney = useJourneyStore((s) => s.currentJourney);

  const handleChange = async (e) => {
    const value = e.target.value;
    try {
      await fetch(`/api/journeys/${currentJourney.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment_object: value }),
      });
    } catch (err) {
      console.error('Failed to update segment:', err);
    }
  };

  return (
    <div style={styles.container}>
      <label style={styles.label}>Segment:</label>
      <select
        style={styles.select}
        value={journey?.segment_object || 'Contact'}
        onChange={handleChange}
        disabled={journey?.status === 'active'}
      >
        <option value="Contact">Contact</option>
        <option value="Lead">Lead</option>
      </select>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#6b7280',
  },
  select: {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '13px',
    background: '#fff',
    cursor: 'pointer',
  },
};
