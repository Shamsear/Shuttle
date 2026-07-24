/**
 * Referee Voice Announcements and Haptic Feedback Utilities
 */

// Official badminton referee speech announcements
export function announceScore(
  leftScore: number,
  rightScore: number,
  servingSide: "left" | "right",
  scoringSystem: "classic" | "rally",
  mode: "singles" | "doubles",
  serviceOver: boolean
) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  const serverScore = servingSide === "left" ? leftScore : rightScore;
  const receiverScore = servingSide === "left" ? rightScore : leftScore;

  let text = "";

  if (serviceOver && (leftScore > 0 || rightScore > 0)) {
    text += "Service over. ";
  }

  if (leftScore === 0 && rightScore === 0) {
    text = "Love all, play.";
  } else {
    const isRally = scoringSystem === "rally";
    const winTarget = isRally ? 21 : (mode === "doubles" ? 15 : 11);
    const isServerMatchPoint = serverScore >= winTarget - 1 && serverScore > receiverScore;

    if (isServerMatchPoint) {
      text += "Match point. ";
    }

    const serverText = serverScore === 0 ? "love" : String(serverScore);
    const receiverText = receiverScore === 0 ? "love" : String(receiverScore);

    if (serverScore === receiverScore) {
      text += `${serverText} all.`;
    } else {
      text += `${serverText}, ${receiverText}.`;
    }
  }

  try {
    window.speechSynthesis.cancel(); // Cancel any ongoing speech announcements
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05; // Slightly faster for high responsiveness
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error("Speech Synthesis failed:", err);
  }
}

// Mobile haptic vibration alerts
export function triggerHaptic(type: "point" | "side-out" | "undo" | "win") {
  if (typeof window === "undefined" || !navigator.vibrate) return;

  try {
    if (type === "point") {
      navigator.vibrate(45); // Single clean tap
    } else if (type === "side-out") {
      navigator.vibrate([40, 60, 40]); // Double tap for serve change
    } else if (type === "undo") {
      navigator.vibrate(80); // Single firm vibration for undo/redo
    } else if (type === "win") {
      navigator.vibrate([100, 100, 100, 100, 300]); // Celebration vibration rhythm
    }
  } catch (err) {
    console.error("Haptic feedback vibration failed:", err);
  }
}
