"use client";

import React, { useState, useEffect } from "react";
import { 
  Player
} from "../components/PlayerPool";
import { 
  MatchState, 
  Side, 
  initializeMatch, 
  handleRally, 
  handleUndo, 
  handleRedo,
  swapSides 
} from "../utils/badmintonEngine";
import Scoreboard from "../components/Scoreboard";
import MatchSetup from "../components/MatchSetup";
import PlayerPool from "../components/PlayerPool";

// Inline SVG Shuttlecock Logo (No Emojis)
const LogoShuttleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle" }}>
    <path d="M12 2v20M5 12h14M8 7l4-5 4 5" />
    <path d="M6 18c0-3.3 2.7-6 6-6s6 2.7 6 6" opacity="0.85" />
  </svg>
);

// Inline SVG Trophy Icon (No Emojis)
const TrophyIcon = () => (
  <svg className="victory-trophy-svg" viewBox="0 0 24 24" fill="none" stroke="var(--color-serve)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
    <path d="M12 2a7 7 0 0 0-7 7v4.66a7 7 0 0 0 14 0V9a7 7 0 0 0-7-7z" fill="rgba(245, 158, 11, 0.15)" />
  </svg>
);

type Screen = "home" | "players" | "setup" | "scoreboard";

interface MatchRecord {
  id: string;
  date: string;
  mode: "singles" | "doubles";
  leftPlayers: string[];
  rightPlayers: string[];
  leftScore: number;
  rightScore: number;
  winnerSide: Side;
}

