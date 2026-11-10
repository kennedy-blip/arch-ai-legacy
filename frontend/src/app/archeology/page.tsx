"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Layers,
  Sparkles,
  GitGraph,
  Database,
  Network,
  RefreshCw,
  FolderOpen,
  ArrowLeft,
  ShieldCheck,
  Flame,
  Search,
  BookOpen
} from "lucide-react";

import VisualCanvas from "@/components/VisualCanvas";
import CodeViewer from "@/components/CodeViewer";
import AIChatSidebar from "@/components/AIChatSidebar";
import {
  fetchCallChain,
  fetchGraphStats,
  loadSampleRepo,
  CallChainResponse,
  CallChainNode,
  SequenceStep,
  StatsResponse
} from "@/lib/api";

export default function ArcheologyWorkspace() {
  const [callChainData, setCallChainData] = useState<CallChainResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<CallChainNode | null>(null);
  const [selectedStep, setSelectedStep] = useState<SequenceStep | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [externalPrompt, setExternalPrompt] = useState<{ citation: string; codeSnippet: string } | null>(null);

  // Load initial graph and statistics
  const loadWorkspaceData = async () => {
    setLoading(true);
    try {
      const [chainRes, statsRes] = await Promise.all([
        fetchCallChain("OrderProcessor.java:OrderProcessor.processOrder", 4),
        fetchGraphStats()
      ]);
      setCallChainData(chainRes);
      setStats(statsRes);
      if (chainRes.nodes.length > 0) {
        setSelectedNode(chainRes.nodes[1] || chainRes.nodes[0]);
      }
    } catch (err) {
      console.error("Workspace initial load failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const handleSelectNode = (node: CallChainNode | null, step?: SequenceStep) => {
    setSelectedNode(node);
    if (step) setSelectedStep(step);
  };

  const handleNavigateCitation = (filePath: string, lineNumber: number) => {
    if (!callChainData) return;
    // Find node matching file path or create synthetic focus
    const matched = callChainData.nodes.find((n) => n.file_path.endsWith(filePath));
    if (matched) {
      setSelectedNode({
        ...matched,
        start_line: lineNumber,
        end_line: lineNumber + 15
      });
    } else {
      setSelectedNode({
        id: `${filePath}:${lineNumber}`,
        name: filePath,
        label: `${filePath}:${lineNumber}`,
        language: filePath.endsWith(".java") ? "java" : filePath.endsWith(".py") ? "python" : "sql",
        file_path: filePath,
        start_line: lineNumber,
        end_line: lineNumber + 15,
        type: filePath.endsWith(".sql") ? "DatabaseTable" : "Function",
        is_rpc: false,
        is_stored_proc: filePath.includes("proc"),
        signature: filePath,
        component: filePath,
        risk: "CRITICAL_LEGACY",
        author: "Legacy Team"
      });
    }
  };

  const handleAskChatAboutLine = (citation: string, codeSnippet: string) => {
    setExternalPrompt({ citation, codeSnippet });
  };

  const handleReloadSampleRepo = async () => {
    setLoading(true);
    await loadSampleRepo();
    await loadWorkspaceData();
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070b14] text-slate-100 overflow-hidden font-sans">
      {/* Top Enterprise Navigation Bar */}
      <header className="h-14 bg-[#0a0f1d] border-b border-archaeo-border px-4 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 group text-slate-300 hover:text-white transition"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-archaeo-gold to-amber-700 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-amber-950/40">
              <Layers className="w-4 h-4 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-wide text-white">ARCHAEO-CODE</span>
                <span className="text-[10px] bg-[#1a233a] text-archaeo-gold border border-amber-900/40 px-1.5 py-0.5 rounded font-mono">
                  v1.0
                </span>
              </div>
              <div className="text-[10px] text-archaeo-muted hidden sm:block">
                Legacy Infrastructure & Code Archeology Platform
              </div>
            </div>
          </Link>

          {/* Active Target Indicator */}
          <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-archaeo-border text-xs">
            <span className="text-archaeo-muted">Target Codebase:</span>
            <span className="font-mono bg-[#111a2e] px-2.5 py-1 rounded-md border border-archaeo-border text-slate-200 flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-archaeo-gold" />
              sample_legacy_repo (Banking Core)
            </span>
          </div>
        </div>

        {/* Global Statistics Chips */}
        <div className="hidden md:flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-[#101728] px-2.5 py-1 rounded border border-archaeo-border">
            <GitGraph className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">Functions:</span>
            <strong className="text-slate-200 font-mono">
              {stats?.graph_statistics.functions || 28}
            </strong>
          </div>
          <div className="flex items-center gap-1.5 bg-[#101728] px-2.5 py-1 rounded border border-archaeo-border">
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Tables:</span>
            <strong className="text-amber-400 font-mono">
              {stats?.graph_statistics.tables || 4}
            </strong>
          </div>
          <div className="flex items-center gap-1.5 bg-[#101728] px-2.5 py-1 rounded border border-archaeo-border">
            <Network className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">RPC Hops:</span>
            <strong className="text-cyan-400 font-mono">
              {callChainData?.blast_radius.rpc_boundaries_crossed || 2}
            </strong>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleReloadSampleRepo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141e33] hover:bg-[#1a2845] border border-archaeo-border text-xs font-semibold text-slate-200 transition"
            title="Reload and re-parse sample repository"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-archaeo-gold" : ""}`} />
            <span className="hidden sm:inline">Reload Legacy Demo</span>
          </button>

          <Link
            href="/"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-archaeo-card hover:bg-slate-800 border border-archaeo-border text-xs text-slate-300 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
        </div>
      </header>

      {/* Main Workspace Layout (VisualCanvas + CodeViewer + AIChatSidebar) */}
      <main className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Left / Center Area: Vertical Split between Sequence Diagram and Code Viewer */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Top Panel: Execution Sequence Diagram */}
          <div className="h-[48%] min-h-[280px]">
            {callChainData ? (
              <VisualCanvas
                data={callChainData}
                selectedNodeId={selectedNode ? selectedNode.id : null}
                onSelectNode={handleSelectNode}
              />
            ) : (
              <div className="h-full rounded-xl bg-archaeo-card border border-archaeo-border flex items-center justify-center">
                <span className="text-slate-500 font-mono text-xs">Loading Knowledge Graph...</span>
              </div>
            )}
          </div>

          {/* Bottom Panel: Syntax-Highlighted Code Viewer with Line Provenance */}
          <div className="flex-1 min-h-[300px]">
            <CodeViewer
              selectedNode={selectedNode}
              onAskChatAboutLine={handleAskChatAboutLine}
            />
          </div>
        </div>

        {/* Right Area: Collapsible Grounded AI Chat & Blast Radius Radar */}
        <div className="w-[420px] shrink-0 h-full">
          <AIChatSidebar
            selectedNode={selectedNode}
            onNavigateCitation={handleNavigateCitation}
            externalPrompt={externalPrompt}
          />
        </div>
      </main>
    </div>
  );
}
