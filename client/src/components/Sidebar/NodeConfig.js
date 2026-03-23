import React, { useState, useEffect } from 'react';
import useJourneyStore from '../../store/journeyStore';
import PersonalizationPicker from '../FieldPicker/PersonalizationPicker';

export default function NodeConfig({ node }) {
  const updateNodeConfig = useJourneyStore((s) => s.updateNodeConfig);
  const journey = useJourneyStore((s) => s.currentJourney);
  const [config, setConfig] = useState(node.data || {});

  useEffect(() => {
    setConfig(node.data || {});
  }, [node.id, node.data]);

  const update = (key, value) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    updateNodeConfig(node.id, newConfig);
  };

  const nodeType = node.type || node.node_type;

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.headerType}>{nodeType}</span>
        <h3 style={styles.headerTitle}>Configure</h3>
      </div>

      {/* Common: Name */}
      <div style={styles.field}>
        <label style={styles.label}>Name</label>
        <input
          style={styles.input}
          value={config.name || ''}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Step name"
        />
      </div>

      {/* Trigger config */}
      {nodeType === 'trigger' && (
        <>
          <div style={styles.field}>
            <label style={styles.label}>Trigger Type</label>
            <select
              style={styles.select}
              value={config.triggerType || 'PlatformEvent'}
              onChange={(e) => update('triggerType', e.target.value)}
            >
              <option value="PlatformEvent">Segment Trigger</option>
              <option value="Scheduled">Schedule</option>
              <option value="RecordChange">Record Change</option>
            </select>
          </div>
        </>
      )}

      {/* Email config */}
      {nodeType === 'email' && (
        <>
          <div style={styles.field}>
            <label style={styles.label}>Subject</label>
            <input
              style={styles.input}
              value={config.subject || ''}
              onChange={(e) => update('subject', e.target.value)}
              placeholder="Email subject line"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Email Body (HTML)</label>
            <textarea
              style={styles.textarea}
              value={config.htmlBody || ''}
              onChange={(e) => update('htmlBody', e.target.value)}
              placeholder="<html>...</html>"
              rows={6}
            />
          </div>
          <PersonalizationPicker
            objectName={journey?.segment_object || 'Contact'}
            onInsert={(field) => {
              const current = config.htmlBody || '';
              update('htmlBody', current + field);
            }}
          />
        </>
      )}

      {/* Wait config */}
      {nodeType === 'wait' && (
        <>
          <div style={styles.field}>
            <label style={styles.label}>Duration</label>
            <input
              style={styles.input}
              type="number"
              min="1"
              value={config.duration || 1}
              onChange={(e) => update('duration', parseInt(e.target.value) || 1)}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Unit</label>
            <select
              style={styles.select}
              value={config.unit || 'Days'}
              onChange={(e) => update('unit', e.target.value)}
            >
              <option value="Hours">Hours</option>
              <option value="Days">Days</option>
              <option value="Weeks">Weeks</option>
            </select>
          </div>
        </>
      )}

      {/* Condition config */}
      {nodeType === 'condition' && (
        <>
          <div style={styles.field}>
            <label style={styles.label}>Field</label>
            <input
              style={styles.input}
              value={config.field || ''}
              onChange={(e) => update('field', e.target.value)}
              placeholder="e.g., Status"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Operator</label>
            <select
              style={styles.select}
              value={config.operator || 'EqualTo'}
              onChange={(e) => update('operator', e.target.value)}
            >
              <option value="EqualTo">Equals</option>
              <option value="NotEqualTo">Not Equals</option>
              <option value="GreaterThan">Greater Than</option>
              <option value="LessThan">Less Than</option>
              <option value="Contains">Contains</option>
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Value</label>
            <input
              style={styles.input}
              value={config.value || ''}
              onChange={(e) => update('value', e.target.value)}
              placeholder="Comparison value"
            />
          </div>
        </>
      )}

      {/* Split config */}
      {nodeType === 'split' && (
        <div style={styles.field}>
          <label style={styles.label}>Split Percentages</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Path A</div>
              <input
                style={{ ...styles.input, width: '80px' }}
                type="number"
                min="0"
                max="100"
                value={config.paths?.[0]?.percentage || 50}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  update('paths', [
                    { label: 'Path A', percentage: val },
                    { label: 'Path B', percentage: 100 - val },
                  ]);
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Path B</div>
              <input
                style={{ ...styles.input, width: '80px' }}
                type="number"
                disabled
                value={100 - (config.paths?.[0]?.percentage || 50)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  panel: {
    padding: '16px',
  },
  header: {
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #f1f5f9',
  },
  headerType: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#0176d3',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  headerTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#181818',
    margin: '4px 0 0 0',
  },
  field: {
    marginBottom: '14px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: '#475569',
    marginBottom: '4px',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '13px',
    background: '#fff',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '13px',
    fontFamily: 'monospace',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },
};
