"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Player } from "../components/PlayerPool";
import { 
  MatchState, 
  Side, 
  initializeMatch, 
  handleRally, 
  handleUndo, 
  handleRedo,
  swapSides 
} from "../utils/badmintonEngine";
import { announceScore, triggerHaptic } from "../utils/refereeDevice";

interface SessionContextType {
  players: Player[];
  activePlayerIds: string[];
  queue: Player[];
  sessionMatches: any[];
  activeMatch: MatchState | null;
  winnerCelebration: { winnerSide: Side; winnerNames: string } | null;
  roomCode: string | null;
  roomRole: "host" | "viewer" | null;
  courtName: string | null;
  recentCourts: { code: string; name: string }[];
  voiceEnabled: boolean;
  isSyncing: boolean;
  syncError: string | null;
  joinInput: string;
  setJoinInput: (val: string) => void;
  setWinnerCelebration: (val: any) => void;
  setActiveMatch: (val: any) => void;
  
  // Roster Actions
  handleAddPlayer: (name: string) => void;
  handleTogglePlayerActive: (id: string) => void;
  handleResetSession: () => void;
  
  // Match Controls
  handleStartMatch: (config: any) => void;
  handleRallyWinner: (winnerSide: Side) => void;
  handleSaveMatch: () => void;
  handleDiscardMatch: () => void;
  handleUndoAction: () => void;
  handleRedoAction: () => void;
  handleSwapSidesAction: () => void;
  
  // Room Sync Actions
  handleCreateRoom: (courtNameInput: string) => Promise<void>;
  handleJoinRoom: (code: string) => Promise<void>;
  handleDisconnectRoom: () => void;
  handleToggleVoice: () => void;
  getDailyLeaderboard: () => any[];
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [activePlayerIds, setActivePlayerIds] = useState<string[]>([]);
  const [queue, setQueue] = useState<Player[]>([]);
  const [sessionMatches, setSessionMatches] = useState<any[]>([]);
  const [activeMatch, setActiveMatch] = useState<MatchState | null>(null);
  
