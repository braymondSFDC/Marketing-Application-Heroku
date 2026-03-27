import React, { useState, useEffect } from 'react';

/**
 * SalesforceConnect — Shows Salesforce connection status and
 * provides a button to connect via OAuth or disconnect.
 */
export default function SalesforceConnect() {
  const [status, setStatus] = useState({ connected: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/auth/status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch auth status:', err);
    }
    setLoading(false);
  };

  const handleConnect = () => {
    // Redirect to Salesforce OAuth — the server handles the flow
    window.location.href = '/auth/salesforce';
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/auth/disconnect', { method: 'POST' });
      setStatus({ connected: false });
      // Reload to clear any cached SF data
      window.location.reload();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  if (loading) return null;

  if (status.connected) {
    return (
      <div style={styles.connectedContainer}>
        <div style={styles.connectedBadge}>
          <span style={styles.greenDot} />
          <span style={styles.connectedText}>
            Connected as {status.fullName || status.userName}
          </span>
        </div>
        <button style={styles.disconnectBtn} onClick={handleDisconnect} title="Disconnect from Salesforce">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button style={styles.connectBtn} onClick={handleConnect}>
      🔐 Connect to Salesforce
    </button>
  );
}

const styles = {
  connectBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: '#0176d3',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background 0.15s ease',
  },
  connectedContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  connectedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: '#e6f9ec',
    borderRadius: '8px',
    border: '1px solid #c8ecd2',
  },
  greenDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#2e844a',
    flexShrink: 0,
  },
  connectedText: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#2e844a',
    whiteSpace: 'nowrap',
  },
  disconnectBtn: {
    padding: '6px 10px',
    background: 'none',
    color: '#6b7280',
    border: '1px solid #e5e5e5',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
