import { useState, useRef, useCallback } from "react";
import FlowNode from "./FlowNode";

export default function FlowCanvas({ nodes, onAddNode, onUpdateNode, onDeleteNode, onConnect }) {
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e, nodeId) => {
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDragging(nodeId);
    setOffset({ x: e.clientX - node.x, y: e.clientY - node.y });
  }, [nodes]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, e.clientX - offset.x);
    const y = Math.max(0, e.clientY - offset.y);
    onUpdateNode(dragging, { x, y });
  }, [dragging, offset, onUpdateNode]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  // Draw SVG connection lines between nodes
  const connections = [];
  nodes.forEach((node) => {
    if (node.nextId) {
      const next = nodes.find(n => n.id === node.nextId);
      if (next) {
        const x1 = node.x + 160;
        const y1 = node.y + 44;
        const x2 = next.x;
        const y2 = next.y + 44;
        connections.push({ id: `${node.id}-${next.id}`, x1, y1, x2, y2 });
      }
    }
  });

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full overflow-auto bg-slate-50"
      style={{
        backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        minHeight: 600,
        cursor: dragging ? "grabbing" : "default",
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* SVG lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        {connections.map(c => (
          <g key={c.id}>
            <path
              d={`M${c.x1},${c.y1} C${c.x1 + 60},${c.y1} ${c.x2 - 60},${c.y2} ${c.x2},${c.y2}`}
              fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6 3"
            />
            <circle cx={c.x1} cy={c.y1} r={4} fill="#3b82f6" />
            <circle cx={c.x2} cy={c.y2} r={4} fill="#3b82f6" />
          </g>
        ))}
      </svg>

      {/* Nodes */}
      {nodes.map(node => (
        <FlowNode
          key={node.id}
          node={node}
          allNodes={nodes}
          onMouseDown={(e) => handleMouseDown(e, node.id)}
          onUpdate={(data) => onUpdateNode(node.id, data)}
          onDelete={() => onDeleteNode(node.id)}
          onConnect={onConnect}
        />
      ))}

      {/* Add node button (bottom center) */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto">
              <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" className="w-8 h-8">
                <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <p className="text-slate-500 font-medium text-sm">Clique em "+ Adicionar nó" para começar</p>
          </div>
        </div>
      )}
    </div>
  );
}