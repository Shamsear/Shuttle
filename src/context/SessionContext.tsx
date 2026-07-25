"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
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
import { CustomDialogModal } from "../components/Modal";
import { supabase } from "../lib/supabase";

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
  handleDeletePlayer: (id: string) => void;
  handleRenamePlayer: (id: string, newName: string) => void;
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
  recentCourtsLoading: boolean;
  showDialog: (config: {
    type: "alert" | "confirm";
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }) => void;
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
  const [recentCourtsLoading, setRecentCourtsLoading] = useState<boolean>(false);
  const [isRoomCreator, setIsRoomCreator] = useState<boolean>(false);
  const [dialog, setDialog] = useState<{
    type: "alert" | "confirm";
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  } | null>(null);
  const [peerInstance, setPeerInstance] = useState<any>(null);
  const [activeConnections, setActiveConnections] = useState<any[]>([]);
  const [hostConnection, setHostConnection] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastServerUpdate, setLastServerUpdate] = useState<number>(0);
  const lastServerUpdateRef = useRef(lastServerUpdate);

  useEffect(() => {
    lastServerUpdateRef.current = lastServerUpdate;
  }, [lastServerUpdate]);

  const [joinInput, setJoinInput] = useState<string>("");
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(false);

  const showDialog = (config: {
    type: "alert" | "confirm";
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }) => {
    setDialog(config);
  };

  // 1. Storage helpers
  const savePlayersToStorage = (updated: Player[]) => {
    setPlayers(updated);
    syncState({ players: updated });
  };

  const saveActivePlayerIdsToStorage = (updated: string[]) => {
    setActivePlayerIds(updated);
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
    setQueue(nextQueue);
    syncState({ activePlayerIds: updated, queue: nextQueue });
  };

  const saveMatchesToStorage = (updated: any[]) => {
    setSessionMatches(updated);
    syncState({ sessionMatches: updated });
  };

  const saveQueueToStorage = (updated: Player[]) => {
    setQueue(updated);
  };

  // 2. Load from storage on mount
  useEffect(() => {
    try {
      const savedRoomCode = localStorage.getItem("shuttle_room_code");
      const savedVoice = localStorage.getItem("shuttle_voice_enabled");
      const savedRole = localStorage.getItem("shuttle_room_role");
      const savedCourtName = localStorage.getItem("shuttle_court_name");
      const savedRecents = localStorage.getItem("shuttle_recent_courts");
      const savedIsCreator = localStorage.getItem("shuttle_is_creator");

      // Initialize empty arrays on load
      setPlayers([]);
      setActivePlayerIds([]);
      setQueue([]);

      if (savedRoomCode) setRoomCode(savedRoomCode);
      setLastServerUpdate(0); // Force initial database poll
      
      if (savedVoice) setVoiceEnabled(savedVoice === "true");
      if (savedRole) setRoomRole(savedRole as any);
      if (savedCourtName) setCourtName(savedCourtName);
      if (savedIsCreator) setIsRoomCreator(savedIsCreator === "true");
      
      if (savedRecents) {
        try {
          const parsed = JSON.parse(savedRecents);
          setRecentCourts(parsed);
          if (parsed.length > 0) {
            setRecentCourtsLoading(true);
          }
          
          // Asynchronously verify that each room still exists on the server
          (async () => {
            try {
              const validationPromises = (parsed as Record<string, unknown>[]).map(async (c) => {
                try {
                  const res = await fetch(`/api/room/${String(c.code)}`, { cache: "no-store" });
                  if (res.ok) return c;
                } catch (e) {
                  return c; // keep it on network errors to prevent false-positives
                }
                return null;
              });
              const results = await Promise.all(validationPromises);
              const validated = results.filter((c): c is Record<string, unknown> => c !== null);

              if (validated.length !== parsed.length) {
                setRecentCourts(validated);
                localStorage.setItem("shuttle_recent_courts", JSON.stringify(validated));
              }
            } finally {
              setRecentCourtsLoading(false);
            }
          })();
        } catch (err) {
          localStorage.removeItem("shuttle_recent_courts");
          setRecentCourtsLoading(false);
        }
      }
    } catch (error) {
      console.error("Failed to load local storage:", error);
    }
  }, []);

  // WebRTC Broadcast helper
  const broadcastState = (updatedState: Record<string, unknown>) => {
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

    const controller = new AbortController();
    const signal = controller.signal;

    const poll = async () => {
      try {
        setIsSyncing(true);
        const res = await fetch(`/api/room/${roomCode}`, { 
          cache: "no-store",
          signal
        });
        if (!res.ok) {
          if (res.status === 404) {
            setSyncError("Room expired or connection lost.");
            setRoomCode(null);
            localStorage.removeItem("shuttle_room_code");
          } else {
            setSyncError(`Server error (${res.status}). Retrying...`);
          }
          return;
        }
        
        setSyncError(null);
        const data = await res.json();
        
        if (signal.aborted) return;

        if (data.lastUpdated > lastServerUpdateRef.current) {
          setLastServerUpdate(data.lastUpdated);
          setPlayers(data.players);
          setActivePlayerIds(data.activePlayerIds);
          setQueue(data.queue);
          setSessionMatches(data.sessionMatches);
          setActiveMatch(data.activeMatch);
          setWinnerCelebration(data.winnerCelebration);
        }
      } catch (err) {
        if (signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }

        const isNetworkError = err instanceof TypeError && 
          (err.message.includes("fetch") || err.message.includes("NetworkError") || err.message.includes("Network error"));

        if (isNetworkError) {
          console.warn("Room sync network error (offline or server down):", err.message);
        } else {
          console.error("Failed to poll room state:", err);
        }
        setSyncError("Connection lost. Trying to reconnect...");
      } finally {
        if (!signal.aborted) {
          setIsSyncing(false);
        }
      }
    };

    poll(); // Run immediately

    // Subscribe to realtime database updates for this specific room code!
    const channel = supabase
      .channel(`room:${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `code=eq.${roomCode.toUpperCase()}`
        },
        () => {
          // Whenever rooms.last_updated changes, fetch immediately!
          poll();
        }
      )
      .subscribe();

    // Fallback: poll every 10 seconds just in case websockets disconnect
    const interval = setInterval(poll, 10000);

    return () => {
      controller.abort();
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [roomCode]);


  const syncState = async (delta: Record<string, unknown>) => {
    if (!roomCode || roomRole === "viewer") return;
    // Broadcast immediately to WebRTC connections for instant 0ms delay sync
    broadcastState(delta);
    try {
      const res = await fetch(`/api/room/${roomCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(delta),
      });
      if (!res.ok) {
        if (res.status === 404) {
          setSyncError("Room expired or connection lost.");
          setRoomCode(null);
          localStorage.removeItem("shuttle_room_code");
        } else {
          setSyncError(`Server sync failed (${res.status}).`);
        }
      } else {
        setSyncError(null);
      }
    } catch (err) {
      const isNetworkError = err instanceof TypeError && 
        (err.message.includes("fetch") || err.message.includes("NetworkError") || err.message.includes("Network error"));

      if (isNetworkError) {
        console.warn("Room sync push network error (offline or server down):", err.message);
      } else {
        console.error("Failed to push sync:", err);
      }
      setSyncError("Connection lost. Sync pending...");
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
        
        // Add to recent list
        addToRecentCourts(data.code, courtNameInput);
        
        let msg = `Court "${courtNameInput}" created! Invite Code: ${data.code}`;
        if (!data.cloud) {
          msg += "\n\n⚠️ Database Offline: The server is running without a database connection. Add DATABASE_URL to your Vercel Environment Variables to enable persistent multi-user court syncing.";
        }
        showDialog({
          type: "alert",
          title: "Court Created",
          message: msg
        });
      } else {
        showDialog({
          type: "alert",
          title: "Error",
          message: "Failed to create court."
        });
      }
    } catch (err) {
      showDialog({
        type: "alert",
        title: "Connection Error",
        message: "Error connecting to server."
      });
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
      showDialog({ type: "alert", title: "Invalid Code", message: "Please enter a valid 6-character invite code." });
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
        setJoinInput("");

        addToRecentCourts(cleanCode, resolvedName);

        showDialog({ type: "alert", title: "Court Joined", message: `Successfully joined court: ${resolvedName}!` });
      } else {
        showDialog({ type: "alert", title: "Not Found", message: "Invite room not found. Check the code and try again." });
      }
    } catch (err) {
      showDialog({ type: "alert", title: "Connection Error", message: "Error connecting to server." });
    }
  };

  const handleDisconnectRoom = () => {
    showDialog({
      type: "confirm",
      title: "Disconnect Court",
      message: "Disconnect from cloud session? Your local device will keep the current session state, but edits will no longer sync.",
      onConfirm: () => {
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
    });
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
      showDialog({ type: "alert", title: "Duplicate Player", message: "A player with this name already exists!" });
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

  const handleDeletePlayer = (id: string) => {
    if (roomCode && roomRole === "viewer") return;
    const isInMatch = activeMatch && [
      ...activeMatch.left.players,
      ...activeMatch.right.players,
    ].some((p) => p?.id === id);
    if (isInMatch) {
      showDialog({ type: "alert", title: "Cannot Delete", message: "This player is currently in an active match. Finish or discard the match first." });
      return;
    }
    const player = players.find((p) => p.id === id);
    showDialog({
      type: "confirm",
      title: "Delete Player",
      message: `Remove "${player?.name || "this player"}" from the roster? This cannot be undone.`,
      onConfirm: () => {
        const updatedPlayers = players.filter((p) => p.id !== id);
        savePlayersToStorage(updatedPlayers);
        const updatedActiveIds = activePlayerIds.filter((pid) => pid !== id);
        saveActivePlayerIdsToStorage(updatedActiveIds);
        const updatedQueue = queue.filter((p) => p.id !== id);
        saveQueueToStorage(updatedQueue);
        syncState({ queue: updatedQueue });
      }
    });
  };

  const handleRenamePlayer = (id: string, newName: string) => {
    if (roomCode && roomRole === "viewer") return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (players.some((p) => p.id !== id && p.name.toLowerCase() === trimmed.toLowerCase())) {
      showDialog({ type: "alert", title: "Duplicate Name", message: "A player with this name already exists!" });
      return;
    }
    const updatedPlayers = players.map((p) => p.id === id ? { ...p, name: trimmed } : p);
    savePlayersToStorage(updatedPlayers);
    const updatedQueue = queue.map((p) => p.id === id ? { ...p, name: trimmed } : p);
    saveQueueToStorage(updatedQueue);
    syncState({ queue: updatedQueue });
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
    showDialog({
      type: "confirm",
      title: "Reset Session",
      message: "Reset current day? This clears today's match history and resets player queues, but keeps all players in the database.",
      onConfirm: () => {
        saveMatchesToStorage([]);
        const activePlayers = players.filter((p) => activePlayerIds.includes(p.id));
        saveQueueToStorage(activePlayers);
      }
    });
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
    showDialog({
      type: "confirm",
      title: "Discard Match",
      message: "Are you sure you want to discard this match and its stats?",
      onConfirm: () => {
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
    });
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
      recentCourtsLoading,
      voiceEnabled,
      isSyncing,
      syncError,
      joinInput,
      setJoinInput,
      setWinnerCelebration,
      setActiveMatch,
      
      handleAddPlayer,
      handleDeletePlayer,
      handleRenamePlayer,
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
      getDailyLeaderboard,
      showDialog
    }}>
      {children}
      {dialog && (
        <CustomDialogModal
          isOpen={!!dialog}
          type={dialog.type}
          title={dialog.title}
          message={dialog.message}
          onConfirm={() => {
            if (dialog.onConfirm) dialog.onConfirm();
            setDialog(null);
          }}
          onClose={() => {
            if (dialog.onCancel) dialog.onCancel();
            setDialog(null);
          }}
        />
      )}
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
