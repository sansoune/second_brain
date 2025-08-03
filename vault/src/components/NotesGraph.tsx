import * as d3 from "d3";
import { useCurrentNote, useNotes } from "../hooks/use-notes";
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Network, ZoomIn, ZoomOut, RotateCcw, Home, Move } from "lucide-react";

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  group: number;
  size: number;
  backlinks: number;
  fx?: number;
  fy?: number;
}

interface GraphLink {
  source: string;
  target: string;
  value: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const NotesGraph: React.FC = () => {
  const { notes } = useNotes();
  const { currentNote, loadNote } = useCurrentNote();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isInitialized, setIsInitialized] = useState(false);
  const [simulationReady, setSimulationReady] = useState(false);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  const extractWikiLinks = useCallback((content: string): string[] => {
    const wikiLinkRegex = /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;
    const links: string[] = [];
    let match;
    while ((match = wikiLinkRegex.exec(content)) !== null) {
      if (match[1]) {
        links.push(match[1].trim());
      }
    }
    return [...new Set(links)];
  }, []);

  // Use the GraphData interface consistently
  const graphData: GraphData = useMemo(() => {
    if (!notes.length) return { nodes: [], links: [] };

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeMap = new Map<string, GraphNode>();

    notes.forEach((note) => {
      const backlinksCount = note.backlinks?.length || 0;
      const node: GraphNode = {
        id: note.id,
        title: note.title,
        group: Math.min(Math.floor(backlinksCount / 3), 5),
        size: Math.max(8, Math.min(25, 8 + backlinksCount * 2)),
        backlinks: backlinksCount,
      };
      nodes.push(node);
      nodeMap.set(note.id, node);
      nodeMap.set(note.title, node);
    });

    notes.forEach((note) => {
      const wikiLinks = extractWikiLinks(note.content);
      wikiLinks.forEach((link) => {
        const targetNode = nodeMap.get(link);
        if (targetNode && targetNode.id !== note.id) {
          links.push({
            source: note.id,
            target: targetNode.id,
            value: 1
          });
        }
      });
    });

    return { nodes, links };
  }, [notes, extractWikiLinks]);

