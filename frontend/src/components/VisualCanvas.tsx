"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Network,
  Database,
  Layers,
  ShieldAlert,
  Code2,
  Sparkles
} from "lucide-react";
import { CallChainResponse, SequenceStep, CallChainNode } from "@/lib/api";

interface VisualCanvasProps {
  data: CallChainResponse;
  selectedNodeId: string | null;
  onSelectNode: (node: CallChainNode | null, step?: SequenceStep) => void;
}

export default function VisualCanvas({
  data,
  selectedNodeId,
  onSelectNode
}: VisualCanvasProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [filterMode, setFilterMode] = useState<"ALL" | "RPC_ONLY" | "MUTATIONS_ONLY">("ALL");
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  const lifelines = data.lifelines || [];
  const sequenceSteps = (data.sequence_steps || []).filter((s) => {
    if (filterMode === "RPC_ONLY") return s.is_rpc;
    if (filterMode === "MUTATIONS_ONLY") return s.is_mutation;
    return true;
  });

  // Calculate layout geometry
  const LIFELINE_WIDTH = 180;
  const LIFELINE_GAP = 50;
  const HEADER_HEIGHT = 90;
  const STEP_HEIGHT = 65;
  const canvasWidth = Math.max(900, lifelines.length * (LIFELINE_WIDTH + LIFELINE_GAP) + 100);
  const canvasHeight = Math.max(550, HEADER_HEIGHT + sequenceSteps.length * STEP_HEIGHT + 120);

  const getLifelineX = (componentId: string): number => {
    // Fuzzy match component ID to lifeline index
    const idx = lifelines.findIndex(
      (l) =>
        l.id.toLowerCase() === componentId.toLowerCase() ||
        componentId.toLowerCase().includes(l.id.toLowerCase()) ||
        l.name.toLowerCase().includes(componentId.toLowerCase())
    );
    if (idx === -1) {
      // Default to PostgresDB if database table or stored proc
      if (componentId.toLowerCase().includes("table") || componentId.toLowerCase().includes("sql") || componentId.toLowerCase().includes("proc")) {
        const dbIdx = lifelines.findIndex((l) => l.type === "DATABASE");
        if (dbIdx !== -1) return 60 + dbIdx * (LIFELINE_WIDTH + LIFELINE_GAP) + LIFELINE_WIDTH / 2;
      }
      return 60 + LIFELINE_WIDTH / 2;
    }
    return 60 + idx * (LIFELINE_WIDTH + LIFELINE_GAP) + LIFELINE_WIDTH / 2;
  };

  // Playback timer
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= sequenceSteps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1600);
    } else if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, sequenceSteps.length]);

  // Sync selected node with step change
  useEffect(() => {
    const currentStep = sequenceSteps[currentStepIndex];
    if (currentStep) {
      const matchedNode =
        data.nodes.find((n) => n.id === currentStep.target || n.component === currentStep.target) ||
        data.nodes.find((n) => n.id === currentStep.source) ||
        null;
      if (matchedNode) {
        onSelectNode(matchedNode, currentStep);
      }
    }
  }, [currentStepIndex]);

  const handleStepClick = (index: number) => {
    setCurrentStepIndex(index);
    setIsPlaying(false);
  };

  const activeStep = sequenceSteps[currentStepIndex];

  return (
    <div className="flex flex-col h-full bg-[#0b101c] rounded-xl border border-archaeo-border overflow-hidden select-none">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#0e1626] border-b border-archaeo-border text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <Layers className="w-3.5 h-3.5 text-archaeo-gold" />
            Execution Sequence Flow
          </span>
          <span className="bg-archaeo-card px-2 py-0.5 rounded text-archaeo-muted border border-archaeo-border font-mono">
            {sequenceSteps.length} hops
          </span>
          {activeStep && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#172338] border border-blue-900/60 text-slate-300">
              <span className="font-mono text-archaeo-gold font-bold">Step {activeStep.step}:</span>
              <span className="font-mono truncate max-w-[260px]">{activeStep.action}</span>
              {activeStep.is_rpc && (
                <span className="bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.5 text-[10px] rounded font-semibold">
                  RPC
                </span>
              )}
              {activeStep.is_mutation && (
                <span className="bg-amber-950 text-amber-400 border border-amber-800 px-1.5 py-0.5 text-[10px] rounded font-semibold">
                  MUTATION
                </span>
              )}
            </div>
          )}
        </div>

        {/* Playback & View Controls */}
        <div className="flex items-center gap-2">
          {/* Filter Pills */}
          <div className="flex items-center bg-[#141e33] p-0.5 rounded border border-archaeo-border mr-2">
            <button
              onClick={() => setFilterMode("ALL")}
              className={`px-2 py-0.5 rounded transition ${filterMode === "ALL" ? "bg-archaeo-gold text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode("RPC_ONLY")}
              className={`px-2 py-0.5 rounded transition ${filterMode === "RPC_ONLY" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
            >
              RPC Only
            </button>
            <button
              onClick={() => setFilterMode("MUTATIONS_ONLY")}
              className={`px-2 py-0.5 rounded transition ${filterMode === "MUTATIONS_ONLY" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
            >
              DB Mutations
            </button>
          </div>

          {/* Stepper Buttons */}
          <button
            onClick={() => {
              setCurrentStepIndex((p) => Math.max(0, p - 1));
              setIsPlaying(false);
            }}
            disabled={currentStepIndex === 0}
            className="p-1.5 rounded bg-archaeo-card hover:bg-slate-800 text-slate-300 disabled:opacity-40 border border-archaeo-border"
            title="Previous Step"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-2.5 py-1.5 rounded bg-archaeo-gold text-black font-semibold flex items-center gap-1 hover:bg-amber-400 transition"
            title={isPlaying ? "Pause Flow" : "Play Flow"}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isPlaying ? "Pause" : "Play"}</span>
          </button>
          <button
            onClick={() => {
              setCurrentStepIndex((p) => Math.min(sequenceSteps.length - 1, p + 1));
              setIsPlaying(false);
            }}
            disabled={currentStepIndex >= sequenceSteps.length - 1}
            className="p-1.5 rounded bg-archaeo-card hover:bg-slate-800 text-slate-300 disabled:opacity-40 border border-archaeo-border"
            title="Next Step"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Zoom controls */}
          <div className="flex items-center ml-2 border-l border-archaeo-border pl-2 gap-1">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.1))}
              className="p-1.5 rounded bg-archaeo-card hover:bg-slate-800 text-slate-400 hover:text-white border border-archaeo-border"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] text-slate-400 w-9 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
              className="p-1.5 rounded bg-archaeo-card hover:bg-slate-800 text-slate-400 hover:text-white border border-archaeo-border"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1.5 rounded bg-archaeo-card hover:bg-slate-800 text-slate-400 hover:text-white border border-archaeo-border"
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Sequence Diagram Canvas */}
      <div className="flex-1 overflow-auto relative p-6 bg-[#080c14] scroll-smooth">
        <div
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: "top left",
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            transition: "transform 0.15s ease-out"
          }}
          className="relative"
        >
          {/* Lifeline Headers (Participants across top) */}
          <div className="flex gap-[50px] pl-[60px] absolute top-0 left-0">
            {lifelines.map((line) => {
              const isDb = line.type === "DATABASE";
              const isRpc = line.type === "RPC_GATEWAY";
              return (
                <div
                  key={line.id}
                  style={{ width: `${LIFELINE_WIDTH}px` }}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border shadow-lg transition-all ${
                    isDb
                      ? "bg-purple-950/40 border-purple-600/60 text-purple-200"
                      : isRpc
                      ? "bg-cyan-950/40 border-cyan-600/60 text-cyan-200"
                      : "bg-[#121c2e] border-slate-700/80 text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {isDb && <Database className="w-4 h-4 text-purple-400" />}
                    {isRpc && <Network className="w-4 h-4 text-cyan-400" />}
                    {!isDb && !isRpc && <Code2 className="w-4 h-4 text-amber-400" />}
                    <span className="font-semibold text-xs tracking-wide truncate max-w-[140px]">
                      {line.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-black/40 font-mono uppercase text-slate-400">
                      {line.language}
                    </span>
                    <span className="text-[10px] text-slate-400">{line.type}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* SVG for Lifeline Vertical Guides & Sequence Arrows */}
          <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
          >
            <defs>
              {/* Arrowhead Markers */}
              <marker id="arrow-default" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <polygon points="0 1, 8 4, 0 7" fill="#60a5fa" />
              </marker>
              <marker id="arrow-rpc" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                <polygon points="0 1, 9 4.5, 0 8" fill="#06b6d4" />
              </marker>
              <marker id="arrow-mutation" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                <polygon points="0 1, 9 4.5, 0 8" fill="#f59e0b" />
              </marker>
              <marker id="arrow-active" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
                <polygon points="0 1, 10 5, 0 9" fill="#f59e0b" />
              </marker>
            </defs>

            {/* Vertical Lifeline Dashed Tracks */}
            {lifelines.map((line) => {
              const x = getLifelineX(line.id);
              return (
                <g key={`track-${line.id}`}>
                  <line
                    x1={x}
                    y1={HEADER_HEIGHT}
                    x2={x}
                    y2={canvasHeight - 30}
                    stroke="#1e293b"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  {/* Lifeline activation bar in background */}
                  <rect
                    x={x - 6}
                    y={HEADER_HEIGHT + 10}
                    width="12"
                    height={canvasHeight - HEADER_HEIGHT - 60}
                    fill="#152136"
                    rx="3"
                    stroke="#334155"
                    strokeWidth="1"
                  />
                </g>
              );
            })}

            {/* Render Sequence Step Message Arrows */}
            {sequenceSteps.map((step, idx) => {
              const fromX = getLifelineX(step.source);
              const toX = getLifelineX(step.target);
              const y = HEADER_HEIGHT + 35 + idx * STEP_HEIGHT;
              const isActive = idx === currentStepIndex;
              const isPast = idx < currentStepIndex;

              const isSelfCall = Math.abs(fromX - toX) < 10;
              const isLeftToRight = toX >= fromX;

              let strokeColor = isActive ? "#f59e0b" : step.is_rpc ? "#06b6d4" : step.is_mutation ? "#f59e0b" : "#60a5fa";
              let markerId = isActive
                ? "url(#arrow-active)"
                : step.is_rpc
                ? "url(#arrow-rpc)"
                : step.is_mutation
                ? "url(#arrow-mutation)"
                : "url(#arrow-default)";

              if (!isPast && !isActive) {
                strokeColor = "#334155";
              }

              if (isSelfCall) {
                // Curved loop for internal method invocation
                const loopRadius = 24;
                return (
                  <path
                    key={`step-arrow-${step.step}`}
                    d={`M ${fromX + 6} ${y} C ${fromX + loopRadius * 2} ${y - 12}, ${fromX + loopRadius * 2} ${y + 20}, ${fromX + 6} ${y + 12}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isActive ? "2.5" : "1.8"}
                    markerEnd={markerId}
                  />
                );
              }

              return (
                <g key={`step-arrow-${step.step}`} className="transition-all duration-300">
                  {/* Active Step Glow Background */}
                  {isActive && (
                    <line
                      x1={fromX}
                      y1={y}
                      x2={toX + (isLeftToRight ? -6 : 6)}
                      y2={y}
                      stroke="rgba(245, 158, 11, 0.3)"
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                  )}

                  <line
                    x1={fromX}
                    y1={y}
                    x2={toX + (isLeftToRight ? -6 : 6)}
                    y2={y}
                    stroke={strokeColor}
                    strokeWidth={isActive ? "2.5" : "1.8"}
                    strokeDasharray={step.is_rpc ? "6 4" : undefined}
                    markerEnd={markerId}
                  />

                  {/* Pulsing Token along active wire */}
                  {isActive && (
                    <circle cx={(fromX + toX) / 2} cy={y} r="4.5" fill="#f59e0b" className="animate-ping" />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Interactive HTML Badges and Labels over arrows */}
          {sequenceSteps.map((step, idx) => {
            const fromX = getLifelineX(step.source);
            const toX = getLifelineX(step.target);
            const midX = (fromX + toX) / 2;
            const y = HEADER_HEIGHT + 35 + idx * STEP_HEIGHT;
            const isActive = idx === currentStepIndex;

            return (
              <div
                key={`badge-${step.step}`}
                onClick={() => handleStepClick(idx)}
                style={{
                  left: `${midX}px`,
                  top: `${y - 14}px`,
                  transform: "translateX(-50%)"
                }}
                className={`absolute cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-all duration-200 z-10 border shadow-md ${
                  isActive
                    ? "bg-[#1a1505] border-archaeo-gold text-archaeo-gold ring-2 ring-archaeo-gold/30 scale-105"
                    : step.is_rpc
                    ? "bg-[#081822] border-cyan-800 text-cyan-300 hover:border-cyan-500"
                    : step.is_mutation
                    ? "bg-[#21160a] border-amber-800 text-amber-300 hover:border-amber-500"
                    : "bg-[#101726] border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isActive ? "bg-archaeo-gold text-black" : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {step.step}
                </span>

                <span className="font-semibold">{step.action}</span>

                {step.is_rpc && (
                  <span className="text-[9px] px-1 rounded bg-cyan-950 text-cyan-400 border border-cyan-700">
                    RPC
                  </span>
                )}
                {step.is_mutation && (
                  <span className="text-[9px] px-1 rounded bg-amber-950 text-amber-400 border border-amber-700">
                    SQL
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Step Detail Bar */}
      <div className="px-4 py-3 bg-[#0d1424] border-t border-archaeo-border flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span className="text-slate-400">Internal Call</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
            <span className="text-slate-400">RPC / Network Boundary</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span className="text-slate-400">Database Table Mutation</span>
          </div>
        </div>

        {activeStep && (
          <div className="text-slate-300 flex items-center gap-2">
            <span className="text-archaeo-muted">Active Node:</span>
            <span className="font-mono bg-archaeo-card px-2 py-0.5 rounded border border-archaeo-border text-archaeo-gold">
              {activeStep.target}
            </span>
            <span className="text-slate-400 text-[11px] max-w-sm truncate">
              {activeStep.description}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
