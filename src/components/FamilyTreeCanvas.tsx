'use client';

import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Maximize2, Minus, Plus } from 'lucide-react';
import type { Person, Relationship, GraphNode, GraphLink } from '@/types';
import { Gender as GenderEnum, RelationshipType } from '@/types';
import { getChineseRelationshipLabel } from '@/lib/chinese-kinship';
import { useLocale } from '@/components/LocaleProvider';

interface FamilyTreeCanvasProps {
  /** Persons to draw, with relativeGeneration set */
  persons: Person[];
  /** Persons used to work out kinship terms; defaults to `persons` */
  allPersons?: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (personId: string) => void;
  onEditPerson?: (person: Person) => void;
}

type TreeNode = GraphNode & Pick<Person, 'birthYear' | 'deathYear'> & { kinship?: string };

interface TooltipState {
  x: number;
  y: number;
  name: string;
  years: string;
  kinship: string;
}

// Color scales for generations
const MALE_COLORS: Record<number, string> = {
  [-3]: '#1E3A8A',
  [-2]: '#1E40AF',
  [-1]: '#1D4ED8',
  0: '#2563EB',
  1: '#3B82F6',
  2: '#60A5FA',
  3: '#93C5FD',
};

const FEMALE_COLORS: Record<number, string> = {
  [-3]: '#D97706',
  [-2]: '#F59E0B',
  [-1]: '#FBBF24',
  0: '#FCD34D',
  1: '#FDE68A',
  2: '#FEF3C7',
  3: '#FFFBEB',
};

const UNKNOWN_COLOR = '#A8A29E';
const INK = '#2B2622';
const BRAND = '#B5402A';
const UNKNOWN_KINSHIP = '未知关系';

const NODE_RADIUS = 26;
const GENERATION_HEIGHT = 130;
const MIN_READABLE_SCALE = 0.75;
const MOVE_DURATION = 600;

// Generation range to display: ancestors (negative) to descendants (positive)
const GENERATION_MIN = -3;
const GENERATION_MAX = 3;

const PARTNER_TYPES: RelationshipType[] = [
  RelationshipType.SPOUSE,
  RelationshipType.CONCUBINE,
  RelationshipType.BETROTHED,
];

const PARENTAL_TYPES: RelationshipType[] = [
  RelationshipType.PARENT_CHILD,
  RelationshipType.ADOPTIVE_PARENT,
  RelationshipType.FOSTER_PARENT,
];

function linkStyle(type: RelationshipType): { stroke: string; width: number; dash: string | null } {
  switch (type) {
    case RelationshipType.PARENT_CHILD:
      return { stroke: '#8C857B', width: 1.5, dash: null };
    case RelationshipType.ADOPTIVE_PARENT:
    case RelationshipType.FOSTER_PARENT:
      return { stroke: '#8C857B', width: 1.5, dash: '4,4' };
    case RelationshipType.SPOUSE:
      return { stroke: BRAND, width: 2, dash: null };
    case RelationshipType.BETROTHED:
      return { stroke: BRAND, width: 1.5, dash: '2,4' };
    case RelationshipType.CONCUBINE:
      return { stroke: '#4D7C5B', width: 2, dash: '6,4' };
    default:
      return { stroke: '#B9B1A6', width: 1.5, dash: '3,5' };
  }
}

function nodeColor(node: Pick<TreeNode, 'gender' | 'relativeGeneration'>): string {
  const gen = node.relativeGeneration ?? 0;
  if (node.gender === GenderEnum.MALE) return MALE_COLORS[gen] ?? MALE_COLORS[0];
  if (node.gender === GenderEnum.FEMALE) return FEMALE_COLORS[gen] ?? FEMALE_COLORS[0];
  return UNKNOWN_COLOR;
}

/** Short text shown inside a node that has no avatar */
function shortName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  if (/[㐀-鿿]/.test(trimmed)) {
    return trimmed.length <= 2 ? trimmed : trimmed.slice(-2);
  }
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

function truncate(name: string, max: number): string {
  return name.length > max ? `${name.slice(0, max)}…` : name;
}

function lifeYears(node: Pick<Person, 'birthYear' | 'deathYear'>): string {
  if (!node.birthYear && !node.deathYear) return '';
  return `${node.birthYear ?? '?'} – ${node.deathYear ?? ''}`.trim();
}

/** Ids of everyone reachable from the center person through relationships */
function findConnectedPersons(centerId: string, persons: Person[], relationships: Relationship[]): Set<string> {
  const adjacency = new Map<string, string[]>();
  persons.forEach((p) => adjacency.set(p.id, []));
  relationships.forEach((rel) => {
    const aList = adjacency.get(rel.personAId);
    const bList = adjacency.get(rel.personBId);
    if (aList && bList) {
      aList.push(rel.personBId);
      bList.push(rel.personAId);
    }
  });

  const connected = new Set<string>([centerId]);
  const queue = [centerId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const neighborId of adjacency.get(currentId) ?? []) {
      if (!connected.has(neighborId)) {
        connected.add(neighborId);
        queue.push(neighborId);
      }
    }
  }
  return connected;
}

export function FamilyTreeCanvas({
  persons,
  allPersons,
  relationships,
  selectedPersonId,
  onSelectPerson,
  onEditPerson,
}: FamilyTreeCanvasProps) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const nodesRef = useRef<TreeNode[]>([]);
  // Node positions survive redraws, so the tree moves instead of being reshuffled
  const positionsRef = useRef(new Map<string, { x: number; y: number }>());
  const lastCenterRef = useRef<string | null>(null);

  const [isEmpty, setIsEmpty] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const kinshipPersons = allPersons ?? persons;
  const selfLabel = t('self');

  /**
   * Move the view to show the tree. With `focusId`, a tree too large to stay readable
   * when shown whole is instead centered on that person at a readable size.
   */
  const showTree = useCallback((duration: number, focusId?: string | null) => {
    const svgEl = svgRef.current;
    const zoom = zoomRef.current;
    const nodes = nodesRef.current;
    if (!svgEl || !zoom || nodes.length === 0) return;

    const { width, height } = svgEl.getBoundingClientRect();
    if (!width || !height) return;

    const xs = nodes.map((n) => n.x ?? 0);
    const ys = nodes.map((n) => n.y ?? 0);
    const minX = Math.min(...xs) - 70;
    const maxX = Math.max(...xs) + 70;
    const minY = Math.min(...ys) - 50;
    const maxY = Math.max(...ys) + 75;
    let k = Math.max(0.2, Math.min(1.25, width / (maxX - minX), height / (maxY - minY)));
    let cx = (minX + maxX) / 2;
    let cy = (minY + maxY) / 2;

    const focus = focusId ? nodes.find((n) => n.id === focusId) : undefined;
    if (focus && k < MIN_READABLE_SCALE) {
      k = MIN_READABLE_SCALE;
      cx = focus.x ?? 0;
      cy = focus.y ?? 0;
    }

    const transform = d3.zoomIdentity.translate(width / 2 - k * cx, height / 2 - k * cy).scale(k);
    const svg = d3.select(svgEl);
    if (duration > 0) {
      svg.transition().duration(duration).call(zoom.transform, transform);
    } else {
      svg.call(zoom.transform, transform);
    }
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const svgEl = svgRef.current;
    const zoom = zoomRef.current;
    if (!svgEl || !zoom) return;
    d3.select(svgEl).transition().duration(200).call(zoom.scaleBy, factor);
  }, []);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    setTooltip(null);

    // The layout is centered on (0, 0); the zoom transform places it in the viewport.
    const centerId = selectedPersonId || (persons.length > 0 ? persons[0].id : null);
    const connectedIds = centerId ? findConnectedPersons(centerId, persons, relationships) : new Set<string>();
    const visiblePersons = persons.filter((person) => {
      if (!connectedIds.has(person.id)) return false;
      const gen = person.relativeGeneration ?? 0;
      return gen >= GENERATION_MIN && gen <= GENERATION_MAX;
    });
    const visibleIds = new Set(visiblePersons.map((p) => p.id));

    const saved = positionsRef.current;
    const isFreshLayout = visiblePersons.every((p) => !saved.has(p.id));

    const nodes: TreeNode[] = visiblePersons.map((person) => {
      const gen = person.relativeGeneration ?? 0;
      const position = saved.get(person.id);
      let kinship: string | undefined;
      if (person.id === selectedPersonId) {
        kinship = selfLabel;
      } else if (selectedPersonId) {
        try {
          const term = getChineseRelationshipLabel(selectedPersonId, person.id, kinshipPersons, relationships);
          if (term && term !== UNKNOWN_KINSHIP) kinship = term;
        } catch {
          // No kinship term for this pair
        }
      }
      return {
        ...person,
        kinship,
        x: position?.x ?? (Math.random() - 0.5) * 300,
        y: position?.y ?? gen * GENERATION_HEIGHT + (Math.random() - 0.5) * 40,
      };
    });
    const previous = new Map(Array.from(saved).filter(([id]) => visibleIds.has(id)));

    const links: GraphLink[] = relationships
      .filter((rel) => visibleIds.has(rel.personAId) && visibleIds.has(rel.personBId))
      .map((rel) => ({ ...rel, source: rel.personAId, target: rel.personBId }));

    nodesRef.current = nodes;
    setIsEmpty(nodes.length === 0);
    if (nodes.length === 0) return;

    const g = svg.append('g');
    const defs = svg.append('defs');

    const simulation = d3
      .forceSimulation<TreeNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<TreeNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => (PARTNER_TYPES.includes(d.type) ? 90 : 150))
          .strength((d) => (PARTNER_TYPES.includes(d.type) ? 0.8 : 0.3))
      )
      .force('charge', d3.forceManyBody<TreeNode>().strength(-650).distanceMax(700))
      .force('collision', d3.forceCollide<TreeNode>().radius(NODE_RADIUS + 26))
      // Ancestors above, descendants below
      .force('generation', d3.forceY<TreeNode>((d) => (d.relativeGeneration ?? 0) * GENERATION_HEIGHT).strength(0.9))
      // The selected person settles in the middle; everyone else is held loosely around them
      .force('x', d3.forceX<TreeNode>(0).strength((d) => (d.id === selectedPersonId ? 0.4 : 0.03)))
      .stop();

    // Work out the final layout up front, so the view can be aimed at it
    simulation.tick(300);
    const settled = new Map(nodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));
    let glide: d3.Timer | null = null;

    // Links
    const link = g
      .append('g')
      .attr('fill', 'none')
      .attr('stroke-linecap', 'round')
      .selectAll('path')
      .data(links)
      .enter()
      .append('path')
      .attr('stroke', (d) => linkStyle(d.type).stroke)
      .attr('stroke-width', (d) => linkStyle(d.type).width)
      .attr('stroke-dasharray', (d) => linkStyle(d.type).dash)
      .attr('stroke-opacity', 0.85);

    // Nodes
    const node = g
      .append('g')
      .selectAll<SVGGElement, TreeNode>('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', (d) => (d.id === selectedPersonId ? 'tree-node is-selected' : 'tree-node'))
      .call(
        d3
          .drag<SVGGElement, TreeNode>()
          .on('start', (event, d) => {
            glide?.stop();
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Halo behind the selected person
    node
      .filter((d) => d.id === selectedPersonId)
      .append('circle')
      .attr('r', NODE_RADIUS + 11)
      .attr('fill', BRAND)
      .attr('opacity', 0.12);

    // Ring shown on hover and on the selected person
    node
      .append('circle')
      .attr('class', 'node-ring')
      .attr('r', NODE_RADIUS + 5)
      .attr('fill', 'none')
      .attr('stroke', BRAND)
      .attr('stroke-width', 2.5);

    node
      .append('circle')
      .attr('r', NODE_RADIUS)
      .attr('fill', (d) => (d.avatar ? '#F3F0EA' : nodeColor(d)))
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 2.5)
      .style('filter', 'drop-shadow(0 1px 2px rgba(43, 38, 34, 0.25))');

    node.each(function (d) {
      const nodeGroup = d3.select(this);

      if (d.avatar) {
        const clipId = `clip-${d.id}`;
        defs.append('clipPath').attr('id', clipId).append('circle').attr('r', NODE_RADIUS - 1.5);
        nodeGroup
          .append('image')
          .attr('href', d.avatar)
          .attr('width', NODE_RADIUS * 2)
          .attr('height', NODE_RADIUS * 2)
          .attr('x', -NODE_RADIUS)
          .attr('y', -NODE_RADIUS)
          .attr('clip-path', `url(#${clipId})`)
          .attr('preserveAspectRatio', 'xMidYMid slice');
      } else {
        const fill = nodeColor(d);
        nodeGroup
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', '14px')
          .attr('font-weight', '600')
          .attr('fill', d3.hsl(fill).l > 0.62 ? INK : '#FFFFFF')
          .text(shortName(d.name));
      }

      // Name and kinship term below the node
      nodeGroup
        .append('text')
        .attr('class', 'node-label')
        .attr('y', NODE_RADIUS + 17)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12.5px')
        .attr('font-weight', '600')
        .attr('fill', INK)
        .text(truncate(d.name, 8));

      if (d.kinship) {
        nodeGroup
          .append('text')
          .attr('class', 'node-label')
          .attr('y', NODE_RADIUS + 32)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px')
          .attr('fill', BRAND)
          .text(truncate(d.kinship, 10));
      }

      // Lock badge for private persons
      if (d.isPrivate) {
        const badge = nodeGroup
          .append('g')
          .attr('transform', `translate(${NODE_RADIUS * 0.72}, ${-NODE_RADIUS * 0.72})`);
        badge.append('circle').attr('r', 8).attr('fill', '#FFFFFF').attr('stroke', '#D6CFC4');
        badge
          .append('path')
          .attr('d', 'M-3.2,-0.6h6.4v4.4h-6.4z M-1.9,-0.6v-1.5a1.9,1.9 0 0 1 3.8,0v1.5')
          .attr('fill', 'none')
          .attr('stroke', '#6B645B')
          .attr('stroke-width', 1.1)
          .attr('stroke-linejoin', 'round');
      }
    });

    node.on('click', (event, d) => {
      event.stopPropagation();
      if (d.id !== selectedPersonId) onSelectPerson(d.id);
    });

    if (onEditPerson) {
      node.on('dblclick', (event, d) => {
        event.stopPropagation();
        const person = persons.find((p) => p.id === d.id);
        if (person) onEditPerson(person);
      });
    }

    // Hover tooltip
    const tooltipPosition = (event: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      return { x: event.clientX - (rect?.left ?? 0) + 14, y: event.clientY - (rect?.top ?? 0) - 12 };
    };
    node
      .on('mouseenter', (event: MouseEvent, d) => {
        setTooltip({ ...tooltipPosition(event), name: d.name, years: lifeYears(d), kinship: d.kinship ?? '' });
      })
      .on('mousemove', (event: MouseEvent) => {
        setTooltip((prev) => (prev ? { ...prev, ...tooltipPosition(event) } : prev));
      })
      .on('mouseleave', () => setTooltip(null));

    const render = () => {
      link.attr('d', (d) => {
        const source = d.source as TreeNode;
        const target = d.target as TreeNode;
        const sx = source.x ?? 0;
        const sy = source.y ?? 0;
        const tx = target.x ?? 0;
        const ty = target.y ?? 0;
        if (PARENTAL_TYPES.includes(d.type)) {
          const midY = (sy + ty) / 2;
          return `M${sx},${sy}C${sx},${midY} ${tx},${midY} ${tx},${ty}`;
        }
        return `M${sx},${sy}L${tx},${ty}`;
      });
      node.attr('transform', (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
      nodes.forEach((n) => saved.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 }));
    };

    simulation.on('tick', render);

    // Zoom and pan
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });
    zoomRef.current = zoom;
    svg.call(zoom).on('dblclick.zoom', null);
    g.attr('transform', d3.zoomTransform(svgEl).toString());

    if (isFreshLayout) {
      render();
      showTree(0, centerId);
    } else {
      // Aim the view at the settled layout, then glide everyone there from where they were
      if (lastCenterRef.current !== centerId) showTree(MOVE_DURATION, centerId);
      const place = (progress: number) => {
        nodes.forEach((n) => {
          const to = settled.get(n.id)!;
          const from = previous.get(n.id) ?? to;
          n.x = from.x + (to.x - from.x) * progress;
          n.y = from.y + (to.y - from.y) * progress;
        });
        render();
      };
      place(0);
      glide = d3.timer((elapsed) => {
        const progress = Math.min(1, elapsed / MOVE_DURATION);
        place(d3.easeCubicInOut(progress));
        if (progress >= 1) glide?.stop();
      });
    }
    lastCenterRef.current = centerId;

    return () => {
      glide?.stop();
      simulation.stop();
      svg.interrupt();
    };
  }, [persons, kinshipPersons, relationships, selectedPersonId, onSelectPerson, onEditPerson, selfLabel, showTree]);

  return (
    <div ref={containerRef} className="tree-canvas relative h-full w-full overflow-hidden">
      <svg ref={svgRef} className="h-full w-full" />

      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-muted-foreground">{t('noPersons')}</p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute left-3 top-3 hidden sm:block rounded-lg border bg-card/90 px-3 py-2.5 text-xs shadow-sm backdrop-blur-sm">
        <div className="mb-1.5 font-medium text-muted-foreground">{t('legend')}</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: MALE_COLORS[0] }} />
            <span>{t('male')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: FEMALE_COLORS[0] }} />
            <span>{t('female')}</span>
          </div>
          {[
            { type: RelationshipType.PARENT_CHILD, label: t('parentChild') },
            { type: RelationshipType.SPOUSE, label: t('spouse') },
            { type: RelationshipType.CONCUBINE, label: t('concubine') },
            { type: RelationshipType.SIBLING, label: t('otherRelations') },
          ].map(({ type, label }) => {
            const style = linkStyle(type);
            return (
              <div key={type} className="flex items-center gap-2">
                <svg width="16" height="6" aria-hidden="true">
                  <line
                    x1="0"
                    y1="3"
                    x2="16"
                    y2="3"
                    stroke={style.stroke}
                    strokeWidth="2"
                    strokeDasharray={style.dash ? '3,2' : undefined}
                  />
                </svg>
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* View controls */}
      <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-lg border bg-card/90 shadow-sm backdrop-blur-sm">
        {[
          { label: t('zoomIn'), icon: Plus, onClick: () => zoomBy(1.3) },
          { label: t('zoomOut'), icon: Minus, onClick: () => zoomBy(1 / 1.3) },
          { label: t('fitView'), icon: Maximize2, onClick: () => showTree(400) },
        ].map(({ label, icon: Icon, onClick }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            onClick={onClick}
            className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&:not(:first-child)]:border-t"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 -translate-y-full rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-medium">{tooltip.name}</div>
          {(tooltip.kinship || tooltip.years) && (
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              {tooltip.kinship && <span className="text-brand">{tooltip.kinship}</span>}
              {tooltip.years && <span>{tooltip.years}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
