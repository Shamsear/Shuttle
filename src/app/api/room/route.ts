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

    const roomState: RoomState = {
      code,
      courtName: body.courtName || `Court ${code}`,
      lastUpdated: Date.now(),
      players: body.players || [],
      activePlayerIds: body.activePlayerIds || [],
      queue: body.queue || [],
      sessionMatches: body.sessionMatches || [],
      activeMatch: body.activeMatch || null,
      winnerCelebration: body.winnerCelebration || null,
      activeScreen: body.activeScreen || "home",
    };

    if (isDbConnected) {
      // Save directly to Neon Postgres database
      await saveRoomToDb(code, roomState, true);
    } else {
      // Fallback: Save to in-memory global registry
      rooms.set(code, roomState);
    }
    
    return NextResponse.json({ code, state: roomState, cloud: isDbConnected });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
