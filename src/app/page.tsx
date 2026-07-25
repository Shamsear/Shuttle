"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "../context/SessionContext";

export default function HomePage() {
  const {
    players,
    activePlayerIds,
    queue,
    sessionMatches,
    activeMatch,
    roomCode,
    roomRole,
    courtName,
    recentCourts,
    recentCourtsLoading,
    syncError,
    joinInput,
    setJoinInput,
    handleCreateRoom,
    handleJoinRoom,
    handleDisconnectRoom,
    handleDeleteRoom,
    removeRecentCourt,
    handleResetSession,
    getDailyLeaderboard,
    showDialog
  } = useSession();

  const [courtNameInput, setCourtNameInput] = React.useState("");
  const router = useRouter();

  const activePlayers = players.filter((p) => activePlayerIds.includes(p.id));

  return (
    <div className="app-container">
      {/* Header */}
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
          {roomCode ? `${courtName}` : "ShuttleScore"}
        </h1>
        <div style={{ display: "flex", gap: "8px" }}>
          {roomCode && (
            <Link href="/players" className="glass-button" style={{ padding: "6px 12px", fontSize: "0.8rem", textDecoration: "none", fontWeight: 600 }}>
              Players roster
            </Link>
          )}
        </div>
      </header>

      {/* Main Viewport */}
      <div className="screen" style={{ marginTop: "20px" }}>
        
        {/* ================= PHASE 1: COURT SELECTION PORTAL ================= */}
        {!roomCode ? (
          <>
            {/* Info Landing Card */}
            <div className="session-summary-card glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px", background: "linear-gradient(135deg, rgba(234, 179, 8, 0.05) 0%, rgba(0, 0, 0, 0) 100%)", border: "1px solid rgba(234, 179, 8, 0.12)" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: "8px" }}>
                🏸 Live Badminton Scoring Board
              </h2>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: "1.4" }}>
                Create or join a court by invite code. ShuttleScore tracks match timelines, checks-in players, and seeds matches directly from wait queues.
              </p>
            </div>

            {/* Create & Join Court Card */}
            <div className="glass-panel flex-col gap-12" style={{ padding: "16px", marginBottom: "20px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  ⚡ Court Registry Manager
                </span>
              </div>

              <div className="flex-col gap-16">
                {/* Create Court Block */}
                <div className="flex-col gap-8" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "16px" }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
                    Create New Court (Persistent Room)
                  </span>
                  <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                    <input 
                      type="text" 
                      className="text-input" 
                      placeholder="Enter Court Name (e.g. Court 1)" 
                      value={courtNameInput}
                      onChange={(e) => setCourtNameInput(e.target.value)}
                      style={{ padding: "10px 12px", fontSize: "0.82rem", flex: 1 }}
                    />
                    <button 
                      className="glass-button" 
                      onClick={() => {
                        if (!courtNameInput.trim()) {
                          showDialog({ type: "alert", title: "Missing Name", message: "Please enter a name for the court." });
                          return;
                        }
                        handleCreateRoom(courtNameInput.trim());
                        setCourtNameInput("");
                      }}
                      style={{ 
                        padding: "10px 16px", 
                        fontSize: "0.8rem", 
                        fontWeight: 700, 
                        color: "var(--color-serve)", 
                        borderColor: "var(--color-serve)",
                        background: "rgba(234, 179, 8, 0.02)"
                      }}
                    >
                      Create
                    </button>
                  </div>
                </div>

                {/* Join Court Block */}
                <div className="flex-col gap-8">
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
                    Enter Court Invite Code
                  </span>
                  <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                    <input 
                      type="text" 
                      className="text-input" 
                      placeholder="Enter 6-char Code" 
                      value={joinInput}
                      onChange={(e) => setJoinInput(e.target.value.toUpperCase().slice(0, 6))}
                      style={{ padding: "10px 12px", fontSize: "0.82rem", textTransform: "uppercase", fontFamily: "monospace", flex: 1 }}
                    />
                    <button 
                      className="glass-button" 
                      onClick={() => handleJoinRoom(joinInput)}
                      style={{ 
                        padding: "10px 18px", 
                        fontSize: "0.8rem", 
                        fontWeight: 700, 
                        color: "var(--color-serve)", 
                        borderColor: "var(--color-serve)",
                        background: "rgba(234, 179, 8, 0.02)"
                      }}
                    >
                      Join Court
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Rejoin Recent Courts */}
            {recentCourts.length > 0 && (
              <div className="glass-panel flex-col gap-10" style={{ padding: "16px", marginBottom: "20px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  ⏳ Quick Rejoin Recent Courts
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {recentCourtsLoading ? (
                    // Pulse animation skeleton indicators
                    recentCourts.map((c) => (
                      <div 
                        key={c.code} 
                        className="glass-panel" 
                        style={{ 
                          padding: "14px", 
                          background: "rgba(255,255,255,0.015)", 
                          border: "1px solid rgba(255,255,255,0.04)",
                          borderRadius: "10px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          opacity: 0.6,
                          animation: "pulse 1.5s infinite ease-in-out"
                        }}
                      >
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div style={{ height: "12px", width: "40%", background: "rgba(255,255,255,0.08)", borderRadius: "4px" }} />
                          <div style={{ height: "8px", width: "25%", background: "rgba(255,255,255,0.05)", borderRadius: "3px" }} />
                        </div>
                        <div style={{ height: "26px", width: "80px", background: "rgba(255,255,255,0.08)", borderRadius: "6px" }} />
                      </div>
                    ))
                  ) : (
                    recentCourts.map((c) => (
                      <div 
                        key={c.code} 
                        className="glass-panel" 
                        style={{ 
                          padding: "10px 14px", 
                          background: "rgba(255,255,255,0.015)", 
                          border: "1px solid rgba(255,255,255,0.05)",
                          borderRadius: "10px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px"
                        }}
                      >
                        <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {c.name}
                          </div>
                          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                            Invite Code: {c.code}
                          </div>
                        </div>
                        
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <button 
                            className="glass-button" 
                            onClick={() => handleJoinRoom(c.code)}
                            style={{ padding: "6px 12px", fontSize: "0.72rem", fontWeight: 700, borderColor: "var(--color-serve)", color: "var(--color-serve)" }}
                          >
                            Enter Court
                          </button>
                          <button 
                            className="glass-button" 
                            onClick={() => removeRecentCourt(c.code)}
                            style={{ 
                              padding: "6px 8px", 
                              fontSize: "0.72rem", 
                              borderColor: "rgba(255,255,255,0.08)", 
                              color: "var(--text-muted)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                            title="Remove from recent list"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          
          // ================= PHASE 2: ACTIVE COURT DASHBOARD =================
          <>
            {/* Active Court Session Summary Card */}
            <div className="session-summary-card glass-panel" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
                  Active Court Dashboard
                </span>
                <span suppressHydrationWarning style={{ fontSize: "0.8rem", color: "var(--color-serve)", fontWeight: 600 }}>
                  {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1, textAlign: "center", background: "rgba(0,0,0,0.15)", padding: "10px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "white" }}>{activePlayerIds.length}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Players Roster</div>
                </div>
                <div style={{ flex: 1, textAlign: "center", background: "rgba(0,0,0,0.15)", padding: "10px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "white" }}>{sessionMatches.length}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Matches Played</div>
                </div>
              </div>

              {activeMatch ? (
                <Link 
                  href="/scoreboard"
                  className="primary-action-btn"
                  style={{
                    background: "linear-gradient(90deg, #eab308 0%, #fbbf24 100%)",
                    color: "#000000",
                    fontWeight: 800,
                    boxShadow: "0 0 15px rgba(234, 179, 8, 0.2)",
                    border: "none",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  ⚡ Active Match Board
                </Link>
              ) : (
                <button
                  className="primary-action-btn"
                  onClick={() => {
                    if (activePlayers.length < 2) {
                      showDialog({
                        type: "alert",
                        title: "Insufficient Players",
                        message: "A badminton match requires at least 2 checked-in players. Please go to the Roster page to register and check in players."
                      });
                      return;
                    }
                    router.push("/setup");
                  }}
                  style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center" }}
                >
                  New Match
                </button>
              )}
            </div>

            {/* Cloud Sync Room Panel (Connected Info) */}
            <div className="glass-panel flex-col gap-12" style={{ padding: "16px", marginBottom: "20px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  ⚡ Court Sync Panel
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "0.75rem", color: "#10b981", fontWeight: 700 }}>
                  <span className="live-pulse-dot" /> Connected (Active)
                </span>
              </div>

              <div className="flex-col gap-8">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#09090b", padding: "12px 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
                      Active Court: {courtName}
                    </div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-serve)", fontFamily: "monospace", letterSpacing: "0.05em", marginTop: "2px" }}>
                      {roomCode}
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button 
                      className="glass-button"
                      style={{ padding: "6px 10px", fontSize: "0.72rem", borderColor: "rgba(255,255,255,0.12)" }}
                      onClick={() => {
                        navigator.clipboard.writeText(roomCode);
                        showDialog({ type: "alert", title: "Copied", message: "Invite code copied!" });
                      }}
                    >
                      Copy
                    </button>
                    <button 
                      className="glass-button"
                      style={{ padding: "6px 10px", fontSize: "0.72rem", borderColor: "var(--color-serve)", color: "var(--color-serve)" }}
                      onClick={async () => {
                        const shareUrl = `${window.location.origin}?room=${roomCode}`;
                        if (navigator.share) {
                          try {
                            await navigator.share({
                              title: `Watch our live match on ${courtName}!`,
                              text: `Join Room ${roomCode} to spectate live!`,
                              url: shareUrl
                            });
                          } catch (err) {}
                        } else {
                          navigator.clipboard.writeText(shareUrl);
                          showDialog({ type: "alert", title: "Copied", message: "Direct share link copied to clipboard!" });
                        }
                      }}
                    >
                      Share
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: "1.3" }}>
                  Share this link or code with your friends to score or spectate together.
                </p>
                {syncError && (
                  <div style={{ fontSize: "0.75rem", color: "var(--color-out)", fontWeight: 600 }}>
                    ⚠️ {syncError}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
                  <button 
                    className="glass-button" 
                    onClick={handleDisconnectRoom}
                    style={{ padding: "10px", border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.8rem", width: "100%" }}
                  >
                    Exit Court Dashboard
                  </button>
                  {roomRole === "host" && (
                    <button 
                      className="glass-button" 
                      onClick={handleDeleteRoom}
                      style={{ 
                        padding: "10px", 
                        border: "1px solid rgba(244,63,94,0.15)", 
                        fontSize: "0.8rem", 
                        width: "100%", 
                        color: "var(--color-out)",
                        background: "rgba(244,63,94,0.02)"
                      }}
                    >
                      🗑️ Delete Court permanently
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Roster Queue Display */}
            {activePlayerIds.length > 0 && (
              <div className="glass-panel" style={{ padding: "16px", marginBottom: "20px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "10px", display: "flex", justifyContent: "space-between" }}>
                  <span>Waiting Queue ({queue.length})</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>First-in, first-play</span>
                </h3>
                {queue.length === 0 ? (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>
                    All players are in a match or queue is empty!
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "6px" }}>
                    {queue.map((p, idx) => (
                      <div 
                        key={p.id} 
                        style={{ 
                          padding: "6px 12px", 
                          background: "rgba(255,255,255,0.04)", 
                          borderRadius: "16px", 
                          fontSize: "0.8rem", 
                          fontWeight: 500,
                          border: "1px solid rgba(255,255,255,0.05)",
                          whiteSpace: "nowrap"
                        }}
                      >
                        <span style={{ color: "var(--color-serve)", marginRight: "4px" }}>#{idx + 1}</span> {p.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Daily Leaderboard */}
            {activePlayerIds.length > 0 && (
              <div className="glass-panel" style={{ padding: "16px", marginBottom: "20px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "12px" }}>
                  Daily Leaderboard
                </h3>
                {sessionMatches.length === 0 ? (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
                    Play matches today to establish daily leaderboard standings!
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="leaderboard-table">
                      <thead>
                        <tr>
                          <th style={{ width: "50px" }}>Rank</th>
                          <th>Player</th>
                          <th style={{ width: "70px", textAlign: "center" }}>W/L</th>
                          <th style={{ width: "80px", textAlign: "center" }}>Diff</th>
                          <th style={{ width: "80px", textAlign: "center" }}>Win %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getDailyLeaderboard().map((row: any, idx: number) => {
                          const rankClass = idx === 0 ? "rank-1" : idx === 1 ? "rank-2" : idx === 2 ? "rank-3" : "";
                          return (
                            <tr key={row.id}>
                              <td>
                                <span className={`rank-badge ${rankClass}`}>{idx + 1}</span>
                              </td>
                              <td style={{ fontWeight: 600 }}>{row.name}</td>
                              <td style={{ textAlign: "center", fontFamily: "monospace" }}>{row.wins} - {row.losses}</td>
                              <td style={{ 
                                  textAlign: "center", 
                                  fontFamily: "monospace", 
                                  fontWeight: 700,
                                  color: row.diff > 0 ? "var(--color-point)" : row.diff < 0 ? "var(--color-out)" : "inherit"
                                }}>
                                {row.diff > 0 ? `+${row.diff}` : row.diff}
                              </td>
                              <td style={{ textAlign: "center", fontFamily: "monospace" }}>{row.winRate}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Grouped Day-by-Day Session History List */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-secondary)" }}>Session History</h3>
              {sessionMatches.length > 0 && (
                <button 
                  className="glass-button" 
                  style={{ padding: "4px 8px", fontSize: "0.7rem", color: "var(--color-out)", borderColor: "rgba(244,63,94,0.15)" }}
                  onClick={handleResetSession}
                >
                  Reset Session
                </button>
              )}
            </div>

            <div className="history-section" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {sessionMatches.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "30px 0" }}>
                  No matches logged yet.
                </div>
              ) : (
                (() => {
                  const grouped: Record<string, any[]> = {};
                  sessionMatches.forEach((m) => {
                    const dateKey = m.date || "Unknown Date";
                    if (!grouped[dateKey]) grouped[dateKey] = [];
                    grouped[dateKey].push(m);
                  });
                  
                  return Object.entries(grouped).map(([date, matches]) => (
                    <div key={date} className="flex-col gap-8">
                      <div style={{ 
                        fontSize: "0.72rem", 
                        fontWeight: 700, 
                        color: "var(--color-serve)", 
                        textTransform: "uppercase", 
                        letterSpacing: "0.08em",
                        borderBottom: "1px solid rgba(234,179,8,0.12)",
                        paddingBottom: "4px",
                        marginTop: "4px"
                      }}>
                        📅 {date}
                      </div>
                      <div className="flex-col gap-8">
                        {matches.map((match) => {
                          const leftNames = match.leftPlayers.map((id: string) => players.find(p => p.id === id)?.name || "Unknown").join(" & ");
                          const rightNames = match.rightPlayers.map((id: string) => players.find(p => p.id === id)?.name || "Unknown").join(" & ");
                          const isLeftWinner = match.winnerSide === "left";
                          
                          return (
                            <div key={match.id} className="history-card glass-panel" style={{ padding: "12px", background: "rgba(255,255,255,0.01)" }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>{match.mode.toUpperCase()}</span>
                                </div>
                                <div style={{ fontSize: "0.85rem", display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "8px", alignItems: "center" }}>
                                  <span style={{ 
                                    fontWeight: isLeftWinner ? 700 : 400, 
                                    color: isLeftWinner ? "var(--color-point)" : "var(--text-primary)",
                                    textAlign: "right"
                                  }}>
                                    {leftNames}
                                  </span>
                                  <span style={{ fontSize: "0.8rem", background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: "6px", fontFamily: "monospace", fontWeight: "bold" }}>
                                    {match.leftScore} - {match.rightScore}
                                  </span>
                                  <span style={{ 
                                    fontWeight: !isLeftWinner ? 700 : 400, 
                                    color: !isLeftWinner ? "var(--color-point)" : "var(--text-primary)",
                                    textAlign: "left"
                                  }}>
                                    {rightNames}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
