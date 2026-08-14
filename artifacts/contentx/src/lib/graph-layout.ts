import { formatDisplayName } from "./display-name";

export interface GraphLayoutNode {
  id: string;
  label: string;
  sublabel?: string;
  kind: string;
  x: number;
  y: number;
  r: number;
  color?: string;
  /** Full original name when `label` was shortened for display. */
  fullLabel?: string;
  metadata?: any;
}

// Shorten a node's display label while preserving the original for tooltips.
function labelPair(name: string): { label: string; fullLabel?: string } {
  const label = formatDisplayName(name);
  return label === name ? { label } : { label, fullLabel: name };
}

export interface GraphLayoutEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  lineType?: 'solid' | 'dashed' | 'dotted';
  metadata?: any;
}

export function computeWorldLayout(entities: any[], relationships: any[]): { nodes: GraphLayoutNode[], edges: GraphLayoutEdge[] } {
  const sortedEntities = [...entities].sort((a, b) => a.kind.localeCompare(b.kind));
  const radius = Math.max(300, sortedEntities.length * 15);
  const cx = 0;
  const cy = 0;

  const nodes = sortedEntities.map((ent, i) => {
    const angle = (i / sortedEntities.length) * 2 * Math.PI - Math.PI / 2;
    return {
      id: ent.id,
      ...labelPair(ent.name),
      sublabel: ent.kind,
      kind: 'entity',
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      r: 10,
      color: 'hsl(var(--card))',
      metadata: ent.attributes
    };
  });

  const edges = relationships.map(rel => ({
    id: rel.id,
    source: rel.source,
    target: rel.target,
    type: rel.type,
    lineType: 'solid' as const,
    metadata: rel.attributes
  }));

  return { nodes, edges };
}

export function computePopulationLayout(population: any, dimensions: any[], rules: any[], characters: any[]): { nodes: GraphLayoutNode[], edges: GraphLayoutEdge[] } {
  const nodes: GraphLayoutNode[] = [];
  const edges: GraphLayoutEdge[] = [];

  nodes.push({
    id: population.id,
    ...labelPair(population.name),
    kind: 'population',
    x: 0,
    y: 0,
    r: 20,
    color: 'hsl(var(--primary))',
    metadata: {
      source: population.provenance?.sourceType || 'manual',
      version: population.version,
      dimensions: dimensions.length,
      dependencies: rules.length,
      characters: characters.length
    }
  });

  dimensions.forEach((dim, i) => {
    // Fan dimensions out on an arc below the population so large dimension
    // sets stay readable instead of collapsing into one flat line.
    const perRow = 8;
    const row = Math.floor(i / perRow);
    const inRow = i % perRow;
    const rowCount = Math.min(perRow, dimensions.length - row * perRow);
    const x = (inRow - (rowCount - 1) / 2) * 170;
    const y = 180 + row * 110;
    nodes.push({
      id: dim.id,
      label: dim.name,
      sublabel: 'Dimension',
      kind: 'dimension',
      x,
      y,
      r: 12,
      metadata: { category: dim.category, dataType: dim.dataType }
    });
    edges.push({
      id: `edge-pop-dim-${dim.id}`,
      source: population.id,
      target: dim.id,
      type: 'has_dimension',
      lineType: 'solid'
    });
  });

  rules.forEach(rule => {
    edges.push({
      id: rule.id,
      source: rule.sourceDimension,
      target: rule.targetDimension,
      type: 'dependency',
      lineType: 'dashed',
      metadata: {
        ruleType: rule.type,
        conditions: JSON.stringify(rule.conditions),
        effect: JSON.stringify(rule.effect),
        version: rule.version
      }
    });
  });

  // Start the character region safely below the last dimension row.
  const dimRows = Math.ceil(dimensions.length / 8);
  const charY = 180 + dimRows * 110 + 160;
  characters.forEach((char, i) => {
    const cols = Math.ceil(Math.sqrt(characters.length));
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = (col - (cols - 1) / 2) * 160;
    const y = charY + row * 120;

    nodes.push({
      id: char.id,
      ...labelPair(char.name),
      sublabel: 'Character',
      kind: 'character',
      x,
      y,
      r: 12,
      color: 'hsl(var(--secondary))',
      metadata: { population: population.name, seed: char.provenance?.seed }
    });

    edges.push({
      id: `edge-pop-char-${char.id}`,
      source: population.id,
      target: char.id,
      type: 'sampled',
      lineType: 'dotted'
    });
  });

  return { nodes, edges };
}

