import React from 'react';
import { getBezierPath, EdgeLabelRenderer } from '@xyflow/react';

export default function ConditionalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style = {},
  markerEnd,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        style={{ ...defaultStyle, ...style }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: '11px',
              fontWeight: '600',
              color: label === 'Yes' || label === 'true' ? '#2e844a' : '#ea001e',
              background: '#fff',
              padding: '2px 8px',
              borderRadius: '10px',
              border: '1px solid #e5e5e5',
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const defaultStyle = {
  stroke: '#94a3b8',
  strokeWidth: 2,
};