export default function Home() {
  const [activeScreen, setActiveScreen] = useState<Screen>("home");
  
  // Touch swipe states
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  
  // Players Database (lifetime records)
  const [players, setPlayers] = useState<Player[]>([]);
  
  // Active players today
  const [activePlayerIds, setActivePlayerIds] = useState<string[]>([]);
  
  // Queue of players waiting to play today
  const [queue, setQueue] = useState<Player[]>([]);
  
  // Today's matches
  const [sessionMatches, setSessionMatches] = useState<MatchRecord[]>([]);

  // Active match scoring state
  const [activeMatch, setActiveMatch] = useState<MatchState | null>(null);
  
  // Winner popup state
  const [winnerCelebration, setWinnerCelebration] = useState<{
    winnerSide: Side;
    winnerNames: string;
  } | null>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const savedPlayers = localStorage.getItem("shuttle_players");
    const savedActiveIds = localStorage.getItem("shuttle_active_player_ids");
    const savedMatches = localStorage.getItem("shuttle_session_matches");
    const savedQueue = localStorage.getItem("shuttle_queue");

    let initialPlayers: Player[] = [];

    if (savedPlayers) {
      initialPlayers = JSON.parse(savedPlayers);
      setPlayers(initialPlayers);
    } else {
      // Seed default players if empty
      const defaultPlayers: Player[] = [
        { id: "1", name: "Alice", stats: { wins: 0, losses: 0, errors: 0, points: 0 } },
        { id: "2", name: "Bob", stats: { wins: 0, losses: 0, errors: 0, points: 0 } },
        { id: "3", name: "Charlie", stats: { wins: 0, losses: 0, errors: 0, points: 0 } },
        { id: "4", name: "David", stats: { wins: 0, losses: 0, errors: 0, points: 0 } },
      ];
      initialPlayers = defaultPlayers;
      setPlayers(defaultPlayers);
      localStorage.setItem("shuttle_players", JSON.stringify(defaultPlayers));
    }

    if (savedActiveIds) {
      setActivePlayerIds(JSON.parse(savedActiveIds));
    } else {
      const defaultActiveIds = initialPlayers.map((p) => p.id);
      setActivePlayerIds(defaultActiveIds);
      localStorage.setItem("shuttle_active_player_ids", JSON.stringify(defaultActiveIds));
    }

    if (savedMatches) setSessionMatches(JSON.parse(savedMatches));
    
    if (savedQueue) {
      setQueue(JSON.parse(savedQueue));
    } else {
      setQueue(initialPlayers);
      localStorage.setItem("shuttle_queue", JSON.stringify(initialPlayers));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Touch Swipe Handlers for mobile gestures (Swipe Right to go back or Undo)
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchEnd.x - touchStart.x;
    const distanceY = touchEnd.y - touchStart.y;
    
    // Check if horizontal swipe right is clear (threshold of 80px, height range < 60px)
    if (distanceX > 80 && Math.abs(distanceY) < 60) {
      if (activeScreen === "players" || activeScreen === "setup") {
        setActiveScreen("home");
      } else if (activeScreen === "scoreboard") {
        handleUndoAction();
      }
    }

    // Check if horizontal swipe left is clear (threshold of -80px, height range < 60px)
    if (distanceX < -80 && Math.abs(distanceY) < 60) {
      if (activeScreen === "scoreboard") {
        handleRedoAction();
      }
    }
  };

  const getDailyLeaderboard = () => {
    const statsMap: Record<string, {
      id: string;
      name: string;
      wins: number;
      losses: number;
      pointsScored: number;
      pointsConceded: number;
    }> = {};

    activePlayerIds.forEach((id) => {
      const playerObj = players.find((p) => p.id === id);
      if (playerObj) {
        statsMap[id] = {
          id,
          name: playerObj.name,
          wins: 0,
          losses: 0,
          pointsScored: 0,
          pointsConceded: 0,
        };
      }
    });

    sessionMatches.forEach((match) => {
      const isLeftWinner = match.winnerSide === "left";
      
      match.leftPlayers.forEach((id) => {
        if (statsMap[id]) {
          statsMap[id].pointsScored += match.leftScore;
          statsMap[id].pointsConceded += match.rightScore;
          if (isLeftWinner) {
            statsMap[id].wins += 1;
          } else {
            statsMap[id].losses += 1;
          }
        }
      });

      match.rightPlayers.forEach((id) => {
        if (statsMap[id]) {
          statsMap[id].pointsScored += match.rightScore;
          statsMap[id].pointsConceded += match.leftScore;
          if (!isLeftWinner) {
            statsMap[id].wins += 1;
          } else {
            statsMap[id].losses += 1;
          }
        }
      });
    });

    return Object.values(statsMap)
      .map((row) => ({
        ...row,
        diff: row.pointsScored - row.pointsConceded,
        winRate: row.wins + row.losses > 0 
          ? Math.round((row.wins / (row.wins + row.losses)) * 100) 
          : 0
      }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.diff !== a.diff) return b.diff - a.diff;
        return b.pointsScored - a.pointsScored;
      });
  };

  // Sync state to localStorage when changed
  const savePlayersToStorage = (updatedPlayers: Player[]) => {
    setPlayers(updatedPlayers);
    localStorage.setItem("shuttle_players", JSON.stringify(updatedPlayers));
  };

  const saveActivePlayerIdsToStorage = (updatedIds: string[]) => {
    setActivePlayerIds(updatedIds);
    localStorage.setItem("shuttle_active_player_ids", JSON.stringify(updatedIds));
    
    // Auto-align queue: add new active players to back of queue, remove inactive from queue
    const activePlayers = players.filter((p) => updatedIds.includes(p.id));
    const newQueue = queue.filter((qp) => updatedIds.includes(qp.id));
    
    // Add checked-in players that aren't in queue yet
    activePlayers.forEach((p) => {
      if (!newQueue.some((qp) => qp.id === p.id)) {
        newQueue.push(p);
      }
    });

    setQueue(newQueue);
    localStorage.setItem("shuttle_queue", JSON.stringify(newQueue));
  };

  const saveQueueToStorage = (updatedQueue: Player[]) => {
    setQueue(updatedQueue);
    localStorage.setItem("shuttle_queue", JSON.stringify(updatedQueue));
  };

  const saveMatchesToStorage = (updatedMatches: MatchRecord[]) => {
    setSessionMatches(updatedMatches);
    localStorage.setItem("shuttle_session_matches", JSON.stringify(updatedMatches));
  };

  // 1. Add Player
  const handleAddPlayer = (name: string) => {
    // Check if name exists
    if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      alert("A player with this name already exists!");
      return;
    }
    const newPlayer: Player = {
      id: Date.now().toString(),
      name,
      stats: { wins: 0, losses: 0, errors: 0, points: 0 },
    };
    const updated = [...players, newPlayer];
    savePlayersToStorage(updated);
    
    // Automatically select for today
    saveActivePlayerIdsToStorage([...activePlayerIds, newPlayer.id]);
  };

  // 2. Toggle active status today
  const handleTogglePlayerActive = (id: string) => {
    let updated: string[];
    if (activePlayerIds.includes(id)) {
      updated = activePlayerIds.filter((pid) => pid !== id);
    } else {
      updated = [...activePlayerIds, id];
    }
    saveActivePlayerIdsToStorage(updated);
  };

  // 3. Start Match Setup
  const handleStartMatch = (config: {
    mode: "singles" | "doubles";
    scoringSystem: "classic" | "rally";
    leftPlayers: Player[];
    rightPlayers: Player[];
  }) => {
    const matchState = initializeMatch(
      config.mode,
      config.scoringSystem,
      config.leftPlayers,
      config.rightPlayers
    );
    setActiveMatch(matchState);
    
    // Remove playing players from waiting queue during active match
    const playingIds = [...config.leftPlayers, ...config.rightPlayers].map((p) => p.id);
    const remainingQueue = queue.filter((p) => !playingIds.includes(p.id));
    saveQueueToStorage(remainingQueue);

    setActiveScreen("scoreboard");
  };

  // Check for winning conditions
  const checkWinner = (match: MatchState) => {
    const scoreA = match.left.score;
    const scoreB = match.right.score;
    const isRally = match.scoringSystem === "rally";

    // Set standard winning targets
    // Rally: 21 points. Classic Doubles: 15 points. Classic Singles: 11 points.
    let winTarget = 21;
    if (!isRally) {
      winTarget = match.mode === "doubles" ? 15 : 11;
    }

    const maxCap = isRally ? 30 : 21;

    // Check if team A won
    if (scoreA >= winTarget && scoreA - scoreB >= 2) {
      return "left";
    }
    if (scoreA === maxCap) {
      return "left";
    }

    // Check if team B won
    if (scoreB >= winTarget && scoreB - scoreA >= 2) {
      return "right";
    }
    if (scoreB === maxCap) {
      return "right";
    }

    return null;
  };

  // 4. Scoring Actions
  const handleRallyWinner = (winnerSide: Side) => {
    if (!activeMatch) return;
    const updated = handleRally(activeMatch, winnerSide, false, null);
    setActiveMatch(updated);

    const winner = checkWinner(updated);
    if (winner) {
      triggerWinnerCelebration(updated, winner);
    }
  };

  const triggerWinnerCelebration = (match: MatchState, winnerSide: Side) => {
    const winnerObj = winnerSide === "left" ? match.left : match.right;
    const winnerNames = winnerObj.players
      .filter((p) => p !== null)
      .map((p) => p!.name)
      .join(" & ");

    setWinnerCelebration({
      winnerSide,
      winnerNames,
    });
  };

  // 5. Save Finished Match Stats
  const handleSaveMatch = () => {
    if (!activeMatch || !winnerCelebration) return;

    const winnerSide = winnerCelebration.winnerSide;

    const leftNames = activeMatch.left.players.filter((p) => p !== null).map((p) => p!.id);
    const rightNames = activeMatch.right.players.filter((p) => p !== null).map((p) => p!.id);

    const newRecord: MatchRecord = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
      mode: activeMatch.mode,
      leftPlayers: leftNames,
      rightPlayers: rightNames,
      leftScore: activeMatch.left.score,
      rightScore: activeMatch.right.score,
      winnerSide,
    };

    // Save record
    saveMatchesToStorage([newRecord, ...sessionMatches]);

    // Update Lifetime Player Statistics
    const updatedPlayers = players.map((player) => {
      const isLeftPlayer = activeMatch.left.players.some((p) => p?.id === player.id);
      const isRightPlayer = activeMatch.right.players.some((p) => p?.id === player.id);

      if (!isLeftPlayer && !isRightPlayer) return player;

      const stats = { ...player.stats };

      // Errors
      if (isLeftPlayer) stats.errors += activeMatch.left.errors;
      if (isRightPlayer) stats.errors += activeMatch.right.errors;

      // Wins / Losses
      const isWinner = (isLeftPlayer && winnerSide === "left") || (isRightPlayer && winnerSide === "right");
      if (isWinner) {
        stats.wins += 1;
      } else {
        stats.losses += 1;
      }

      return {
        ...player,
        stats,
      };
    });

    savePlayersToStorage(updatedPlayers);

    // Queue Rotations: Winner Stays, Loser Rotates Out
    const losers = winnerSide === "left" ? activeMatch.right.players : activeMatch.left.players;

    const nextQueue = [...queue];

    // Push losers to back of queue
    losers.forEach((p) => {
      if (p) {
        // Find fresh profile from database
        const databasePlayer = updatedPlayers.find((dp) => dp.id === p.id);
        if (databasePlayer) nextQueue.push(databasePlayer);
      }
    });

    // Winners stay: Add winners back to queue front/playing rotation
    // Let's also make sure queue players are updated with fresh database stats
    const freshQueue = nextQueue.map((qp) => {
      const fresh = updatedPlayers.find((dp) => dp.id === qp.id);
      return fresh || qp;
    });

    saveQueueToStorage(freshQueue);

    // Clean up active match
    setActiveMatch(null);
    setWinnerCelebration(null);
    setActiveScreen("home");
  };

  const handleDiscardMatch = () => {
    if (confirm("Are you sure you want to discard this match and its stats?")) {
      // Return players to back of queue
      if (activeMatch) {
        const allMatchPlayers = [
          ...activeMatch.left.players,
          ...activeMatch.right.players,
        ].filter((p) => p !== null) as Player[];

        const nextQueue = [...queue];
        allMatchPlayers.forEach((p) => {
          if (!nextQueue.some((qp) => qp.id === p.id)) {
            nextQueue.push(p);
          }
        });
        saveQueueToStorage(nextQueue);
      }

      setActiveMatch(null);
      setWinnerCelebration(null);
      setActiveScreen("home");
    }
  };

  const handleResetSession = () => {
    if (confirm("Reset current day? This clears today's match history and resets player queues, but keeps all players in the database.")) {
      saveMatchesToStorage([]);
      // Reset queue to all active player profiles
      const activePlayers = players.filter((p) => activePlayerIds.includes(p.id));
      saveQueueToStorage(activePlayers);
    }
  };

  const handleUndoAction = () => {
    if (!activeMatch) return;
    const reverted = handleUndo(activeMatch);
    setActiveMatch(reverted);
  };

  const handleRedoAction = () => {
    if (!activeMatch) return;
    const restored = handleRedo(activeMatch);
    setActiveMatch(restored);
  };

  const handleSwapSidesAction = () => {
    if (!activeMatch) return;
    const swapped = swapSides(activeMatch);
    setActiveMatch(swapped);
  };

  return (
    <div 
      className="app-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Dynamic Header */}
      {activeScreen !== "scoreboard" && (
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
            ShuttleScore
          </h1>
          <div style={{ display: "flex", gap: "8px" }}>
            {activeScreen === "home" && (
              <button 
                className="glass-button" 
                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                onClick={() => setActiveScreen("players")}
              >
                Players
              </button>
            )}
            {activeScreen !== "home" && (
              <button 
                className="glass-button" 
                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                onClick={() => setActiveScreen("home")}
              >
                Back
              </button>
            )}
          </div>
        </header>
      )}

      {/* 1. Home Dashboard View */}
      {activeScreen === "home" && (
        <div className="screen">
        {/* Day Session Card */}
        <div className="session-summary-card glass-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
              Active Session
            </span>
            <span suppressHydrationWarning style={{ fontSize: "0.8rem", color: "var(--color-serve)", fontWeight: 600 }}>
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ flex: 1, textAlign: "center", background: "rgba(0,0,0,0.15)", padding: "10px", borderRadius: "10px" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "white" }}>{activePlayerIds.length}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Players Pool</div>
            </div>
            <div style={{ flex: 1, textAlign: "center", background: "rgba(0,0,0,0.15)", padding: "10px", borderRadius: "10px" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "white" }}>{sessionMatches.length}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Matches Played</div>
            </div>
          </div>

          <button 
            className="primary-action-btn"
            onClick={() => {
              if (activePlayerIds.length < 2) {
                alert("Please check-in at least 2 players to start matches. Go to 'Players' menu.");
                setActiveScreen("players");
              } else {
                setActiveScreen("setup");
              }
            }}
          >
            New Match
          </button>
        </div>

        {/* Queue Display */}
        {activePlayerIds.length > 0 && (
          <div className="glass-panel" style={{ padding: "16px", marginBottom: "20px" }}>
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

        {/* Daily Leaderboard Card */}
        {activePlayerIds.length > 0 && (
          <div className="glass-panel" style={{ padding: "16px", marginBottom: "20px" }}>
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
                    {getDailyLeaderboard().map((row, idx) => {
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

        {/* History List */}
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

        <div className="history-section">
          {sessionMatches.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "30px 0" }}>
              No matches played yet today.
            </div>
          ) : (
            sessionMatches.map((match) => {
              const leftNames = match.leftPlayers.map(id => players.find(p => p.id === id)?.name || "Unknown").join(" & ");
              const rightNames = match.rightPlayers.map(id => players.find(p => p.id === id)?.name || "Unknown").join(" & ");
              
              const isLeftWinner = match.winnerSide === "left";
              
              return (
                <div key={match.id} className="history-card glass-panel">
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{match.mode.toUpperCase()}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{match.date}</span>
                    </div>
                    <div style={{ fontSize: "0.9rem", display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "8px", alignItems: "center" }}>
                      <span style={{ 
                        fontWeight: isLeftWinner ? 700 : 400, 
                        color: isLeftWinner ? "var(--color-point)" : "var(--text-primary)",
                        textAlign: "right"
                      }}>
                        {leftNames}
                      </span>
                      <span style={{ fontSize: "0.85rem", background: "rgba(0,0,0,0.2)", padding: "2px 6px", borderRadius: "6px", fontFamily: "monospace", fontWeight: "bold" }}>
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
            })
          )}
        </div>
      </div>
      )}

      {/* 2. Players Management View */}
      {activeScreen === "players" && (
        <div className="screen">
          <PlayerPool
            players={players}
            activePlayerIds={activePlayerIds}
            onAddPlayer={handleAddPlayer}
            onTogglePlayerActive={handleTogglePlayerActive}
            onClose={() => setActiveScreen("home")}
          />
        </div>
      )}

      {/* 3. Match Setup View */}
      {activeScreen === "setup" && (
        <div className="screen">
          <MatchSetup
            activePlayers={players.filter((p) => activePlayerIds.includes(p.id))}
            queue={queue}
            defaultScoringSystem="classic"
            onStartMatch={handleStartMatch}
            onCancel={() => setActiveScreen("home")}
          />
        </div>
      )}

      {/* 4. Scoreboard Screen */}
      {activeScreen === "scoreboard" && (
        <div className="screen no-scroll" style={{ padding: 0 }}>
          {activeMatch && (
            <Scoreboard
              state={activeMatch}
              onRallyWinner={handleRallyWinner}
              onUndo={handleUndoAction}
              onRedo={handleRedoAction}
              onSwapSides={handleSwapSidesAction}
              onEndMatch={handleDiscardMatch}
            />
          )}
        </div>
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
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>Final Score</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "2px", fontFamily: "monospace" }}>
                {activeMatch.left.score} - {activeMatch.right.score}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                <span>Errors: {activeMatch.left.errors}</span>
                <span>Errors: {activeMatch.right.errors}</span>
              </div>
            </div>
          )}

          <div className="flex-col gap-12" style={{ width: "100%", maxWidth: "260px" }}>
            <button className="primary-action-btn" onClick={handleSaveMatch}>
              Save Match & Rotate Queue
            </button>
            <button 
              className="glass-button" 
              onClick={() => setWinnerCelebration(null)}
              style={{ padding: "14px" }}
            >
              Continue Playing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