export function computeCharacterLayout(character: any, population: any, snapshots: any[], agents: any[]): { nodes: GraphLayoutNode[], edges: GraphLayoutEdge[] } {
  const nodes: GraphLayoutNode[] = [];
  const edges: GraphLayoutEdge[] = [];

  // Character in center
  nodes.push({
    id: character.id,
    ...labelPair(character.name),
    kind: 'character',
    x: 0,
    y: 0,
    r: 20,
    color: 'hsl(var(--secondary))',
    metadata: { seed: character.provenance?.seed }
  });

  // Population above
  if (population) {
    nodes.push({
      id: population.id,
      ...labelPair(population.name),
      sublabel: 'Population',
      kind: 'population',
      x: 0,
      y: -150,
      r: 16,
      color: 'hsl(var(--primary))'
    });
    edges.push({
      id: `edge-pop-char`,
      source: population.id,
      target: character.id,
      type: 'sampled_from',
      lineType: 'dotted'
    });
  }

  // Goals to the left
  const goals = character.attributes?.goals || [];
  goals.forEach((g: string, i: number) => {
    const id = `goal-${i}`;
    nodes.push({
      id,
      label: 'Goal',
      sublabel: g,
      kind: 'goal',
      x: -200,
      y: (i - (goals.length - 1) / 2) * 80,
      r: 10,
      metadata: { description: g }
    });
    edges.push({
      id: `edge-char-goal-${i}`,
      source: character.id,
      target: id,
      type: 'has_goal',
      lineType: 'solid'
    });
  });

  // Snapshots below
  snapshots.forEach((snap, i) => {
    const snapX = (i - (snapshots.length - 1) / 2) * 150;
    nodes.push({
      id: snap.id,
      label: `Snapshot v${snapshots.length - i}`,
      kind: 'characterSnapshot',
      x: snapX,
      y: 150,
      r: 12,
      metadata: { createdAt: snap.createdAt }
    });
    edges.push({
      id: `edge-char-snap-${snap.id}`,
      source: character.id,
      target: snap.id,
      type: 'resolved_to',
      lineType: 'dotted'
    });

    // Agents below their snapshots
    const snapAgents = agents.filter(a => a.snapshotId === snap.id);
    snapAgents.forEach((ag, j) => {
      nodes.push({
        id: ag.id,
        ...labelPair(ag.name),
        sublabel: 'Agent',
        kind: 'agent',
        x: snapX + (j - (snapAgents.length - 1) / 2) * 80,
        y: 300,
        r: 14,
        color: 'hsl(var(--primary))',
        metadata: {
          snapshotId: ag.provenance?.snapshotId || ag.snapshotId,
          characterId: ag.provenance?.characterId,
          goals: ag.goals?.length || 0
        }
      });
      edges.push({
        id: `edge-snap-ag-${ag.id}`,
        source: snap.id,
        target: ag.id,
        type: 'instantiated',
        lineType: 'dotted'
      });
    });
  });

  return { nodes, edges };
}