  const [winnerCelebration, setWinnerCelebration] = useState<{
    winnerSide: Side;
    winnerNames: string;
  } | null>(null);

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomRole, setRoomRole] = useState<"host" | "viewer" | null>(null);
  const [courtName, setCourtName] = useState<string | null>(null);
  const [recentCourts, setRecentCourts] = useState<{ code: string; name: string }[]>([]);
  const [isRoomCreator, setIsRoomCreator] = useState<boolean>(false);
  const [peerInstance, setPeerInstance] = useState<any>(null);
  const [activeConnections, setActiveConnections] = useState<any[]>([]);
  const [hostConnection, setHostConnection] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastServerUpdate, setLastServerUpdate] = useState<number>(0);
  const [joinInput, setJoinInput] = useState<string>("");
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(false);

  // Helper to resolve localStorage key names based on active room code
  const getStorageKey = (base: string, customCode?: string | null) => {
    const code = customCode !== undefined ? customCode : roomCode;
    return code ? `shuttle_${code.toUpperCase()}_${base}` : `shuttle_local_${base}`;
  };

  // 1. Storage helpers
  const savePlayersToStorage = (updated: Player[]) => {
    setPlayers(updated);
    localStorage.setItem(getStorageKey("players"), JSON.stringify(updated));
    syncState({ players: updated });
  };

  const saveActivePlayerIdsToStorage = (updated: string[]) => {
    setActivePlayerIds(updated);
    localStorage.setItem(getStorageKey("active_player_ids"), JSON.stringify(updated));
    // Re-sync queue to match active roster
    const activePlayers = players.filter((p) => updated.includes(p.id));
    const nextQueue = activePlayers.filter((p) => {
      if (activeMatch) {
        const isPlaying = [...activeMatch.left.players, ...activeMatch.right.players].some(
          (pm) => pm && pm.id === p.id
        );
        return !isPlaying;
      }
      return true;
    });
    saveQueueToStorage(nextQueue);
    syncState({ activePlayerIds: updated, queue: nextQueue });
  };

  const saveMatchesToStorage = (updated: any[]) => {
    setSessionMatches(updated);
    localStorage.setItem(getStorageKey("session_matches"), JSON.stringify(updated));
    syncState({ sessionMatches: updated });
  };

  const saveQueueToStorage = (updated: Player[]) => {
    setQueue(updated);
    localStorage.setItem(getStorageKey("queue"), JSON.stringify(updated));
  };

  // 2. Load from storage on mount
  useEffect(() => {
    try {
      const savedRoomCode = localStorage.getItem("shuttle_room_code");
      const keyPrefix = savedRoomCode ? `shuttle_${savedRoomCode.toUpperCase()}_` : "shuttle_local_";

      const savedPlayers = localStorage.getItem(`${keyPrefix}players`);
      const savedActiveIds = localStorage.getItem(`${keyPrefix}active_player_ids`);
      const savedMatches = localStorage.getItem(`${keyPrefix}session_matches`);
      const savedQueue = localStorage.getItem(`${keyPrefix}queue`);
      const savedVoice = localStorage.getItem("shuttle_voice_enabled");
      const savedRole = localStorage.getItem("shuttle_room_role");
      const savedCourtName = localStorage.getItem("shuttle_court_name");
      const savedRecents = localStorage.getItem("shuttle_recent_courts");
      const savedIsCreator = localStorage.getItem("shuttle_is_creator");

      let initialPlayers: Player[] = [];

      if (savedPlayers) {
        try {
          initialPlayers = JSON.parse(savedPlayers);
          setPlayers(initialPlayers);
        } catch (e) {
          localStorage.removeItem(`${keyPrefix}players`);
        }
      }

      if (initialPlayers.length === 0) {
        const defaultPlayers: Player[] = [
          { id: "1", name: "Alice", stats: { wins: 0, losses: 0, errors: 0, points: 0 } },
          { id: "2", name: "Bob", stats: { wins: 0, losses: 0, errors: 0, points: 0 } },
          { id: "3", name: "Charlie", stats: { wins: 0, losses: 0, errors: 0, points: 0 } },
          { id: "4", name: "David", stats: { wins: 0, losses: 0, errors: 0, points: 0 } },
        ];
        initialPlayers = defaultPlayers;
        setPlayers(defaultPlayers);
        localStorage.setItem(`${keyPrefix}players`, JSON.stringify(defaultPlayers));
      }

      if (savedActiveIds) {
        try {
          setActivePlayerIds(JSON.parse(savedActiveIds));
        } catch (e) {
          localStorage.removeItem(`${keyPrefix}active_player_ids`);
        }
      } else {
        const defaultActiveIds = initialPlayers.map((p) => p.id);
        setActivePlayerIds(defaultActiveIds);
        localStorage.setItem(`${keyPrefix}active_player_ids`, JSON.stringify(defaultActiveIds));
      }

      if (savedMatches) {
        try {
          setSessionMatches(JSON.parse(savedMatches));
        } catch (e) {
          localStorage.removeItem(`${keyPrefix}session_matches`);
        }
      }
      
      if (savedQueue) {
        try {
          setQueue(JSON.parse(savedQueue));
        } catch (e) {
          localStorage.removeItem(`${keyPrefix}queue`);
        }
      } else {
        setQueue(initialPlayers);
        localStorage.setItem(`${keyPrefix}queue`, JSON.stringify(initialPlayers));
      }

      if (savedRoomCode) setRoomCode(savedRoomCode);
      // Explicitly initialize lastServerUpdate to 0 on mount to force initial server DB hydration
      setLastServerUpdate(0);
      
      if (savedVoice) setVoiceEnabled(savedVoice === "true");
      if (savedRole) setRoomRole(savedRole as any);
      if (savedCourtName) setCourtName(savedCourtName);
      if (savedIsCreator) setIsRoomCreator(savedIsCreator === "true");
      
      if (savedRecents) {
        try {
          setRecentCourts(JSON.parse(savedRecents));
        } catch (err) {
          localStorage.removeItem("shuttle_recent_courts");
        }
      }
    } catch (error) {
      console.error("Failed to load local storage:", error);
    }
  }, []);

  // WebRTC Broadcast helper
  const broadcastState = (updatedState: Partial<any>) => {
    if (!isRoomCreator || activeConnections.length === 0) return;
    
    const fullState = {
      type: "STATE_UPDATE",
      players: updatedState.players !== undefined ? updatedState.players : players,
      activePlayerIds: updatedState.activePlayerIds !== undefined ? updatedState.activePlayerIds : activePlayerIds,
      queue: updatedState.queue !== undefined ? updatedState.queue : queue,
      sessionMatches: updatedState.sessionMatches !== undefined ? updatedState.sessionMatches : sessionMatches,
      activeMatch: updatedState.activeMatch !== undefined ? updatedState.activeMatch : activeMatch,
      winnerCelebration: updatedState.winnerCelebration !== undefined ? updatedState.winnerCelebration : winnerCelebration
    };

    activeConnections.forEach(conn => {
      if (conn.open) {
        try {
          conn.send(fullState);
        } catch (e) {}
      }
    });
  };

  // WebRTC PeerJS Sync Hook
  useEffect(() => {
    if (typeof window === "undefined" || !roomCode) {
      if (peerInstance) {
        try {
          peerInstance.destroy();
        } catch (e) {}
        setPeerInstance(null);
        setActiveConnections([]);
        setHostConnection(null);
      }
      return;
    }

    let activePeer: any = null;

    const initPeer = async () => {
      try {
        const { default: Peer } = await import("peerjs");
        
        const peerId = isRoomCreator 
          ? `shuttlescore-${roomCode.toUpperCase()}` 
          : `shuttlescore-guest-${roomCode.toUpperCase()}-${Math.floor(Math.random() * 10000)}`;

        const p = new Peer(peerId, { debug: 1 });
        activePeer = p;
        setPeerInstance(p);

        p.on("open", (id) => {
          console.log(`PeerJS WebRTC channel opened: ${id}`);
          
          if (!isRoomCreator) {
            // Guests connect directly to the creator (host) peer channel
            const conn = p.connect(`shuttlescore-${roomCode.toUpperCase()}`);
            setHostConnection(conn);

            conn.on("open", () => {
              console.log("WebRTC Peer connection established with Host Court!");
            });

            conn.on("data", (data: any) => {
              if (data && data.type === "STATE_UPDATE") {
                if (data.players !== undefined) setPlayers(data.players);
                if (data.activePlayerIds !== undefined) setActivePlayerIds(data.activePlayerIds);
                if (data.queue !== undefined) setQueue(data.queue);
                if (data.sessionMatches !== undefined) setSessionMatches(data.sessionMatches);
                if (data.activeMatch !== undefined) setActiveMatch(data.activeMatch);
                if (data.winnerCelebration !== undefined) setWinnerCelebration(data.winnerCelebration);
              }
            });

            conn.on("close", () => {
              console.log("WebRTC Connection closed by Host.");
              setHostConnection(null);
            });
          }
        });

        if (isRoomCreator) {
          p.on("connection", (conn) => {
            console.log("Guest connected to our Court WebRTC session!");
            
            // Add peer connection to our broadcasts list
            setActiveConnections(prev => {
              if (prev.some(c => c.peer === conn.peer)) return prev;
              return [...prev, conn];
            });
            
            conn.on("open", () => {
              // Push the current state to the guest immediately
              conn.send({
                type: "STATE_UPDATE",
                players,
                activePlayerIds,
                queue,
                sessionMatches,
                activeMatch,
                winnerCelebration
              });
            });

            conn.on("data", (data: any) => {
              if (data && data.type === "ACTION_TRIGGER") {
                // Execute action locally on the host
                if (data.action === "rally") handleRallyWinner(data.side);
                if (data.action === "undo") handleUndoAction();
                if (data.action === "redo") handleRedoAction();
                if (data.action === "swap") handleSwapSidesAction();
              }
            });

            conn.on("close", () => {
              setActiveConnections(prev => prev.filter(c => c.peer !== conn.peer));
            });
          });
        }

        p.on("error", (err) => {
          console.error("PeerJS signaling error:", err);
        });
      } catch (err) {
        console.error("Failed to initialize PeerJS WebRTC:", err);
      }
    };

    initPeer();

    return () => {
      if (activePeer) {
        try {
          activePeer.destroy();
        } catch (e) {}
      }
    };
  }, [roomCode, isRoomCreator]);

  // 3. Room sync polling & pushes
  useEffect(() => {
    if (!roomCode) return;
    setIsSyncing(true);
    setSyncError(null);

    const poll = async () => {
      try {
        const res = await fetch(`/api/room/${roomCode}`, { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 404) {
            setSyncError("Room expired or connection lost.");
            setRoomCode(null);
            localStorage.removeItem("shuttle_room_code");
          }
          return;
        }
        const data = await res.json();
        if (data.lastUpdated > lastServerUpdate) {
          setLastServerUpdate(data.lastUpdated);
          setPlayers(data.players);
          setActivePlayerIds(data.activePlayerIds);
          setQueue(data.queue);
          setSessionMatches(data.sessionMatches);
          setActiveMatch(data.activeMatch);
          setWinnerCelebration(data.winnerCelebration);
          
          localStorage.setItem(getStorageKey("players"), JSON.stringify(data.players));
          localStorage.setItem(getStorageKey("active_player_ids"), JSON.stringify(data.activePlayerIds));
          localStorage.setItem(getStorageKey("queue"), JSON.stringify(data.queue));
          localStorage.setItem(getStorageKey("session_matches"), JSON.stringify(data.sessionMatches));
          localStorage.setItem(getStorageKey("last_server_update"), String(data.lastUpdated));
        }
      } catch (err) {
        console.error("Failed to poll room state:", err);
      } finally {
        setIsSyncing(false);
      }
    };

    poll(); // Run immediately
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [roomCode, lastServerUpdate]);


  const syncState = async (delta: Partial<any>) => {
    if (!roomCode || roomRole === "viewer") return;
    // Broadcast immediately to WebRTC connections for instant 0ms delay sync
    broadcastState(delta);
    try {
      await fetch(`/api/room/${roomCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(delta),
      });
    } catch (err) {
      console.error("Failed to push sync:", err);
    }
  };

  // 4. Room control methods
  const handleCreateRoom = async (courtNameInput: string) => {
    try {
      const res = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtName: courtNameInput,
          players,
          activePlayerIds,
          queue,
          sessionMatches,
          activeMatch,
          winnerCelebration,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRoomCode(data.code);
        setRoomRole("host");
        setCourtName(courtNameInput);
        setIsRoomCreator(true);
        setLastServerUpdate(data.state.lastUpdated);
        localStorage.setItem("shuttle_room_code", data.code);
        localStorage.setItem("shuttle_room_role", "host");
        localStorage.setItem("shuttle_court_name", courtNameInput);
        localStorage.setItem("shuttle_is_creator", "true");
        localStorage.setItem(getStorageKey("last_server_update", data.code), String(data.state.lastUpdated));
        
        // Add to recent list
        addToRecentCourts(data.code, courtNameInput);
        
        alert(`Court "${courtNameInput}" created! Invite Code: ${data.code}`);
        if (!data.cloud) {
          alert("⚠️ Database Offline: The server is running without a database connection. Add DATABASE_URL to your Vercel Environment Variables to enable persistent multi-user court syncing.");
        }
      } else {
        alert("Failed to create court.");
      }
    } catch (err) {
      alert("Error connecting to server.");
    }
  };

  const addToRecentCourts = (code: string, name: string) => {
    const updated = [
      { code, name },
      ...recentCourts.filter(c => c.code !== code)
    ].slice(0, 5);
    setRecentCourts(updated);
    localStorage.setItem("shuttle_recent_courts", JSON.stringify(updated));
  };

  const handleJoinRoom = async (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode || cleanCode.length !== 6) {
      alert("Please enter a valid 6-character invite code.");
      return;
    }
    try {
      const res = await fetch(`/api/room/${cleanCode}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setRoomCode(cleanCode);
        setRoomRole("host");
        setIsRoomCreator(false);
        const resolvedName = data.courtName || `Court ${cleanCode}`;
        setCourtName(resolvedName);
        setPlayers(data.players);
        setActivePlayerIds(data.activePlayerIds);
        setQueue(data.queue);
        setSessionMatches(data.sessionMatches);
        setActiveMatch(data.activeMatch);
        setWinnerCelebration(data.winnerCelebration);
        setLastServerUpdate(data.lastUpdated);

        localStorage.setItem("shuttle_room_code", cleanCode);
        localStorage.setItem("shuttle_room_role", "host");
        localStorage.setItem("shuttle_court_name", resolvedName);
        localStorage.setItem("shuttle_is_creator", "false");
        localStorage.setItem(getStorageKey("players", cleanCode), JSON.stringify(data.players));
        localStorage.setItem(getStorageKey("active_player_ids", cleanCode), JSON.stringify(data.activePlayerIds));
        localStorage.setItem(getStorageKey("queue", cleanCode), JSON.stringify(data.queue));
        localStorage.setItem(getStorageKey("session_matches", cleanCode), JSON.stringify(data.sessionMatches));
        localStorage.setItem(getStorageKey("last_server_update", cleanCode), String(data.lastUpdated));
        setJoinInput("");

        // Add to recent list
        addToRecentCourts(cleanCode, resolvedName);

        alert(`Successfully joined court: ${resolvedName}!`);
      } else {
        alert("Invite room not found. Check the code and try again.");
      }
    } catch (err) {
      alert("Error connecting to server.");
    }
  };

  const handleDisconnectRoom = () => {
    if (confirm("Disconnect from cloud session? Your local device will keep the current session state, but edits will no longer sync.")) {
      setRoomCode(null);
      setRoomRole(null);
      setCourtName(null);
      setIsRoomCreator(false);
      localStorage.removeItem("shuttle_room_code");
      localStorage.removeItem("shuttle_room_role");
      localStorage.removeItem("shuttle_court_name");
      localStorage.removeItem("shuttle_is_creator");
      localStorage.removeItem("shuttle_last_server_update");
    }
  };

  const handleToggleVoice = () => {
    const newVal = !voiceEnabled;
    setVoiceEnabled(newVal);
    localStorage.setItem("shuttle_voice_enabled", String(newVal));
    triggerHaptic("point");
    if (newVal) {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance("Voice referee active"));
      } catch (err) {}
    }
  };

  // 5. Roster Actions
  const handleAddPlayer = (name: string) => {
    if (roomCode && roomRole === "viewer") return;
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
    saveActivePlayerIdsToStorage([...activePlayerIds, newPlayer.id]);
  };

  const handleTogglePlayerActive = (id: string) => {
    if (roomCode && roomRole === "viewer") return;
    let updated: string[];
    if (activePlayerIds.includes(id)) {
      updated = activePlayerIds.filter((pid) => pid !== id);
    } else {
      updated = [...activePlayerIds, id];
    }
    saveActivePlayerIdsToStorage(updated);
  };

  const handleResetSession = () => {
    if (roomCode && roomRole === "viewer") return;
    if (confirm("Reset current day? This clears today's match history and resets player queues, but keeps all players in the database.")) {
      saveMatchesToStorage([]);
      const activePlayers = players.filter((p) => activePlayerIds.includes(p.id));
      saveQueueToStorage(activePlayers);
    }
  };

  // 6. Match Logic Actions
  const handleStartMatch = (config: {
    mode: "singles" | "doubles";
    scoringSystem: "classic" | "rally";
    leftPlayers: Player[];
    rightPlayers: Player[];
  }) => {
    if (roomCode && roomRole === "viewer") return;
    const matchState = initializeMatch(
      config.mode,
      config.scoringSystem,
      config.leftPlayers,
      config.rightPlayers
    );
    setActiveMatch(matchState);
    
    const playingIds = [...config.leftPlayers, ...config.rightPlayers].map((p) => p.id);
    const remainingQueue = queue.filter((p) => !playingIds.includes(p.id));
    saveQueueToStorage(remainingQueue);

    syncState({ activeMatch: matchState, queue: remainingQueue });
  };

  const checkWinner = (match: MatchState): Side | null => {
    const scoreA = match.left.score;
    const scoreB = match.right.score;
    const isRally = match.scoringSystem === "rally";

    let winTarget = 21;
    if (!isRally) {
      winTarget = match.mode === "doubles" ? 15 : 11;
    }
    const maxCap = isRally ? 30 : 21;

    if (scoreA >= winTarget && scoreA - scoreB >= 2) return "left";
    if (scoreA === maxCap) return "left";
    if (scoreB >= winTarget && scoreB - scoreA >= 2) return "right";
    if (scoreB === maxCap) return "right";

    return null;
  };

  const handleRallyWinner = (winnerSide: Side) => {
    if (roomCode && roomRole === "viewer") return;
    if (!activeMatch) return;

    // WebRTC connection action intercept
    if (!isRoomCreator && hostConnection && hostConnection.open) {
      hostConnection.send({ type: "ACTION_TRIGGER", action: "rally", side: winnerSide });
      return;
    }

    const serviceOver = activeMatch.servingSide !== winnerSide;
    const updated = handleRally(activeMatch, winnerSide, false, null);
    setActiveMatch(updated);

    const winner = checkWinner(updated);
    if (winner) {
      const winnerObj = winner === "left" ? updated.left : updated.right;
      const winnerNames = winnerObj.players
        .filter((p) => p !== null)
        .map((p) => p!.name)
        .join(" & ");

      const celebration = { winnerSide: winner, winnerNames };
      setWinnerCelebration(celebration);
      syncState({ activeMatch: updated, winnerCelebration: celebration });
      
      triggerHaptic("win");
      if (voiceEnabled) {
        try {
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(`Game won by ${winnerNames}`));
        } catch (err) {}
      }
    } else {
      syncState({ activeMatch: updated });
      triggerHaptic(serviceOver ? "side-out" : "point");
      if (voiceEnabled) {
        announceScore(updated.left.score, updated.right.score, updated.servingSide, updated.scoringSystem, updated.mode, serviceOver);
      }
    }
  };

  const handleSaveMatch = () => {
    if (!activeMatch || !winnerCelebration) return;

    const winnerSide = winnerCelebration.winnerSide;

    const leftNames = activeMatch.left.players.filter((p) => p !== null).map((p) => p!.id);
    const rightNames = activeMatch.right.players.filter((p) => p !== null).map((p) => p!.id);

    const newRecord = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
      mode: activeMatch.mode,
      leftPlayers: leftNames,
      rightPlayers: rightNames,
      leftScore: activeMatch.left.score,
      rightScore: activeMatch.right.score,
      winnerSide,
    };

    const nextMatches = [newRecord, ...sessionMatches];
    saveMatchesToStorage(nextMatches);

    const updatedPlayers = players.map((player) => {
      const isLeftPlayer = activeMatch.left.players.some((p) => p?.id === player.id);
      const isRightPlayer = activeMatch.right.players.some((p) => p?.id === player.id);

      if (!isLeftPlayer && !isRightPlayer) return player;

      const stats = { ...player.stats };

      if (isLeftPlayer) stats.errors += activeMatch.left.errors;
      if (isRightPlayer) stats.errors += activeMatch.right.errors;

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

    const losers = winnerSide === "left" ? activeMatch.right.players : activeMatch.left.players;
    const nextQueue = [...queue];

    losers.forEach((p) => {
      if (p) {
        const databasePlayer = updatedPlayers.find((dp) => dp.id === p.id);
        if (databasePlayer) nextQueue.push(databasePlayer);
      }
    });

    const freshQueue = nextQueue.map((qp) => {
      const fresh = updatedPlayers.find((dp) => dp.id === qp.id);
      return fresh || qp;
    });

    saveQueueToStorage(freshQueue);

    setActiveMatch(null);
    setWinnerCelebration(null);
    syncState({
      activeMatch: null,
      winnerCelebration: null,
      queue: freshQueue,
    });
  };

  const handleDiscardMatch = () => {
    if (roomCode && roomRole === "viewer") return;
    if (confirm("Are you sure you want to discard this match and its stats?")) {
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
      syncState({ activeMatch: null, winnerCelebration: null });
    }
  };

  const handleUndoAction = () => {
    if (roomCode && roomRole === "viewer") return;
    if (!activeMatch) return;

    if (!isRoomCreator && hostConnection && hostConnection.open) {
      hostConnection.send({ type: "ACTION_TRIGGER", action: "undo" });
      return;
    }

    const reverted = handleUndo(activeMatch);
    setActiveMatch(reverted);
    syncState({ activeMatch: reverted });
    triggerHaptic("undo");
    if (voiceEnabled) {
      announceScore(reverted.left.score, reverted.right.score, reverted.servingSide, reverted.scoringSystem, reverted.mode, false);
    }
  };

  const handleRedoAction = () => {
    if (roomCode && roomRole === "viewer") return;
    if (!activeMatch) return;

    if (!isRoomCreator && hostConnection && hostConnection.open) {
      hostConnection.send({ type: "ACTION_TRIGGER", action: "redo" });
      return;
    }

    const restored = handleRedo(activeMatch);
    setActiveMatch(restored);
    syncState({ activeMatch: restored });
    triggerHaptic("undo");
    if (voiceEnabled) {
      announceScore(restored.left.score, restored.right.score, restored.servingSide, restored.scoringSystem, restored.mode, false);
    }
  };

  const handleSwapSidesAction = () => {
    if (roomCode && roomRole === "viewer") return;
    if (!activeMatch) return;

    if (!isRoomCreator && hostConnection && hostConnection.open) {
      hostConnection.send({ type: "ACTION_TRIGGER", action: "swap" });
      return;
    }

    const swapped = swapSides(activeMatch);
    setActiveMatch(swapped);
    syncState({ activeMatch: swapped });
    triggerHaptic("point");
  };

  const getDailyLeaderboard = () => {
    const statsMap: Record<string, {
      id: string;
      name: string;
      wins: number;
      losses: number;
      netPoints: number;
    }> = {};

    players.forEach((p) => {
      statsMap[p.id] = { id: p.id, name: p.name, wins: 0, losses: 0, netPoints: 0 };
    });

    sessionMatches.forEach((match) => {
      const mode = match.mode;
      const isLeftWinner = match.winnerSide === "left";
      
      const leftDiff = match.leftScore - match.rightScore;
      const rightDiff = match.rightScore - match.leftScore;

      match.leftPlayers.forEach((pid: string) => {
        if (!statsMap[pid]) statsMap[pid] = { id: pid, name: `Player ${pid}`, wins: 0, losses: 0, netPoints: 0 };
        if (isLeftWinner) statsMap[pid].wins += 1;
        else statsMap[pid].losses += 1;
        statsMap[pid].netPoints += leftDiff;
      });

      match.rightPlayers.forEach((pid: string) => {
        if (!statsMap[pid]) statsMap[pid] = { id: pid, name: `Player ${pid}`, wins: 0, losses: 0, netPoints: 0 };
        if (!isLeftWinner) statsMap[pid].wins += 1;
        else statsMap[pid].losses += 1;
        statsMap[pid].netPoints += rightDiff;
      });
    });

    return Object.values(statsMap).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.netPoints !== a.netPoints) return b.netPoints - a.netPoints;
      const aTotal = a.wins + a.losses;
      const bTotal = b.wins + b.losses;
      const aRate = aTotal > 0 ? a.wins / aTotal : 0;
      const bRate = bTotal > 0 ? b.wins / bTotal : 0;
      return bRate - aRate;
    });
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get("room");
      if (urlRoom && urlRoom.length === 6) {
        handleJoinRoom(urlRoom);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, []);

  return (
    <SessionContext.Provider value={{
      players,
      activePlayerIds,
      queue,
      sessionMatches,
      activeMatch,
      winnerCelebration,
      roomCode,
      roomRole,
      courtName,
      recentCourts,
      voiceEnabled,
      isSyncing,
      syncError,
      joinInput,
      setJoinInput,
      setWinnerCelebration,
      setActiveMatch,
      
      handleAddPlayer,
      handleTogglePlayerActive,
      handleResetSession,
      handleStartMatch,
      handleRallyWinner,
      handleSaveMatch,
      handleDiscardMatch,
      handleUndoAction,
      handleRedoAction,
      handleSwapSidesAction,
      handleCreateRoom,
      handleJoinRoom,
      handleDisconnectRoom,
      handleToggleVoice,
      getDailyLeaderboard
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
