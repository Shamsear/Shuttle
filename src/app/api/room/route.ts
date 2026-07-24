import { NextResponse } from "next/server";
import { rooms, RoomState } from "./store";
import { saveRoomToDb, getAllRoomsFromDb, getDb } from "./db";

export const dynamic = "force-dynamic";

// GET handler: fetch all active courts
export async function GET() {
  try {
    const isDbConnected = getDb() !== null;
    const headers = {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    };
    if (isDbConnected) {
      const dbRooms = await getAllRoomsFromDb();
      return NextResponse.json(dbRooms, { headers });
    } else {
      // In-memory fallback
      const localRooms = Array.from(rooms.values());
      return NextResponse.json(localRooms, { headers });
    }
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch courts list" }, { status: 500 });
  }
}

// POST handler: create a new court session
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Generate a unique 6-character room invite code
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Omit confusing letters
    let code = "";
    let attempts = 0;
    const isDbConnected = getDb() !== null;
    
    // Fallback registry check
    do {
      code = "";
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      attempts++;
    } while (rooms.has(code) && attempts < 100);

    const defaultPlayers = [
      { id: "1", name: "Alice", stats: { wins: 0, losses: 0, errors: 0, points: 0 } },
      { id: "2", name: "Bob", stats: { wins: 0, losses: 0, errors: 0, points: 0 } },
      { id: "3", name: "Charlie", stats: { wins: 0, losses: 0, errors: 0, points: 0 } },
      { id: "4", name: "David", stats: { wins: 0, losses: 0, errors: 0, points: 0 } },
    ];

    const initialPlayers = (body.players && body.players.length > 0) ? body.players : defaultPlayers;
    const initialActivePlayerIds = (body.activePlayerIds && body.activePlayerIds.length > 0) ? body.activePlayerIds : initialPlayers.map((p: any) => p.id);
    const initialQueue = (body.queue && body.queue.length > 0) ? body.queue : initialPlayers;

    const roomState: RoomState = {
      code,
      courtName: body.courtName || `Court ${code}`,
      lastUpdated: Date.now(),
      players: initialPlayers,
      activePlayerIds: initialActivePlayerIds,
      queue: initialQueue,
      sessionMatches: body.sessionMatches || [],
      activeMatch: body.activeMatch || null,
      winnerCelebration: body.winnerCelebration || null,
      activeScreen: body.activeScreen || "home",
    };

    if (isDbConnected) {
      // Save directly to Neon Postgres database
      await saveRoomToDb(code, roomState);
    } else {
      // Fallback: Save to in-memory global registry
      rooms.set(code, roomState);
    }
    
    return NextResponse.json({ code, state: roomState, cloud: isDbConnected });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
