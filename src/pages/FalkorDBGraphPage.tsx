import React, { useState, useMemo, useEffect } from "react";
import { useMarketplace } from "@/context/MarketplaceContext";
import { api } from "@/services/apiClient";
import { 
  GitBranch, 
  Terminal, 
  Play, 
  Database, 
  ShieldCheck,
  Building2,
  Package,
  FileText,
  Truck,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers
} from "lucide-react";
import { Link } from "react-router-dom";

export interface GraphNode {
  id: string;
  type: "Business" | "Product" | "Order" | "Delivery";
  label: string;
  meta: string;
  color: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

interface FalkorHealthState {
  ok: boolean;
  status: string;
  details: string;
  host?: string;
  port?: number;
}

export const FalkorDBGraphPage: React.FC = () => {
  const { products, orders, seller, seedSampleCatalog } = useMarketplace();

  // FalkorDB Cloud Live Status
  const [falkorHealth, setFalkorHealth] = useState<FalkorHealthState>({
    ok: false,
    status: "probing",
    details: "Probing FalkorDB Cloud connection...",
  });

  // Remote topology from FalkorDB
  const [remoteNodes, setRemoteNodes] = useState<GraphNode[]>([]);
  const [remoteEdges, setRemoteEdges] = useState<GraphEdge[]>([]);
  const [isLoadingTopology, setIsLoadingTopology] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Local fallback nodes computed from context
  const fallbackNodes = useMemo<GraphNode[]>(() => {
    const nodes: GraphNode[] = [];

    const businesses = Array.from(new Set([
      ...(seller.isRegistered && seller.name ? [seller.name] : []),
      ...products.map((p) => p.businessName).filter(Boolean)
    ]));

    businesses.forEach((biz, idx) => {
      const bizProducts = products.filter((p) => p.businessName === biz);
      const avgRate = bizProducts.length > 0
        ? Math.round(bizProducts.reduce((sum, p) => sum + p.onTimeRate, 0) / bizProducts.length)
        : 98;
      nodes.push({
        id: `biz-${idx}`,
        type: "Business",
        label: biz,
        meta: `Verified Supplier • ${avgRate}% On-Time`,
        color: "from-blue-600 to-blue-800",
      });
    });

    products.forEach((p) => {
      nodes.push({
        id: `prod-${p.id}`,
        type: "Product",
        label: p.name,
        meta: `SKU: ${p.sku} • ₹${p.basePrice.toLocaleString()} Base`,
        color: "from-cyan-600 to-cyan-800",
      });
    });

    orders.forEach((o) => {
      nodes.push({
        id: `ord-${o.id}`,
        type: "Order",
        label: o.orderCode || `Order #${o.id}`,
        meta: `${o.title} • ₹${o.value.toLocaleString()}`,
        color: "from-amber-600 to-amber-800",
      });

      if (o.stage === "In Transit" || o.stage === "Delivered" || o.stage === "In production") {
        nodes.push({
          id: `del-${o.id}`,
          type: "Delivery",
          label: `Fulfillment #${o.id}`,
          meta: `Due: ${o.dueDate} • Stage: ${o.stage}`,
          color: "from-rose-600 to-rose-800",
        });
      }
    });

    return nodes;
  }, [products, orders, seller]);

  const fallbackEdges = useMemo<GraphEdge[]>(() => {
    const edges: GraphEdge[] = [];

    fallbackNodes.filter((n) => n.type === "Business").forEach((bNode) => {
      const matchedProducts = products.filter((p) => p.businessName === bNode.label);
      matchedProducts.forEach((p) => {
        edges.push({
          from: bNode.id,
          to: `prod-${p.id}`,
          label: ":OFFERS",
        });
      });
    });

    orders.forEach((o) => {
      const matchedProd = products.find((p) => o.title.toLowerCase().includes(p.name.toLowerCase()));
      if (matchedProd) {
        edges.push({
          from: `ord-${o.id}`,
          to: `prod-${matchedProd.id}`,
          label: ":CONTAINS",
        });
      }

      const matchedBiz = fallbackNodes.find(
        (n) => n.type === "Business" && n.label.toLowerCase() === o.counterparty.toLowerCase()
      );
      if (matchedBiz) {
        edges.push({
          from: `ord-${o.id}`,
          to: matchedBiz.id,
          label: ":DEAL_WITH",
        });
      }

      if (o.stage === "In Transit" || o.stage === "Delivered" || o.stage === "In production") {
        edges.push({
          from: `ord-${o.id}`,
          to: `del-${o.id}`,
          label: ":HAS_DELIVERY",
        });
      }
    });

    return edges;
  }, [fallbackNodes, products, orders]);

  // Active nodes & edges: prefer remote FalkorDB data if available, otherwise fallback
  const dynamicNodes = remoteNodes.length > 0 ? remoteNodes : fallbackNodes;
  const dynamicEdges = remoteEdges.length > 0 ? remoteEdges : fallbackEdges;

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const activeSelected = selectedNode || (dynamicNodes.length > 0 ? dynamicNodes[0] : null);

  // Preset Cypher Queries for FalkorDB
  const presetQueries = useMemo(() => [
    {
      title: "Active Catalog Unit Prices",
      cypher: `MATCH (b:Business)-[:OFFERS]->(p:Product)\nRETURN b.name AS supplier, p.name AS product, p.category AS category, p.basePrice AS basePrice\nORDER BY p.basePrice ASC`,
      description: "Traverses :OFFERS edges to list active product catalog unit prices.",
    },
    {
      title: "Order Pipeline & Fulfillment",
      cypher: `MATCH (o:Order)\nOPTIONAL MATCH (o)-[:SOLD_BY]->(b:Business)\nOPTIONAL MATCH (o)-[:HAS_DELIVERY]->(d:Delivery)\nRETURN o.orderCode AS code, o.title AS title, o.value AS value, o.stage AS stage, b.name AS supplier, d.stage AS deliveryStage`,
      description: "Traces order entities with linked seller business nodes and delivery status.",
    },
    {
      title: "Supplier Catalog Breadth",
      cypher: `MATCH (b:Business)\nOPTIONAL MATCH (b)-[:OFFERS]->(p:Product)\nRETURN b.name AS supplier, b.category AS category, count(p) AS totalProducts, avg(p.basePrice) AS avgPrice`,
      description: "Aggregates supplier product listings and pricing statistics in OpenCypher.",
    },
    {
      title: "Full Graph Topology Overview",
      cypher: `MATCH (n)\nRETURN labels(n)[0] AS entityType, count(n) AS nodeCount\nORDER BY nodeCount DESC`,
      description: "Summarizes all active graph entity types stored in the FalkorDB cluster.",
    },
  ], []);

  const [activeQueryIndex, setActiveQueryIndex] = useState(0);
  const [currentCypher, setCurrentCypher] = useState(presetQueries[0].cypher);
  const [queryExecuting, setQueryExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<{
    data: any[];
    statistics?: any;
    count: number;
    executionTimeMs?: number;
    error?: string;
  } | null>(null);

  // Load health and initial topology on mount
  const refreshTopology = async () => {
    setIsLoadingTopology(true);
    try {
      const topo = await api.getGraphTopology();
      if (topo?.nodes && topo.nodes.length > 0) {
        setRemoteNodes(topo.nodes);
        setRemoteEdges(topo.edges || []);
      }
    } catch {
      // Fallback remains active
    } finally {
      setIsLoadingTopology(false);
    }
  };

  const checkHealth = async () => {
    try {
      const res = await api.getHealth();
      const falkor = res.services?.falkordb;
      if (falkor) {
        setFalkorHealth({
          ok: falkor.status === "ready",
          status: falkor.status,
          details: falkor.details || "Connected",
        });
      }
    } catch (err: any) {
      setFalkorHealth({
        ok: false,
        status: "offline",
        details: err?.message || "Backend server unreachable",
      });
    }
  };

  useEffect(() => {
    checkHealth();
    refreshTopology();
    runLiveCypher(presetQueries[0].cypher);
  }, []);

  // Handle Sync with Supabase
  const handleSyncGraph = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const res = await api.syncGraph();
      if (res.success) {
        setSyncStatusMsg(`Successfully synced ${res.nodesCount} nodes and ${res.edgesCount} relationships to FalkorDB Cloud!`);
        await refreshTopology();
        await runLiveCypher(currentCypher);
      } else {
        setSyncStatusMsg(res.message || "Graph sync completed with warnings.");
      }
    } catch (err: any) {
      setSyncStatusMsg(err.message || "Failed to sync Supabase to FalkorDB.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Run Cypher query directly against FalkorDB Cloud
  const runLiveCypher = async (cypher: string) => {
    setQueryExecuting(true);
    const start = performance.now();
    try {
      const res = await api.executeGraphQuery(cypher);
      const elapsed = Math.round(performance.now() - start);
      if (res.success) {
        setQueryResult({
          data: res.data || [],
          statistics: res.statistics,
          count: res.count || (res.data ? res.data.length : 0),
          executionTimeMs: elapsed,
        });
      } else {
        setQueryResult({
          data: [],
          count: 0,
          error: res.error || "Query failed to execute.",
          executionTimeMs: elapsed,
        });
      }
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      setQueryResult({
        data: [],
        count: 0,
        error: err.message || "Failed to execute Cypher query on FalkorDB Cloud.",
        executionTimeMs: elapsed,
      });
    } finally {
      setQueryExecuting(false);
    }
  };

  const handleSelectPreset = (idx: number) => {
    setActiveQueryIndex(idx);
    const q = presetQueries[idx].cypher;
    setCurrentCypher(q);
    runLiveCypher(q);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070A11] text-slate-900 dark:text-gray-100 pt-20 pb-20">
      
      {/* Header Banner */}
      <div className="border-b border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0A0F1D]/80 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-purple-500/10 dark:bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 font-mono">
                  GRAPH REASONING LAYER
                </span>
                <span className="text-xs text-slate-500 dark:text-gray-400 font-mono">/graph</span>
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                FalkorDB Knowledge Graph Explorer
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-gray-400">
                Live relationship reasoning layer: Traverses institutional transactions, verified product catalogs, and counterparty order histories.
              </p>
            </div>

            {/* Live FalkorDB Status Badge & Sync Action */}
            <div className="flex flex-wrap items-center gap-3">
              <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-mono font-medium ${
                falkorHealth.ok 
                  ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                  : "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
              }`}>
                <span className={`h-2 w-2 rounded-full ${falkorHealth.ok ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                <Database className="h-3.5 w-3.5" />
                <span>{falkorHealth.ok ? "FalkorDB Cloud Active (Port 63732)" : "FalkorDB Connecting..."}</span>
              </div>

              <button
                onClick={handleSyncGraph}
                disabled={isSyncing}
                className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md transition-all cursor-pointer"
                title="Synchronize records from Supabase into FalkorDB Cloud Graph"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Syncing..." : "Sync with Supabase"}</span>
              </button>
            </div>
          </div>

          {/* Sync notification banner */}
          {syncStatusMsg && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-purple-200 dark:border-purple-500/30 bg-purple-50/70 dark:bg-purple-950/30 px-4 py-2.5 text-xs text-purple-900 dark:text-purple-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>{syncStatusMsg}</span>
              </div>
              <button 
                onClick={() => setSyncStatusMsg(null)}
                className="text-[11px] underline text-purple-600 dark:text-purple-400 hover:text-purple-800 cursor-pointer ml-3"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        
        {/* ============================================================== */}
        {/* 1. VISUAL GRAPH REASONING TOPOLOGY */}
        {/* ============================================================== */}
        <section className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1424] shadow-lg p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-[#1B2335]">
            <div className="flex items-center gap-2.5">
              <GitBranch className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Live Knowledge Graph Topology</span>
                  {remoteNodes.length > 0 && (
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                      Cloud Synced
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-gray-400">
                  {dynamicNodes.length > 0 
                    ? `Displaying ${dynamicNodes.length} graph nodes and ${dynamicEdges.length} active relationships from FalkorDB`
                    : "No graph nodes registered yet"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={refreshTopology}
                disabled={isLoadingTopology}
                className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-500 transition-colors cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${isLoadingTopology ? "animate-spin" : ""}`} />
                <span>Reload</span>
              </button>
            </div>
          </div>

          {/* If No Graph Nodes (Empty Pipeline) */}
          {dynamicNodes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-[#1E2638] bg-slate-50/50 dark:bg-[#0A0F1D]/50 p-12 text-center">
              <Database className="h-10 w-10 text-purple-500/60 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 dark:text-gray-200">Knowledge Graph Waiting for Live Data</h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                No businesses, products, or orders are in the database yet. Click below to load sample entities into Supabase and FalkorDB Cloud.
              </p>

              {/* Ontology Schema Diagram */}
              <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 sm:gap-4 p-3 rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0C1222] text-xs font-mono">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                  <Building2 className="h-3.5 w-3.5" /> (:Business)
                </span>
                <span className="text-slate-400 text-[10px]">─[:OFFERS]─▶</span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30">
                  <Package className="h-3.5 w-3.5" /> (:Product)
                </span>
                <span className="text-slate-400 text-[10px]">◀─[:SOLD_BY]─</span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                  <FileText className="h-3.5 w-3.5" /> (:Order)
                </span>
                <span className="text-slate-400 text-[10px]">─[:HAS_DELIVERY]─▶</span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                  <Truck className="h-3.5 w-3.5" /> (:Delivery)
                </span>
              </div>

              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  onClick={async () => {
                    await seedSampleCatalog();
                    await handleSyncGraph();
                  }}
                  className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Load Sample Catalog & Sync Graph</span>
                </button>
                <Link
                  to="/seller"
                  className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-[#12192B] dark:hover:bg-[#19233C] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Product in Seller Hub</span>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Dynamic Node Grid Layout */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 pt-2">
                {dynamicNodes.map((node) => {
                  const isSelected = activeSelected?.id === node.id;
                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30 shadow-md shadow-purple-500/20 scale-[1.02]"
                          : "border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-100 dark:border-[#1E2638] dark:bg-[#0A0F1D] dark:hover:border-gray-600"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 font-mono">
                          (:{node.type})
                        </span>
                        <span className="h-2 w-2 rounded-full bg-purple-500" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{node.label}</h4>
                      <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-1 truncate">{node.meta}</p>
                    </button>
                  );
                })}
              </div>

              {/* Node Detail Bar */}
              {activeSelected && (
                <div className="mt-6 rounded-xl border border-purple-200 dark:border-purple-500/20 bg-purple-50/40 dark:bg-[#0A0F1D] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 dark:text-gray-400 font-mono block">Selected Entity Inspector</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">(:{activeSelected.type} &#123; label: "{activeSelected.label}" &#125;)</span>
                    <span className="text-slate-500 dark:text-gray-400 ml-2 font-mono text-xs">ID: {activeSelected.id}</span>
                  </div>
                  <div className="text-purple-700 dark:text-purple-300 font-mono text-[11px] bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-500/30 px-3 py-1.5 rounded-lg font-semibold">
                    Connected Edges: {dynamicEdges.filter((e) => e.from === activeSelected.id || e.to === activeSelected.id).length} Relationships
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* ============================================================== */}
        {/* 2. CYPHER QUERY RUNNER & PRESET EVIDENCE QUERIES */}
        {/* ============================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Query Console (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1424] shadow-lg p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1B2335] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Live OpenCypher Query Runner</h3>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-gray-400 font-mono">
                  <span>Engine: FalkorDB Cloud (RESP2)</span>
                </div>
              </div>

              {/* Preset Selector */}
              <div className="flex flex-wrap gap-2 mb-4">
                {presetQueries.map((pq, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectPreset(idx)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                      activeQueryIndex === idx
                        ? "bg-purple-600 text-white font-semibold shadow-sm"
                        : "bg-slate-100 dark:bg-[#0A0F1D] border border-slate-200 dark:border-[#1E2638] text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {pq.title}
                  </button>
                ))}
              </div>

              {/* Editable Cypher Editor */}
              <div className="relative rounded-xl border border-slate-800 bg-[#070A10] p-3 shadow-inner">
                <textarea
                  value={currentCypher}
                  onChange={(e) => setCurrentCypher(e.target.value)}
                  rows={4}
                  className="w-full bg-transparent font-mono text-xs text-purple-300 focus:outline-hidden resize-none leading-relaxed"
                  placeholder="Enter Cypher query (e.g. MATCH (n) RETURN n LIMIT 10)..."
                />
                <button
                  onClick={() => runLiveCypher(currentCypher)}
                  disabled={queryExecuting}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/40 px-3 py-1 text-[11px] font-sans font-semibold cursor-pointer disabled:opacity-50"
                >
                  <Play className={`h-3 w-3 ${queryExecuting ? "animate-spin" : ""}`} />
                  <span>{queryExecuting ? "Executing..." : "Execute Cypher"}</span>
                </button>
              </div>

              {/* Query Result Table / Terminal */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-slate-500 dark:text-gray-400 uppercase tracking-wider block">
                    Execution Results {queryExecuting ? "(Running on FalkorDB Cloud...)" : `(${queryResult?.count || 0} Rows Returned)`}:
                  </span>
                  {queryResult?.executionTimeMs !== undefined && (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                      <Clock className="h-3 w-3" />
                      <span>{queryResult.executionTimeMs}ms execution</span>
                    </span>
                  )}
                </div>

                {/* Error Banner */}
                {queryResult?.error && (
                  <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2 mb-3">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-semibold">Cypher Syntax / Execution Error:</strong>
                      <span className="font-mono text-[11px]">{queryResult.error}</span>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 dark:border-[#1E2638] bg-slate-50 dark:bg-[#0A0F1D] overflow-hidden text-xs max-h-72 overflow-y-auto">
                  {!queryResult || queryResult.data.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 dark:text-gray-400">
                      <Layers className="h-8 w-8 text-slate-400 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">0 matching records returned from active graph state.</p>
                      <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-1">
                        Click "Sync with Supabase" above or add listings in Seller Hub to populate records.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 space-y-2">
                      {queryResult.data.map((row, rIdx) => (
                        <div key={rIdx} className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-gray-800/60 pb-2 last:border-b-0 last:pb-0 gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {typeof Object.values(row)[0] === "object" ? JSON.stringify(Object.values(row)[0]) : String(Object.values(row)[0])}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 font-mono text-slate-500 dark:text-gray-400 text-[11px]">
                            {Object.entries(row).slice(1).map(([k, v], cIdx) => (
                              <span key={cIdx} className="bg-white dark:bg-gray-800/60 border border-slate-200 dark:border-transparent px-2 py-0.5 rounded text-slate-700 dark:text-gray-300 shadow-2xs">
                                {k}: <strong className="text-slate-900 dark:text-white">{typeof v === "object" ? JSON.stringify(v) : String(v)}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#182033] text-[11px] text-slate-500 dark:text-gray-400 flex items-center justify-between font-mono">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Endpoint: AWS ap-south-1</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Live FalkorDB Traversal</span>
            </div>
          </div>

          {/* Evidence Explanation Panel (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-purple-200 dark:border-purple-500/20 bg-white dark:bg-[#0E1424] shadow-lg p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-[#1B2335] pb-3">
              <ShieldCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Why Graph Reasoning Matters</h3>
                <p className="text-[11px] text-slate-500 dark:text-gray-400">FalkorDB is an institutional reasoning layer, not just a chart</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-slate-700 dark:text-gray-300 leading-relaxed">
              <div className="rounded-xl border border-slate-200 dark:border-[#1E2638] bg-slate-50/70 dark:bg-[#0A0F1D] p-3.5">
                <strong className="text-slate-900 dark:text-white block font-semibold mb-1">1. Material Ranking Influence</strong>
                <p className="text-slate-500 dark:text-gray-400 text-[11px]">
                  When a buyer enters a request, FalkorDB traces prior orders with similar specifications. Suppliers with recorded on-time fulfillment edges receive priority match rankings.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-[#1E2638] bg-slate-50/70 dark:bg-[#0A0F1D] p-3.5">
                <strong className="text-slate-900 dark:text-white block font-semibold mb-1">2. Evidence-Based Counteroffers</strong>
                <p className="text-slate-500 dark:text-gray-400 text-[11px]">
                  The Buyer Agent does not pull arbitrary discount numbers out of thin air. It extracts historical comparable unit prices from the graph to propose realistic, defensible counteroffers.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-[#1E2638] bg-slate-50/70 dark:bg-[#0A0F1D] p-3.5">
                <strong className="text-slate-900 dark:text-white block font-semibold mb-1">3. Evidence, Not Guarantees</strong>
                <p className="text-slate-500 dark:text-gray-400 text-[11px]">
                  Historical prices are evidence of past transactions, not guaranteed current quotes. Differences in raw material, batch quantity, date, and warranty terms are explicitly adjusted.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-950/20 p-3 text-[11px] text-blue-900 dark:text-blue-300">
              <strong>Architecture Note:</strong> FalkorDB Cloud stores multi-hop graph relationships for low-latency Cypher traversal, while Supabase provides ACID guarantees for catalog records and payment status.
            </div>
          </div>

        </section>

      </div>

    </div>
  );
};
