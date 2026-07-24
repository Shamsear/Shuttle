import { NextResponse } from "next/server";
import { rooms, RoomState } from "./store";
import { saveRoomToDb, getDb } from "./db";

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
