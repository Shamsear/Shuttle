import { getSupabaseAdmin } from "../../../lib/supabase";
import { RoomState } from "./store";

interface Player {
  id: string;
  name: string;
  stats: {
    wins: number;
    losses: number;
    errors: number;
    points: number;
  };
}

interface Match {
  id: string;
  date: string;
  mode: string;
  leftPlayers: string[];
  rightPlayers: string[];
  leftScore: number;
  rightScore: number;
  winnerSide: string;
}

// Helper to get Supabase Admin client if configured
export function getDb() {
  const adminClient = getSupabaseAdmin();
  return adminClient;
}

// Supabase table schemas are initialized in the Supabase SQL editor.
// We just return true so it doesn't block the rest of the application.
export async function initDb() {
  return true;
}

// Fetch room state from Supabase in parallel
export async function getRoomFromDb(code: string) {
  const supabase = getDb();
  if (!supabase) return null;

  try {
    const cleanCode = code.toUpperCase();

    // Fire all read queries concurrently in parallel, converting PromiseLike to native Promise
    const [roomRes, playersRes, queueRes, matchesRes, activeMatchRes] = await Promise.all([
      Promise.resolve(supabase.from("rooms").select("code, court_name, last_updated").eq("code", cleanCode).single()),
      Promise.resolve(supabase.from("players").select("id, name, wins, losses, errors, points").eq("room_code", cleanCode)),
      Promise.resolve(supabase.from("queue").select("player_id, position").eq("room_code", cleanCode).order("position", { ascending: true })),
      Promise.resolve(supabase.from("matches").select("id, date, mode, left_players, right_players, left_score, right_score, winner_side").eq("room_code", cleanCode).order("id", { ascending: false })),
      Promise.resolve(supabase.from("active_matches").select("active_match, winner_celebration").eq("room_code", cleanCode).maybeSingle())
    ]);

    if (roomRes.error || !roomRes.data) return null;
    const room = roomRes.data;

    const players = (playersRes.data || []).map(p => ({
      id: p.id,
      name: p.name,
      stats: { wins: p.wins, losses: p.losses, errors: p.errors, points: p.points }
    }));

    const queue = (queueRes.data || []).map(q => {
      const found = players.find(p => p.id === q.player_id);
      return found || { id: q.player_id, name: "Unknown", stats: { wins: 0, losses: 0, errors: 0, points: 0 } };
    });

    const sessionMatches = (matchesRes.data || []).map(m => ({
      id: m.id,
      date: m.date,
      mode: m.mode,
      leftPlayers: m.left_players,
      rightPlayers: m.right_players,
      leftScore: m.left_score,
      rightScore: m.right_score,
      winnerSide: m.winner_side
    }));

    const activeMatch = activeMatchRes.data ? activeMatchRes.data.active_match : null;
    const winnerCelebration = activeMatchRes.data ? activeMatchRes.data.winner_celebration : null;

    return {
      code: room.code,
      courtName: room.court_name,
      lastUpdated: Number(room.last_updated),
      players,
      activePlayerIds: players.map(p => p.id),
      queue,
      sessionMatches,
      activeMatch,
      winnerCelebration
    };
  } catch (error) {
    console.error(`Failed to get room ${code} from database:`, error);
    return null;
  }
}

// Fetch all active rooms from Supabase
export async function getAllRoomsFromDb() {
  const supabase = getDb();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("rooms")
      .select("code")
      .order("last_updated", { ascending: false });

    if (error || !data) return [];

    const activeRooms: RoomState[] = [];
    const roomsData = await Promise.all(data.map(r => getRoomFromDb(r.code)));
    for (const full of roomsData) {
      if (full) {
        // cast to RoomState safely since it contains all RoomState properties
        activeRooms.push(full as unknown as RoomState);
      }
    }
    return activeRooms;
  } catch (error) {
    console.error("Failed to fetch all rooms from database:", error);
    return [];
  }
}

