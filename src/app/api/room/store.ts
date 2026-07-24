export interface RoomState {
  code: string;
  lastUpdated: number;
  players: any[];
  activePlayerIds: string[];
  queue: any[];
  sessionMatches: any[];
  activeMatch: any | null;
  winnerCelebration: any | null;
  activeScreen: string;
}

// In-memory global store that survives HMR code updates in development
const globalRooms = globalThis as unknown as {
  rooms: Map<string, RoomState>;
};

if (!globalRooms.rooms) {
  globalRooms.rooms = new Map();
}

export const rooms = globalRooms.rooms;
