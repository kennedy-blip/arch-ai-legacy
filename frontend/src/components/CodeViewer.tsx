"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FileCode,
  GitCommit,
  User,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  Search,
  ExternalLink,
  ShieldAlert,
  Flame
} from "lucide-react";
import { fetchFileContent, FileContentResponse, CallChainNode } from "@/lib/api";

interface CodeViewerProps {
  selectedNode: CallChainNode | null;
  onAskChatAboutLine: (citation: string, codeSnippet: string) => void;
}

const AVAILABLE_FILES = [
  "OrderProcessor.java",
  "PaymentGatewayClient.java",
  "RiskEvaluationService.java",
  "api_gateway.py",
  "settlement_worker.py",
  "stored_procedures.sql",
  "schema.sql"
];

export default function CodeViewer({ selectedNode, onAskChatAboutLine }: CodeViewerProps) {
  const [activeFile, setActiveFile] = useState<string>("OrderProcessor.java");
  const [fileData, setFileData] = useState<FileContentResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedLine, setCopiedLine] = useState<number | null>(null);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const codeContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // Sync active file and target line whenever selectedNode changes
  useEffect(() => {
    if (selectedNode && selectedNode.file_path) {
      const baseName = selectedNode.file_path.split("/").pop() || selectedNode.file_path;
      if (AVAILABLE_FILES.includes(baseName)) {
        setActiveFile(baseName);
      }
    }
  }, [selectedNode]);

  // Fetch file content whenever activeFile changes
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchFileContent(activeFile, 1, 100)
      .then((data) => {
        if (isMounted) {
          setFileData(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeFile]);

  // Smooth scroll to selectedNode line range
  useEffect(() => {
    if (selectedNode && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }, [selectedNode, fileData]);

  const handleCopyCitation = (lineNo: number, code: string) => {
    const citation = `${activeFile}:${lineNo}`;
    navigator.clipboard.writeText(citation);
    setCopiedLine(lineNo);
    setTimeout(() => setCopiedLine(null), 1500);
  };

  const isHighlighted = (lineNo: number): boolean => {
    if (!selectedNode) return false;
    // Check if line falls within selected node's start and end lines
    if (lineNo >= selectedNode.start_line && lineNo <= selectedNode.end_line) {
      return true;
    }
    return false;
  };

  const getLanguage = (file: string): string => {
    if (file.endsWith(".java")) return "Java";
    if (file.endsWith(".py")) return "Python";
    if (file.endsWith(".sql")) return "SQL (PostgreSQL)";
    return "Source";
  };

  const archeology = fileData?.archeology;

  return (
    <div className="flex flex-col h-full bg-[#0a0f1d] rounded-xl border border-archaeo-border overflow-hidden">
      {/* File Tabs & Header */}
      <div className="flex items-center justify-between px-3 bg-[#0d1424] border-b border-archaeo-border text-xs">
        {/* Horizontal File Tabs */}
        <div className="flex items-center overflow-x-auto scrollbar-none py-1.5 gap-1 max-w-[70%]">
          {AVAILABLE_FILES.map((file) => {
            const isActive = activeFile === file;
            return (
              <button
                key={file}
                onClick={() => setActiveFile(file)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] whitespace-nowrap transition-all border ${
                  isActive
                    ? "bg-[#18233c] text-archaeo-gold border-archaeo-gold/50 shadow font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#121c2e] border-transparent"
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>{file}</span>
              </button>
            );
          })}
        </div>

        {/* Metadata Badges */}
        <div className="flex items-center gap-2 py-1">
          <span className="px-2 py-0.5 rounded bg-black/40 text-slate-300 font-mono text-[11px] border border-slate-800">
            {getLanguage(activeFile)}
          </span>
          {archeology && (
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                archeology.legacy_risk_badge.includes("CRITICAL")
                  ? "bg-rose-950/60 text-rose-300 border-rose-800"
                  : "bg-amber-950/60 text-amber-300 border-amber-800"
              }`}
            >
              <Flame className="w-3 h-3" />
              {archeology.legacy_risk_badge}
            </span>
          )}
        </div>
      </div>

      {/* Line Provenance Bar (Archeology Banner) */}
      {archeology && (
        <div className="px-4 py-2 bg-[#10182b] border-b border-archaeo-border/70 flex flex-wrap items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-300">
              <User className="w-3.5 h-3.5 text-archaeo-gold" />
              <span>Primary Author:</span>
              <strong className="text-white font-mono">{archeology.primary_author}</strong>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Untouched:</span>
              <strong className="text-slate-200 font-mono">{archeology.days_since_last_edit} days</strong>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <GitCommit className="w-3.5 h-3.5 text-cyan-400" />
              <span>Churn:</span>
              <strong className="text-slate-200 font-mono">{archeology.churn_count} commits</strong>
            </div>
          </div>

          {selectedNode && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-archaeo-muted">Active Scope:</span>
              <span className="font-mono bg-archaeo-card px-2 py-0.5 rounded text-archaeo-gold text-[11px] border border-archaeo-border">
                {activeFile}:{selectedNode.start_line}-{selectedNode.end_line}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Code Listing with Line Provenance Gutter */}
      <div
        ref={codeContainerRef}
        className="flex-1 overflow-auto font-mono text-[12px] leading-5 bg-[#080d1a] relative select-text"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500 gap-2">
            <span className="w-2 h-2 rounded-full bg-archaeo-gold animate-ping"></span>
            <span>Parsing AST & Git Blame...</span>
          </div>
        ) : !fileData ? (
          <div className="p-8 text-center text-slate-500">No file content available</div>
        ) : (
          <div className="min-w-full inline-block py-2">
            {fileData.lines.map((l) => {
              const highlighted = isHighlighted(l.line_number);
              const blame = archeology?.blame_lines.find((b) => b.line_number === l.line_number);
              const isHovered = hoveredLine === l.line_number;
              const isTargetStart = selectedNode && selectedNode.start_line === l.line_number;

              return (
                <div
                  key={l.line_number}
                  ref={isTargetStart ? activeLineRef : undefined}
                  onMouseEnter={() => setHoveredLine(l.line_number)}
                  onMouseLeave={() => setHoveredLine(null)}
                  className={`group flex items-stretch px-2 transition-colors ${
                    highlighted
                      ? "bg-amber-950/25 border-l-4 border-archaeo-gold shadow-inner"
                      : isHovered
                      ? "bg-[#10192e]"
                      : "hover:bg-[#0c1324]"
                  }`}
                >
                  {/* Line Number */}
                  <div className="w-10 text-right pr-3 select-none text-slate-600 group-hover:text-slate-400 font-mono text-[11px]">
                    {l.line_number}
                  </div>

                  {/* Git Blame Gutter Info */}
                  <div className="w-36 hidden md:flex items-center gap-1.5 pr-2 select-none text-[10px] text-slate-500 border-r border-slate-800/80 mr-3 truncate font-mono">
                    {blame ? (
                      <>
                        <span className="text-cyan-400 truncate max-w-[50px]">{blame.short_hash}</span>
                        <span className="truncate text-slate-400 max-w-[70px]">{blame.author_name}</span>
                      </>
                    ) : (
                      <span className="text-slate-700">-</span>
                    )}
                  </div>

                  {/* Code Line Text */}
                  <div className="flex-1 whitespace-pre pr-4 text-slate-200">
                    <span
                      className={`${
                        l.code.trim().startsWith("//") || l.code.trim().startsWith("/*") || l.code.trim().startsWith("#") || l.code.trim().startsWith("--")
                          ? "text-slate-500 italic"
                          : l.code.includes("UPDATE ") || l.code.includes("INSERT ") || l.code.includes("DELETE ")
                          ? "text-amber-400 font-semibold"
                          : l.code.includes("class ") || l.code.includes("def ") || l.code.includes("public ")
                          ? "text-cyan-300 font-semibold"
                          : l.code.includes("return") || l.code.includes("throw ")
                          ? "text-purple-400"
                          : highlighted
                          ? "text-amber-100"
                          : "text-slate-200"
                      }`}
                    >
                      {l.code || " "}
                    </span>
                  </div>

                  {/* Hover Quick Action Buttons */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 select-none pr-1">
                    <button
                      onClick={() => handleCopyCitation(l.line_number, l.code)}
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition"
                      title="Copy citation [file:line]"
                    >
                      {copiedLine === l.line_number ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      onClick={() =>
                        onAskChatAboutLine(`${activeFile}:${l.line_number}`, l.code)
                      }
                      className="px-1.5 py-0.5 rounded bg-archaeo-gold/20 hover:bg-archaeo-gold text-archaeo-gold hover:text-black font-semibold text-[10px] transition"
                      title="Explain line in AI chat"
                    >
                      Explain
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CodeViewer Footer info */}
      <div className="px-3 py-1.5 bg-[#0d1424] border-t border-archaeo-border flex items-center justify-between text-[11px] text-slate-400">
        <span className="font-mono">
          File: <strong className="text-slate-200">{activeFile}</strong> ({fileData?.total_lines || 0} lines)
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-amber-400"></span> DML SQL Mutations
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-cyan-400"></span> RPC & Declarations
          </span>
        </div>
      </div>
    </div>
  );
}
