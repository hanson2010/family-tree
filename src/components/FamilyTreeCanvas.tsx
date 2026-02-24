'use client';

import * as React from 'react';
import { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';
import type { Person, Relationship, GraphNode, GraphLink } from '@/types';
import { Gender as GenderEnum, RelationshipType } from '@/types';
import { getChineseRelationshipLabel } from '@/lib/chinese-kinship';

interface FamilyTreeCanvasProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (personId: string | null) => void;
  onEditPerson?: (person: Person) => void;
}

// Color scales for generations
const MALE_COLORS: Record<number, string> = {
  [-3]: '#1E3A8A', // Blue 900
  [-2]: '#1E40AF', // Blue 800
  [-1]: '#1D4ED8', // Blue 700
  0: '#2563EB',    // Blue 600
  1: '#3B82F6',    // Blue 500
  2: '#60A5FA',    // Blue 400
  3: '#93C5FD',    // Blue 300
};

const FEMALE_COLORS: Record<number, string> = {
  [-3]: '#D97706', // Amber 600
  [-2]: '#F59E0B', // Amber 500
  [-1]: '#FBBF24', // Amber 400
  0: '#FCD34D',    // Amber 300
  1: '#FDE68A',    // Amber 200
  2: '#FEF3C7',    // Amber 100
  3: '#FFFBEB',    // Amber 50
};

const NODE_SIZE = 50;
const NODE_RADIUS = 25;

// Generation range to display: ancestors (negative) to descendants (positive)
const GENERATION_MIN = -3; // ancestors (parents, grandparents, great-grandparents)
const GENERATION_MAX = 3;  // descendants (children, grandchildren)

// Vertical spacing per generation level
const GENERATION_HEIGHT = 120;

