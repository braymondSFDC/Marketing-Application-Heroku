import React, { useState, useEffect, useRef } from 'react';
import useJourneyStore from '../../store/journeyStore';

/**
 * CampaignPicker — Lets users associate a journey with an existing
 * Salesforce Campaign or create a new one directly from the canvas.
 */
export default function CampaignPicker({ journey }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch campaigns when dropdown opens
  useEffect(() => {
    if (isOpen && campaigns.length === 0) {
      fetchCampaigns();
    }
  }, [isOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
        setShowCreate(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
      setConnected(data.connected || false);
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    }
    setLoading(false);
  };

  const handleSelectCampaign = async (campaign) => {
    setIsOpen(false);
    setSearch('');
    try {
      await fetch(`/api/journeys/${journey.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sf_campaign_id: campaign.id }),
      });
      // Update local state
      useJourneyStore.setState((state) => ({
        currentJourney: state.currentJourney
          ? { ...state.currentJourney, sf_campaign_id: campaign.id, _campaignName: campaign.name }
          : state.currentJourney,
      }));
    } catch (err) {
      console.error('Failed to link campaign:', err);
    }
  };

  const handleUnlinkCampaign = async () => {
    setIsOpen(false);
    try {
      // Send empty string to clear campaign — the COALESCE will set it
      await fetch(`/api/journeys/${journey.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sf_campaign_id: '' }),
      });
      useJourneyStore.setState((state) => ({
        currentJourney: state.currentJourney
          ? { ...state.currentJourney, sf_campaign_id: null, _campaignName: null }
          : state.currentJourney,
      }));
    } catch (err) {
      console.error('Failed to unlink campaign:', err);
    }
  };

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCampaignName.trim() }),
      });
      const data = await res.json();
      if (data.campaign) {
        // Auto-link the new campaign to this journey
        await handleSelectCampaign(data.campaign);
        // Add to local list
        setCampaigns((prev) => [data.campaign, ...prev]);
      }
    } catch (err) {
      console.error('Failed to create campaign:', err);
    }
    setCreating(false);
    setNewCampaignName('');
    setShowCreate(false);
  };

  // Get current campaign name
  const currentCampaignName = (() => {
    if (!journey?.sf_campaign_id) return null;
    // Check if we already cached the name
    if (journey._campaignName) return journey._campaignName;
    // Try finding in the loaded campaigns
    const found = campaigns.find((c) => c.id === journey.sf_campaign_id);
    return found ? found.name : 'Campaign ' + journey.sf_campaign_id.substring(0, 8);
  })();

  // Filter campaigns by search
  const filtered = campaigns.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const isDisabled = journey?.status === 'active';

  return (
    <div style={styles.container} ref={dropdownRef}>
      <label style={styles.label}>Campaign:</label>
      <button
        style={{
          ...styles.triggerBtn,
          ...(currentCampaignName ? styles.triggerLinked : {}),
          opacity: isDisabled ? 0.5 : 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
        }}
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        disabled={isDisabled}
      >
        <span style={styles.triggerText}>
          {currentCampaignName ? `📣 ${currentCampaignName}` : '🔗 Link Campaign'}
        </span>
        <span style={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div style={styles.dropdown}>
          {/* Not connected banner */}
          {!connected && !loading && (
            <div style={styles.banner}>
              <span>ℹ️</span>
              <span>Connect to Salesforce to see campaigns</span>
            </div>
          )}

          {/* Create new campaign */}
          {connected && (
            <div style={styles.createSection}>
              {showCreate ? (
                <div style={styles.createForm}>
                  <input
                    style={styles.createInput}
                    placeholder="Campaign name..."
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateCampaign()}
                    autoFocus
                  />
                  <div style={styles.createActions}>
                    <button
                      style={styles.createSubmitBtn}
                      onClick={handleCreateCampaign}
                      disabled={creating || !newCampaignName.trim()}
                    >
                      {creating ? 'Creating...' : 'Create'}
                    </button>
                    <button style={styles.createCancelBtn} onClick={() => setShowCreate(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  style={styles.createNewBtn}
                  onClick={() => setShowCreate(true)}
                >
                  ➕ Create New Campaign
                </button>
              )}
            </div>
          )}

          {/* Search */}
          <div style={styles.searchWrapper}>
            <input
              style={styles.searchInput}
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Unlink option */}
          {currentCampaignName && (
            <button
              style={styles.unlinkBtn}
              onClick={handleUnlinkCampaign}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#fce4e4'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              ✕ Remove Campaign Link
            </button>
          )}

          {/* Campaign list */}
          <div style={styles.list}>
            {loading && (
              <div style={styles.emptyState}>Loading campaigns...</div>
            )}

            {!loading && filtered.length === 0 && connected && (
              <div style={styles.emptyState}>No campaigns found</div>
            )}

            {filtered.map((c) => (
              <button
                key={c.id}
                style={{
                  ...styles.item,
                  ...(c.id === journey?.sf_campaign_id ? styles.itemSelected : {}),
                }}
                onClick={() => handleSelectCampaign(c)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    c.id === journey?.sf_campaign_id ? '#f0f7ff' : 'none';
                }}
              >
                <div style={styles.itemMain}>
                  <span style={styles.itemName}>
                    {c.id === journey?.sf_campaign_id && '✓ '}
                    {c.name}
                  </span>
                  {c.memberCount > 0 && (
                    <span style={styles.itemCount}>
                      {c.memberCount.toLocaleString()} members
                    </span>
                  )}
                </div>
                <div style={styles.itemMeta}>
                  {c.status && <span>{c.status}</span>}
                  {c.type && <span> · {c.type}</span>}
                </div>
              </button>
            ))}
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
    color: '#6b7280',
    cursor: 'pointer',
    maxWidth: '220px',
    transition: 'all 0.15s ease',
  },
  triggerLinked: {
    color: '#181818',
    borderColor: '#0176d3',
    background: '#f0f7ff',
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
  createSection: {
    padding: '8px',
    borderBottom: '1px solid #f1f5f9',
  },
  createNewBtn: {
    display: 'block',
    width: '100%',
    padding: '8px 10px',
    background: '#f0f7ff',
    border: '1px dashed #0176d3',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#0176d3',
    cursor: 'pointer',
    textAlign: 'left',
  },
  createForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  createInput: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #0176d3',
    borderRadius: '6px',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  createActions: {
    display: 'flex',
    gap: '6px',
  },
  createSubmitBtn: {
    flex: 1,
    padding: '6px 10px',
    background: '#0176d3',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  createCancelBtn: {
    padding: '6px 10px',
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e5e5e5',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
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
  unlinkBtn: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '12px',
    color: '#ea001e',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.1s',
  },
  list: {
    maxHeight: '240px',
    overflowY: 'auto',
    padding: '4px 0',
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
  itemSelected: {
    background: '#f0f7ff',
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
