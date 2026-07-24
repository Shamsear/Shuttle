import React from "react";
import { MatchState, Side } from "../utils/badmintonEngine";
import CourtVisualizer from "./CourtVisualizer";

interface ScoreboardProps {
  state: MatchState;
  onRallyWinner: (winnerSide: Side) => void;
  onRallyError?: (errorSide: Side) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSwapSides: () => void;
  onEndMatch: () => void;
}

// SVG Icons
const UndoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle" }}>
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </svg>
);

const RedoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle" }}>
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
  </svg>
);

const SwapIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle" }}>
    <path d="M7 21V10M3 17l4 4 4-4M17 3v11M21 7l-4-4-4 4" />
  </svg>
);

export default function Scoreboard({
  state,
  onRallyWinner,
  onUndo,
  onRedo,
  onSwapSides,
  onEndMatch,
}: ScoreboardProps) {
  const { left, right, servingSide, scoringSystem } = state;

  const getTeamNames = (side: Side) => {
    const sideObj = side === "left" ? left : right;
    const players = sideObj.players.filter((p) => p !== null);
    if (players.length === 0) return side === "left" ? "Team A" : "Team B";
    return players.map((p) => p!.name).join(" & ");
  };

  const leftTeamName = getTeamNames("left");
  const rightTeamName = getTeamNames("right");

  const isClassic = scoringSystem === "classic";
  const isLeftServing = servingSide === "left";

  // Dynamic button labels based on rules (Classic = Point vs Side-Out, Rally = Rally Win)
  const leftButtonTitle = isClassic
    ? isLeftServing
      ? "Team A Point (+1)"
      : "Side-Out (Serve Team A)"
    : "Team A Rally Win";

  const leftButtonSub = isClassic
    ? isLeftServing
      ? "Server Scores & Swaps"
      : "Gain Serve (No Point)"
    : leftTeamName;

  const rightButtonTitle = isClassic
    ? !isLeftServing
      ? "Team B Point (+1)"
      : "Side-Out (Serve Team B)"
    : "Team B Rally Win";

  const rightButtonSub = isClassic
    ? !isLeftServing
      ? "Server Scores & Swaps"
      : "Gain Serve (No Point)"
    : rightTeamName;

  const canUndo = state.history.length > 0;
  const canRedo = state.future && state.future.length > 0;

  return (
    <div className="scoreboard-layout">
      {/* 1. Scoreboard HUD - Positioned at the top */}
      <div className="scoreboard-header-hud">
        {/* Left Team (Bottom Team) Score Card */}
        <div className="hud-team-score-card left-team">
          <div className={`hud-score-digits ${servingSide === "left" ? "serving" : ""}`}>
            {left.score}
          </div>
          <div className={`hud-team-label ${servingSide === "left" ? "serving" : ""}`}>
            {leftTeamName} {servingSide === "left" && "•"}
          </div>
        </div>

        {/* HUD Center Divider with Rules Badge */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="hud-divider">VS</div>
          <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", fontWeight: 700 }}>
            {isClassic ? "Classic" : "Rally"}
          </span>
        </div>

        {/* Right Team (Top Team) Score Card */}
        <div className="hud-team-score-card right-team">
          <div className={`hud-team-label ${servingSide === "right" ? "serving" : ""}`}>
            {servingSide === "right" && "•"} {rightTeamName}
          </div>
          <div className={`hud-score-digits ${servingSide === "right" ? "serving" : ""}`}>
            {right.score}
          </div>
        </div>
      </div>

      {/* 2. SVG Court Visualizer - Positioned in the center */}
      <CourtVisualizer state={state} />

      {/* 3. Scoring inputs - Side-by-Side Tap Zones */}
      <div className="rally-tap-zones-container">
        {/* Team A Tap button */}
        <div 
          className={`rally-tap-button left-win ${isClassic && !isLeftServing ? "side-out-btn" : ""}`}
          onClick={() => onRallyWinner("left")}
        >
          <span className="rally-tap-title">{leftButtonTitle}</span>
          <span className="rally-tap-sub">{leftButtonSub}</span>
        </div>

        {/* Team B Tap button */}
        <div 
          className={`rally-tap-button right-win ${isClassic && isLeftServing ? "side-out-btn" : ""}`}
          onClick={() => onRallyWinner("right")}
        >
          <span className="rally-tap-title">{rightButtonTitle}</span>
          <span className="rally-tap-sub">{rightButtonSub}</span>
        </div>
      </div>

      {/* 4. Action bar at the bottom */}
      <div className="floating-controls-bar">
        {/* Undo Button */}
        <button 
          className="glass-button icon-only-btn" 
          onClick={onUndo}
          title="Undo last point"
          disabled={!canUndo}
          style={{ opacity: canUndo ? 1 : 0.3 }}
        >
          <UndoIcon />
        </button>

        {/* Redo Button */}
        <button 
          className="glass-button icon-only-btn" 
          onClick={onRedo}
          title="Redo last point"
          disabled={!canRedo}
          style={{ opacity: canRedo ? 1 : 0.3 }}
        >
          <RedoIcon />
        </button>

        <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", flex: 1, textAlign: "center" }}>
          Swipe Right to Undo • Left to Redo
        </div>

        {/* Swap Sides button */}
        <button 
          className="glass-button icon-only-btn" 
          onClick={onSwapSides}
          title="Swap sides visually"
        >
          <SwapIcon />
        </button>

        {/* End match / Cancel */}
        <button 
          className="glass-button control-btn"
          style={{ border: "1px solid rgba(244, 63, 94, 0.2)", color: "#fb7185", background: "rgba(244, 63, 94, 0.05)" }}
          onClick={onEndMatch}
        >
          Discard
        </button>
      </div>
    </div>
  );
}
