"use client";

import * as React from "react";
import { Keyboard, X } from "lucide-react";

interface ShortcutRow {
  keys: string[];
  label: string;
}

const SHORTCUTS: ShortcutRow[] = [
  { keys: ["N"], label: "New feature request" },
  { keys: ["Esc"], label: "Close panel or modal" },
  { keys: ["?"], label: "Show keyboard shortcuts" },
];

export function ShortcutModal() {
  const [open, setOpen] = React.useState(false);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  const openModal = React.useCallback(() => {
    triggerRef.current = document.activeElement as HTMLElement;
    setOpen(true);
  }, []);

  const closeModal = React.useCallback(() => {
    setOpen(false);
    // Restore focus to what triggered the modal (if applicable)
    triggerRef.current?.focus();
  }, []);

  // Global ? key listener — guarded against input fields and modifiers.
  // Global Esc listener — uses capture phase so it fires BEFORE the SlideOver's
  // window listener, ensuring topmost-layer (modal) closes first.
  React.useEffect(() => {
    const handleQuestion = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (document.activeElement as HTMLElement)?.isContentEditable;
      if (isEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        open ? closeModal() : openModal();
      }
    };

    document.addEventListener("keydown", handleQuestion);
    return () => document.removeEventListener("keydown", handleQuestion);
  }, [open, openModal, closeModal]);

  // Separate capture-phase Esc handler — only active when the modal is open.
  // Capture phase ensures it intercepts Esc before the SlideOver's bubble-phase
  // listener, giving the modal topmost-layer precedence.
  React.useEffect(() => {
    if (!open) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation(); // prevent SlideOver from also closing
        closeModal();
      }
    };

    window.addEventListener("keydown", handleEsc, { capture: true });
    return () => window.removeEventListener("keydown", handleEsc, { capture: true });
  }, [open, closeModal]);

  // Focus trap inside the dialog while open
  React.useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Auto-focus the close button on open
    const closeBtn = dialog.querySelector<HTMLButtonElement>("[data-autofocus]");
    closeBtn?.focus();

    const focusable = dialog.querySelectorAll<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    dialog.addEventListener("keydown", handleTab);
    return () => dialog.removeEventListener("keydown", handleTab);
  }, [open]);

  if (!open) return null;

  return (
    // Backdrop
    <div
      className="slide-over-overlay"
      onClick={closeModal}
      aria-hidden="true"
    >
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "var(--canvas)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          padding: "var(--space-6)",
          width: "min(420px, calc(100vw - 2rem))",
          zIndex: "var(--z-modal)",
          margin: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-5)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Keyboard size={16} style={{ color: "var(--ink-tertiary)" }} />
            <h2
              id="shortcut-modal-title"
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: "var(--weight-semi)",
                color: "var(--ink)",
              }}
            >
              Keyboard shortcuts
            </h2>
          </div>
          <button
            data-autofocus
            onClick={closeModal}
            aria-label="Close shortcuts"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-tertiary)",
              padding: "var(--space-1)",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Shortcut rows */}
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          {SHORTCUTS.map((row) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--space-2) var(--space-3)",
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--ink-secondary)",
                }}
              >
                {row.label}
              </span>
              <div style={{ display: "flex", gap: "var(--space-1)" }}>
                {row.keys.map((k) => (
                  <kbd
                    key={k}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-xs)",
                      color: "var(--ink)",
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "2px 6px",
                      lineHeight: 1.4,
                    }}
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </dialog>
    </div>
  );
}