// Save room state to Supabase
export async function saveRoomToDb(code: string, state: Partial<RoomState>, isNewRoom = false): Promise<{ success: boolean; lastUpdated: number }> {
  const supabase = getDb();
  if (!supabase) return { success: false, lastUpdated: 0 };

  try {
    const cleanCode = code.toUpperCase();
    const lastUpdated = Date.now();

    // Step 1: Create room first ONLY if it is a new room (required for foreign key constraints)
    if (isNewRoom) {
      const { error: roomError } = await supabase.from("rooms").upsert({
        code: cleanCode,
        court_name: state.courtName || `Court ${cleanCode}`,
        last_updated: lastUpdated
      });
      if (roomError) throw roomError;
    }

    // Step 2: Execute Players update first (since other child tables like queue have foreign key references to players)
    if (state.players) {
      const playerRecords = state.players.map((p: Player) => ({
        id: p.id,
        room_code: cleanCode,
        name: p.name,
        wins: p.stats.wins,
        losses: p.stats.losses,
        errors: p.stats.errors,
        points: p.stats.points
      }));

      if (!isNewRoom) {
        if (playerRecords.length > 0) {
          const playerIds = state.players.map((p: Player) => p.id);
          const { error: delErr } = await supabase.from("players")
            .delete()
            .eq("room_code", cleanCode)
            .not("id", "in", `(${playerIds.join(",")})`);
          if (delErr) throw delErr;

          const { error: upsErr } = await supabase.from("players").upsert(playerRecords);
          if (upsErr) throw upsErr;
        } else {
          const { error: delErr } = await supabase.from("players").delete().eq("room_code", cleanCode);
          if (delErr) throw delErr;
        }
      } else {
        if (playerRecords.length > 0) {
          const { error: insErr } = await supabase.from("players").insert(playerRecords);
          if (insErr) throw insErr;
        }
      }
    }

    // Step 3: Execute all remaining child table upserts in parallel (using async IIFE to return native ES Promises)
    const updates: Promise<unknown>[] = [];

    // B. Queue update
    if (state.queue) {
      const queueRecords = state.queue.map((q: Player, i: number) => ({
        room_code: cleanCode,
        player_id: q.id,
        position: i
      }));

      updates.push((async () => {
        if (!isNewRoom) {
          const { error: delErr } = await supabase.from("queue").delete().eq("room_code", cleanCode);
          if (delErr) throw delErr;
        }
        if (queueRecords.length > 0) {
          const { error: insErr } = await supabase.from("queue").insert(queueRecords);
          if (insErr) throw insErr;
        }
      })());
    }

    // C. Matches update
    if (state.sessionMatches) {
      const matchRecords = state.sessionMatches.map((m: Match) => ({
        id: m.id,
        room_code: cleanCode,
        date: m.date,
        mode: m.mode,
        left_players: m.leftPlayers,
        right_players: m.rightPlayers,
        left_score: m.leftScore,
        right_score: m.rightScore,
        winner_side: m.winnerSide
      }));

      updates.push((async () => {
        if (isNewRoom) {
          if (matchRecords.length > 0) {
            const { error: insErr } = await supabase.from("matches").insert(matchRecords);
            if (insErr) throw insErr;
          }
        } else {
          if (matchRecords.length > 0) {
            const matchIds = state.sessionMatches!.map((m: Match) => m.id);
            const { error: delErr } = await supabase.from("matches")
              .delete()
              .eq("room_code", cleanCode)
              .not("id", "in", `(${matchIds.join(",")})`);
            if (delErr) throw delErr;

            const { error: upsErr } = await supabase.from("matches").upsert(matchRecords);
            if (upsErr) throw upsErr;
          } else {
            const { error: delErr } = await supabase.from("matches")
              .delete()
              .eq("room_code", cleanCode);
            if (delErr) throw delErr;
          }
        }
      })());
    }

    // D. Active Match update
    if (state.activeMatch !== undefined || state.winnerCelebration !== undefined) {
      const upsertData: Record<string, unknown> = { room_code: cleanCode };
      if (state.activeMatch !== undefined) upsertData.active_match = state.activeMatch;
      if (state.winnerCelebration !== undefined) upsertData.winner_celebration = state.winnerCelebration;

      if (!isNewRoom || upsertData.active_match !== null || upsertData.winner_celebration !== null) {
        updates.push((async () => {
          const { error: upsErr } = await supabase.from("active_matches").upsert(upsertData);
          if (upsErr) throw upsErr;
        })());
      }
    }

    // Await all updates
    await Promise.all(updates);

    // Step 3: Now that child tables are committed, update rooms table to trigger Realtime Sync
    if (!isNewRoom) {
      const updateData: Record<string, unknown> = { last_updated: lastUpdated };
      if (state.courtName) updateData.court_name = state.courtName;
      const { error: roomError } = await supabase
        .from("rooms")
        .update(updateData)
        .eq("code", cleanCode);
      if (roomError) throw roomError;
    }

    return { success: true, lastUpdated };
  } catch (error) {
    console.error(`Failed to save room ${code} to database:`, error);
    return { success: false, lastUpdated: 0 };
  }
}
