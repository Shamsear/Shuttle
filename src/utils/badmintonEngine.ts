export interface Player {
  id: string;
  name: string;
}

export type Side = "left" | "right";
export type CourtPosition = "left" | "right"; // Service court box (Left or Right relative to looking at that side)
export type ScoringSystem = "classic" | "rally";

export interface MatchState {
  mode: "singles" | "doubles";
  scoringSystem: ScoringSystem;
  left: {
    players: (Player | null)[]; // Index 0: Left box, Index 1: Right box
    score: number;
    errors: number;
  };
  right: {
    players: (Player | null)[]; // Index 0: Left box, Index 1: Right box
    score: number;
    errors: number;
  };
  servingSide: Side;
  serverPosition: CourtPosition; // Which box the current server stands in
  receiverPosition: CourtPosition; // Which box the receiver stands in
  history: Omit<MatchState, "history" | "future">[]; // Stack for undo
  future: Omit<MatchState, "history" | "future">[];  // Stack for redo
}

/**
 * Initializes the match state with players and default positions
 */
export function initializeMatch(
  mode: "singles" | "doubles",
  scoringSystem: ScoringSystem,
  leftPlayers: Player[],
  rightPlayers: Player[]
): MatchState {
  const leftBoxPlayers: (Player | null)[] = [null, null];
  const rightBoxPlayers: (Player | null)[] = [null, null];

  if (mode === "singles") {
    // In singles, players start in the right box (since score is 0-0, even)
    leftBoxPlayers[1] = leftPlayers[0] || null; // Index 1 is Right Box
    rightBoxPlayers[1] = rightPlayers[0] || null; // Index 1 is Right Box
  } else {
    // In doubles, player 1 is in the right box, player 2 is in the left box
    leftBoxPlayers[0] = leftPlayers[1] || null; // Left Box
    leftBoxPlayers[1] = leftPlayers[0] || null; // Right Box
    
    rightBoxPlayers[0] = rightPlayers[1] || null; // Left Box
    rightBoxPlayers[1] = rightPlayers[0] || null; // Right Box
  }

  return {
    mode,
    scoringSystem,
    left: {
      players: leftBoxPlayers,
      score: 0,
      errors: 0,
    },
    right: {
      players: rightBoxPlayers,
      score: 0,
      errors: 0,
    },
    servingSide: "left", // Default serving side is Left (Team A)
    serverPosition: "right", // Initial serve is from Right court (0 is even)
    receiverPosition: "right", // Receiver is in Right court (diagonal)
    history: [],
    future: [],
  };
}

/**
 * Creates a clone of the match state, removing history & future to prevent circular refs in stack
 */
function cloneStateForHistory(state: MatchState): Omit<MatchState, "history" | "future"> {
  return {
    mode: state.mode,
    scoringSystem: state.scoringSystem,
    left: {
      players: [...state.left.players],
      score: state.left.score,
      errors: state.left.errors,
    },
    right: {
      players: [...state.right.players],
      score: state.right.score,
      errors: state.right.errors,
    },
    servingSide: state.servingSide,
    serverPosition: state.serverPosition,
    receiverPosition: state.receiverPosition,
  };
}

/**
 * Swaps the player positions (boxes) on a specific side
 */
function swapPositions(players: (Player | null)[]): (Player | null)[] {
  return [players[1], players[0]];
}

/**
 * Calculates who the server and receiver should be based on current positions and scores
 */
export function updateServicePositions(state: MatchState): MatchState {
  const newState = { ...state };
  const servingSide = newState.servingSide;
  const servingScore = newState[servingSide].score;

  // Server position based on server's score: Even = Right court (1), Odd = Left court (0)
  const serverPos: CourtPosition = servingScore % 2 === 0 ? "right" : "left";
  newState.serverPosition = serverPos;
  
  // Receiver position is always diagonal to server (Right serves to Right, Left serves to Left)
  newState.receiverPosition = serverPos;

  // In Singles, BOTH the server and receiver move left and right together based on the server's score
  if (newState.mode === "singles") {
    const leftPlayer = newState.left.players[0] || newState.left.players[1];
    const rightPlayer = newState.right.players[0] || newState.right.players[1];

    // Even score -> Right court (Index 1), Odd score -> Left court (Index 0)
    const targetIndex = servingScore % 2 === 0 ? 1 : 0;

    if (leftPlayer) {
      newState.left.players = [null, null];
      newState.left.players[targetIndex] = leftPlayer;
    }

    if (rightPlayer) {
      newState.right.players = [null, null];
      newState.right.players[targetIndex] = rightPlayer;
    }
  }

  return newState;
}

