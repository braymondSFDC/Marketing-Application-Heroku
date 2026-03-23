import React, { useState, useEffect } from 'react';
import { useCanvasContext } from './hooks/useCanvasContext';
import useJourneyStore from './store/journeyStore';
import JourneyCanvas from './components/Canvas/JourneyCanvas';
import JourneyList from './components/JourneyList';

export default function App() {
  const { canvasContext, loading: ctxLoading, error: ctxError } = useCanvasContext();
  const [view, setView] = useState('list'); // 'list' or 'canvas'
  const [activeJourneyId, setActiveJourneyId] = useState(null);
  const fetchJourneys = useJourneyStore((s) => s.fetchJourneys);

  useEffect(() => {
    if (canvasContext) {
      fetchJourneys();
    }
  }, [canvasContext, fetchJourneys]);

  if (ctxLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Connecting to Salesforce...</p>
      </div>
    );
  }

  if (ctxError) {
    return (
      <div style={styles.errorContainer}>
        <h2 style={styles.errorTitle}>Connection Error</h2>
        <p style={styles.errorText}>{ctxError}</p>
      </div>
    );
  }

  if (view === 'canvas' && activeJourneyId) {
    return (
      <JourneyCanvas
        journeyId={activeJourneyId}
        onBack={() => {
          setView('list');
          setActiveJourneyId(null);
          fetchJourneys();
        }}
      />
    );
  }

  return (
    <JourneyList
      onSelectJourney={(id) => {
        setActiveJourneyId(id);
        setView('canvas');
      }}
    />
  );
}

const styles = {
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: '16px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e5e5e5',
    borderTopColor: '#0176d3',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: '14px',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: '8px',
  },
  errorTitle: {
    color: '#ea001e',
    fontSize: '18px',
  },
  errorText: {
    color: '#6b7280',
    fontSize: '14px',
  },
};
