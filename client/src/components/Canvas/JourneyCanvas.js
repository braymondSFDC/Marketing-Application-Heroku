import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
  addEdge,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
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

/* ── Inner component that has access to useReactFlow() ── */
function CanvasInner({ journeyId, onBack }) {
  const { journey } = useJourney(journeyId);
  useRealtimeStats(journeyId);
  const { screenToFlowPosition } = useReactFlow();

  const storeNodes = useJourneyStore((s) => s.nodes);
  const storeEdges = useJourneyStore((s) => s.edges);
  const setStoreNodes = useJourneyStore((s) => s.setNodes);
  const setStoreEdges = useJourneyStore((s) => s.setEdges);
  const selectedNode = useJourneyStore((s) => s.selectedNode);
  const selectNode = useJourneyStore((s) => s.selectNode);

  // Derive React Flow nodes from Zustand store (single source of truth)
  const rfNodes = useMemo(() =>
    storeNodes.map((n) => ({
      id: n.id,
      type: n.node_type || n.type || 'trigger',
      position: { x: n.position_x ?? n.position?.x ?? 0, y: n.position_y ?? n.position?.y ?? 0 },
      data: n.config || n.data || {},
    })),
    [storeNodes]
  );

  const rfEdges = useMemo(() =>
    storeEdges.map((e) => ({
      id: e.id,
      source: e.source_node_id || e.source,
      target: e.target_node_id || e.target,
      label: e.label,
      type: e.label ? 'conditional' : 'default',
      animated: true,
      style: { stroke: '#94a3b8', strokeWidth: 2 },
    })),
    [storeEdges]
  );

  // Controlled-mode change handlers — write directly to Zustand
  const onNodesChange = useCallback((changes) => {
    setStoreNodes((prev) => {
      // Convert store nodes to RF format, apply changes, then convert back
      const rfPrev = prev.map((n) => ({
        id: n.id,
        type: n.node_type || n.type || 'trigger',
        position: { x: n.position_x ?? n.position?.x ?? 0, y: n.position_y ?? n.position?.y ?? 0 },
        data: n.config || n.data || {},
      }));
      const rfNext = applyNodeChanges(changes, rfPrev);
      return rfNext.map((rf) => {
        // Preserve any extra store fields from the original node
        const orig = prev.find((n) => n.id === rf.id) || {};
        return {
          ...orig,
          id: rf.id,
          node_type: rf.type,
          type: rf.type,
          position_x: rf.position.x,
          position_y: rf.position.y,
          config: rf.data,
          data: rf.data,
        };
      });
    });
  }, [setStoreNodes]);

  const onEdgesChange = useCallback((changes) => {
    setStoreEdges((prev) => {
      const rfPrev = prev.map((e) => ({
        id: e.id,
        source: e.source_node_id || e.source,
        target: e.target_node_id || e.target,
        label: e.label,
        type: e.label ? 'conditional' : 'default',
        animated: true,
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      }));
      const rfNext = applyEdgeChanges(changes, rfPrev);
      return rfNext.map((rf) => {
        const orig = prev.find((e) => e.id === rf.id) || {};
        return {
          ...orig,
          id: rf.id,
          source_node_id: rf.source,
          target_node_id: rf.target,
          source: rf.source,
          target: rf.target,
          label: rf.label,
        };
      });
    });
  }, [setStoreEdges]);

  const onConnect = useCallback((params) => {
    setStoreEdges((prev) => {
      const rfPrev = prev.map((e) => ({
        id: e.id,
        source: e.source_node_id || e.source,
        target: e.target_node_id || e.target,
        animated: true,
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      }));
      const rfNext = addEdge({ ...params, animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } }, rfPrev);
      return rfNext.map((rf) => ({
        id: rf.id,
        source_node_id: rf.source,
        target_node_id: rf.target,
        source: rf.source,
        target: rf.target,
        label: rf.label,
      }));
    });
  }, [setStoreEdges]);

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

    // Use the useReactFlow hook's screenToFlowPosition (works in v12)
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const newNode = {
      id: `${type}-${Date.now()}`,
      node_type: type,
      type,
      position_x: position.x,
      position_y: position.y,
      config: { name: `New ${type}` },
      data: { name: `New ${type}` },
    };

    setStoreNodes((prev) => [...prev, newNode]);
  }, [screenToFlowPosition, setStoreNodes]);

  return (
    <div style={styles.container}>
      {/* Top Bar */}
      <JourneyHeader journey={journey} onBack={onBack} />

      <div style={styles.workspace}>
        {/* Left: Build Panel */}
        <BuildPanel />

        {/* Center: React Flow Canvas */}
        <div style={styles.canvas}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
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

        {/* Right: Config Panel or Live Stats */}
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
  },
  rightPanel: {
    width: '280px',
    borderLeft: '1px solid #e5e5e5',
    background: '#fff',
    overflowY: 'auto',
  },
};
