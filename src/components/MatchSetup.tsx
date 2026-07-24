import React, { useState } from "react";
import Link from "next/link";
import { ScoringSystem } from "../utils/badmintonEngine";
import { Player } from "./PlayerPool";

interface MatchSetupProps {
  activePlayers: Player[];
  queue: Player[];
  defaultScoringSystem: ScoringSystem;
  onStartMatch: (config: {
    mode: "singles" | "doubles";
    scoringSystem: ScoringSystem;
    leftPlayers: Player[];
    rightPlayers: Player[];
  }) => void;
  onCancel: () => void;
  showDialog: (config: {
    type: "alert" | "confirm";
    title: string;
    message: string;
    onConfirm?: () => void;
  }) => void;
}

// Icons
const BoltIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const ShuttleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v20M5 12h14M8 7l4-5 4 5" />
    <path d="M6 18c0-3.3 2.7-6 6-6s6 2.7 6 6" opacity="0.8" />
  </svg>
);

const TrophyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
    <path d="M12 2a7 7 0 0 0-7 7v4.66a7 7 0 0 0 14 0V9a7 7 0 0 0-7-7z" />
  </svg>
);

export default function MatchSetup({
  activePlayers,
  queue,
  defaultScoringSystem,
  onStartMatch,
  onCancel,
  showDialog,
}: MatchSetupProps) {
  const [mode, setMode] = useState<"singles" | "doubles">("singles");
  const [scoringSystem, setScoringSystem] = useState<ScoringSystem>(defaultScoringSystem);
  const [leftPlayerIds, setLeftPlayerIds] = useState<string[]>(["", ""]);
  const [rightPlayerIds, setRightPlayerIds] = useState<string[]>(["", ""]);

  const handleModeChange = (newMode: "singles" | "doubles") => {
    setMode(newMode);
    setLeftPlayerIds(["", ""]);
    setRightPlayerIds(["", ""]);
  };

  const handleAutofill = () => {
    const queueList = [...queue];
    if (mode === "singles") {
      const p1 = queueList[0]?.id || "";
      const p2 = queueList[1]?.id || "";
      setLeftPlayerIds([p1, ""]);
      setRightPlayerIds([p2, ""]);
    } else {
      const p1 = queueList[0]?.id || "";
      const p2 = queueList[1]?.id || "";
      const p3 = queueList[2]?.id || "";
      const p4 = queueList[3]?.id || "";
      setLeftPlayerIds([p1, p2]);
      setRightPlayerIds([p3, p4]);
    }
  };

  const handleStart = () => {
    const leftCount = mode === "singles" ? 1 : 2;
    const rightCount = mode === "singles" ? 1 : 2;

    const selectedLeft: Player[] = [];
    const selectedRight: Player[] = [];

    for (let i = 0; i < leftCount; i++) {
      const id = leftPlayerIds[i];
      if (!id) {
        showDialog({ type: "alert", title: "Missing Player", message: `Choose Player ${i + 1} for Team A (Bottom)` });
        return;
      }
      const player = activePlayers.find((p) => p.id === id);
      if (player) selectedLeft.push(player);
    }

    for (let i = 0; i < rightCount; i++) {
      const id = rightPlayerIds[i];
      if (!id) {
        showDialog({ type: "alert", title: "Missing Player", message: `Choose Player ${i + 1} for Team B (Top)` });
        return;
      }
      const player = activePlayers.find((p) => p.id === id);
      if (player) selectedRight.push(player);
    }

    const allSelectedIds = [...selectedLeft, ...selectedRight].map((p) => p.id);
    const uniqueSelectedIds = new Set(allSelectedIds);
    if (allSelectedIds.length !== uniqueSelectedIds.size) {
      showDialog({ type: "alert", title: "Duplicate Selection", message: "A player cannot be selected multiple times in a match!" });
      return;
    }

    onStartMatch({
      mode,
      scoringSystem,
      leftPlayers: selectedLeft,
      rightPlayers: selectedRight,
    });
  };

  const renderPlayerSelect = (
    team: "left" | "right",
    index: number,
    label: string
  ) => {
    const selectedIds = team === "left" ? leftPlayerIds : rightPlayerIds;
    const setSelectedIds = team === "left" ? setLeftPlayerIds : setRightPlayerIds;
    const value = selectedIds[index];

    const availablePlayers = activePlayers.filter((p) => {
      if (p.id === value) return true;
      const isSelectedOnLeft = leftPlayerIds.includes(p.id);
      const isSelectedOnRight = rightPlayerIds.includes(p.id);
      return !isSelectedOnLeft && !isSelectedOnRight;
    });

    return (
      <div className="flex-col gap-8" key={`${team}-${index}`} style={{ width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {label}
          </label>
          {value && (
            <span style={{ fontSize: "0.7rem", color: "var(--color-accent)", fontWeight: 700 }}>
              Checked In
            </span>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <select
            className="player-select-dropdown"
            value={value}
            onChange={(e) => {
              const newIds = [...selectedIds];
              newIds[index] = e.target.value;
              setSelectedIds(newIds);
            }}
            style={{
              paddingLeft: value ? "42px" : "16px",
              borderColor: value ? "var(--color-accent)" : "rgba(255,255,255,0.08)",
              background: value ? "#18181b" : "#0d0d0d"
            }}
          >
            <option value="">-- Choose Player --</option>
            {availablePlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
          {value && (
            <div style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "var(--color-accent)",
              color: "#000000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.65rem",
              fontWeight: 800,
              pointerEvents: "none"
            }}>
              {activePlayers.find(p => p.id === value)?.name.substring(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (activePlayers.length < 2) {
    return (
      <div className="setup-container flex-col gap-20" style={{ textAlign: "center", padding: "30px 20px" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>⚠️</div>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "white", marginBottom: "8px" }}>
          Insufficient Checked-In Players
        </h3>
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: "1.4", marginBottom: "20px" }}>
          A badminton match requires at least 2 checked-in players. Please go to the Roster page to register and check in players.
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button 
            className="glass-button" 
            style={{ padding: "10px 20px", fontSize: "0.8rem", fontWeight: 700 }}
            onClick={onCancel}
          >
            Go Back
          </button>
          <Link 
            href="/players" 
            className="glass-button" 
            style={{ 
              padding: "10px 20px", 
              fontSize: "0.8rem", 
              fontWeight: 700, 
              color: "var(--color-serve)", 
              borderColor: "var(--color-serve)",
              background: "rgba(234, 179, 8, 0.02)",
              textDecoration: "none"
            }}
          >
            Manage Roster
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-container flex-col gap-20">
      <h2 style={{ fontSize: "1.35rem", fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
        Match Setup
      </h2>
      
      {/* Game Mode Selector */}
      <div className="flex-col gap-8">
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Match Format
        </span>
        <div className="mode-selector" style={{ background: "#0d0d0d", padding: "4px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            className={`glass-button ${mode === "singles" ? "active" : ""}`}
            onClick={() => handleModeChange("singles")}
            style={{ flex: 1, padding: "12px 0", border: "none", borderRadius: "10px" }}
          >
            Singles (1v1)
          </button>
          <button
            className={`glass-button ${mode === "doubles" ? "active" : ""}`}
            onClick={() => handleModeChange("doubles")}
            style={{ flex: 1, padding: "12px 0", border: "none", borderRadius: "10px" }}
          >
            Doubles (2v2)
          </button>
        </div>
      </div>

      {/* Rules Selector */}
      <div className="flex-col gap-8">
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Scoring Rules
        </span>
        <div className="mode-selector" style={{ background: "#0d0d0d", padding: "4px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            className={`glass-button ${scoringSystem === "classic" ? "active" : ""}`}
            onClick={() => setScoringSystem("classic")}
            style={{ flex: 1, padding: "12px 0", border: "none", borderRadius: "10px" }}
          >
            Classic Rules
          </button>
          <button
            className={`glass-button ${scoringSystem === "rally" ? "active" : ""}`}
            onClick={() => setScoringSystem("rally")}
            style={{ flex: 1, padding: "12px 0", border: "none", borderRadius: "10px" }}
          >
            Rally Rules
          </button>
        </div>
      </div>

      {/* Autofill Trigger */}
      {queue.length > 0 && (
        <button 
          className="glass-button" 
          onClick={handleAutofill}
          style={{ 
            padding: "14px", 
            border: "1px dashed var(--color-accent)", 
            color: "var(--color-accent)", 
            background: "rgba(234, 179, 8, 0.03)", 
            width: "100%",
            fontSize: "0.85rem",
            borderRadius: "12px"
          }}
        >
          <span style={{ marginRight: "6px", display: "inline-flex", alignItems: "center" }}><BoltIcon /></span>
          Autofill from Queue ({queue.length} waiting)
        </button>
      )}

      {/* Team B (Top Court) Selection */}
      <div className="setup-segment-card glass-panel flex-col gap-16">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "10px" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Team B (Top Court)
          </span>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-out)", boxShadow: "0 0 8px var(--color-out-glow)" }}></span>
        </div>
        <div className="player-selector-grid flex-col gap-12">
          {renderPlayerSelect("right", 0, mode === "singles" ? "Player Profile" : "Left Court Position")}
          {mode === "doubles" && renderPlayerSelect("right", 1, "Right Court Position")}
        </div>
      </div>

      {/* Team A (Bottom Court) Selection */}
      <div className="setup-segment-card glass-panel flex-col gap-16">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "10px" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Team A (Bottom Court)
          </span>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-point)", boxShadow: "0 0 8px var(--color-point-glow)" }}></span>
        </div>
        <div className="player-selector-grid flex-col gap-12">
          {renderPlayerSelect("left", 0, mode === "singles" ? "Player Profile" : "Left Court Position")}
          {mode === "doubles" && renderPlayerSelect("left", 1, "Right Court Position")}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex-col gap-12" style={{ marginTop: "8px" }}>
        <button className="primary-action-btn" onClick={handleStart} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          <ShuttleIcon /> Start Match
        </button>
        <button
          className="glass-button"
          onClick={onCancel}
          style={{ padding: "14px", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