  useEffect(() => {
    if (!svgRef.current || !graphData.nodes.length) return;

    // Only initialize once or when graph data actually changes
    if (isInitialized && graphData.nodes.length > 0) {
      // Just update the current note highlighting without full re-render
      const svg = d3.select(svgRef.current);
      const nodes = svg.selectAll('circle');
      
      nodes
        .attr('stroke', (d: any) => currentNote?.id === d.id ? '#fbbf24' : '#1f2937')
        .attr('stroke-width', (d: any) => currentNote?.id === d.id ? 3 : 1.5);
      
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = dimensions.width;
    const height = dimensions.height;

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 8])
      .on('zoom', (event: { transform: any; }) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    const container = svg.append('g');

    // Distribute nodes initially in a circle to prevent stacking
    const radius = Math.min(width, height) / 3;
    const angleStep = (2 * Math.PI) / graphData.nodes.length;
    
    graphData.nodes.forEach((node, i) => {
      const angle = i * angleStep;
      node.x = width / 2 + radius * Math.cos(angle);
      node.y = height / 2 + radius * Math.sin(angle);
    });

    // Create simulation with improved forces for closer nodes
    const simulation = d3.forceSimulation<GraphNode>(graphData.nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(graphData.links)
        .id((d: { id: any; }) => d.id)
        .distance(60) // Reduced from 100
        .strength(0.8) // Increased from 0.5
      )
      .force('charge', d3.forceManyBody().strength(-200)) // Reduced from -300
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((node: d3.SimulationNodeDatum) => (node as GraphNode).size + 3))
      .force('x', d3.forceX(width / 2).strength(0.1))
      .force('y', d3.forceY(height / 2).strength(0.1))
      .alphaDecay(0.02); // Even slower cooling for smoother transitions

    simulationRef.current = simulation;

    // Create links
    const link = container.append('g')
      .selectAll('line')
      .data(graphData.links)
      .join('line')
      .attr('stroke', '#4a5568')
      .attr('stroke-opacity', 0.8)
      .attr('stroke-width', 1.5);

    // Create nodes
    const node = container.append('g')
      .selectAll('circle')
      .data(graphData.nodes)
      .join('circle')
      .attr('r', (d: { size: any; }) => d.size)
      .attr('fill', (d: { group: number; }) => {
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
        return colors[d.group % colors.length];
      })
      .attr('stroke', (d: { id: string | undefined; }) => currentNote?.id === d.id ? '#fbbf24' : '#1f2937')
      .attr('stroke-width', (d: { id: string | undefined; }) => currentNote?.id === d.id ? 3 : 1.5)
      .style('cursor', 'pointer')
      .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))')
      .call(
        d3.drag<SVGCircleElement, GraphNode, unknown>()
          .on('start', function (event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>, d: GraphNode) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', function (event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>, d: GraphNode) {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', function (event: d3.D3DragEvent<SVGCircleElement, GraphNode, unknown>, d: GraphNode) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = undefined;
            d.fy = undefined;
          }) as any
      );

    // Add labels with better visibility
    const labels = container.append('g')
      .selectAll('text')
      .data(graphData.nodes)
      .join('text')
      .text((d: { title: any; }) => d.title.length > 20 ? d.title.substring(0, 20) + '...' : d.title)
      .attr('font-size', 11)
      .attr('font-family', 'Inter, sans-serif')
      .attr('fill', '#e2e8f0')
      .attr('text-anchor', 'middle')
      .attr('dy', (d: { size: number; }) => d.size + 18)
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .style('font-weight', '500')
      .style('text-shadow', '0 1px 2px rgba(0,0,0,0.8)');

    // Add tooltips
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.9)')
      .style('color', 'white')
      .style('padding', '12px')
      .style('border-radius', '8px')
      .style('font-size', '13px')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('border', '1px solid #374151')
      .style('box-shadow', '0 10px 25px rgba(0,0,0,0.3)');

    // Node interactions
    node
      .on('mouseover', (event: { pageX: number; pageY: number; }, d: { title: any; backlinks: any; }) => {
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip.html(`
          <div class="font-semibold">${d.title}</div>
          <div class="text-sm text-gray-300 mt-1">Backlinks: ${d.backlinks}</div>
          <div class="text-xs text-gray-400 mt-2">Click to open • Drag to move</div>
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', () => {
        tooltip.transition().duration(200).style('opacity', 0);
      })
      .on('click', (_event: any, d: { id: string; }) => {
        loadNote(d.id);
      });

    // Set simulation ready after a short delay to allow initial positioning
    setTimeout(() => {
      setSimulationReady(true);
    }, 100);

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: { source: any; }) => (d.source as any).x)
        .attr('y1', (d: { source: any; }) => (d.source as any).y)
        .attr('x2', (d: { target: any; }) => (d.target as any).x)
        .attr('y2', (d: { target: any; }) => (d.target as any).y);

      node
        .attr('cx', (d: GraphNode & { x?: number }) => d.x!)
        .attr('cy', (d: GraphNode & { y?: number }) => d.y!);

      labels
        .attr('x', (d: GraphNode & { x?: number }) => d.x!)
        .attr('y', (d: GraphNode & { y?: number }) => d.y!);
    });

    // Cleanup
    return () => {
      tooltip.remove();
      simulation.stop();
      setSimulationReady(false);
    };
  }, [graphData, dimensions, currentNote]);

  // Mark as initialized after first render
  useEffect(() => {
    if (graphData.nodes.length > 0) {
      setIsInitialized(true);
    }
  }, [graphData]);

  // Separate effect to handle current note highlighting
  useEffect(() => {
    if (!svgRef.current || !graphData.nodes.length || !isInitialized) return;
    
    const svg = d3.select(svgRef.current);
    const nodes = svg.selectAll('circle');
    
    // Update only the stroke styling for current note
    nodes
      .attr('stroke', (d: any) => currentNote?.id === d.id ? '#fbbf24' : '#1f2937')
      .attr('stroke-width', (d: any) => currentNote?.id === d.id ? 3 : 1.5);
  }, [currentNote, isInitialized, graphData.nodes.length]);

  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleZoomIn = () => {
    if (svgRef.current) {
      d3.select(svgRef.current).transition().call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 1.4
      );
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current) {
      d3.select(svgRef.current).transition().call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 0.7
      );
    }
  };

  const handleReset = () => {
    if (svgRef.current && simulationRef.current) {
      d3.select(svgRef.current).transition().call(
        d3.zoom<SVGSVGElement, unknown>().transform as any,
        d3.zoomIdentity
      );
      simulationRef.current.alpha(1).restart();
    }
  };

  const handleCenter = () => {
    if (svgRef.current) {
      const width = dimensions.width;
      const height = dimensions.height;
      d3.select(svgRef.current).transition().call(
        d3.zoom<SVGSVGElement, unknown>().transform as any,
        d3.zoomIdentity.translate(width / 2, height / 2).scale(1)
      );
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-3">
          <Network className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold">Notes Graph</h2>
          <span className="text-sm text-gray-400 bg-gray-700 px-2 py-1 rounded">
            {graphData.nodes.length} notes • {graphData.links.length} links
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomIn}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleCenter}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            title="Center View"
          >
            <Home className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative bg-gray-900">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="border border-gray-800"
          style={{ background: 'radial-gradient(circle at 50% 50%, #1f2937 0%, #111827 100%)' }}
        />
        
        {graphData.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <Network className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No notes to visualize</p>
              <p className="text-sm">Create some notes with wiki links [[like this]] to see the graph</p>
            </div>
          </div>
        )}
        
        {/* Loading indicator while simulation initializes */}
        {graphData.nodes.length > 0 && !simulationReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
            <div className="text-center text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
              <p className="text-sm">Initializing graph...</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="border-t border-gray-700 p-4 bg-gray-800">
        <div className="flex items-center gap-6 text-sm text-gray-300">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Few connections</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span>Some connections</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-yellow-500 rounded-full"></div>
            <span>Many connections</span>
          </div>
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-400">
              Click to open • Drag to move • Scroll to zoom • Current note has golden border
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesGraph;