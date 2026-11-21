'use client';

import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Maximize2, Minus, Plus } from 'lucide-react';
import type { Person, Relationship, GraphNode } from '@/types';
import { Gender as GenderEnum, RelationshipType } from '@/types';
import { getChineseRelationshipLabel } from '@/lib/chinese-kinship';
import { DEFAULT_LAYOUT_OPTIONS, PARENTAL_TYPES, layoutFamilyTree } from '@/lib/tree-layout';
import { useLocale } from '@/components/LocaleProvider';

interface FamilyTreeCanvasProps {
  /** Persons to draw, with relativeGeneration set */
  persons: Person[];
  /** Persons drawn only to keep a filtered tree connected; shown faded */
  connectorIds?: Set<string>;
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
/** Smallest text in the tree (kinship terms), in tree units */
const SMALLEST_FONT = 11;
/** The view never zooms out so far that text drops below this size on screen */
const MIN_SCREEN_FONT_PX = 9;
const MIN_FIT_SCALE = MIN_SCREEN_FONT_PX / SMALLEST_FONT;
const MAX_FIT_SCALE = 1.25;
/** Room around the persons for their labels and the arches above a row */
const TREE_PAD_X = 60;
const TREE_PAD_TOP = NODE_RADIUS + 24;
const TREE_PAD_BOTTOM = NODE_RADIUS + 48;
/** Space kept clear between the tree and the canvas edge */
const VIEW_MARGIN = 16;
const MOVE_DURATION = 600;
/** Persons shown only to connect a filtered tree */
const CONNECTOR_OPACITY = 0.5;
const CONNECTOR_RING = '#6B645B';

// Generation range to display: ancestors (negative) to descendants (positive)
const GENERATION_MIN = -3;
const GENERATION_MAX = 3;

/** A line between two persons, redrawn from their current positions */
interface TreeLink {
  id: string;
  type: RelationshipType;
  path: () => string;
}

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

/**
 * One line per relationship, from person to person: an S-curve from parent to child, a straight
 * line otherwise. Two persons in the same row with someone between them get an arch over them.
 */
function treeLinks(relationships: Relationship[], at: (id: string) => { x: number; y: number }): TreeLink[] {
  const { nodeSpacing } = DEFAULT_LAYOUT_OPTIONS;
  return relationships.map((rel) => ({
    id: rel.id,
    type: rel.type,
    path: () => {
      const a = at(rel.personAId);
      const b = at(rel.personBId);
      if (PARENTAL_TYPES.includes(rel.type)) {
        const midY = (a.y + b.y) / 2;
        return `M${a.x},${a.y}C${a.x},${midY} ${b.x},${midY} ${b.x},${b.y}`;
      }
      const [left, right] = a.x <= b.x ? [a, b] : [b, a];
      if (Math.abs(a.y - b.y) < 1 && right.x - left.x >= 2 * nodeSpacing - 1) {
        const rise = 12 + Math.min(10, (right.x - left.x) * 0.03);
        return `M${left.x},${left.y - NODE_RADIUS}Q${(left.x + right.x) / 2},${left.y - NODE_RADIUS - 2 * rise} ${right.x},${right.y - NODE_RADIUS}`;
      }
      return `M${a.x},${a.y}L${b.x},${b.y}`;
    },
  }));
}

export function FamilyTreeCanvas({
  persons,
  connectorIds,
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
  // The center person and the persons drawn when the view was last aimed
  const lastViewRef = useRef<string | null>(null);

  const [isEmpty, setIsEmpty] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const kinshipPersons = allPersons ?? persons;
  const selfLabel = t('self');

  /**
   * Show the whole tree, zoomed out no further than the minimum text size, with the person
   * `focusId` (at their position in `positions`) as close to the middle as possible. The view
   * stops where the tree's edge meets the canvas edge: a tree that fits stays fully in view,
   * and a larger one never shows empty space beyond its edge.
   */
  const centerOn = useCallback((
    focusId: string | null,
    duration: number,
    positions?: Map<string, { x: number; y: number }>
  ) => {
    const svgEl = svgRef.current;
    const zoom = zoomRef.current;
    const nodes = nodesRef.current;
    if (!svgEl || !zoom || nodes.length === 0) return;

    const { width, height } = svgEl.getBoundingClientRect();
    if (!width || !height) return;

    const points = nodes.map((n) => positions?.get(n.id) ?? { x: n.x ?? 0, y: n.y ?? 0 });
    const minX = Math.min(...points.map((p) => p.x)) - TREE_PAD_X;
    const maxX = Math.max(...points.map((p) => p.x)) + TREE_PAD_X;
    const minY = Math.min(...points.map((p) => p.y)) - TREE_PAD_TOP;
    const maxY = Math.max(...points.map((p) => p.y)) + TREE_PAD_BOTTOM;
    const viewWidth = Math.max(1, width - 2 * VIEW_MARGIN);
    const viewHeight = Math.max(1, height - 2 * VIEW_MARGIN);

    const fitScale = Math.min(viewWidth / (maxX - minX), viewHeight / (maxY - minY));
    const k = Math.max(MIN_FIT_SCALE, Math.min(MAX_FIT_SCALE, fitScale));

    // The view's center may move between the two positions that put a tree edge on a view edge
    const clampCenter = (value: number, low: number, high: number, viewSize: number) => {
      const a = low + viewSize / (2 * k);
      const b = high - viewSize / (2 * k);
      return Math.min(Math.max(value, Math.min(a, b)), Math.max(a, b));
    };
    const focusIndex = Math.max(0, nodes.findIndex((n) => n.id === focusId));
    const cx = clampCenter(points[focusIndex].x, minX, maxX, viewWidth);
    const cy = clampCenter(points[focusIndex].y, minY, maxY, viewHeight);

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
    // The tree is everyone connected through any person, so a filter that hides someone does not
    // cut off the persons related through them; `persons` then decides who is drawn
    const connectedIds = centerId ? findConnectedPersons(centerId, kinshipPersons, relationships) : new Set<string>();
    const visiblePersons = persons.filter((person) => {
      if (!connectedIds.has(person.id)) return false;
      const gen = person.relativeGeneration ?? 0;
      return gen >= GENERATION_MIN && gen <= GENERATION_MAX;
    });
    const visibleIds = new Set(visiblePersons.map((p) => p.id));
    const viewKey = `${centerId}|${[...visibleIds].sort().join(',')}`;

    const saved = positionsRef.current;
    const isFreshLayout = visiblePersons.every((p) => !saved.has(p.id));

    const visibleRelationships = relationships.filter(
      (rel) => visibleIds.has(rel.personAId) && visibleIds.has(rel.personBId)
    );
    const layout = layoutFamilyTree(visiblePersons, visibleRelationships);
    const settled = layout.positions;

    const nodes: TreeNode[] = visiblePersons.map((person) => {
      const position = settled.get(person.id)!;
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
      return { ...person, kinship, x: position.x, y: position.y };
    });
    const previous = new Map(Array.from(saved).filter(([id]) => visibleIds.has(id)));

    nodesRef.current = nodes;
    setIsEmpty(nodes.length === 0);
    if (nodes.length === 0) return;

    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const at = (id: string) => {
      const n = nodeById.get(id)!;
      return { x: n.x ?? 0, y: n.y ?? 0 };
    };
    const links = treeLinks(visibleRelationships, at);

    const g = svg.append('g');
    const defs = svg.append('defs');
    let glide: d3.Timer | null = null;

    // Links
    const link = g
      .append('g')
      .attr('fill', 'none')
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
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
      // Connectors do not match the filters: faded and in grey
      .attr('opacity', (d) => (connectorIds?.has(d.id) ? CONNECTOR_OPACITY : null))
      .style('filter', (d) => (connectorIds?.has(d.id) ? 'grayscale(1)' : null));

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

    // Dashed ring marking a connector
    node
      .filter((d) => !!connectorIds?.has(d.id))
      .append('circle')
      .attr('r', NODE_RADIUS + 4)
      .attr('fill', 'none')
      .attr('stroke', CONNECTOR_RING)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,3');

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
          .attr('font-size', `${SMALLEST_FONT}px`)
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
      link.attr('d', (d) => d.path());
      node.attr('transform', (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
      nodes.forEach((n) => saved.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 }));
    };

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
      centerOn(centerId, 0);
    } else {
      // When the center person or the persons drawn change (e.g. a filter), aim the view at the
      // new layout, then glide everyone there
      if (lastViewRef.current !== viewKey) centerOn(centerId, MOVE_DURATION, settled);
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
    lastViewRef.current = viewKey;

    return () => {
      glide?.stop();
      svg.interrupt();
    };
  }, [persons, connectorIds, kinshipPersons, relationships, selectedPersonId, onSelectPerson, onEditPerson, selfLabel, centerOn]);

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
          {connectorIds && connectorIds.size > 0 && (
            <div className="flex items-center gap-2">
              <svg width="12" height="12" aria-hidden="true">
                <circle cx="6" cy="6" r="4" fill="#A8A29E" opacity={CONNECTOR_OPACITY} />
                <circle cx="6" cy="6" r="5.25" fill="none" stroke={CONNECTOR_RING} strokeWidth="1" strokeDasharray="2,1.5" />
              </svg>
              <span>{t('connectorLegend')}</span>
            </div>
          )}
        </div>
      </div>

      {/* View controls */}
      <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-lg border bg-card/90 shadow-sm backdrop-blur-sm">
        {[
          { label: t('zoomIn'), icon: Plus, onClick: () => zoomBy(1.3) },
          { label: t('zoomOut'), icon: Minus, onClick: () => zoomBy(1 / 1.3) },
          { label: t('fitView'), icon: Maximize2, onClick: () => centerOn(selectedPersonId, 400) },
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
