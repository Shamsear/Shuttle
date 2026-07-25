import { NextResponse } from "next/server";
import { rooms } from "../store";
import { getRoomFromDb, saveRoomToDb, getDb } from "../db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // Await params in Next.js 15+ as it is now a Promise
    const resolvedParams = await params;
    const code = resolvedParams.code.toUpperCase();
    const isDbConnected = getDb() !== null;
    const headers = {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    };
    
    if (isDbConnected) {
      // Fetch from Neon database
      const dbRoom = await getRoomFromDb(code);
      if (!dbRoom) {
        return NextResponse.json({ error: "Invite code not found in database" }, { status: 404 });
      }
      return NextResponse.json(dbRoom, { headers });
    } else {
      // Fallback: Fetch from in-memory global registry
      const localRoom = rooms.get(code);
      if (!localRoom) {
        return NextResponse.json({ error: "Invite code not found locally" }, { status: 404 });
      }
      return NextResponse.json(localRoom, { headers });
    }
  } catch {
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
      // Save the delta directly to the database without pre-fetching
      const saveRes = await saveRoomToDb(code, body);
      if (!saveRes.success) {
        return NextResponse.json({ error: "Failed to update room state in database" }, { status: 500 });
      }
      return NextResponse.json({ success: true, code, lastUpdated: saveRes.lastUpdated });
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
  } catch {
    return NextResponse.json({ error: "Failed to update room state" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const resolvedParams = await params;
    const code = resolvedParams.code.toUpperCase();
    const isDbConnected = getDb() !== null;

    if (isDbConnected) {
      const supabase = getDb();
      if (!supabase) {
        return NextResponse.json({ error: "Database client unavailable" }, { status: 500 });
      }
      const { error } = await supabase.from("rooms").delete().eq("code", code);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    } else {
      // Fallback: Delete from in-memory global registry
      rooms.delete(code);
      return NextResponse.json({ success: true });
    }
  } catch {
    return NextResponse.json({ error: "Failed to delete room" }, { status: 500 });
  }
}
