import { useEffect, useRef, useState, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, Crosshair, HelpCircle, Network } from 'lucide-react';

export interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  r: number;
  color?: string;
  kind?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  lineType?: 'solid' | 'dashed' | 'dotted';
  color?: string;
}

interface StableGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectionId?: string | null;
  onSelectNode?: (id: string) => void;
  onSelectEdge?: (id: string) => void;
  onEmptyClick?: () => void;
}

export function StableGraph({
  nodes,
  edges,
  selectionId,
  onSelectNode,
  onSelectEdge,
  onEmptyClick
}: StableGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  
  // Fit graph on initial load
  useEffect(() => {
    handleFit();
  }, [nodes.length > 0]);

  // Wheel to zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = -e.deltaY * 0.002;
      const newK = Math.min(Math.max(0.1, transform.k * (1 + zoomFactor)), 5);
      
      // Calculate cursor position relative to SVG
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Keep mouse position stable during zoom
      const xs = (mouseX - transform.x) / transform.k;
      const ys = (mouseY - transform.y) / transform.k;
      
      setTransform({
        x: mouseX - xs * newK,
        y: mouseY - ys * newK,
        k: newK
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [transform]);

  // Mouse Drag to Pan
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only left click
    if ((e.target as Element).tagName !== 'svg' && (e.target as Element).tagName !== 'g') {
      // Allow clicking nodes/edges without panning immediately
    }
    
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setTransform({
      ...transform,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      onEmptyClick?.();
    }
  };

  // Controls
  const handleZoomIn = () => setTransform(prev => ({ ...prev, k: Math.min(prev.k * 1.5, 5) }));
  const handleZoomOut = () => setTransform(prev => ({ ...prev, k: Math.max(prev.k / 1.5, 0.1) }));
  
  const handleFit = () => {
    if (nodes.length === 0 || !containerRef.current) return;
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs) - 100;
    const maxX = Math.max(...xs) + 100;
    const minY = Math.min(...ys) - 100;
    const maxY = Math.max(...ys) + 100;
    
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const w = maxX - minX;
    const h = maxY - minY;
    
    if (w <= 0 || h <= 0) return;
    const k = Math.min(cw / w, ch / h) * 0.9;
    const x = (cw - w * k) / 2 - minX * k;
    const y = (ch - h * k) / 2 - minY * k;
    setTransform({ x, y, k: Math.min(k, 1) });
  };

  const handleCenterSelected = () => {
    if (!selectionId || !containerRef.current) return;
    const node = nodes.find(n => n.id === selectionId);
    if (!node) return;
    
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    
    setTransform(prev => ({
      ...prev,
      x: cw / 2 - node.x * prev.k,
      y: ch / 2 - node.y * prev.k
    }));
  };

  const handleReset = () => {
    setTransform({ x: 0, y: 0, k: 1 });
    handleFit();
  };

  // Process Edges to map coordinates
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const renderedEdges = edges.map(e => {
    const s = nodeMap.get(e.source);
    const t = nodeMap.get(e.target);
    return { ...e, sx: s?.x ?? 0, sy: s?.y ?? 0, tx: t?.x ?? 0, ty: t?.y ?? 0, valid: !!(s && t) };
  }).filter(e => e.valid);

  if (nodes.length === 0) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50">
        <Network className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-bold text-muted-foreground">NO GRAPH DATA</h2>
        <p className="text-sm text-muted-foreground/70">Import a dataset or create a Population to begin.</p>
      </div>
    );
  }

  return (
    <div 
      className="absolute inset-0 overflow-hidden bg-background select-none cursor-grab active:cursor-grabbing"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <svg 
        ref={svgRef}
        width="100%" 
        height="100%" 
        className="absolute inset-0 touch-none"
        onClick={handleBackgroundClick}
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="currentColor" className="text-muted-foreground/50" />
          </marker>
          <marker id="arrowhead-selected" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--primary))" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {/* EDGES */}
          {renderedEdges.map(edge => {
            const isSelected = selectionId === edge.id;
            const isRelated = selectionId === edge.source || selectionId === edge.target;
            
            // Adjust line styling based on requirement
            let strokeDasharray = "";
            if (edge.lineType === 'dashed') strokeDasharray = "6 4";
            if (edge.lineType === 'dotted') strokeDasharray = "2 4";

            return (
              <g key={edge.id} className="cursor-pointer group" onClick={() => onSelectEdge?.(edge.id)}>
                {/* Hit area */}
                <path 
                  d={`M ${edge.sx} ${edge.sy} L ${edge.tx} ${edge.ty}`}
                  stroke="transparent"
                  strokeWidth={20}
                  fill="none"
                />
                <path
                  d={`M ${edge.sx} ${edge.sy} L ${edge.tx} ${edge.ty}`}
                  stroke={isSelected ? "hsl(var(--primary))" : isRelated ? "hsl(var(--primary))" : (edge.color || "currentColor")}
                  strokeWidth={isSelected ? 2.5 : isRelated ? 1.5 : 1}
                  strokeDasharray={strokeDasharray}
                  className={`transition-colors duration-200 ${!isSelected && !isRelated ? 'text-muted-foreground/30' : ''}`}
                  fill="none"
                  markerEnd={`url(#${isSelected || isRelated ? 'arrowhead-selected' : 'arrowhead'})`}
                />
              </g>
            );
          })}

          {/* NODES */}
          {nodes.map(node => {
            const isSelected = selectionId === node.id;
            // Determine if related (connected to selected)
            const isRelated = renderedEdges.some(e => 
              (e.source === selectionId && e.target === node.id) || 
              (e.target === selectionId && e.source === node.id)
            );
            
            const opacity = (selectionId && !isSelected && !isRelated) ? 0.4 : 1;

            return (
              <g 
                key={node.id} 
                transform={`translate(${node.x}, ${node.y})`}
                className="cursor-pointer group transition-opacity duration-300"
                style={{ opacity }}
                onClick={() => onSelectNode?.(node.id)}
              >
                {/* Selection Ring */}
                {isSelected && (
                  <circle 
                    r={node.r + 8} 
                    fill="hsl(var(--primary))" 
                    fillOpacity="0.1" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth="2.5" 
                    className="animate-in fade-in"
                  />
                )}
                
                {/* Node Shape */}
                <circle 
                  r={node.r} 
                  fill={node.color || "hsl(var(--card))"} 
                  stroke={isSelected ? "hsl(var(--primary))" : "currentColor"}
                  strokeWidth={isSelected ? 0 : 2}
                  className={`transition-colors text-border group-hover:stroke-primary`}
                />
                
                {/* Node Label */}
                <text
                  y={node.r + 14}
                  textAnchor="middle"
                  className={`text-[12px] font-mono transition-colors pointer-events-none select-none ${
                    isSelected ? 'fill-primary font-bold' : 'fill-foreground group-hover:fill-primary'
                  }`}
                >
                  {node.label}
                </text>
                {node.sublabel && (
                  <text
                    y={node.r + 26}
                    textAnchor="middle"
                    className="text-[9px] font-mono fill-muted-foreground pointer-events-none select-none"
                  >
                    {node.sublabel}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Explicit Graph Controls Overlay */}
      <div className="absolute bottom-6 left-6 flex items-center gap-1 bg-card/90 backdrop-blur border border-border shadow-sm rounded-none p-1">
        <button onClick={handleZoomIn} className="p-2 hover:bg-muted text-foreground transition-colors" title="Zoom In">
          <ZoomIn className="h-4 w-4" />
        </button>
        <button onClick={handleZoomOut} className="p-2 hover:bg-muted text-foreground transition-colors" title="Zoom Out">
          <ZoomOut className="h-4 w-4" />
        </button>
        <div className="w-px h-4 bg-border mx-1"></div>
        <button onClick={handleFit} className="p-2 hover:bg-muted text-foreground transition-colors" title="Fit to Screen">
          <Maximize className="h-4 w-4" />
        </button>
        <button onClick={handleCenterSelected} disabled={!selectionId} className="p-2 hover:bg-muted text-foreground transition-colors disabled:opacity-30" title="Center Selected">
          <Crosshair className="h-4 w-4" />
        </button>
        <button onClick={handleReset} className="p-2 hover:bg-muted text-foreground transition-colors" title="Reset Layout">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

    </div>
  );
}

export function GraphLegend({ 
  nodeTypes, 
  relationshipTypes 
}: { 
  nodeTypes: { label: string, color: string }[],
  relationshipTypes: { label: string, strokeDasharray?: string }[]
}) {
  return (
    <div className="absolute top-6 left-6 bg-card/90 backdrop-blur border border-border shadow-sm p-4 w-64 pointer-events-none">
      <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground mb-3">Legend</div>
      
      <div className="space-y-4">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Node Types</div>
          <div className="space-y-1.5">
            {nodeTypes.map(nt => (
              <div key={nt.label} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border border-foreground/20" style={{ backgroundColor: nt.color }}></div>
                <span className="text-xs font-medium">{nt.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Relationships</div>
          <div className="space-y-2">
            {relationshipTypes.map(rt => (
              <div key={rt.label} className="flex items-center gap-2">
                <svg width="24" height="4" className="shrink-0 text-muted-foreground">
                  <line 
                    x1="0" y1="2" x2="24" y2="2" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeDasharray={rt.strokeDasharray || ""} 
                  />
                </svg>
                <span className="text-xs font-medium">{rt.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
