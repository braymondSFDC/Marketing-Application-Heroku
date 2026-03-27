import React, { useState } from 'react';
import useJourneyStore from '../../store/journeyStore';
import SegmentPicker from './SegmentPicker';
import CampaignPicker from './CampaignPicker';
import LaunchButton from './LaunchButton';

const STATUS_CONFIG = {
  draft: { label: 'Draft', bg: '#f1f5f9', color: '#475569' },
  launching: { label: 'Launching...', bg: '#fef4e8', color: '#c05600' },
  active: { label: 'Active', bg: '#e6f9ec', color: '#2e844a' },
  paused: { label: 'Paused', bg: '#fef4e8', color: '#fe9339' },
  completed: { label: 'Completed', bg: '#e0f0ff', color: '#0176d3' },
  failed: { label: 'Failed', bg: '#fce4e4', color: '#ea001e' },
};

export default function JourneyHeader({
  journey,
  onBack,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isDirty,
}) {
  const status = useJourneyStore((s) => s.status);
  const renameJourney = useJourneyStore((s) => s.renameJourney);
  const deleteJourney = useJourneyStore((s) => s.deleteJourney);
  const sc = STATUS_CONFIG[journey?.status] || STATUS_CONFIG.draft;

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  const handleStartRename = () => {
    setRenameValue(journey?.name || '');
    setIsRenaming(true);
    setShowMenu(false);
  };

  const handleRename = async () => {
    if (renameValue.trim() && renameValue.trim() !== journey?.name) {
      await renameJourney(journey.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleDelete = async () => {
    if (window.confirm(`Delete "${journey?.name}"? This cannot be undone.`)) {
      await deleteJourney(journey.id);
      onBack();
    }
    setShowMenu(false);
  };

  return (
    <div style={styles.header}>
      <div style={styles.left}>
        <button style={styles.backBtn} onClick={onBack}>←</button>

        {isRenaming ? (
          <input
            style={styles.renameInput}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            autoFocus
          />
        ) : (
          <h2
            style={styles.title}
            onDoubleClick={handleStartRename}
            title="Double-click to rename"
          >
            {journey?.name || 'Untitled Journey'}
          </h2>
        )}

        <span style={{ ...styles.badge, background: sc.bg, color: sc.color }}>
          {sc.label}
        </span>

        {/* ⋮ Menu */}
        <div style={styles.menuWrapper}>
          <button
            style={styles.menuBtn}
            onClick={() => setShowMenu(!showMenu)}
          >
            ⋮
          </button>
          {showMenu && (
            <div style={styles.dropdown}>
              <button style={styles.dropdownItem} onClick={handleStartRename}>
                ✏️ Rename
              </button>
              <button
                style={{ ...styles.dropdownItem, color: '#ea001e' }}
                onClick={handleDelete}
              >
                🗑 Delete
              </button>
            </div>
          )}
        </div>

        {/* Undo / Redo */}
        <div style={styles.undoRedoGroup}>
          <button
            style={{ ...styles.iconBtn, opacity: canUndo ? 1 : 0.35 }}
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            ↩
          </button>
          <button
            style={{ ...styles.iconBtn, opacity: canRedo ? 1 : 0.35 }}
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            ↪
          </button>
        </div>

        {status === 'saving' && (
          <span style={styles.savingIndicator}>Saving...</span>
        )}
      </div>

      <div style={styles.right}>
        {/* Save button */}
        <button
          style={{
            ...styles.saveBtn,
            opacity: isDirty ? 1 : 0.5,
          }}
          onClick={onSave}
          title="Save (Ctrl+S)"
        >
          💾 Save
        </button>
        <CampaignPicker journey={journey} />
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
    gap: '10px',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
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
    cursor: 'pointer',
  },
  renameInput: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#181818',
    border: '1px solid #0176d3',
    borderRadius: '6px',
    padding: '4px 8px',
    outline: 'none',
    width: '200px',
  },
  badge: {
    fontSize: '12px',
    fontWeight: '600',
    padding: '3px 10px',
    borderRadius: '12px',
    textTransform: 'capitalize',
  },
  menuWrapper: {
    position: 'relative',
  },
  menuBtn: {
    background: 'none',
    border: '1px solid #e5e5e5',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '16px',
    cursor: 'pointer',
    color: '#6b7280',
    lineHeight: '1',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '4px',
    background: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
    zIndex: 100,
    minWidth: '140px',
    overflow: 'hidden',
  },
  dropdownItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'none',
    border: 'none',
    padding: '10px 14px',
    fontSize: '13px',
    cursor: 'pointer',
    color: '#181818',
  },
  undoRedoGroup: {
    display: 'flex',
    gap: '2px',
    marginLeft: '4px',
    borderLeft: '1px solid #e5e5e5',
    paddingLeft: '10px',
  },
  iconBtn: {
    background: 'none',
    border: '1px solid #e5e5e5',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '15px',
    cursor: 'pointer',
    color: '#475569',
    lineHeight: '1',
  },
  saveBtn: {
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e5e5e5',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  savingIndicator: {
    fontSize: '12px',
    color: '#94a3b8',
    fontStyle: 'italic',
  },
};
