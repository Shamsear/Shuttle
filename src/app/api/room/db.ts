import { neon } from "@neondatabase/serverless";

// Helper to get Neon DB client if DATABASE_URL is defined
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return null;
  }
  return neon(url);
}

// Initialise the rooms table if it doesn't exist yet
export async function initDb() {
  const sql = getDb();
  if (!sql) return false;
  
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS rooms (
        code VARCHAR(6) PRIMARY KEY,
        last_updated BIGINT NOT NULL,
        state JSONB NOT NULL
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
    const result = await sql`
      SELECT state, last_updated FROM rooms WHERE code = ${code.toUpperCase()}
    `;
    if (result.length === 0) return null;

    const row = result[0];
    return {
      code,
      lastUpdated: Number(row.last_updated),
      ...row.state
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
    const result = await sql`
      SELECT code, last_updated, state FROM rooms ORDER BY last_updated DESC
    `;
    return result.map(row => ({
      code: row.code,
      lastUpdated: Number(row.last_updated),
      ...row.state
    }));
  } catch (error) {
    console.error("Failed to fetch all rooms from database:", error);
    return [];
  }
}

// Save room state to Postgres
export async function saveRoomToDb(code: string, state: any) {
  const sql = getDb();
  if (!sql) return false;

  try {
    await initDb(); // Graceful auto-init
    const cleanCode = code.toUpperCase();
    const lastUpdated = Date.now();
    
    // Omit code and lastUpdated from json payload to avoid duplication
    const { code: _, lastUpdated: __, ...statePayload } = state;

    await sql`
      INSERT INTO rooms (code, last_updated, state)
      VALUES (${cleanCode}, ${lastUpdated}, ${statePayload})
      ON CONFLICT (code) DO UPDATE
      SET last_updated = EXCLUDED.last_updated,
          state = EXCLUDED.state;
    `;
    return true;
  } catch (error) {
    console.error(`Failed to save room ${code} to database:`, error);
    return false;
  }
}
