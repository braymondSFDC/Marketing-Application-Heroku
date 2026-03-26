import { create } from 'zustand';

const API_BASE = '/api';

const useJourneyStore = create((set, get) => ({
  // ── Journey state ──
  journeys: [],
  currentJourney: null,
  nodes: [],
  edges: [],
  selectedNode: null,
  status: 'idle', // idle, loading, saving, launching, error

  // ── Canvas context (from Salesforce) ──
  canvasContext: null,

  // ── Live stats ──
  stats: { overall: {}, byNode: {} },

  // ── Launch progress ──
  launchProgress: null,

  // ── Actions ──

  setCanvasContext: (ctx) => set({ canvasContext: ctx }),

  // Fetch all journeys for this org
  fetchJourneys: async () => {
    set({ status: 'loading' });
    try {
      const res = await fetch(`${API_BASE}/journeys`);
      const data = await res.json();
      set({ journeys: data.journeys || [], status: 'idle' });
    } catch (err) {
      console.error('Failed to fetch journeys:', err);
      set({ status: 'error' });
    }
  },

  // Load a specific journey with nodes and edges
  loadJourney: async (id) => {
    set({ status: 'loading' });
    try {
      const res = await fetch(`${API_BASE}/journeys/${id}`);
      const data = await res.json();
      set({
        currentJourney: data.journey,
        nodes: data.nodes || [],
        edges: data.edges || [],
        status: 'idle',
      });
    } catch (err) {
      console.error('Failed to load journey:', err);
      set({ status: 'error' });
    }
  },

  // Create a new journey
  createJourney: async (journeyData) => {
    set({ status: 'saving' });
    try {
      const res = await fetch(`${API_BASE}/journeys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(journeyData),
      });
      const data = await res.json();
      set((state) => ({
        journeys: [data.journey, ...state.journeys],
        currentJourney: data.journey,
        nodes: [],
        edges: [],
        status: 'idle',
      }));
      return data.journey;
    } catch (err) {
      console.error('Failed to create journey:', err);
      set({ status: 'error' });
    }
  },

  // Save entire canvas state
  saveCanvas: async () => {
    const { currentJourney, nodes, edges } = get();
    if (!currentJourney) return;

    set({ status: 'saving' });
    try {
      await fetch(`${API_BASE}/journeys/${currentJourney.id}/canvas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: nodes.map((n) => ({
            id: n.id,
            node_type: n.type || n.node_type,
            position_x: n.position?.x ?? n.position_x,
            position_y: n.position?.y ?? n.position_y,
            config: n.data || n.config || {},
          })),
          edges: edges.map((e) => ({
            id: e.id,
            source_node_id: e.source,
            target_node_id: e.target,
            label: e.label,
          })),
          canvas_state: { nodes, edges },
        }),
      });
      set({ status: 'idle' });
    } catch (err) {
      console.error('Failed to save canvas:', err);
      set({ status: 'error' });
    }
  },

  // React Flow onChange handlers
  setNodes: (nodesOrFn) => {
    set((state) => ({
      nodes: typeof nodesOrFn === 'function' ? nodesOrFn(state.nodes) : nodesOrFn,
    }));
  },

  setEdges: (edgesOrFn) => {
    set((state) => ({
      edges: typeof edgesOrFn === 'function' ? edgesOrFn(state.edges) : edgesOrFn,
    }));
  },

  addNode: (node) => {
    set((state) => ({ nodes: [...state.nodes, node] }));
  },

  selectNode: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId) || null;
    set({ selectedNode: node });
  },

  updateNodeConfig: (nodeId, config) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...config } } : n
      ),
    }));
  },

  // Rename a journey
  renameJourney: async (id, newName) => {
    try {
      const res = await fetch(`${API_BASE}/journeys/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      set((state) => ({
        journeys: state.journeys.map((j) =>
          j.id === id ? { ...j, name: newName } : j
        ),
        currentJourney:
          state.currentJourney?.id === id
            ? { ...state.currentJourney, name: newName }
            : state.currentJourney,
      }));
      return data.journey;
    } catch (err) {
      console.error('Failed to rename journey:', err);
    }
  },

  // Delete a journey
  deleteJourney: async (id) => {
    try {
      await fetch(`${API_BASE}/journeys/${id}`, { method: 'DELETE' });
      set((state) => ({
        journeys: state.journeys.filter((j) => j.id !== id),
        currentJourney:
          state.currentJourney?.id === id ? null : state.currentJourney,
      }));
    } catch (err) {
      console.error('Failed to delete journey:', err);
    }
  },

  // Launch journey
  launchJourney: async () => {
    const { currentJourney } = get();
    if (!currentJourney) return;

    set({ status: 'launching', launchProgress: { step: 0, message: 'Initiating launch...' } });
    try {
      const res = await fetch(`${API_BASE}/journeys/${currentJourney.id}/launch`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Launch failed');
      }

      return data;
    } catch (err) {
      console.error('Failed to launch journey:', err);
      set({ status: 'error', launchProgress: { step: 0, message: err.message } });
      throw err;
    }
  },

  // Update launch progress (from WebSocket)
  setLaunchProgress: (progress) => set({ launchProgress: progress }),

  // Update stats (from WebSocket)
  updateStats: (newStats) => set({ stats: newStats }),

  updateNodeStats: (nodeId, eventType) => {
    set((state) => {
      const byNode = { ...state.stats.byNode };
      if (!byNode[nodeId]) byNode[nodeId] = {};
      byNode[nodeId][eventType] = (byNode[nodeId][eventType] || 0) + 1;

      const overall = { ...state.stats.overall };
      overall[eventType] = (overall[eventType] || 0) + 1;

      return { stats: { overall, byNode } };
    });
  },
}));

export default useJourneyStore;
