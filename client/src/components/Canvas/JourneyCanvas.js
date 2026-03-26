import React, { useCallback, useEffect, useRef } from 'react';
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
import WaitNode from './nodes/WaitNode';
import SplitNode from './nodes/SplitNode';
import ConditionNode from './nodes/ConditionNode';
import ExitNode from './nodes/ExitNode';
import ConditionalEdge from './edges/ConditionalEdge';

import BuildPanel from '../Sidebar/BuildPanel';
import NodeConfig from '../Sidebar/NodeConfig';
import LiveStats from '../Sidebar/LiveStats';
import JourneyHeader from '../TopBar/JourneyHeader';

const nodeTypes = {
  trigger: TriggerNode,
  email: EmailNode,
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

  // Zustand store — used for persistence and cross-component access
  const storeNodes = useJourneyStore((s) => s.nodes);
  const storeEdges = useJourneyStore((s) => s.edges);
  const setStoreNodes = useJourneyStore((s) => s.setNodes);
  const setStoreEdges = useJourneyStore((s) => s.setEdges);
  const selectedNode = useJourneyStore((s) => s.selectedNode);
  const selectNode = useJourneyStore((s) => s.selectNode);

  // React Flow's own state — the rendering source of truth.
  // Initialized from the store on mount. RF manages internal properties
  // (measured, width, height, etc.) that must not be stripped.
  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodesToRF(storeNodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdgesToRF(storeEdges));

  // Sync RF state → Zustand store (for persistence / cross-component reads).
  // Use a ref to avoid infinite loops — only sync when RF state actually changes.
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

  const onConnect = useCallback((params) => {
    setEdges((eds) =>
      addEdge(
        { ...params, animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } },
        eds
      )
    );
  }, [setEdges]);

  const onNodeClick = useCallback((_event, node) => {
    selectNode(node.id);
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

    // Add directly to RF state — the useEffect sync will push it to the store
    setNodes((nds) => [...nds, newNode]);
  }, [screenToFlowPosition, setNodes]);

  return (
    <div style={styles.container}>
      <JourneyHeader journey={journey} onBack={onBack} />

      <div style={styles.workspace}>
        <BuildPanel />

        <div style={styles.canvas}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
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
