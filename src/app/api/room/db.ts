import { neon } from "@neondatabase/serverless";

// Helper to get Neon DB client if DATABASE_URL is defined
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return null;
  }
  return neon(url);
}

// Initialise normalized database tables if they don't exist yet
export async function initDb() {
  const sql = getDb();
  if (!sql) return false;
  
  try {
    // 1. Rooms
    await sql`
      CREATE TABLE IF NOT EXISTS rooms (
        code VARCHAR(6) PRIMARY KEY,
        court_name VARCHAR(255) NOT NULL,
        last_updated BIGINT NOT NULL
      );
    `;

    // 2. Players
    await sql`
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
    `;

    // 3. Queue Positions
    await sql`
      CREATE TABLE IF NOT EXISTS queue (
        room_code VARCHAR(6) NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
        player_id VARCHAR(50) NOT NULL,
        position INT NOT NULL,
        PRIMARY KEY (room_code, player_id)
      );
    `;

    // 4. Match Records
    await sql`
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
    `;

    // 5. Active Matches & Winner Celebrations
    await sql`
      CREATE TABLE IF NOT EXISTS active_matches (
        room_code VARCHAR(6) PRIMARY KEY REFERENCES rooms(code) ON DELETE CASCADE,
        active_match JSONB,
        winner_celebration JSONB
      );
    `;

    return true;
  } catch (error) {
    console.error("Failed to initialise database tables:", error);
    return false;
  }
}

// Fetch room state from Postgres
export async function getRoomFromDb(code: string) {
  const sql = getDb();
  if (!sql) return null;

  try {
    await initDb(); // Graceful auto-init
    const cleanCode = code.toUpperCase();

    // 1. Fetch room base
    const roomRows = await sql`
      SELECT code, court_name, last_updated FROM rooms WHERE code = ${cleanCode}
    `;
    if (roomRows.length === 0) return null;
    const room = roomRows[0];

    // 2. Fetch players
    const playerRows = await sql`
      SELECT id, name, wins, losses, errors, points FROM players WHERE room_code = ${cleanCode}
    `;
    const players = playerRows.map(p => ({
      id: p.id,
      name: p.name,
      stats: { wins: p.wins, losses: p.losses, errors: p.errors, points: p.points }
    }));

    // 3. Fetch queue
    const queueRows = await sql`
      SELECT player_id, position FROM queue WHERE room_code = ${cleanCode} ORDER BY position ASC
    `;
    const queue = queueRows.map(q => {
      const found = players.find(p => p.id === q.player_id);
      return found || { id: q.player_id, name: "Unknown", stats: { wins: 0, losses: 0, errors: 0, points: 0 } };
    });

    // 4. Fetch session history matches
    const matchRows = await sql`
      SELECT id, date, mode, left_players, right_players, left_score, right_score, winner_side 
      FROM matches WHERE room_code = ${cleanCode} ORDER BY id DESC
    `;
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

    // 5. Fetch active match metadata
    const activeMatchRows = await sql`
      SELECT active_match, winner_celebration FROM active_matches WHERE room_code = ${cleanCode}
    `;
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
export async function saveRoomToDb(code: string, state: any) {
  const sql = getDb();
  if (!sql) return false;

  try {
    await initDb();
    const cleanCode = code.toUpperCase();
    const lastUpdated = Date.now();

    // 1. Upsert base Room
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

    // 2. Upsert Players
    if (state.players) {
      await sql`DELETE FROM players WHERE room_code = ${cleanCode}`;
      for (const p of state.players) {
        await sql`
          INSERT INTO players (id, room_code, name, wins, losses, errors, points)
          VALUES (${p.id}, ${cleanCode}, ${p.name}, ${p.stats.wins}, ${p.stats.losses}, ${p.stats.errors}, ${p.stats.points});
        `;
      }
    }

    // 3. Upsert Queue
    if (state.queue) {
      await sql`DELETE FROM queue WHERE room_code = ${cleanCode}`;
      for (let i = 0; i < state.queue.length; i++) {
        const q = state.queue[i];
        await sql`
          INSERT INTO queue (room_code, player_id, position)
          VALUES (${cleanCode}, ${q.id}, ${i});
        `;
      }
    }

    // 4. Upsert Matches
    if (state.sessionMatches) {
      const matchIds = state.sessionMatches.map((m: any) => m.id);
      if (matchIds.length > 0) {
        // Query to format matchIds safely
        await sql`DELETE FROM matches WHERE room_code = ${cleanCode} AND id NOT IN (${matchIds})`;
      } else {
        await sql`DELETE FROM matches WHERE room_code = ${cleanCode}`;
      }

      for (const m of state.sessionMatches) {
        await sql`
          INSERT INTO matches (id, room_code, date, mode, left_players, right_players, left_score, right_score, winner_side)
          VALUES (${m.id}, ${cleanCode}, ${m.date}, ${m.mode}, ${JSON.stringify(m.leftPlayers)}, ${JSON.stringify(m.rightPlayers)}, ${m.leftScore}, ${m.rightScore}, ${m.winnerSide})
          ON CONFLICT (id) DO UPDATE
          SET date = EXCLUDED.date,
              mode = EXCLUDED.mode,
              left_players = EXCLUDED.left_players,
              right_players = EXCLUDED.right_players,
              left_score = EXCLUDED.left_score,
              right_score = EXCLUDED.right_score,
              winner_side = EXCLUDED.winner_side;
        `;
      }
    }

    // 5. Upsert Active Match & Winner Celebration
    if (state.activeMatch !== undefined || state.winnerCelebration !== undefined) {
      const activeMatchVal = state.activeMatch ? JSON.stringify(state.activeMatch) : null;
      const celebrationVal = state.winnerCelebration ? JSON.stringify(state.winnerCelebration) : null;

      await sql`
        INSERT INTO active_matches (room_code, active_match, winner_celebration)
        VALUES (${cleanCode}, ${activeMatchVal}, ${celebrationVal})
        ON CONFLICT (room_code) DO UPDATE
        SET active_match = COALESCE(${activeMatchVal}, active_matches.active_match),
            winner_celebration = COALESCE(${celebrationVal}, active_matches.winner_celebration);
      `;
    }

    return true;
  } catch (error) {
    console.error(`Failed to save room ${code} to database:`, error);
    return false;
  }
}
