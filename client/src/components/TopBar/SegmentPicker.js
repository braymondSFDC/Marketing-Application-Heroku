import React, { useState, useEffect, useRef } from 'react';
import useJourneyStore from '../../store/journeyStore';

const TYPE_ICONS = {
  data_cloud_segment: '🔷',
  object: '👤',
  listview: '📋',
  campaign: '📣',
  report: '📊',
};

const TYPE_LABELS = {
  data_cloud_segment: 'Data Cloud Segment',
  object: 'Object',
  listview: 'List View',
  campaign: 'Campaign',
  report: 'Report',
};

export default function SegmentPicker({ journey }) {
  const currentJourney = useJourneyStore((s) => s.currentJourney);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const dropdownRef = useRef(null);

  // Fetch segments on mount
  useEffect(() => {
    async function fetchSegments() {
      setLoading(true);
      try {
        const res = await fetch('/api/segments');
        const data = await res.json();
        setSegments(data.segments || []);
        setConnected(data.connected || false);
        if (data.message) setMessage(data.message);
      } catch (err) {
        console.error('Failed to fetch segments:', err);
        // Fallback
        setSegments([
          { id: 'contact-all', name: 'All Contacts', type: 'object', object: 'Contact' },
          { id: 'lead-all', name: 'All Leads', type: 'object', object: 'Lead' },
        ]);
      }
      setLoading(false);
    }
    fetchSegments();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (segment) => {
    setIsOpen(false);
    setSearch('');
    try {
      let segment_filter;
      switch (segment.type) {
        case 'data_cloud_segment':
          segment_filter = { type: 'data_cloud_segment', segmentId: segment.id, name: segment.name };
          break;
        case 'campaign':
          segment_filter = { type: 'campaign', campaignId: segment.id, name: segment.name };
          break;
        case 'report':
          segment_filter = { type: 'report', reportId: segment.id, name: segment.name };
          break;
        case 'listview':
          segment_filter = { type: 'listview', listviewId: segment.id, name: segment.name, object: segment.object };
          break;
        default:
          segment_filter = { type: 'object', object: segment.object };
      }
      await fetch(`/api/journeys/${currentJourney.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment_object: segment.object || segment.type,
          segment_filter,
        }),
      });
    } catch (err) {
      console.error('Failed to update segment:', err);
    }
  };

  // Get the currently selected segment info
  const currentSegment = (() => {
    const filter = journey?.segment_filter;
    if (filter?.segmentId) {
      const found = segments.find((s) => s.id === filter.segmentId);
      return found ? `🔷 ${found.name}` : filter.name || 'Data Cloud Segment';
    }
    if (filter?.campaignId) {
      const found = segments.find((s) => s.id === filter.campaignId);
      return found ? found.name : filter.name || 'Campaign';
    }
    if (filter?.reportId) {
      const found = segments.find((s) => s.id === filter.reportId);
      return found ? found.name : filter.name || 'Report';
    }
    if (filter?.listviewId) {
      const found = segments.find((s) => s.id === filter.listviewId);
      return found ? `📋 ${found.name}` : filter.name || 'List View';
    }
    return journey?.segment_object === 'Lead' ? 'All Leads' : 'All Contacts';
  })();

  // Filter segments by search
  const filtered = segments.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  // Group segments by type
  const grouped = {
    data_cloud_segment: filtered.filter((s) => s.type === 'data_cloud_segment'),
    object: filtered.filter((s) => s.type === 'object'),
    listview: filtered.filter((s) => s.type === 'listview'),
    campaign: filtered.filter((s) => s.type === 'campaign'),
    report: filtered.filter((s) => s.type === 'report'),
  };

  const isDisabled = journey?.status === 'active';

  return (
    <div style={styles.container} ref={dropdownRef}>
      <label style={styles.label}>Audience:</label>
      <button
        style={{
          ...styles.triggerBtn,
          opacity: isDisabled ? 0.5 : 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
        }}
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        disabled={isDisabled}
      >
        <span style={styles.triggerText}>{currentSegment}</span>
        <span style={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div style={styles.dropdown}>
          {/* Connection status banner */}
          {!connected && message && (
            <div style={styles.banner}>
              <span style={styles.bannerIcon}>ℹ️</span>
              <span style={styles.bannerText}>{message}</span>
            </div>
          )}
          {connected && (
            <div style={{ ...styles.banner, background: '#e6f9ec', color: '#2e844a' }}>
              <span style={styles.bannerIcon}>✅</span>
              <span style={styles.bannerText}>Connected to Salesforce</span>
            </div>
          )}

          {/* Search */}
          <div style={styles.searchWrapper}>
            <input
              style={styles.searchInput}
              placeholder="Search segments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Loading state */}
          {loading && (
            <div style={styles.emptyState}>Loading segments...</div>
          )}

          {/* Segment groups */}
          <div style={styles.list}>
            {['data_cloud_segment', 'object', 'listview', 'campaign', 'report'].map((type) => {
              const items = grouped[type];
              if (!items || items.length === 0) return null;
              return (
                <div key={type}>
                  <div style={styles.groupHeader}>
                    {TYPE_ICONS[type]} {TYPE_LABELS[type]}s
                  </div>
                  {items.map((seg) => (
                    <button
                      key={seg.id}
                      style={styles.item}
                      onClick={() => handleSelect(seg)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f1f5f9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'none';
                      }}
                    >
                      <div style={styles.itemMain}>
                        <span style={styles.itemName}>{seg.name}</span>
                        {seg.memberCount != null && (
                          <span style={styles.itemCount}>
                            {seg.memberCount.toLocaleString()} members
                          </span>
                        )}
                      </div>
                      {seg.status && (
                        <span style={styles.itemMeta}>{seg.status}</span>
                      )}
                      {seg.segmentType && (
                        <span style={styles.itemMeta}>{seg.segmentType}</span>
                      )}
                      {seg.description && seg.type === 'data_cloud_segment' && (
                        <span style={styles.itemMeta}>{seg.description.slice(0, 60)}{seg.description.length > 60 ? '...' : ''}</span>
                      )}
                      {seg.folder && (
                        <span style={styles.itemMeta}>{seg.folder}</span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}

            {!loading && filtered.length === 0 && (
              <div style={styles.emptyState}>No segments found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#6b7280',
  },
  triggerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    fontSize: '13px',
    fontWeight: '500',
    color: '#181818',
    cursor: 'pointer',
    maxWidth: '220px',
    transition: 'border-color 0.15s ease',
  },
  triggerText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  chevron: {
    fontSize: '9px',
    color: '#6b7280',
    flexShrink: 0,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '4px',
    width: '320px',
    background: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    zIndex: 200,
    overflow: 'hidden',
  },
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    background: '#fef4e8',
    color: '#c05600',
    fontSize: '11px',
    borderBottom: '1px solid #e5e5e5',
  },
  bannerIcon: {
    flexShrink: 0,
  },
  bannerText: {
    lineHeight: '1.3',
  },
  searchWrapper: {
    padding: '8px',
    borderBottom: '1px solid #f1f5f9',
  },
  searchInput: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #e5e5e5',
    borderRadius: '6px',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  list: {
    maxHeight: '300px',
    overflowY: 'auto',
    padding: '4px 0',
  },
  groupHeader: {
    padding: '8px 12px 4px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    textAlign: 'left',
    padding: '8px 12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.1s ease',
  },
  itemMain: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  itemName: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#181818',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  itemCount: {
    fontSize: '11px',
    color: '#6b7280',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  itemMeta: {
    fontSize: '11px',
    color: '#94a3b8',
    marginTop: '2px',
  },
  emptyState: {
    padding: '16px',
    textAlign: 'center',
    fontSize: '13px',
    color: '#94a3b8',
  },
};
