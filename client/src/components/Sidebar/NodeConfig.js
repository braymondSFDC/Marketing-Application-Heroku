import React, { useState, useEffect } from 'react';
import useJourneyStore from '../../store/journeyStore';
import PersonalizationPicker from '../FieldPicker/PersonalizationPicker';
import ContentPicker from './ContentPicker';
import FieldPicker from './FieldPicker';

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
          {/* Content Picker from CMS */}
          <div style={styles.field}>
            <label style={styles.label}>Select Email Content</label>
            <ContentPicker
              contentType="email"
              value={config.contentId}
              onChange={(item) => {
                if (item) {
                  update('contentId', item.id);
                  update('contentName', item.name);
                  if (item.subject) update('subject', item.subject);
                } else {
                  update('contentId', null);
                  update('contentName', null);
                }
              }}
            />
          </div>
          <div style={styles.divider} />
          <div style={{ ...styles.field, marginTop: '8px' }}>
            <label style={{ ...styles.label, color: '#94a3b8' }}>— or compose manually —</label>
          </div>
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

      {/* SMS config */}
      {nodeType === 'sms' && (
        <>
          <div style={styles.field}>
            <label style={styles.label}>Select SMS Content</label>
            <ContentPicker
              contentType="sms"
              value={config.contentId}
              onChange={(item) => {
                if (item) {
                  update('contentId', item.id);
                  update('contentName', item.name);
                  if (item.message) update('messageBody', item.message);
                } else {
                  update('contentId', null);
                  update('contentName', null);
                }
              }}
            />
          </div>
          <div style={styles.divider} />
          <div style={{ ...styles.field, marginTop: '8px' }}>
            <label style={{ ...styles.label, color: '#94a3b8' }}>— or compose manually —</label>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>SMS Message</label>
            <textarea
              style={styles.textarea}
              value={config.messageBody || ''}
              onChange={(e) => update('messageBody', e.target.value)}
              placeholder="Your SMS message..."
              rows={4}
            />
            <div style={styles.charCount}>
              {(config.messageBody || '').length}/160 characters
            </div>
          </div>
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

      {/* Condition config — multi-branch with field picker */}
      {nodeType === 'condition' && (
        <ConditionConfig config={config} update={update} journey={journey} />
      )}

      {/* Split config — multi-branch with experiment settings */}
      {nodeType === 'split' && (
        <SplitConfig config={config} update={update} />
      )}
    </div>
  );
}

/**
 * ConditionConfig — Multi-branch condition builder with field picker.
 * Inspired by Salesforce Flow Decision element, simplified.
 */
function ConditionConfig({ config, update, journey }) {
  const branches = config.branches || [
    { id: 'b1', label: 'Branch 1', field: '', operator: 'EqualTo', value: '' },
  ];

  const updateBranch = (idx, key, val) => {
    const updated = branches.map((b, i) => i === idx ? { ...b, [key]: val } : b);
    update('branches', updated);
  };

  const addBranch = () => {
    const newBranch = {
      id: `b${Date.now()}`,
      label: `Branch ${branches.length + 1}`,
      field: '',
      operator: 'EqualTo',
      value: '',
    };
    update('branches', [...branches, newBranch]);
  };

  const removeBranch = (idx) => {
    if (branches.length <= 1) return;
    update('branches', branches.filter((_, i) => i !== idx));
  };

  const segmentObject = journey?.segment_object || 'Contact';

  return (
    <>
      <div style={styles.sectionHeader}>
        <span>Conditions</span>
        <span style={styles.sectionCount}>{branches.length} branch{branches.length !== 1 ? 'es' : ''} + Default</span>
      </div>

      {branches.map((branch, idx) => (
        <div key={branch.id} style={styles.branchCard}>
          <div style={styles.branchHeader}>
            <input
              style={styles.branchLabelInput}
              value={branch.label}
              onChange={(e) => updateBranch(idx, 'label', e.target.value)}
              placeholder={`Branch ${idx + 1}`}
            />
            {branches.length > 1 && (
              <button style={styles.removeBranchBtn} onClick={() => removeBranch(idx)} title="Remove">✕</button>
            )}
          </div>

          {/* Field Picker */}
          <div style={styles.field}>
            <label style={styles.label}>Field</label>
            <FieldPicker
              objectName={segmentObject}
              value={branch.field}
              onChange={(fieldName) => updateBranch(idx, 'field', fieldName)}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Operator</label>
            <select
              style={styles.select}
              value={branch.operator || 'EqualTo'}
              onChange={(e) => updateBranch(idx, 'operator', e.target.value)}
            >
              <option value="EqualTo">Equals</option>
              <option value="NotEqualTo">Not Equals</option>
              <option value="GreaterThan">Greater Than</option>
              <option value="LessThan">Less Than</option>
              <option value="GreaterOrEqual">Greater or Equal</option>
              <option value="LessOrEqual">Less or Equal</option>
              <option value="Contains">Contains</option>
              <option value="StartsWith">Starts With</option>
              <option value="IsNull">Is Empty</option>
              <option value="IsNotNull">Is Not Empty</option>
            </select>
          </div>

          {branch.operator !== 'IsNull' && branch.operator !== 'IsNotNull' && (
            <div style={styles.field}>
              <label style={styles.label}>Value</label>
              <input
                style={styles.input}
                value={branch.value || ''}
                onChange={(e) => updateBranch(idx, 'value', e.target.value)}
                placeholder="Comparison value"
              />
            </div>
          )}
        </div>
      ))}

      {/* Default branch indicator */}
      <div style={styles.defaultBranch}>
        <span style={styles.defaultIcon}>↳</span>
        <span>Default (no match)</span>
      </div>

      <button style={styles.addBranchBtn} onClick={addBranch}>
        + Add Branch
      </button>
    </>
  );
}