export function computeSimulationLayout(simulation: any, agents: any[], events: any[], evaluations: any[]): { nodes: GraphLayoutNode[], edges: GraphLayoutEdge[] } {
  const nodes: GraphLayoutNode[] = [];
  const edges: GraphLayoutEdge[] = [];

  // Simulation at top
  nodes.push({
    id: simulation.id,
    ...labelPair(simulation.name),
    kind: 'simulation',
    x: 0,
    y: 0,
    r: 20,
    color: 'hsl(var(--primary))',
    metadata: { topic: simulation.config.topic, turns: simulation.turnsExecuted }
  });

  // Agents row
  agents.forEach((ag, i) => {
    const x = (i - (agents.length - 1) / 2) * 200;
    nodes.push({
      id: ag.agentId,
      ...labelPair(ag.name),
      sublabel: ag.role,
      kind: 'agent',
      x,
      y: 150,
      r: 14,
      color: 'hsl(var(--secondary))',
      metadata: {
        snapshotId: ag.provenance?.snapshotId || ag.snapshotId,
        characterId: ag.provenance?.characterId,
        goals: ag.goals?.length || 0
      }
    });
    edges.push({
      id: `edge-sim-ag-${ag.agentId}`,
      source: simulation.id,
      target: ag.agentId,
      type: 'participant',
      lineType: 'solid'
    });
  });

  // Events timeline down the middle
  let currentY = 300;
  let prevEventId = simulation.id;
  
  events.forEach((ev) => {
    const hasStateChange = ev.stateBefore && ev.stateAfter;
    
    nodes.push({
      id: ev.id,
      label: `${ev.type} (T${ev.turn})`,
      sublabel: hasStateChange ? 'State Change' : undefined,
      kind: 'event',
      x: 0,
      y: currentY,
      r: hasStateChange ? 12 : 8,
      color: hasStateChange ? 'hsl(var(--secondary))' : undefined,
      metadata: {
        ...ev.payload,
        actorId: ev.actorId,
        turn: ev.turn,
        type: ev.type,
        ...(hasStateChange ? { stateBefore: ev.stateBefore, stateAfter: ev.stateAfter } : {})
      }
    });

    edges.push({
      id: `edge-ev-seq-${ev.id}`,
      source: prevEventId,
      target: ev.id,
      type: 'sequence',
      lineType: 'solid'
    });
    
    edges.push({
      id: `edge-ev-ag-${ev.id}`,
      source: ev.actorId,
      target: ev.id,
      type: 'performed',
      lineType: 'dashed'
    });

    prevEventId = ev.id;
    currentY += 80;
  });

  // Outcome
  if (simulation.outcome) {
    const outcomeId = `outcome-${simulation.id}`;
    nodes.push({
      id: outcomeId,
      label: 'Outcome',
      kind: 'outcome',
      x: 0,
      y: currentY,
      r: 12,
      metadata: { agreement: simulation.outcome.agreementReached, gap: simulation.outcome.finalGap }
    });
    edges.push({
      id: `edge-ev-out`,
      source: prevEventId,
      target: outcomeId,
      type: 'resulted_in',
      lineType: 'solid'
    });
    prevEventId = outcomeId;
    currentY += 100;
  }

  // Evaluations at bottom
  evaluations.forEach((ev, i) => {
    nodes.push({
      id: ev.id,
      label: `Eval: ${ev.kind}`,
      kind: 'evaluation',
      x: (i - (evaluations.length - 1) / 2) * 150,
      y: currentY,
      r: 12,
      color: 'hsl(var(--chart-3))'
    });
    edges.push({
      id: `edge-sim-eval-${ev.id}`,
      source: simulation.id, // logically applies to sim
      target: ev.id,
      type: 'evaluated',
      lineType: 'dotted'
    });
  });

  return { nodes, edges };
}

// Lineage items form a provenance TREE: each item names its parent explicitly
// (parentId), so a character with several snapshots/agents/simulations shows
// every real descendant instead of an arbitrary single path. Items are grouped
// into stage rows (top-to-bottom) by `stage` order of first appearance.
export function computeLineageLayout(
  items: { id: string; label: string; kind: string; parentId?: string | null; metadata?: Record<string, unknown> }[]
): { nodes: GraphLayoutNode[], edges: GraphLayoutEdge[] } {
  const nodes: GraphLayoutNode[] = [];
  const edges: GraphLayoutEdge[] = [];

  // Row per kind, in order of first appearance.
  const stageOrder: string[] = [];
  items.forEach(it => { if (!stageOrder.includes(it.kind)) stageOrder.push(it.kind); });

  const ySpacing = 130;
  const xSpacing = 220;

  stageOrder.forEach((kind, row) => {
    const rowItems = items.filter(it => it.kind === kind);
    rowItems.forEach((item, i) => {
      nodes.push({
        id: item.id,
        ...labelPair(item.label),
        sublabel: item.kind,
        kind: item.kind,
        x: (i - (rowItems.length - 1) / 2) * xSpacing,
        y: row * ySpacing,
        r: item.kind === 'MatrAIx' ? 16 : 12,
        color: item.kind === 'MatrAIx' ? 'hsl(var(--secondary))' : 'hsl(var(--card))',
        metadata: item.metadata
      });
      if (item.parentId) {
        edges.push({
          id: `edge-prov-${item.parentId}-${item.id}`,
          source: item.parentId,
          target: item.id,
          type: 'provenance',
          lineType: 'dotted'
        });
      }
    });
  });

  return { nodes, edges };
}