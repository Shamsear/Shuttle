"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "../../context/SessionContext";
import PlayerPool from "../../components/PlayerPool";

export default function PlayersPage() {
  const {
    players,
    activePlayerIds,
    sessionMatches,
    handleAddPlayer,
    handleTogglePlayerActive,
  } = useSession();

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img 
            src="/logo.jpg" 
            alt="ShuttleScore Logo" 
            style={{ 
              width: "28px", 
              height: "28px", 
              borderRadius: "6px", 
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 0 8px rgba(234,179,8,0.15)"
            }} 
          />
          Players
        </h1>
        <Link href="/" className="glass-button" style={{ padding: "6px 12px", fontSize: "0.8rem", textDecoration: "none" }}>
          Back
        </Link>
      </header>

      <div className="screen" style={{ marginTop: "20px" }}>
        <PlayerPool
          players={players}
          activePlayerIds={activePlayerIds}
          sessionMatches={sessionMatches}
          onAddPlayer={handleAddPlayer}
          onTogglePlayerActive={handleTogglePlayerActive}
          onClose={() => {
            // Programmatically go back to home screen
            window.location.href = "/";
          }}
        />
      </div>
    </div>
  );
}