export function FamilyTreeCanvas({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
  onEditPerson,
}: FamilyTreeCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);

  // Tooltip state for kinship term
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    kinshipTerm: string;
  }>({ visible: false, x: 0, y: 0, kinshipTerm: '' });

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Get color for a person based on gender and generation
  const getPersonColor = useCallback((person: Pick<Person, 'gender' | 'relativeGeneration'>): string => {
    const gen = person.relativeGeneration ?? 0;
    const colors = person.gender === GenderEnum.MALE ? MALE_COLORS : FEMALE_COLORS;
    return colors[gen] ?? colors[0] ?? '#6B7280';
  }, []);

  // Get kinship term from selected person to another person
  const getKinshipTerm = useCallback((fromPersonId: string, toPersonId: string): string => {
    return getChineseRelationshipLabel(fromPersonId, toPersonId, persons, relationships);
  }, [persons, relationships]);

  // Find all persons connected to a center person via relationships (BFS)
  const findConnectedPersons = useCallback((
    centerPersonId: string,
    allPersons: Person[],
    allRelationships: Relationship[]
  ): Set<string> => {
    const connectedIds = new Set<string>();
    const queue = [centerPersonId];
    connectedIds.add(centerPersonId);

    // Build adjacency list
    const adjacency = new Map<string, string[]>();
    allPersons.forEach(p => adjacency.set(p.id, []));

    allRelationships.forEach(rel => {
      const aList = adjacency.get(rel.personAId);
      const bList = adjacency.get(rel.personBId);
      if (aList) aList.push(rel.personBId);
      if (bList) bList.push(rel.personAId);
    });

    // BFS to find all connected persons
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const neighbors = adjacency.get(currentId) || [];

      for (const neighborId of neighbors) {
        if (!connectedIds.has(neighborId)) {
          connectedIds.add(neighborId);
          queue.push(neighborId);
        }
      }
    }

    return connectedIds;
  }, []);

  // Build graph data with filtering
  const buildGraphData = useCallback((centerPersonId: string | null): { nodes: GraphNode[]; links: GraphLink[]; centerId: string | null } => {
    // Determine center person
    const centerId = centerPersonId || (persons.length > 0 ? persons[0].id : null);
    if (!centerId) {
      return { nodes: [], links: [], centerId: null };
    }

    // Find all connected persons
    const connectedIds = findConnectedPersons(centerId, persons, relationships);

    // Filter persons: connected and within generation range
    const filteredPersons = persons.filter(person => {
      if (!connectedIds.has(person.id)) return false;

      const gen = person.relativeGeneration ?? 0;
      return gen >= GENERATION_MIN && gen <= GENERATION_MAX;
    });

    // Create a set of filtered person IDs
    const filteredPersonIds = new Set(filteredPersons.map(p => p.id));

    // Create nodes with initial positions based on generation
    const centerY = dimensions.height / 2;
    const nodes: GraphNode[] = filteredPersons.map((person) => {
      const gen = person.relativeGeneration ?? 0;
      // Ancestors (negative gen) at top, descendants (positive gen) at bottom
      const baseY = centerY + gen * GENERATION_HEIGHT;

      return {
        ...person,
        x: dimensions.width / 2 + (Math.random() - 0.5) * 200,
        y: baseY + (Math.random() - 0.5) * 50,
      };
    });

    // Filter out relationships that reference non-existent or filtered-out persons
    const links: GraphLink[] = relationships
      .filter((rel) => filteredPersonIds.has(rel.personAId) && filteredPersonIds.has(rel.personBId))
      .map((rel) => ({
        ...rel,
        source: rel.personAId,
        target: rel.personBId,
      }));

    return { nodes, links, centerId };
  }, [persons, relationships, dimensions, findConnectedPersons]);

  // D3 visualization
  useEffect(() => {
    if (!svgRef.current || persons.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const { nodes, links, centerId } = buildGraphData(selectedPersonId);

    if (nodes.length === 0) return;

    // Create container group for zoom/pan
    const g = svg.append('g').attr('class', 'graph-container');
    gRef.current = g;

    // Define arrow marker for directed relationships
    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 40)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', '#9CA3AF')
      .attr('d', 'M0,-5L10,0L0,5');

    // Create force simulation with generation-based y positioning
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id((d) => d.id)
        .distance(180)
        .strength(0.3))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(NODE_RADIUS + 30))
      // Custom force to keep nodes at their generation-based y position
      .force('y-generation', (alpha) => {
        const centerY = height / 2;
        nodes.forEach((node) => {
          const gen = node.relativeGeneration ?? 0;
          // Ancestors (negative gen) at top, descendants (positive gen) at bottom
          const targetY = centerY + gen * GENERATION_HEIGHT;
          // Gently pull towards target y position
          node.vy = (node.vy ?? 0) + (targetY - (node.y ?? 0)) * alpha * 0.1;
        });
      });

    simulationRef.current = simulation;

    // Draw links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', (d) => {
        switch (d.type) {
          case RelationshipType.SPOUSE:
            return '#EF4444'; // Red for spouse
          case RelationshipType.CONCUBINE:
            return '#22C55E'; // Green for concubine
          case RelationshipType.PARENT_CHILD:
            return '#4B5563'; // Dark grey for blood relation
          default:
            return '#D1D5DB';
        }
      })
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', (d) => {
        switch (d.type) {
          case RelationshipType.SPOUSE:
            return 'none';
          case RelationshipType.CONCUBINE:
            return '5,5';
          case RelationshipType.BETROTHED:
            return '2,2';
          default:
            return 'none';
        }
      })
      .attr('marker-end', (d) => {
        return d.type === RelationshipType.PARENT_CHILD ? 'url(#arrow)' : null;
      });

    // Draw nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
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
        }));

    // Node background shape
    node.append('rect')
      .attr('width', NODE_SIZE)
      .attr('height', NODE_SIZE)
      .attr('x', -NODE_RADIUS)
      .attr('y', -NODE_RADIUS)
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('fill', (d) => {
        if (d.avatar) return '#F3F4F6'; // Gray background for avatar
        return getPersonColor(d);
      })
      .attr('stroke', (d) => {
        if (d.id === selectedPersonId) return '#BE123C'; // Rose 700 for selected
        return '#374151';
      })
      .attr('stroke-width', (d) => {
        return d.id === selectedPersonId ? 3 : 1;
      });

    // Avatar image or name text
    node.each(function(d) {
      const nodeGroup = d3.select(this);

      if (d.avatar) {
        // Add clip path for avatar
        const clipId = `clip-${d.id}`;
        svg.select('defs')
          .append('clipPath')
          .attr('id', clipId)
          .append('rect')
          .attr('width', NODE_SIZE - 4)
          .attr('height', NODE_SIZE - 4)
          .attr('x', -NODE_RADIUS + 2)
          .attr('y', -NODE_RADIUS + 2)
          .attr('rx', 6)
          .attr('ry', 6);

        // Add avatar image
        nodeGroup.append('image')
          .attr('href', d.avatar)
          .attr('width', NODE_SIZE - 4)
          .attr('height', NODE_SIZE - 4)
          .attr('x', -NODE_RADIUS + 2)
          .attr('y', -NODE_RADIUS + 2)
          .attr('clip-path', `url(#${clipId})`)
          .attr('preserveAspectRatio', 'xMidYMid slice');

        // Name below node
        nodeGroup.append('text')
          .attr('y', NODE_RADIUS + 14)
          .attr('text-anchor', 'middle')
          .attr('font-size', '12px')
          .attr('fill', '#374151')
          .text(d.name.length > 8 ? d.name.substring(0, 8) + '...' : d.name);
      } else {
        // Name in center of node - increased font size and wrap long names
        const fontSize = 14;
        const maxWidth = NODE_RADIUS * 1.6;
        const name = d.name;

        nodeGroup.append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', `${fontSize}px`)
          .attr('fill', d.gender === GenderEnum.MALE ? '#FFFFFF' : '#1F2937')
          .attr('font-weight', '600')
          .each(function() {
            const text = d3.select(this);
            const textWidth = name.length * fontSize * 0.6;

            if (textWidth > maxWidth && name.length > 3) {
              // Split into two lines for long names
              const mid = Math.ceil(name.length / 2);
              const firstHalf = name.substring(0, mid);
              const secondHalf = name.substring(mid);

              text.text(null);
              text.append('tspan')
                .attr('x', 0)
                .attr('dy', '-0.3em')
                .text(firstHalf);
              text.append('tspan')
                .attr('x', 0)
                .attr('dy', '1.2em')
                .text(secondHalf);
            } else {
              text.text(name);
            }
          });
      }
    });

    // Click handler - select the person
    node.on('click', (event, d) => {
      event.stopPropagation();
      const newSelectedId = d.id === selectedPersonId ? null : d.id;
      onSelectPerson(newSelectedId);
    });

    // Hover handlers for kinship term tooltip
    node.on('mouseenter', (event, d) => {
      if (selectedPersonId && selectedPersonId !== d.id) {
        const kinshipTerm = getKinshipTerm(selectedPersonId, d.id);
        if (kinshipTerm) {
          const containerRect = containerRef.current?.getBoundingClientRect();
          if (containerRect) {
            setTooltip({
              visible: true,
              x: event.clientX - containerRect.left + 10,
              y: event.clientY - containerRect.top - 10,
              kinshipTerm,
            });
          }
        }
      }
    });

    node.on('mousemove', (event) => {
      if (tooltip.visible) {
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (containerRect) {
          setTooltip(prev => ({
            ...prev,
            x: event.clientX - containerRect.left + 10,
            y: event.clientY - containerRect.top - 10,
          }));
        }
      }
    });

    node.on('mouseleave', () => {
      setTooltip(prev => ({ ...prev, visible: false }));
    });

    // Double-click to edit
    if (onEditPerson) {
      node.on('dblclick', (event, d) => {
        event.stopPropagation();
        const person = persons.find(p => p.id === d.id);
        if (person) {
          onEditPerson(person);
        }
      });
    }

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0);

      node.attr('transform', (d) => {
        const x = d.x ?? 0;
        const y = d.y ?? 0;
        return `translate(${x}, ${y})`;
      });
    });

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [persons, relationships, dimensions, selectedPersonId, getPersonColor, buildGraphData, onSelectPerson, onEditPerson, getKinshipTerm]);

  // Empty state
  if (persons.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center bg-muted/30"
      >
        <div className="text-center">
          <svg
            viewBox="0 0 24 24"
            className="h-16 w-16 mx-auto text-muted-foreground mb-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h3 className="text-lg font-medium text-muted-foreground">
            No family members yet
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add your first family member to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden bg-muted/30">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
      />

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-lg text-xs">
        <div className="font-medium mb-2">图例</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500" />
            <span>男</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-300" />
            <span>女</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-red-500" />
            <span>配偶</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-green-500" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #22C55E 0, #22C55E 3px, transparent 3px, transparent 6px)' }} />
            <span>妾</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-gray-600" />
            <span>父母子女</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-gray-400" />
            <span>其他关系</span>
          </div>
        </div>
      </div>

      {/* Kinship term tooltip */}
      {tooltip.visible && (
        <div
          className="absolute pointer-events-none bg-popover text-popover-foreground shadow-md rounded-md px-3 py-2 text-sm border z-50"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="font-medium">{tooltip.kinshipTerm}</div>
        </div>
      )}
    </div>
  );
}
