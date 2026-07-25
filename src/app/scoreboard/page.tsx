"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../../context/SessionContext";
import Scoreboard from "../../components/Scoreboard";

const TrophyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "16px" }}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
    <path d="M12 2a5 5 0 0 0-5 5v4c0 2.2 1.8 4 4 4h2c2.2 0 4-1.8 4-4V7a5 5 0 0 0-5-5z" />
  </svg>
);

export default function ScoreboardPage() {
  const {
    activeMatch,
    voiceEnabled,
    roomCode,
    roomRole,
    winnerCelebration,
    handleToggleVoice,
    handleRallyWinner,
    handleUndoAction,
    handleRedoAction,
    handleSwapSidesAction,
    handleDiscardMatch,
    handleSaveMatch,
  } = useSession();
  const router = useRouter();

  // If no match is active, redirect to home page
  React.useEffect(() => {
    if (!activeMatch && !winnerCelebration) {
      router.push("/");
    }
  }, [activeMatch, winnerCelebration, router]);

  if (!activeMatch && !winnerCelebration) {
    return (
      <div className="app-container flex-col align-center justify-center" style={{ minHeight: "100vh" }}>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No active match found. Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="app-container no-scroll" style={{ padding: 0, height: "100dvh", overflow: "hidden" }}>
      {activeMatch && (
        <Scoreboard
          state={activeMatch}
          voiceEnabled={voiceEnabled}
          isReadOnly={roomCode !== null && roomRole === "viewer"}
          onToggleVoice={handleToggleVoice}
          onRallyWinner={handleRallyWinner}
          onUndo={handleUndoAction}
          onRedo={handleRedoAction}
          onSwapSides={handleSwapSidesAction}
          onEndMatch={() => {
            handleDiscardMatch();
            router.push("/");
          }}
        />
      )}

      {/* Celebration Overlay */}
      {winnerCelebration && (
        <div className="celebration-overlay">
          <TrophyIcon />
          <h2 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: "8px", color: "var(--color-point)" }}>
            Match Complete!
          </h2>
          <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "white", marginBottom: "24px" }}>
            {winnerCelebration.winnerNames} Won!
          </p>
          
          {activeMatch && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", padding: "16px", borderRadius: "12px", width: "100%", maxWidth: "260px", marginBottom: "32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{activeMatch.left.players.filter(Boolean).map(p => p!.name).join("/")}</span>
                <span style={{ fontWeight: 800, color: "white" }}>{activeMatch.left.score}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{activeMatch.right.players.filter(Boolean).map(p => p!.name).join("/")}</span>
                <span style={{ fontWeight: 800, color: "white" }}>{activeMatch.right.score}</span>
              </div>
            </div>
          )}

          <button 
            className="primary-action-btn"
            style={{ maxWidth: "260px", background: "var(--color-point)", color: "white" }}
            onClick={() => {
              handleSaveMatch();
              router.push("/");
            }}
          >
            Confirm Stats & Next Match
          </button>
        </div>
      )}
    </div>
  );
}
