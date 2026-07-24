import { neon } from "@neondatabase/serverless";

// Helper to get Neon DB client if DATABASE_URL is defined
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return null;
  }
  return neon(url);
}

let isDbInitialized = false;

// Initialise normalized database tables if they don't exist yet
export async function initDb() {
  if (isDbInitialized) return true;
  
  const sql = getDb();
  if (!sql) return false;
  
  try {
    // Check if the old table schema exists (lacking court_name column)
    const checkColumns = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'rooms' AND column_name = 'court_name'
    `;
    
    // If the rooms table exists but does not have the 'court_name' column, drop it to recreate the new relational schema
    if (checkColumns.length === 0) {
      const checkTableExists = await sql`
        SELECT table_name FROM information_schema.tables WHERE table_name = 'rooms'
      `;
      if (checkTableExists.length > 0) {
        console.log("Migration: Dropping old rooms table to apply new relational schema...");
        await sql`DROP TABLE IF EXISTS rooms CASCADE`;
      }
    }

    // Execute all table creations inside a single network round-trip query execution
    await sql`
      CREATE TABLE IF NOT EXISTS rooms (
        code VARCHAR(6) PRIMARY KEY,
        court_name VARCHAR(255) NOT NULL,
        last_updated BIGINT NOT NULL
      );
      
      ALTER TABLE rooms DROP COLUMN IF EXISTS state;

      CREATE TABLE IF NOT EXISTS players (
        id VARCHAR(50) NOT NULL,
        room_code VARCHAR(6) NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        wins INT DEFAULT 0,
        losses INT DEFAULT 0,
        errors INT DEFAULT 0,
        points INT DEFAULT 0,
        PRIMARY KEY (id, room_code)
      );

      CREATE TABLE IF NOT EXISTS queue (
        room_code VARCHAR(6) NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
        player_id VARCHAR(50) NOT NULL,
        position INT NOT NULL,
        PRIMARY KEY (room_code, player_id)
      );

      CREATE TABLE IF NOT EXISTS matches (
        id VARCHAR(50) PRIMARY KEY,
        room_code VARCHAR(6) NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
        date VARCHAR(50) NOT NULL,
        mode VARCHAR(20) NOT NULL,
        left_players JSONB NOT NULL,
        right_players JSONB NOT NULL,
        left_score INT NOT NULL,
        right_score INT NOT NULL,
        winner_side VARCHAR(10) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS active_matches (
        room_code VARCHAR(6) PRIMARY KEY REFERENCES rooms(code) ON DELETE CASCADE,
        active_match JSONB,
        winner_celebration JSONB
      );
    `;

    isDbInitialized = true;
    return true;
  } catch (error) {
    console.error("Failed to initialise database tables:", error);
    return false;
  }
}

// Fetch room state from Postgres in a high-performance concurrent read pipeline
export async function getRoomFromDb(code: string) {
  const sql = getDb();
  if (!sql) return null;

  try {
    await initDb(); // Graceful auto-init
    const cleanCode = code.toUpperCase();

    // Fire all read queries concurrently in a single parallel batch request
    const [roomRows, playerRows, queueRows, matchRows, activeMatchRows] = await Promise.all([
      sql`SELECT code, court_name, last_updated FROM rooms WHERE code = ${cleanCode}`,
      sql`SELECT id, name, wins, losses, errors, points FROM players WHERE room_code = ${cleanCode}`,
      sql`SELECT player_id, position FROM queue WHERE room_code = ${cleanCode} ORDER BY position ASC`,
      sql`SELECT id, date, mode, left_players, right_players, left_score, right_score, winner_side FROM matches WHERE room_code = ${cleanCode} ORDER BY id DESC`,
      sql`SELECT active_match, winner_celebration FROM active_matches WHERE room_code = ${cleanCode}`
    ]);

    if (roomRows.length === 0) return null;
    const room = roomRows[0];

    const players = playerRows.map(p => ({
      id: p.id,
      name: p.name,
      stats: { wins: p.wins, losses: p.losses, errors: p.errors, points: p.points }
    }));

    const queue = queueRows.map(q => {
      const found = players.find(p => p.id === q.player_id);
      return found || { id: q.player_id, name: "Unknown", stats: { wins: 0, losses: 0, errors: 0, points: 0 } };
    });

    const sessionMatches = matchRows.map(m => ({
      id: m.id,
      date: m.date,
      mode: m.mode,
      leftPlayers: m.left_players,
      rightPlayers: m.right_players,
      leftScore: m.left_score,
      rightScore: m.right_score,
      winnerSide: m.winner_side
    }));

    const activeMatch = activeMatchRows.length > 0 ? activeMatchRows[0].active_match : null;
    const winnerCelebration = activeMatchRows.length > 0 ? activeMatchRows[0].winner_celebration : null;

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

// Fetch all active rooms from Postgres
export async function getAllRoomsFromDb() {
  const sql = getDb();
  if (!sql) return [];

  try {
    await initDb();
    const roomRows = await sql`
      SELECT code, court_name, last_updated FROM rooms ORDER BY last_updated DESC
    `;

    const activeRooms: any[] = [];
    for (const r of roomRows) {
      const full = await getRoomFromDb(r.code);
      if (full) {
        activeRooms.push(full);
      }
    }
    return activeRooms;
  } catch (error) {
    console.error("Failed to fetch all rooms from database:", error);
    return [];
  }
}

// Save room state to Postgres using normalized entity tables
// Save room state to Postgres using normalized entity tables with high-performance jsonb batching
export async function saveRoomToDb(code: string, state: any) {
  const sql = getDb();
  if (!sql) return false;

  try {
    await initDb();
    const cleanCode = code.toUpperCase();
    const lastUpdated = Date.now();

    // Step 1: Upsert base Room first to avoid Foreign Key constraint violations on children
    if (state.courtName) {
      await sql`
        INSERT INTO rooms (code, court_name, last_updated)
        VALUES (${cleanCode}, ${state.courtName}, ${lastUpdated})
        ON CONFLICT (code) DO UPDATE
        SET court_name = EXCLUDED.court_name, last_updated = EXCLUDED.last_updated;
      `;
    } else {
      await sql`
        UPDATE rooms SET last_updated = ${lastUpdated} WHERE code = ${cleanCode};
      `;
    }

    // Step 2: Execute all child table upserts in parallel (saving database round-trips)
    const updates: Promise<any>[] = [];

    // A. Players batch update
    if (state.players) {
      const playerRecords = state.players.map((p: any) => ({
        id: p.id,
        room_code: cleanCode,
        name: p.name,
        wins: p.stats.wins,
        losses: p.stats.losses,
        errors: p.stats.errors,
        points: p.stats.points
      }));

      updates.push(
        sql`
          DELETE FROM players WHERE room_code = ${cleanCode};
          INSERT INTO players (id, room_code, name, wins, losses, errors, points)
          SELECT id, room_code, name, wins, losses, errors, points
          FROM jsonb_to_recordset(${JSON.stringify(playerRecords)}::jsonb)
          AS x(id VARCHAR, room_code VARCHAR, name VARCHAR, wins INT, losses INT, errors INT, points INT);
        `
      );
    }

    // B. Queue batch update
    if (state.queue) {
      const queueRecords = state.queue.map((q: any, i: number) => ({
        room_code: cleanCode,
        player_id: q.id,
        position: i
      }));

      updates.push(
        sql`
          DELETE FROM queue WHERE room_code = ${cleanCode};
          INSERT INTO queue (room_code, player_id, position)
          SELECT room_code, player_id, position
          FROM jsonb_to_recordset(${JSON.stringify(queueRecords)}::jsonb)
          AS x(room_code VARCHAR, player_id VARCHAR, position INT);
        `
      );
    }

    // C. Matches batch update
    if (state.sessionMatches) {
      const matchIds = state.sessionMatches.map((m: any) => m.id);
      const matchRecords = state.sessionMatches.map((m: any) => ({
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

      if (matchIds.length > 0) {
        updates.push(
          sql`
            DELETE FROM matches WHERE room_code = ${cleanCode} AND id NOT IN (${matchIds});
            INSERT INTO matches (id, room_code, date, mode, left_players, right_players, left_score, right_score, winner_side)
            SELECT id, room_code, date, mode, left_players, right_players, left_score, right_score, winner_side
            FROM jsonb_to_recordset(${JSON.stringify(matchRecords)}::jsonb)
            AS x(id VARCHAR, room_code VARCHAR, date VARCHAR, mode VARCHAR, left_players JSONB, right_players JSONB, left_score INT, right_score INT, winner_side VARCHAR)
            ON CONFLICT (id) DO UPDATE
            SET date = EXCLUDED.date,
                mode = EXCLUDED.mode,
                left_players = EXCLUDED.left_players,
                right_players = EXCLUDED.right_players,
                left_score = EXCLUDED.left_score,
                right_score = EXCLUDED.right_score,
                winner_side = EXCLUDED.winner_side;
          `
        );
      } else {
        updates.push(sql`DELETE FROM matches WHERE room_code = ${cleanCode};`);
      }
    }

    // D. Active Match update
    if (state.activeMatch !== undefined || state.winnerCelebration !== undefined) {
      const activeMatchVal = state.activeMatch ? JSON.stringify(state.activeMatch) : null;
      const celebrationVal = state.winnerCelebration ? JSON.stringify(state.winnerCelebration) : null;

      updates.push(
        sql`
          INSERT INTO active_matches (room_code, active_match, winner_celebration)
          VALUES (${cleanCode}, ${activeMatchVal}, ${celebrationVal})
          ON CONFLICT (room_code) DO UPDATE
          SET active_match = COALESCE(${activeMatchVal}, active_matches.active_match),
              winner_celebration = COALESCE(${celebrationVal}, active_matches.winner_celebration);
        `
      );
    }

    // Await all batch updates in parallel
    await Promise.all(updates);

    return true;
  } catch (error) {
    console.error(`Failed to save room ${code} to database:`, error);
    return false;
  }
}
