import { useState, useEffect } from 'react';
import useJourneyStore from '../store/journeyStore';

/**
 * Hook to load and provide Salesforce Canvas context.
 *
 * In production (inside Canvas iframe):
 *   - Reads window.__CANVAS_CONTEXT__ set by the server-rendered page
 *   - Falls back to fetching /canvas/context from the session
 *
 * In development:
 *   - Returns a mock context for local development
 */
export function useCanvasContext() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const setCanvasContext = useJourneyStore((s) => s.setCanvasContext);
  const canvasContext = useJourneyStore((s) => s.canvasContext);

  useEffect(() => {
    async function loadContext() {
      try {
        // Check if Canvas context was injected by server
        if (window.__CANVAS_CONTEXT__) {
          setCanvasContext(window.__CANVAS_CONTEXT__);
          setLoading(false);
          return;
        }

        // Try fetching from session
        const res = await fetch('/canvas/context');
        if (res.ok) {
          const ctx = await res.json();
          setCanvasContext(ctx);
          setLoading(false);
          return;
        }

        // Dev mode fallback
        if (process.env.NODE_ENV === 'development') {
          setCanvasContext({
            orgId: '00Dxx0000000000',
            orgName: 'Dev Org',
            userId: '005xx0000000000',
            userName: 'developer@example.com',
            fullName: 'Developer User',
            instanceUrl: 'https://dev-org.my.salesforce.com',
          });
          setLoading(false);
          return;
        }

        setError('No Canvas context available. Open this app from Salesforce.');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadContext();
  }, [setCanvasContext]);

  return { canvasContext, loading, error };
}
