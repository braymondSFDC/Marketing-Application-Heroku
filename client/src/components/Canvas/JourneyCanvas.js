import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
  addEdge,
  useReactFlow,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useJourney } from '../../hooks/useJourney';
import { useRealtimeStats } from '../../hooks/useRealtimeStats';
import useJourneyStore from '../../store/journeyStore';

import TriggerNode from './nodes/TriggerNode';
import EmailNode from './nodes/EmailNode';
import SmsNode from './nodes/SmsNode';
import WaitNode from './nodes/WaitNode';
import SplitNode from './nodes/SplitNode';
import ConditionNode from './nodes/ConditionNode';
import ExitNode from './nodes/ExitNode';
import ConditionalEdge from './edges/ConditionalEdge';

import BuildPanel from '../Sidebar/BuildPanel';
import NodeConfig from '../Sidebar/NodeConfig';
import LiveStats from '../Sidebar/LiveStats';
import JourneyHeader from '../TopBar/JourneyHeader';

/* ── Undo / Redo hook ── */
function useUndoRedo(nodes, edges, setNodes, setEdges) {
  const past = useRef([]);
  const future = useRef([]);
  const skipRecord = useRef(false);

  // Record snapshot whenever nodes/edges change (debounced)
  const recordTimer = useRef(null);
  useEffect(() => {
    if (skipRecord.current) { skipRecord.current = false; return; }
    clearTimeout(recordTimer.current);
    recordTimer.current = setTimeout(() => {
      const snap = JSON.stringify({ nodes, edges });
      const lastSnap = past.current[past.current.length - 1];
      if (snap !== lastSnap) {
        past.current.push(snap);
        if (past.current.length > 50) past.current.shift();
        future.current = [];
      }
    }, 300);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (past.current.length < 2) return; // need at least 2: prev + current
    const current = past.current.pop();
    future.current.push(current);
    const prev = past.current[past.current.length - 1];
    const { nodes: pn, edges: pe } = JSON.parse(prev);
    skipRecord.current = true;
    setNodes(pn);
    setEdges(pe);
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    const next = future.current.pop();
    past.current.push(next);
    const { nodes: nn, edges: ne } = JSON.parse(next);
    skipRecord.current = true;
    setNodes(nn);
    setEdges(ne);
  }, [setNodes, setEdges]);

  const canUndo = past.current.length >= 2;
  const canRedo = future.current.length > 0;

  return { undo, redo, canUndo, canRedo };
}

const nodeTypes = {
  trigger: TriggerNode,
  email: EmailNode,
  sms: SmsNode,
  wait: WaitNode,
  split: SplitNode,
  condition: ConditionNode,
  exit: ExitNode,
};

const edgeTypes = {
  conditional: ConditionalEdge,
};

/**
 * Convert store nodes → React Flow format (for initial load only).
 */
function storeNodesToRF(storeNodes) {
  return storeNodes.map((n) => ({
    id: n.id,
    type: n.node_type || n.type || 'trigger',
    position: {
      x: n.position_x ?? n.position?.x ?? 0,
      y: n.position_y ?? n.position?.y ?? 0,
    },
    data: n.config || n.data || {},
  }));
}

function storeEdgesToRF(storeEdges) {
  return storeEdges.map((e) => ({
    id: e.id,
    source: e.source_node_id || e.source,
    target: e.target_node_id || e.target,
    label: e.label,
    type: e.label ? 'conditional' : 'default',
    animated: true,
    style: { stroke: '#94a3b8', strokeWidth: 2 },
  }));
}

