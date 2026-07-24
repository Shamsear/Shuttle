import React, { useState } from "react";

export interface PlayerStats {
  wins: number;
  losses: number;
  errors: number;
  points: number;
}

export interface Player {
  id: string;
  name: string;
  stats: PlayerStats;
}

interface MatchRecord {
  id: string;
  date: string;
  mode: "singles" | "doubles";
  leftPlayers: string[];
  rightPlayers: string[];
  leftScore: number;
  rightScore: number;
  winnerSide: "left" | "right";
}

interface PlayerPoolProps {
  players: Player[];
  activePlayerIds: string[];
  sessionMatches: MatchRecord[];
  onAddPlayer: (name: string) => void;
  onTogglePlayerActive: (id: string) => void;
  onDeletePlayer: (id: string) => void;
  onRenamePlayer: (id: string, newName: string) => void;
  onClose: () => void;
}

// Icons
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const ActiveCheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-point)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SparkleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: "4px" }}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

export default function PlayerPool({
  players,
  activePlayerIds,
  sessionMatches,
  onAddPlayer,
  onTogglePlayerActive,
  onDeletePlayer,
  onRenamePlayer,
  onClose,
}: PlayerPoolProps) {
  const [newPlayerName, setNewPlayerName] = useState("");
  const [activeTab, setActiveTab] = useState<"checkin" | "all" | "analytics">("checkin");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    onAddPlayer(newPlayerName.trim());
    setNewPlayerName("");
  };

  const getWinRate = (stats: PlayerStats) => {
    const total = stats.wins + stats.losses;
    if (total === 0) return "-";
    return `${Math.round((stats.wins / total) * 100)}%`;
  };

  // Partner chemistry calculator
  const getBestPartner = (playerId: string) => {
    const doubleMatches = sessionMatches.filter(m => m.mode === "doubles");
    
    // Track wins/losses with each partner
    const partnerStats: Record<string, { wins: number; total: number }> = {};

    doubleMatches.forEach(match => {
      const isLeft = match.leftPlayers.includes(playerId);
      const isRight = match.rightPlayers.includes(playerId);
      
      if (!isLeft && !isRight) return;

      const isWinner = (isLeft && match.winnerSide === "left") || (isRight && match.winnerSide === "right");
      const teammates = isLeft ? match.leftPlayers : match.rightPlayers;
      const partnerId = teammates.find(id => id !== playerId);

      if (partnerId) {
        if (!partnerStats[partnerId]) {
          partnerStats[partnerId] = { wins: 0, total: 0 };
        }
        partnerStats[partnerId].total += 1;
        if (isWinner) {
          partnerStats[partnerId].wins += 1;
        }
      }
    });

    let bestPartnerId = "";
    let highestRate = -1;
    let mostMatches = 0;

    Object.entries(partnerStats).forEach(([id, data]) => {
      const rate = data.wins / data.total;
      // Tie breaker: rate, then total matches played together
      if (rate > highestRate || (rate === highestRate && data.total > mostMatches)) {
        highestRate = rate;
        bestPartnerId = id;
        mostMatches = data.total;
      }
    });

    if (!bestPartnerId) return "No matches";

    const partnerName = players.find(p => p.id === bestPartnerId)?.name || "Unknown";
    const winRatePercent = Math.round(highestRate * 100);
    return `${partnerName} (${winRatePercent}% WR)`;
  };

  const activePlayersList = players.filter((p) => activePlayerIds.includes(p.id));

  return (
    <div className="players-layout flex-col gap-20">
      <h2 style={{ fontSize: "1.35rem", fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: "-0.02em", textTransform: "uppercase" }}>
        Players Database
      </h2>

      {/* Add Player Form */}
      <form onSubmit={handleSubmit} className="add-player-form">
        <input
          type="text"
          className="text-input"
          placeholder="Enter player name..."
          value={newPlayerName}
          onChange={(e) => setNewPlayerName(e.target.value)}
        />
        <button 
          type="submit" 
          className="glass-button" 
          style={{ padding: "0 18px", background: "var(--color-accent)", border: "none" }}
        >
          <PlusIcon />
        </button>
      </form>

      {players.length === 0 && (
        <div style={{ padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "12px", textAlign: "center" }}>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>No players in roster. Add players using the input above to get started!</p>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="mode-selector">
        <button
          className={`glass-button ${activeTab === "checkin" ? "active" : ""}`}
          onClick={() => setActiveTab("checkin")}
          style={{ padding: "10px 0", fontSize: "0.78rem", flex: 1 }}
        >
          Check-In ({activePlayerIds.length})
        </button>
        <button
          className={`glass-button ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
          style={{ padding: "10px 0", fontSize: "0.78rem", flex: 1 }}
        >
          Roster ({players.length})
        </button>
        <button
          className={`glass-button ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => setActiveTab("analytics")}
          style={{ padding: "10px 0", fontSize: "0.78rem", flex: 1 }}
        >
          Chemistry
        </button>
      </div>

      {/* Player List */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
        {activeTab === "checkin" && (
          activePlayersList.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0", fontSize: "0.9rem" }}>
              Roster is empty. Toggle players active under the &quot;Roster&quot; tab.
            </div>
          ) : (
            activePlayersList.map((player) => (
              <div key={player.id} className="player-row glass-panel" style={{ borderLeft: "3px solid var(--color-target)", padding: "12px 16px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{player.name}</div>
                  <div className="player-stats-mini">
                    <span className="player-stat-badge">Winrate: {getWinRate(player.stats)}</span>
                    <span className="player-stat-badge">Wins: {player.stats.wins}</span>
                    <span className="player-stat-badge">Losses: {player.stats.losses}</span>
                    <span className="player-stat-badge">Errors: {player.stats.errors}</span>
                  </div>
                </div>
                <button
                  className="glass-button"
                  style={{ 
                    padding: "6px 12px", 
                    fontSize: "0.75rem", 
                    color: "var(--color-out)", 
                    borderColor: "rgba(244, 63, 94, 0.15)",
                    background: "rgba(244, 63, 94, 0.02)"
                  }}
                  onClick={() => onTogglePlayerActive(player.id)}
                >
                  Deactivate
                </button>
              </div>
            ))
          )
        )}

        {activeTab === "all" && (
          players.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0", fontSize: "0.9rem" }}>
              No player records found. Add players using the form above.
            </div>
          ) : (
            players.map((player) => {
              const isActive = activePlayerIds.includes(player.id);
              const isEditing = editingId === player.id;
              return (
                <div
                  key={player.id}
                  className={`player-row glass-panel ${isActive ? "selected" : ""}`}
                  style={{ padding: "12px 16px" }}
                >
                  <div
                    style={{ flex: 1, cursor: isEditing ? "default" : "pointer" }}
                    onClick={() => { if (!isEditing) onTogglePlayerActive(player.id); }}
                  >
                    {isEditing ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          onRenamePlayer(player.id, editName);
                          setEditingId(null);
                        }}
                        style={{ display: "flex", gap: "6px", alignItems: "center" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          className="text-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                          style={{ padding: "6px 10px", fontSize: "0.88rem", flex: 1 }}
                          onKeyDown={(e) => { if (e.key === "Escape") setEditingId(null); }}
                        />
                        <button
                          type="submit"
                          className="glass-button"
                          style={{ padding: "6px 10px", fontSize: "0.7rem", fontWeight: 700, color: "var(--color-point)", borderColor: "rgba(16, 185, 129, 0.3)" }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="glass-button"
                          onClick={() => setEditingId(null)}
                          style={{ padding: "6px 10px", fontSize: "0.7rem", fontWeight: 700 }}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px" }}>
                          {player.name}
                          {isActive && <ActiveCheckIcon />}
                        </div>
                        <div className="player-stats-mini">
                          <span className="player-stat-badge">Winrate: {getWinRate(player.stats)}</span>
                          <span className="player-stat-badge">W/L: {player.stats.wins}/{player.stats.losses}</span>
                          <span className="player-stat-badge">Errors: {player.stats.errors}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {!isEditing && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        padding: "4px 8px",
                        borderRadius: "8px",
                        background: isActive ? "rgba(16, 185, 129, 0.1)" : "rgba(255,255,255,0.02)",
                        color: isActive ? "var(--color-point)" : "var(--text-muted)",
                        border: isActive ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid transparent",
                        cursor: "pointer"
                      }}
                        onClick={() => onTogglePlayerActive(player.id)}
                      >
                        {isActive ? "Active" : "Check-in"}
                      </div>
                      <button
                        className="glass-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(player.id);
                          setEditName(player.name);
                        }}
                        style={{
                          padding: "4px 8px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "var(--color-serve)",
                          borderColor: "rgba(234, 179, 8, 0.2)",
                          background: "rgba(234, 179, 8, 0.02)",
                          lineHeight: 1
                        }}
                      >
                        ✎
                      </button>
                      <button
                        className="glass-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePlayer(player.id);
                        }}
                        style={{
                          padding: "4px 8px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "var(--color-out)",
                          borderColor: "rgba(244, 63, 94, 0.2)",
                          background: "rgba(244, 63, 94, 0.02)",
                          lineHeight: 1
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )
        )}

        {activeTab === "analytics" && (
          players.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0", fontSize: "0.9rem" }}>
              No player profiles to analyze.
            </div>
          ) : (
            players.map((player) => (
              <div key={player.id} className="player-row glass-panel" style={{ borderLeft: "3px solid #eab308", padding: "14px 16px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: "1rem", color: "white" }}>{player.name}</div>
                  <div className="player-stats-mini" style={{ gridTemplateColumns: "1fr", gap: "8px", marginTop: "8px" }}>
                    <span className="player-stat-badge" style={{ fontSize: "0.78rem" }}>
                      🔥 win rate: <strong style={{ color: "var(--color-point)" }}>{getWinRate(player.stats)}</strong> ({player.stats.wins}W - {player.stats.losses}L)
                    </span>
                    <span className="player-stat-badge" style={{ fontSize: "0.78rem" }}>
                      <SparkleIcon /> Best Partner: <strong style={{ color: "#fbbf24" }}>{getBestPartner(player.id)}</strong>
                    </span>
                    <span className="player-stat-badge" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      ⚠️ average errors logged: <strong>{player.stats.wins + player.stats.losses > 0 ? (player.stats.errors / (player.stats.wins + player.stats.losses)).toFixed(1) : 0}</strong> per match
                    </span>
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* Done Button */}
      <button className="primary-action-btn" onClick={onClose}>
        Confirm Roster
      </button>
    </div>
  );
}
