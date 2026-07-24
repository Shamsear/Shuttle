import { NextResponse } from "next/server";
import { rooms } from "../store";
import { getRoomFromDb, saveRoomToDb, getDb } from "../db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // Await params in Next.js 15+ as it is now a Promise
    const resolvedParams = await params;
    const code = resolvedParams.code.toUpperCase();
    const isDbConnected = getDb() !== null;
    
    if (isDbConnected) {
      // Fetch from Neon database
      const dbRoom = await getRoomFromDb(code);
      if (!dbRoom) {
        return NextResponse.json({ error: "Invite code not found in database" }, { status: 404 });
      }
      return NextResponse.json(dbRoom);
    } else {
      // Fallback: Fetch from in-memory global registry
      const localRoom = rooms.get(code);
      if (!localRoom) {
        return NextResponse.json({ error: "Invite code not found locally" }, { status: 404 });
      }
      return NextResponse.json(localRoom);
    }
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch room state" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // Await params in Next.js 15+ as it is now a Promise
    const resolvedParams = await params;
    const code = resolvedParams.code.toUpperCase();
    const body = await request.json();
    const isDbConnected = getDb() !== null;
    
    if (isDbConnected) {
      // Get current state to merge
      const existing = await getRoomFromDb(code);
      if (!existing) {
        return NextResponse.json({ error: "Invite code not found in database" }, { status: 404 });
      }
      
      const updated = {
        ...existing,
        ...body,
        code,
        lastUpdated: Date.now()
      };
      
      await saveRoomToDb(code, updated);
      return NextResponse.json(updated);
    } else {
      // Fallback: Fetch from in-memory global registry
      const existing = rooms.get(code);
      if (!existing) {
        return NextResponse.json({ error: "Invite code not found locally" }, { status: 404 });
      }

      const updated = {
        ...existing,
        ...body,
        code,
        lastUpdated: Date.now(),
      };

      rooms.set(code, updated);
      return NextResponse.json(updated);
    }
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update room state" }, { status: 500 });
  }
}
