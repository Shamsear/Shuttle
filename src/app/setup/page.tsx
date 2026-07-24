"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "../../context/SessionContext";
import MatchSetup from "../../components/MatchSetup";

export default function SetupPage() {
  const {
    players,
    activePlayerIds,
    queue,
    handleStartMatch,
    showDialog,
  } = useSession();
  const router = useRouter();

  const activePlayers = players.filter((p) => activePlayerIds.includes(p.id));

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
          Match Setup
        </h1>
        <Link href="/" className="glass-button" style={{ padding: "6px 12px", fontSize: "0.8rem", textDecoration: "none" }}>
          Cancel
        </Link>
      </header>

      <div className="screen" style={{ marginTop: "20px" }}>
        <MatchSetup
          activePlayers={activePlayers}
          queue={queue}
          defaultScoringSystem="classic"
          showDialog={showDialog}
          onStartMatch={(config) => {
            handleStartMatch(config);
            router.push("/scoreboard");
          }}
          onCancel={() => {
            router.push("/");
          }}
        />
      </div>
    </div>
  );
}