/**
 * Processes a rally result
 * @param state Current match state
 * @param rallyWinner Side that won the rally ("left" or "right")
 * @param isError Did the opponent lose due to hitting it "out" or fault?
 * @param errorSide The side that made the error (if any)
 */
export function handleRally(
  state: MatchState,
  rallyWinner: Side,
  isError: boolean = false,
  errorSide: Side | null = null
): MatchState {
  // 1. Save history entry for Undo
  const historyEntry = cloneStateForHistory(state);
  
  let newState: MatchState = {
    ...state,
    left: {
      ...state.left,
      players: [...state.left.players],
    },
    right: {
      ...state.right,
      players: [...state.right.players],
    },
    history: [...state.history, historyEntry],
    future: [], // Clear redo history on new action
  };

  // 2. Record errors if applicable
  if (isError && errorSide) {
    newState[errorSide].errors += 1;
  }

  const isServerWinner = newState.servingSide === rallyWinner;

  if (newState.scoringSystem === "rally") {
    // --- Modern Rally Point System ---
    // Rally winner ALWAYS receives +1 point
    newState[rallyWinner].score += 1;

    if (isServerWinner) {
      // Server wins rally: In doubles, server & partner swap positions
      if (newState.mode === "doubles") {
        newState[rallyWinner].players = swapPositions(newState[rallyWinner].players);
      }
    } else {
      // Receiver wins rally: Serve transitions to them (no position swap)
      newState.servingSide = rallyWinner;
    }
  } else {
    // --- Classic Hand-In Hand-Out System ---
    if (isServerWinner) {
      // Server wins rally: Scores +1 point!
      newState[rallyWinner].score += 1;
      
      // In doubles, server & partner swap positions
      if (newState.mode === "doubles") {
        newState[rallyWinner].players = swapPositions(newState[rallyWinner].players);
      }
    } else {
      // Receiver wins rally: Side-out (Loss of serve)! NO point scored, serve transitions.
      newState.servingSide = rallyWinner;
    }
  }

  // 3. Update server and receiver positions dynamically
  newState = updateServicePositions(newState);

  return newState;
}

/**
 * Undoes the last action
 */
export function handleUndo(state: MatchState): MatchState {
  if (state.history.length === 0) return state;

  const newHistory = [...state.history];
  const previousState = newHistory.pop()!;
  const currentStateCloned = cloneStateForHistory(state);

  return {
    ...state,
    ...previousState,
    left: { 
      ...previousState.left, 
      players: [...previousState.left.players] 
    },
    right: { 
      ...previousState.right, 
      players: [...previousState.right.players] 
    },
    history: newHistory,
    future: [currentStateCloned, ...state.future], // Push current state to redo stack
  };
}

/**
 * Redoes the last undone action
 */
export function handleRedo(state: MatchState): MatchState {
  if (state.future.length === 0) return state;

  const newFuture = [...state.future];
  const nextState = newFuture.shift()!;
  const currentStateCloned = cloneStateForHistory(state);

  return {
    ...state,
    ...nextState,
    left: { 
      ...nextState.left, 
      players: [...nextState.left.players] 
    },
    right: { 
      ...nextState.right, 
      players: [...nextState.right.players] 
    },
    history: [...state.history, currentStateCloned], // Push current state to undo stack
    future: newFuture,
  };
}

/**
 * Swaps left and right display sides visually
 */
export function swapSides(state: MatchState): MatchState {
  const historyEntry = cloneStateForHistory(state);

  const swappedLeft = { ...state.right, players: [...state.right.players] };
  const swappedRight = { ...state.left, players: [...state.left.players] };
  const swappedServingSide: Side = state.servingSide === "left" ? "right" : "left";

  let newState: MatchState = {
    ...state,
    left: swappedLeft,
    right: swappedRight,
    servingSide: swappedServingSide,
    history: [...state.history, historyEntry],
    future: [], // Clear redo history on visual side swap
  };

  newState = updateServicePositions(newState);
  return newState;
}
