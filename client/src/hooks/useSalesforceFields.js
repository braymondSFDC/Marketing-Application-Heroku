import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to fetch and cache Salesforce object field descriptions.
 * Used by the Personalization Engine field picker.
 */
export function useSalesforceFields(objectName) {
  const [fields, setFields] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFields = useCallback(async (objName) => {
    if (!objName) return;

    // Check cache first
    const cacheKey = `sf_fields_${objName}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setFields(JSON.parse(cached));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/fields/${objName}`);
      if (!res.ok) throw new Error('Failed to fetch fields');

      const data = await res.json();
      setFields(data);

      // Cache for the session
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFields(objectName);
  }, [objectName, fetchFields]);

  return { fields, loading, error, refetch: () => fetchFields(objectName) };
}
