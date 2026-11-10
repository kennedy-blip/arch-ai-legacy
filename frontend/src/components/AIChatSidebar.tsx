"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  ShieldAlert,
  Flame,
  ArrowRight,
  Database,
  Network,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { streamExplain, BlastRadius, CallChainNode } from "@/lib/api";

interface Message {
  id: string;
  sender: "user" | "archaeo";
  text: string;
  blastRadius?: BlastRadius;
  timestamp: string;
}

interface AIChatSidebarProps {
  selectedNode: CallChainNode | null;
  onNavigateCitation: (filePath: string, lineNumber: number) => void;
  externalPrompt?: { citation: string; codeSnippet: string } | null;
}

const PRESET_PROMPTS = [
  "What breaks if I modify processOrder()?",
  "Audit hidden database side-effects & stored procedures",
  "Design safe Strangler Fig anti-corruption layer"
];

export default function AIChatSidebar({
  selectedNode,
  onNavigateCitation,
  externalPrompt
}: AIChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "archaeo",
      text: "### Archaeo-Code Intelligence Online\n\nI have parsed the polyglot AST call chains, Git blame history, and database mutation graph.\n\nSelect any node in the sequence diagram or click a preset prompt below to trace down-stream blast radius and plan safe refactoring.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [inputText, setInputText] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [latestBlastRadius, setLatestBlastRadius] = useState<BlastRadius | null>(null);
  const [showRadar, setShowRadar] = useState<boolean>(true);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-trigger when an external prompt arrives from CodeViewer
  useEffect(() => {
    if (externalPrompt) {
      const q = `Explain line [${externalPrompt.citation}]: "${externalPrompt.codeSnippet.trim()}" and evaluate its downstream side-effects.`;
      handleSendMessage(q);
    }
  }, [externalPrompt]);

  // Auto-scroll on new tokens
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleSendMessage = async (queryText?: string) => {
    const q = (queryText || inputText).trim();
    if (!q || isStreaming) return;

    setInputText("");
    const userMsgId = `usr_${Date.now()}`;
    const archaeoMsgId = `arc_${Date.now()}`;

    // Append user message
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: "user",
        text: q,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      },
      {
        id: archaeoMsgId,
        sender: "archaeo",
        text: "",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);

    setIsStreaming(true);

    let accumulatedText = "";

    await streamExplain(
      q,
      selectedNode ? selectedNode.id : undefined,
      (token: string) => {
        accumulatedText += token;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === archaeoMsgId ? { ...m, text: accumulatedText } : m
          )
        );
      },
      (metadata: any) => {
        if (metadata && metadata.blast_radius) {
          setLatestBlastRadius(metadata.blast_radius);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === archaeoMsgId
                ? { ...m, blastRadius: metadata.blast_radius }
                : m
            )
          );
        }
      }
    );

    setIsStreaming(false);
  };

  /**
   * Parses markdown and turns citation links like [OrderProcessor.java:16] into clickable interactive pills
   */
  const renderFormattedMessage = (content: string) => {
    const citationRegex = /\[([a-zA-Z0-9_\-.]+\.(?:java|py|sql)):(\d+)(?:-(\d+))?\]/g;
    const parts: (string | React.ReactNode)[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = citationRegex.exec(content)) !== null) {
      // Push preceding text
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      const file = match[1];
      const line = parseInt(match[2], 10);
      const fullCitation = match[0];

      parts.push(
        <button
          key={`cit-${match.index}`}
          onClick={() => onNavigateCitation(file, line)}
          className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-archaeo-gold/20 hover:bg-archaeo-gold text-archaeo-gold hover:text-black font-mono text-[11px] font-bold border border-archaeo-gold/40 transition cursor-pointer shadow-sm"
          title={`Click to navigate to ${file} at line ${line}`}
        >
          <span>{fullCitation}</span>
          <ExternalLink className="w-2.5 h-2.5 inline" />
        </button>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return (
      <div className="space-y-2 text-xs leading-relaxed text-slate-200">
        {parts.map((p, i) => (
          <React.Fragment key={i}>
            {typeof p === "string" ? (
              <span className="whitespace-pre-wrap">{p}</span>
            ) : (
              p
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0e1c] rounded-xl border border-archaeo-border overflow-hidden">
      {/* Sidebar Header */}
      <div className="px-4 py-3 bg-[#0d1424] border-b border-archaeo-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-archaeo-gold" />
          <h2 className="font-semibold text-xs tracking-wider uppercase text-slate-200">
            Archaeo-RAG Intelligence
          </h2>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Neo4j Grounded
        </span>
      </div>

      {/* Blast Radius Radar Panel (Collapsible) */}
      {latestBlastRadius && (
        <div className="bg-[#12192d] border-b border-archaeo-border text-xs">
          <div
            onClick={() => setShowRadar(!showRadar)}
            className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-[#162039] transition select-none"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span className="font-semibold text-slate-200 text-[11px] uppercase tracking-wider">
                Blast Radius Radar
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  latestBlastRadius.risk_score > 75
                    ? "bg-rose-950 text-rose-300 border border-rose-800"
                    : "bg-amber-950 text-amber-300 border border-amber-800"
                }`}
              >
                {latestBlastRadius.risk_score}/100 {latestBlastRadius.risk_category}
              </span>
            </div>
            {showRadar ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </div>

          {showRadar && (
            <div className="px-4 pb-3 pt-1 grid grid-cols-2 gap-2 text-[11px]">
              {/* Mutated Tables */}
              <div className="p-2 rounded bg-[#0b101c] border border-archaeo-border">
                <div className="flex items-center gap-1 text-slate-400 mb-1">
                  <Database className="w-3 h-3 text-amber-400" />
                  <span className="font-semibold">Mutated Tables</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {latestBlastRadius.mutated_tables.map((t) => (
                    <span
                      key={t}
                      className="px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700 font-mono text-[10px]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* RPC & Invocations */}
              <div className="p-2 rounded bg-[#0b101c] border border-archaeo-border">
                <div className="flex items-center gap-1 text-slate-400 mb-1">
                  <Network className="w-3 h-3 text-cyan-400" />
                  <span className="font-semibold">RPC Boundaries</span>
                </div>
                <div className="text-cyan-300 font-mono font-bold text-xs">
                  {latestBlastRadius.rpc_boundaries_crossed} remote hop(s)
                </div>
              </div>

              {/* Upstream & Downstream Counts */}
              <div className="col-span-2 flex items-center justify-between p-2 rounded bg-[#0b101c] border border-archaeo-border">
                <div className="text-slate-400">
                  Direct Callers Impacted:{" "}
                  <strong className="text-rose-400 font-mono">{latestBlastRadius.upstream_caller_count}</strong>
                </div>
                <div className="text-slate-400">
                  Downstream Dependencies:{" "}
                  <strong className="text-amber-400 font-mono">{latestBlastRadius.downstream_function_count}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat Messages Log */}
      <div
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 font-sans select-text"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[92%] rounded-xl p-3 border shadow-md ${
                m.sender === "user"
                  ? "bg-[#182844] border-blue-700/60 text-slate-100"
                  : "bg-[#0e1628] border-archaeo-border text-slate-200"
              }`}
            >
              {renderFormattedMessage(m.text)}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 px-1">
              {m.sender === "user" ? "You" : "Archaeo-RAG"} • {m.timestamp}
            </span>
          </div>
        ))}

        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-archaeo-gold px-2">
            <span className="w-2 h-2 rounded-full bg-archaeo-gold animate-ping"></span>
            <span>Synthesizing multi-hop call-chains and line citations...</span>
          </div>
        )}
      </div>

      {/* Preset Suggestions */}
      <div className="px-3 py-1.5 bg-[#0b101d] border-t border-archaeo-border flex flex-wrap gap-1.5">
        {PRESET_PROMPTS.map((p, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(p)}
            className="text-[10px] px-2 py-1 rounded bg-[#131d33] hover:bg-archaeo-gold hover:text-black text-slate-300 border border-slate-700/60 transition truncate max-w-full"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-3 bg-[#0d1424] border-t border-archaeo-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask about functions, tables, or blast radius..."
            disabled={isStreaming}
            className="flex-1 bg-[#080d1a] border border-archaeo-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-archaeo-gold transition"
          />
          <button
            type="submit"
            disabled={isStreaming || !inputText.trim()}
            className="px-3 py-2 rounded-lg bg-archaeo-gold text-black font-semibold hover:bg-amber-400 disabled:opacity-40 transition flex items-center justify-center"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