/**
 * SplitConfig — Multi-branch path experiment with winner selection.
 */
function SplitConfig({ config, update }) {
  const paths = config.paths || [
    { label: 'Path A', percentage: 50 },
    { label: 'Path B', percentage: 50 },
  ];

  const updatePath = (idx, key, val) => {
    const updated = paths.map((p, i) => i === idx ? { ...p, [key]: val } : p);
    update('paths', updated);
  };

  const addPath = () => {
    // Redistribute percentages evenly
    const count = paths.length + 1;
    const even = Math.floor(100 / count);
    const remainder = 100 - (even * count);
    const newPaths = [
      ...paths.map((p) => ({ ...p, percentage: even })),
      { label: `Path ${String.fromCharCode(65 + paths.length)}`, percentage: even + remainder },
    ];
    update('paths', newPaths);
  };

  const removePath = (idx) => {
    if (paths.length <= 2) return;
    const newPaths = paths.filter((_, i) => i !== idx);
    // Redistribute
    const each = Math.floor(100 / newPaths.length);
    const rem = 100 - (each * newPaths.length);
    const redistributed = newPaths.map((p, i) => ({
      ...p,
      percentage: each + (i === 0 ? rem : 0),
    }));
    update('paths', redistributed);
  };

  const redistributeEvenly = () => {
    const count = paths.length;
    const even = Math.floor(100 / count);
    const rem = 100 - (even * count);
    const newPaths = paths.map((p, i) => ({
      ...p,
      percentage: even + (i === 0 ? rem : 0),
    }));
    update('paths', newPaths);
  };

  const total = paths.reduce((sum, p) => sum + (p.percentage || 0), 0);

  return (
    <>
      <div style={styles.sectionHeader}>
        <span>Paths</span>
        <span style={styles.sectionCount}>{paths.length} paths</span>
      </div>

      {paths.map((p, idx) => (
        <div key={idx} style={styles.pathRow}>
          <input
            style={{ ...styles.input, flex: 1, minWidth: 0 }}
            value={p.label}
            onChange={(e) => updatePath(idx, 'label', e.target.value)}
          />
          <div style={styles.percentInput}>
            <input
              style={{ ...styles.input, width: '55px', textAlign: 'center' }}
              type="number"
              min="0"
              max="100"
              value={p.percentage}
              onChange={(e) => updatePath(idx, 'percentage', parseInt(e.target.value) || 0)}
            />
            <span style={styles.percentSign}>%</span>
          </div>
          {paths.length > 2 && (
            <button style={styles.removeBranchBtn} onClick={() => removePath(idx)} title="Remove">✕</button>
          )}
        </div>
      ))}

      {total !== 100 && (
        <div style={styles.warningBanner}>
          ⚠️ Total is {total}% (should be 100%)
          <button style={styles.fixBtn} onClick={redistributeEvenly}>Fix</button>
        </div>
      )}

      <button style={styles.addBranchBtn} onClick={addPath}>
        + Add Path
      </button>

      {/* Winner Selection */}
      <div style={{ ...styles.sectionHeader, marginTop: '16px' }}>
        <span>Winner Selection</span>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Enable Winner</label>
        <select
          style={styles.select}
          value={config.winnerEnabled ? 'yes' : 'no'}
          onChange={(e) => update('winnerEnabled', e.target.value === 'yes')}
        >
          <option value="no">No — distribute evenly</option>
          <option value="yes">Yes — pick a winner</option>
        </select>
      </div>

      {config.winnerEnabled && (
        <>
          <div style={styles.field}>
            <label style={styles.label}>Winning Metric</label>
            <select
              style={styles.select}
              value={config.winnerMetric || 'open_rate'}
              onChange={(e) => update('winnerMetric', e.target.value)}
            >
              <option value="open_rate">Open Rate</option>
              <option value="click_rate">Click Rate</option>
              <option value="conversion_rate">Conversion Rate</option>
              <option value="unsubscribe_rate">Lowest Unsubscribe Rate</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Test Group Size</label>
            <div style={styles.sliderRow}>
              <input
                type="range"
                min="5"
                max="50"
                value={config.testGroupSize || 15}
                onChange={(e) => update('testGroupSize', parseInt(e.target.value))}
                style={styles.slider}
              />
              <span style={styles.sliderValue}>{config.testGroupSize || 15}%</span>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Test Duration</label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                style={{ ...styles.input, width: '60px' }}
                type="number"
                min="1"
                value={config.testDuration || 4}
                onChange={(e) => update('testDuration', parseInt(e.target.value) || 1)}
              />
              <select
                style={{ ...styles.select, width: '90px' }}
                value={config.testDurationUnit || 'hours'}
                onChange={(e) => update('testDurationUnit', e.target.value)}
              >
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Fallback if No Winner</label>
            <select
              style={styles.select}
              value={config.fallbackBehavior || 'distribute_evenly'}
              onChange={(e) => update('fallbackBehavior', e.target.value)}
            >
              <option value="distribute_evenly">Distribute Evenly</option>
              <option value="first_path">Send to First Path</option>
              <option value="hold">Hold — Wait for Manual Decision</option>
            </select>
          </div>
        </>
      )}
    </>
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
  divider: {
    borderTop: '1px solid #f1f5f9',
    margin: '8px 0',
  },
  charCount: {
    fontSize: '11px',
    color: '#94a3b8',
    textAlign: 'right',
    marginTop: '4px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    fontWeight: '700',
    color: '#475569',
    padding: '8px 0',
    borderBottom: '1px solid #f1f5f9',
    marginBottom: '10px',
  },
  sectionCount: {
    fontSize: '11px',
    fontWeight: '500',
    color: '#94a3b8',
  },
  branchCard: {
    border: '1px solid #e5e5e5',
    borderRadius: '8px',
    padding: '10px',
    marginBottom: '10px',
    background: '#fafbfc',
  },
  branchHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  branchLabelInput: {
    flex: 1,
    padding: '4px 8px',
    border: '1px solid transparent',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#181818',
    background: 'transparent',
    outline: 'none',
  },
  removeBranchBtn: {
    background: 'none',
    border: 'none',
    color: '#ea001e',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '4px',
    lineHeight: 1,
  },
  defaultBranch: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 10px',
    background: '#f8fafc',
    borderRadius: '6px',
    border: '1px dashed #d1d5db',
    fontSize: '12px',
    color: '#6b7280',
    fontStyle: 'italic',
    marginBottom: '10px',
  },
  defaultIcon: {
    color: '#94a3b8',
    fontSize: '14px',
  },
  addBranchBtn: {
    display: 'block',
    width: '100%',
    padding: '8px',
    background: 'none',
    border: '1px dashed #0176d3',
    borderRadius: '6px',
    color: '#0176d3',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center',
  },
  pathRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  percentInput: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  percentSign: {
    fontSize: '12px',
    color: '#6b7280',
  },
  warningBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    background: '#fef4e8',
    borderRadius: '6px',
    fontSize: '11px',
    color: '#c05600',
    marginBottom: '10px',
  },
  fixBtn: {
    background: '#c05600',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  slider: {
    flex: 1,
  },
  sliderValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#181818',
    minWidth: '36px',
    textAlign: 'right',
  },
};
