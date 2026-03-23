import React, { useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  addEdge,
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

export default function JourneyCanvas({ journeyId, onBack }) {
  const reactFlowRef = useRef(null);
  const { journey } = useJourney(journeyId);
  useRealtimeStats(journeyId);

  const storeNodes = useJourneyStore((s) => s.nodes);
  const storeEdges = useJourneyStore((s) => s.edges);
  const setStoreNodes = useJourneyStore((s) => s.setNodes);
  const setStoreEdges = useJourneyStore((s) => s.setEdges);
  const selectedNode = useJourneyStore((s) => s.selectedNode);
  const selectNode = useJourneyStore((s) => s.selectNode);

  // Convert stored nodes to React Flow format
  const initialNodes = useMemo(() =>
    storeNodes.map((n) => ({
      id: n.id,
      type: n.node_type || n.type || 'trigger',
      position: { x: n.position_x ?? n.position?.x ?? 0, y: n.position_y ?? n.position?.y ?? 0 },
      data: n.config || n.data || {},
    })),
    [storeNodes]
  );

  const initialEdges = useMemo(() =>
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

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync local state back to store
  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    setStoreNodes((prev) => {
      const updated = [...prev];
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          const idx = updated.findIndex((n) => n.id === change.id);
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], position_x: change.position.x, position_y: change.position.y };
          }
        }
      }
      return updated;
    });
  }, [onNodesChange, setStoreNodes]);

  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } }, eds));
    setStoreEdges((prev) => [
      ...prev,
      {
        id: `e-${params.source}-${params.target}`,
        source_node_id: params.source,
        target_node_id: params.target,
        source: params.source,
        target: params.target,
      },
    ]);
  }, [setEdges, setStoreEdges]);

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

    const position = reactFlowRef.current?.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    }) || { x: event.clientX, y: event.clientY };

    const newNode = {
      id: `${type}-${Date.now()}`,
      type,
      position,
      data: { name: `New ${type}` },
    };

    setNodes((nds) => [...nds, newNode]);
    setStoreNodes((prev) => [
      ...prev,
      {
        id: newNode.id,
        node_type: type,
        position_x: position.x,
        position_y: position.y,
        config: newNode.data,
      },
    ]);
  }, [setNodes, setStoreNodes]);

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
            ref={reactFlowRef}
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
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
