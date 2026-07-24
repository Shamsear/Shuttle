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

interface PlayerPoolProps {
  players: Player[];
  activePlayerIds: string[];
  onAddPlayer: (name: string) => void;
  onTogglePlayerActive: (id: string) => void;
  onClose: () => void;
}

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

export default function PlayerPool({
  players,
  activePlayerIds,
  onAddPlayer,
  onTogglePlayerActive,
  onClose,
}: PlayerPoolProps) {
  const [newPlayerName, setNewPlayerName] = useState("");
  const [activeTab, setActiveTab] = useState<"checkin" | "all">("checkin");

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

  const activePlayersList = players.filter((p) => activePlayerIds.includes(p.id));

  return (
    <div className="players-layout flex-col gap-20">
      <h2 style={{ fontSize: "1.35rem", fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
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

      {/* Tab Switcher */}
      <div className="mode-selector">
        <button
          className={`glass-button ${activeTab === "checkin" ? "active" : ""}`}
          onClick={() => setActiveTab("checkin")}
          style={{ padding: "10px 0", fontSize: "0.8rem", flex: 1 }}
        >
          Roster Today ({activePlayerIds.length})
        </button>
        <button
          className={`glass-button ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
          style={{ padding: "10px 0", fontSize: "0.8rem", flex: 1 }}
        >
          All Profiles ({players.length})
        </button>
      </div>

      {/* Player List */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
        {activeTab === "checkin" ? (
          activePlayersList.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0", fontSize: "0.9rem" }}>
              Roster is empty. Toggle players active under the &quot;All Profiles&quot; tab.
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
        ) : (
          players.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0", fontSize: "0.9rem" }}>
              No player records found. Add players using the form above.
            </div>
          ) : (
            players.map((player) => {
              const isActive = activePlayerIds.includes(player.id);
              return (
                <div
                  key={player.id}
                  className={`player-row glass-panel ${isActive ? "selected" : ""}`}
                  onClick={() => onTogglePlayerActive(player.id)}
                  style={{ cursor: "pointer", padding: "12px 16px" }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px" }}>
                      {player.name}
                      {isActive && <ActiveCheckIcon />}
                    </div>
                    <div className="player-stats-mini">
                      <span className="player-stat-badge">Winrate: {getWinRate(player.stats)}</span>
                      <span className="player-stat-badge">W/L: {player.stats.wins}/{player.stats.losses}</span>
                      <span className="player-stat-badge">Errors: {player.stats.errors}</span>
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: "0.7rem", 
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    padding: "4px 8px", 
                    borderRadius: "8px", 
                    background: isActive ? "rgba(16, 185, 129, 0.1)" : "rgba(255,255,255,0.02)",
                    color: isActive ? "var(--color-point)" : "var(--text-muted)",
                    border: isActive ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid transparent"
                  }}>
                    {isActive ? "Active" : "In check"}
                  </div>
                </div>
              );
            })
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
