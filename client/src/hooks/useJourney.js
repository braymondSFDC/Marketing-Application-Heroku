import { useCallback, useEffect, useRef } from 'react';
import useJourneyStore from '../store/journeyStore';

/**
 * Hook for journey CRUD operations with auto-save debouncing.
 */
export function useJourney(journeyId) {
  const loadJourney = useJourneyStore((s) => s.loadJourney);
  const saveCanvas = useJourneyStore((s) => s.saveCanvas);
  const nodes = useJourneyStore((s) => s.nodes);
  const edges = useJourneyStore((s) => s.edges);
  const currentJourney = useJourneyStore((s) => s.currentJourney);

  const saveTimerRef = useRef(null);

  // Load journey on mount
  useEffect(() => {
    if (journeyId) {
      loadJourney(journeyId);
    }
  }, [journeyId, loadJourney]);

  // Auto-save debounce (2 seconds after last change)
  const scheduleAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveCanvas();
    }, 2000);
  }, [saveCanvas]);

  // Trigger auto-save when nodes or edges change
  useEffect(() => {
    if (currentJourney && (nodes.length > 0 || edges.length > 0)) {
      scheduleAutoSave();
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [nodes, edges, currentJourney, scheduleAutoSave]);

  return {
    journey: currentJourney,
    nodes,
    edges,
    save: saveCanvas,
  };
}
