import React, { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
        animation: "fadeIn 0.25s ease-out"
      }}
      onClick={onClose}
    >
      <div 
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth: "480px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "rgba(10, 10, 10, 0.85)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
          display: "flex",
          flexDirection: "column",
          animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          padding: "20px"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "white", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
            {title}
          </h3>
          <button 
            onClick={onClose}
            className="glass-button"
            style={{ 
              width: "28px", 
              height: "28px", 
              padding: 0, 
              borderRadius: "50%", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              fontSize: "1.1rem",
              lineHeight: 1,
              color: "var(--text-muted)",
              borderColor: "rgba(255,255,255,0.08)"
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

interface CustomDialogProps {
  isOpen: boolean;
  type: "alert" | "confirm";
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function CustomDialogModal({ isOpen, type, title, message, onConfirm, onClose }: CustomDialogProps) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex-col gap-16" style={{ padding: "8px 0" }}>
        <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: "1.5", margin: 0 }}>
          {message}
        </p>
        
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "8px" }}>
          {type === "confirm" && (
            <button 
              className="glass-button" 
              style={{ padding: "8px 16px", fontSize: "0.8rem", fontWeight: 700 }}
              onClick={onClose}
            >
              Cancel
            </button>
          )}
          <button 
            className="glass-button" 
            style={{ 
              padding: "8px 16px", 
              fontSize: "0.8rem", 
              fontWeight: 700, 
              color: "var(--color-serve)", 
              borderColor: "var(--color-serve)",
              background: "rgba(234, 179, 8, 0.02)"
            }}
            onClick={onConfirm}
          >
            {type === "confirm" ? "Confirm" : "OK"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
