import React from "react";
import { MatchState, Side, CourtPosition } from "../utils/badmintonEngine";

interface CourtVisualizerProps {
  state: MatchState;
}

// Inline SVG Shuttlecock Icon (Gold accent)
const ShuttlecockIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", marginRight: "3px" }}>
    <path d="M12 2v20M5 12h14M8 7l4-5 4 5" />
    <path d="M6 18c0-3.3 2.7-6 6-6s6 2.7 6 6" opacity="0.8" />
  </svg>
);

// Inline SVG Target Crosshair Icon (White accent)
const TargetIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", marginRight: "3px" }}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
  </svg>
);

export default function CourtVisualizer({ state }: CourtVisualizerProps) {
  const { left, right, servingSide, serverPosition } = state;

  const getBoxStatus = (side: Side, pos: CourtPosition) => {
    const isServerSide = servingSide === side;
    
    if (isServerSide) {
      return {
        isServer: serverPosition === pos,
        isReceiver: false,
      };
    } else {
      const opposingPos: CourtPosition = serverPosition === "right" ? "right" : "left";
      return {
        isServer: false,
        isReceiver: pos === opposingPos,
      };
    }
  };

  const courtPlayers: Array<{
    id: string;
    name: string;
    posClass: string;
    isServer: boolean;
    isReceiver: boolean;
  }> = [];

  // Top Side (Right Team) - Top Team's Right Box is on screen TOP-LEFT (32%), Left Box is on TOP-RIGHT (68%)
  const topPlayerLeftBox = right.players[0]; // Left box -> screen top-right (68%)
  if (topPlayerLeftBox) {
    const status = getBoxStatus("right", "left");
    courtPlayers.push({
      id: topPlayerLeftBox.id,
      name: topPlayerLeftBox.name,
      posClass: "pos-top-right",
      isServer: status.isServer,
      isReceiver: status.isReceiver,
    });
  }

  const topPlayerRightBox = right.players[1]; // Right box -> screen top-left (32%)
  if (topPlayerRightBox) {
    const status = getBoxStatus("right", "right");
    courtPlayers.push({
      id: topPlayerRightBox.id,
      name: topPlayerRightBox.name,
      posClass: "pos-top-left",
      isServer: status.isServer,
      isReceiver: status.isReceiver,
    });
  }

  // Bottom Side (Left Team) - Bottom Team's Left Box is on screen BOTTOM-LEFT (32%), Right Box is on BOTTOM-RIGHT (68%)
  const bottomPlayerLeftBox = left.players[0]; // Left box -> screen bottom-left (32%)
  if (bottomPlayerLeftBox) {
    const status = getBoxStatus("left", "left");
    courtPlayers.push({
      id: bottomPlayerLeftBox.id,
      name: bottomPlayerLeftBox.name,
      posClass: "pos-bottom-left",
      isServer: status.isServer,
      isReceiver: status.isReceiver,
    });
  }

  const bottomPlayerRightBox = left.players[1]; // Right box -> screen bottom-right (68%)
  if (bottomPlayerRightBox) {
    const status = getBoxStatus("left", "right");
    courtPlayers.push({
      id: bottomPlayerRightBox.id,
      name: bottomPlayerRightBox.name,
      posClass: "pos-bottom-right",
      isServer: status.isServer,
      isReceiver: status.isReceiver,
    });
  }

  // Calculate curve flight path in 610 x 1340 coordinate system
  const getCurvePath = () => {
    let x1 = 415, y1 = 1060, x2 = 195, y2 = 280;

    if (servingSide === "left") {
      // Bottom side serving
      y1 = 1060;
      x1 = serverPosition === "right" ? 415 : 195; // Right box is x=415, Left box is x=195
      y2 = 280;
      x2 = serverPosition === "right" ? 195 : 415; // Receiver is in diagonal box across net!
    } else {
      // Top side serving
      y1 = 280;
      x1 = serverPosition === "right" ? 195 : 415; // Top team Right box is x=195, Left box is x=415
      y2 = 1060;
      x2 = serverPosition === "right" ? 415 : 195; // Bottom receiver is in diagonal box across net!
    }

    const ctrlX = (x1 + x2) / 2 + (servingSide === "left" ? 50 : -50);
    const ctrlY = (y1 + y2) / 2;

    return `M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`;
  };

  const pathD = getCurvePath();

  // Get active receiver court rect coordinates in 610 x 1340 coordinate system
  const getReceiverRect = () => {
    const isTopReceiver = servingSide === "left";
    
    let x = 86;
    if (isTopReceiver) {
      // Top receiver: when server is in Right box (x=415), receiver is in top-left box (x=86)
      x = serverPosition === "right" ? 86 : 305;
    } else {
      // Bottom receiver: when server is in Right box (x=195), receiver is in bottom-right box (x=305)
      x = serverPosition === "right" ? 305 : 86;
    }

    const y = isTopReceiver ? 116 : 902;

    return { x, y, width: 219, height: 322 };
  };

  const rxRect = getReceiverRect();

  return (
    <div className="court-container">
      <div className="court-wrapper">
        <svg 
          className="court-svg" 
          viewBox="0 0 610 1340" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Pitch Black Court Surface */}
          <rect width="610" height="1340" fill="#080808" rx="8" />

          {/* Receiver Target Service Box Highlight */}
          <rect 
            x={rxRect.x} 
            y={rxRect.y} 
            width={rxRect.width} 
            height={rxRect.height} 
            fill="url(#targetBoxGlow)" 
            opacity="0.35"
          />

          {/* Outer Boundary Line (Doubles Court: 530 x 1260) */}
          <rect 
            x="40" 
            y="40" 
            width="530" 
            height="1260" 
            stroke="#ffffff" 
            strokeWidth="6" 
            strokeLinejoin="round"
          />

          {/* Singles Sidelines (46 units in from outer line) */}
          <line x1="86" y1="40" x2="86" y2="1300" stroke="#3f3f46" strokeWidth="4" />
          <line x1="524" y1="40" x2="524" y2="1300" stroke="#3f3f46" strokeWidth="4" />

          {/* Short Service Lines (1.98m from center net y=670 -> y=438 & y=902) */}
          <line x1="40" y1="438" x2="570" y2="438" stroke="#ffffff" strokeWidth="5" />
          <line x1="40" y1="902" x2="570" y2="902" stroke="#ffffff" strokeWidth="5" />

          {/* Doubles Long Service Lines (76 units in from back line -> y=116 & y=1224) */}
          <line x1="40" y1="116" x2="570" y2="116" stroke="#3f3f46" strokeWidth="4" />
          <line x1="40" y1="1224" x2="570" y2="1224" stroke="#3f3f46" strokeWidth="4" />

          {/* Center Lines (from short service line to back boundary) */}
          <line x1="305" y1="40" x2="305" y2="438" stroke="#ffffff" strokeWidth="4" />
          <line x1="305" y1="902" x2="305" y2="1300" stroke="#ffffff" strokeWidth="4" />

          {/* Center Net Line & Posts */}
          <line x1="20" y1="670" x2="590" y2="670" stroke="#eab308" strokeWidth="8" strokeDasharray="12 6" />
          <circle cx="20" cy="670" r="8" fill="#eab308" />
          <circle cx="590" cy="670" r="8" fill="#eab308" />

          <defs>
            <radialGradient id="targetBoxGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>

            <marker
              id="serveLaserHead"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <polygon points="0 2, 6 4, 0 6" fill="#eab308" />
            </marker>
          </defs>

          {/* Animated Curved Serve Flight Path */}
          <path 
            d={pathD} 
            className="serve-path-line" 
            markerEnd="url(#serveLaserHead)"
          />
        </svg>

        {/* Player Overlay Tokens */}
        <div className="court-players-overlay">
          {courtPlayers.map((cp) => (
            <div 
              key={cp.id} 
              className={`player-court-bubble ${cp.posClass} ${cp.isServer ? "is-server" : ""} ${cp.isReceiver ? "is-receiver" : ""}`}
            >
              <div className="player-token-avatar">
                {cp.name.substring(0, 2).toUpperCase()}
              </div>
              <span className="player-token-name">
                {cp.isServer && <ShuttlecockIcon />}
                {cp.isReceiver && <TargetIcon />}
                {cp.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
