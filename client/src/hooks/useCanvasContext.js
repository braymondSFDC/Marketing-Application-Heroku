import { useState, useEffect } from 'react';
import useJourneyStore from '../store/journeyStore';

/**
 * Hook to load and provide application context.
 *
 * Standalone mode:
 *   - Fetches context from /auth/context (session-based, auto-initialized)
 *   - No Canvas or Salesforce dependency
 *
 * Future Canvas mode:
 *   - Reads window.__CANVAS_CONTEXT__ set by the Canvas signed-request handler
 *   - Falls back to /auth/context from the session
 */
export function useCanvasContext() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const setCanvasContext = useJourneyStore((s) => s.setCanvasContext);
  const canvasContext = useJourneyStore((s) => s.canvasContext);

  useEffect(() => {
    async function loadContext() {
      try {
        // Future Canvas support: check if context was injected by Canvas handler
        if (window.__CANVAS_CONTEXT__) {
          setCanvasContext(window.__CANVAS_CONTEXT__);
          setLoading(false);
          return;
        }

        // Standalone mode: fetch from session endpoint
        const res = await fetch('/auth/context');
        if (res.ok) {
          const ctx = await res.json();
          setCanvasContext(ctx);
          setLoading(false);
          return;
        }

        // If fetch failed, set a default context for development
        setCanvasContext({
          orgId: 'standalone-org',
          orgName: 'Marketing Journey Builder',
          userId: 'standalone-user',
          userName: 'admin@journeybuilder.app',
          fullName: 'Journey Builder Admin',
          instanceUrl: null,
        });
        setLoading(false);
      } catch (err) {
        // Even on error, allow the app to load with a default context
        setCanvasContext({
          orgId: 'standalone-org',
          orgName: 'Marketing Journey Builder',
          userId: 'standalone-user',
          userName: 'admin@journeybuilder.app',
          fullName: 'Journey Builder Admin',
          instanceUrl: null,
        });
        setLoading(false);
      }
    }

    loadContext();
  }, [setCanvasContext]);

  return { canvasContext, loading, error };
}