/* ── Inner component that has access to useReactFlow() ── */
function CanvasInner({ journeyId, onBack }) {
  const { journey } = useJourney(journeyId);
  useRealtimeStats(journeyId);
  const { screenToFlowPosition } = useReactFlow();
  const storeStatus = useJourneyStore((s) => s.status);

  // Zustand store — used for persistence and cross-component access
  const storeNodes = useJourneyStore((s) => s.nodes);
  const storeEdges = useJourneyStore((s) => s.edges);
  const setStoreNodes = useJourneyStore((s) => s.setNodes);
  const setStoreEdges = useJourneyStore((s) => s.setEdges);
  const selectedNode = useJourneyStore((s) => s.selectedNode);
  const selectNode = useJourneyStore((s) => s.selectNode);
  const saveCanvas = useJourneyStore((s) => s.saveCanvas);

  // React Flow's own state — the rendering source of truth.
  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodesToRF(storeNodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdgesToRF(storeEdges));

  // Register RF setNodes with the store so updateNodeConfig can push data changes to the canvas
  const registerRFSetNodes = useJourneyStore((s) => s.registerRFSetNodes);
  useEffect(() => {
    registerRFSetNodes(setNodes);
    return () => registerRFSetNodes(null);
  }, [setNodes, registerRFSetNodes]);

  // Undo / Redo
  const { undo, redo, canUndo, canRedo } = useUndoRedo(nodes, edges, setNodes, setEdges);

  // Track dirty state for save indicator
  const [isDirty, setIsDirty] = useState(false);
  const initialSnap = useRef(JSON.stringify({ nodes: storeNodesToRF(storeNodes), edges: storeEdgesToRF(storeEdges) }));
  useEffect(() => {
    try {
      const snap = JSON.stringify({ n: nodes.map(n => n.id + n.type + (n.position?.x ?? 0) + (n.position?.y ?? 0)), e: edges.map(e => e.id) });
      const parsed = JSON.parse(initialSnap.current);
      const init = JSON.stringify({ n: (parsed.nodes || []).map(n => n.id + n.type + (n.position?.x ?? 0) + (n.position?.y ?? 0)), e: (parsed.edges || []).map(e => e.id) });
      setIsDirty(snap !== init);
    } catch (err) { /* ignore during initial render */ }
  }, [nodes, edges]);

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Shift+Z / Ctrl+Y = redo, Ctrl+S = save
  useEffect(() => {
    const handler = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if (mod && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Sync RF state → Zustand store (for persistence / cross-component reads).
  const syncTimer = useRef(null);
  useEffect(() => {
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      setStoreNodes(
        nodes.map((n) => ({
          id: n.id,
          node_type: n.type,
          type: n.type,
          position_x: n.position.x,
          position_y: n.position.y,
          config: n.data,
          data: n.data,
        }))
      );
    }, 200);
  }, [nodes, setStoreNodes]);

  useEffect(() => {
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      setStoreEdges(
        edges.map((e) => ({
          id: e.id,
          source_node_id: e.source,
          target_node_id: e.target,
          source: e.source,
          target: e.target,
          label: e.label,
        }))
      );
    }, 200);
  }, [edges, setStoreEdges]);

  // Save canvas to server
  const handleSave = useCallback(async () => {
    // Wait for sync to finish, then save
    await new Promise((r) => setTimeout(r, 300));
    await saveCanvas();
    initialSnap.current = JSON.stringify({ nodes, edges });
    setIsDirty(false);
  }, [saveCanvas, nodes, edges]);

  const onConnect = useCallback((params) => {
    setEdges((eds) =>
      addEdge(
        { ...params, animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } },
        eds
      )
    );
  }, [setEdges]);

  // Click on an edge to delete it
  const onEdgeClick = useCallback((_event, edge) => {
    setEdges((eds) => eds.filter((e) => e.id !== edge.id));
  }, [setEdges]);

  const onNodeClick = useCallback((_event, node) => {
    // Pass the full RF node directly so selectedNode always has fresh data
    selectNode(node.id, node);
  }, [selectNode]);

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // Handle drag-and-drop from BuildPanel
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const newNode = {
      id: `${type}-${Date.now()}`,
      type,
      position,
      data: { name: `New ${type}` },
    };

    setNodes((nds) => [...nds, newNode]);
  }, [screenToFlowPosition, setNodes]);

  // Show loading state while journey is being fetched
  if (!journey && storeStatus === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e5e5e5', borderTopColor: '#0176d3', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading journey...</p>
      </div>
    );
  }

  // If journey failed to load, show error with back button
  if (!journey && storeStatus !== 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '16px' }}>
        <p style={{ color: '#ea001e', fontSize: '16px' }}>Failed to load journey</p>
        <button onClick={onBack} style={{ background: '#0176d3', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' }}>
          ← Back to Journeys
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <JourneyHeader
        journey={journey}
        onBack={onBack}
        onSave={handleSave}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        isDirty={isDirty}
      />

      <div style={styles.workspace}>
        <BuildPanel />

        <div style={styles.canvas}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            deleteKeyCode="Backspace"
            snapToGrid
            snapGrid={[16, 16]}
          >
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                const colors = {
                  trigger: '#0176d3',
                  email: '#7c3aed',
                  sms: '#16a34a',
                  wait: '#f59e0b',
                  split: '#06b6d4',
                  condition: '#f97316',
                  exit: '#6b7280',
                };
                return colors[n.type] || '#94a3b8';
              }}
              maskColor="rgba(0,0,0,0.08)"
            />
            <Background variant="dots" gap={16} size={1} color="#ddd" />
          </ReactFlow>
        </div>

        <div style={styles.rightPanel}>
          {selectedNode ? (
            <NodeConfig node={selectedNode} />
          ) : (
            <LiveStats journeyId={journeyId} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Exported wrapper provides ReactFlowProvider ── */
export default function JourneyCanvas({ journeyId, onBack }) {
  return (
    <ReactFlowProvider>
      <CanvasInner journeyId={journeyId} onBack={onBack} />
    </ReactFlowProvider>
  );
}

const styles = {
  container: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  workspace: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  rightPanel: {
    width: '280px',
    borderLeft: '1px solid #e5e5e5',
    background: '#fff',
    overflowY: 'auto',
  },
};
