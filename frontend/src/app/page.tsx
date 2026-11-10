"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Layers,
  Sparkles,
  GitGraph,
  Database,
  Network,
  ShieldAlert,
  ArrowRight,
  Code2,
  Terminal,
  Server,
  Flame,
  CheckCircle2,
  ExternalLink,
  Cpu
} from "lucide-react";
import { ingestRepository, loadSampleRepo } from "@/lib/api";

export default function DashboardLanding() {
  const router = useRouter();
  const [repoPath, setRepoPath] = useState<string>("./sample_legacy_repo");
  const [loading, setLoading] = useState<boolean>(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setIngestStatus("Parsing Polyglot ASTs (Java, Python, SQL) & Git Blame History...");

    try {
      if (repoPath.includes("sample")) {
        await loadSampleRepo();
      } else {
        await ingestRepository(repoPath);
      }
      setIngestStatus("Knowledge Graph successfully populated in Neo4j. Launching Archeology Workspace...");
      setTimeout(() => {
        router.push("/archeology");
      }, 1000);
    } catch (err) {
      console.warn("Direct ingest error, launching workspace:", err);
      router.push("/archeology");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans select-none">
      {/* Top Navbar */}
      <nav className="h-16 border-b border-archaeo-border bg-[#0a0f1d]/90 backdrop-blur px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-archaeo-gold to-amber-700 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-950/40">
            <Layers className="w-5 h-5 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-wider text-white">ARCHAEO-CODE</span>
              <span className="text-[10px] bg-amber-950/80 text-archaeo-gold border border-amber-800/80 px-2 py-0.5 rounded font-mono font-bold">
                ENTERPRISE
              </span>
            </div>
            <p className="text-[11px] text-archaeo-muted hidden sm:block">
              Legacy Infrastructure & Distributed Code Archeology
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111a2e] border border-archaeo-border">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-300 font-mono">Neo4j 5.x & Qdrant Online</span>
          </div>

          <Link
            href="/archeology"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-archaeo-gold hover:bg-amber-400 text-black font-semibold text-xs transition shadow-md shadow-amber-950/30"
          >
            <span>Open Archeology Canvas</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 flex flex-col gap-12">
        {/* Title and Executive Hook */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#121c33] border border-archaeo-gold/30 text-archaeo-gold text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Reverse-Engineer Without Breaking Production</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Illuminate Hidden <span className="text-transparent bg-clip-text bg-gradient-to-r from-archaeo-gold to-amber-400">Blast Radius</span> in Legacy Systems
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Archaeo-Code parses polyglot ASTs (Java, Python, SQL), maps Git commit and blame history,
            indexes code entities into a Neo4j Knowledge Graph, and surfaces execution flows through
            interactive sequence diagrams and grounded AI chat with strict line citations.
          </p>
        </div>

        {/* Ingestion & Launch Card */}
        <div className="max-w-2xl w-full mx-auto bg-gradient-to-b from-[#10192e] to-[#0d1424] rounded-2xl border border-archaeo-border p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-archaeo-gold" />
              <h2 className="font-semibold text-sm uppercase tracking-wider text-slate-200">
                Codebase Ingestion Engine
              </h2>
            </div>
            <span className="text-xs text-archaeo-muted font-mono">Polyglot AST + Git Blame</span>
          </div>

          <form onSubmit={handleIngest} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5">
                Target Repository Path or Git Directory:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  placeholder="./sample_legacy_repo"
                  className="flex-1 bg-[#070b14] border border-archaeo-border rounded-lg px-3.5 py-2.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-archaeo-gold transition"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-lg bg-archaeo-gold hover:bg-amber-400 text-black font-bold text-xs transition flex items-center gap-2 disabled:opacity-50 shrink-0 shadow"
                >
                  {loading ? (
                    <>
                      <span className="w-3 h-3 rounded-full bg-black animate-ping"></span>
                      <span>Ingesting...</span>
                    </>
                  ) : (
                    <>
                      <span>Ingest & Explore</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Demo Pre-load Button */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-archaeo-border/60 text-xs">
              <span className="text-archaeo-muted text-[11px]">
                Want instant exploration without configuring a local repo?
              </span>
              <button
                type="button"
                onClick={() => {
                  setRepoPath("./sample_legacy_repo");
                  handleIngest({ preventDefault: () => {} } as any);
                }}
                className="text-archaeo-gold hover:text-amber-300 font-mono font-semibold underline text-[11px] flex items-center gap-1"
              >
                <span>Load Multi-Service Banking Demo (Java + Python + SQL)</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {/* Ingestion status notice */}
            {ingestStatus && (
              <div className="p-3 rounded-lg bg-[#14233e] border border-blue-800 text-xs text-blue-200 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                <span>{ingestStatus}</span>
              </div>
            )}
          </form>
        </div>

        {/* Feature Grid / Architectural Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Pillar 1 */}
          <div className="p-5 rounded-xl bg-[#0d1424] border border-archaeo-border hover:border-archaeo-gold/40 transition group">
            <div className="w-10 h-10 rounded-lg bg-blue-950/60 border border-blue-800 flex items-center justify-center text-blue-400 mb-3 group-hover:scale-105 transition">
              <Code2 className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-white mb-1.5">
              Polyglot AST Extraction
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tree-Sitter parsers for Java, Python, and SQL. Extracts classes, methods, stored procedures,
              and cross-process RPC boundaries without compiling legacy dependencies.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="p-5 rounded-xl bg-[#0d1424] border border-archaeo-border hover:border-archaeo-gold/40 transition group">
            <div className="w-10 h-10 rounded-lg bg-amber-950/60 border border-amber-800 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition">
              <GitGraph className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-white mb-1.5">
              Git Blame Archeology
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Correlates line-level Git history to identify code untouched for 5+ years, high churn hotfixes,
              and code written by retired engineers with zero characterization tests.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="p-5 rounded-xl bg-[#0d1424] border border-archaeo-border hover:border-archaeo-gold/40 transition group">
            <div className="w-10 h-10 rounded-lg bg-rose-950/60 border border-rose-800 flex items-center justify-center text-rose-400 mb-3 group-hover:scale-105 transition">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-white mb-1.5">
              Downstream Blast Radius
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Multi-hop Cypher call-chain traversal reveals transitive dependencies, database table mutations,
              and hidden stored procedure side effects before any refactoring starts.
            </p>
          </div>
        </div>

        {/* Live Archeology Snapshot Preview */}
        <div className="p-6 rounded-2xl bg-[#0c1222] border border-archaeo-border flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              <span className="font-semibold text-sm text-white">
                Live Knowledge Graph Ready
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive execution sequence diagrams, line provenance code viewers, and grounded AI chat available.
            </p>
          </div>

          <Link
            href="/archeology"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-archaeo-gold to-amber-500 text-black font-bold text-xs hover:opacity-90 transition flex items-center gap-2 shadow-lg shadow-amber-950/40 shrink-0"
          >
            <span>Launch Archeology Canvas</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-archaeo-border px-8 flex items-center justify-between text-xs text-archaeo-muted bg-[#080d19]">
        <span>Archaeo-Code Platform • Enterprise Distributed Systems Archeology</span>
        <span className="font-mono text-[11px]">Tree-Sitter • Neo4j • Qdrant • Redis</span>
      </footer>
    </div>
  );
}
