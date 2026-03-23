import React from 'react';

const NODE_CATEGORIES = [
  {
    title: 'Triggers',
    items: [
      { type: 'trigger', icon: '⚡', label: 'Segment', description: 'Entry based on segment criteria' },
    ],
  },
  {
    title: 'Actions',
    items: [
      { type: 'email', icon: '✉️', label: 'Email', description: 'Send an email' },
    ],
  },
  {
    title: 'Logic',
    items: [
      { type: 'condition', icon: '◆', label: 'Condition', description: 'Branch on field criteria' },
      { type: 'split', icon: '⑂', label: 'A/B Split', description: 'Random percentage split' },
      { type: 'wait', icon: '⏱', label: 'Wait', description: 'Delay for a period' },
      { type: 'exit', icon: '🔚', label: 'Exit', description: 'End journey path' },
    ],
  },
];

export default function BuildPanel() {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div style={styles.panel}>
      <div style={styles.panelTitle}>Build</div>
      {NODE_CATEGORIES.map((cat) => (
        <div key={cat.title} style={styles.category}>
          <div style={styles.categoryTitle}>{cat.title}</div>
          {cat.items.map((item) => (
            <div
              key={item.type}
              style={styles.nodeItem}
              draggable
              onDragStart={(e) => onDragStart(e, item.type)}
            >
              <span style={styles.nodeIcon}>{item.icon}</span>
              <div>
                <div style={styles.nodeLabel}>{item.label}</div>
                <div style={styles.nodeDesc}>{item.description}</div>
              </div>
            </div>
          ))}
        </div>
      ))}
      <div style={styles.hint}>
        Drag and drop nodes onto the canvas to build your journey.
      </div>
    </div>
  );
}

const styles = {
  panel: {
    width: '220px',
    borderRight: '1px solid #e5e5e5',
    background: '#fff',
    padding: '16px',
    overflowY: 'auto',
  },
  panelTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '16px',
  },
  category: {
    marginBottom: '20px',
  },
  categoryTitle: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  nodeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: '8px',
    cursor: 'grab',
    transition: 'background 0.1s',
    marginBottom: '4px',
    border: '1px solid transparent',
    background: '#f8fafc',
  },
  nodeIcon: {
    fontSize: '18px',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#181818',
  },
  nodeDesc: {
    fontSize: '11px',
    color: '#94a3b8',
    marginTop: '1px',
  },
  hint: {
    fontSize: '12px',
    color: '#94a3b8',
    textAlign: 'center',
    padding: '16px 0',
    borderTop: '1px solid #f1f5f9',
    marginTop: '8px',
  },
};
