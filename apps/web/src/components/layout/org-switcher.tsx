"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { authClient } from "@claire/auth/client";
import { toast } from "sonner";

// ── Create Workspace Dialog ────────────────────────────────────────────────
function CreateWorkspaceDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [name, setName] = React.useState("");
  const createMutation = trpc.organization.create.useMutation();

  // Auto-focus input when dialog opens
  React.useEffect(() => {
    if (open) {
      setName("");
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Esc closes the dialog (capture phase so it wins over SlideOver)
  React.useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc, { capture: true });
    return () => window.removeEventListener("keydown", handleEsc, { capture: true });
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createMutation.mutateAsync({ name: trimmed });
      toast.success(`Workspace "${trimmed}" created`);
      onCreated();
      onClose();
    } catch {
      toast.error("Failed to create workspace. Please try again.");
    }
  };

  return (
    /* Backdrop */
    <div
      className="slide-over-overlay"
      onClick={onClose}
      aria-hidden="true"
    >
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-ws-title"
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
          width: "min(400px, calc(100vw - 2rem))",
          zIndex: "var(--z-modal)",
          margin: 0,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-5)" }}>
          <h2
            id="create-ws-title"
            style={{ fontSize: "var(--text-base)", fontWeight: "var(--weight-semi)", color: "var(--ink)", fontFamily: "var(--font-sans)" }}
          >
            Create workspace
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
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

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <label
              htmlFor="ws-name"
              style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--ink-secondary)", fontFamily: "var(--font-sans)" }}
            >
              Workspace name
            </label>
            <input
              ref={inputRef}
              id="ws-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              maxLength={50}
              required
              className="input"
              style={{ fontFamily: "var(--font-sans)" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim() || createMutation.isPending}
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {createMutation.isPending ? "Creating…" : "Create workspace"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

// ── Org Switcher ────────────────────────────────────────────────────────────
export function OrgSwitcher() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const { data: orgs, isLoading } = trpc.organization.list.useQuery();
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const switchMutation = trpc.organization.switchActive.useMutation();

  const activeOrgId = session?.session?.activeOrganizationId;
  const activeOrg = orgs?.find((o) => o.id === activeOrgId);

  const handleSwitch = async (orgId: string) => {
    if (orgId === activeOrgId) return;
    await switchMutation.mutateAsync({ organizationId: orgId });
    await utils.invalidate();
    await refetchSession();
    router.push("/dashboard");
    router.refresh();
  };

  const handleCreated = async () => {
    await utils.invalidate();
    await refetchSession();
    router.refresh();
  };

  if (isLoading || !orgs || orgs.length === 0) {
    return <div className="skeleton w-32 h-8" />;
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-surface-raised transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1">
          <span className="font-medium text-sm truncate max-w-[150px]" style={{ fontFamily: "var(--font-sans)" }}>
            {activeOrg?.name || "Select workspace"}
          </span>
          <ChevronsUpDown size={14} className="text-ink-tertiary" />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-[220px] bg-canvas border border-subtle rounded-md shadow-lg p-1 z-[var(--z-dropdown)]"
            side="bottom"
            align="start"
            sideOffset={8}
          >
            {/* Workspace list */}
            {orgs.map((org) => (
              <DropdownMenu.Item
                key={org.id}
                className="flex items-center justify-between px-3 py-2 text-sm rounded-sm cursor-pointer hover:bg-surface-raised outline-none select-none text-ink-secondary data-[highlighted]:text-ink data-[highlighted]:bg-surface-raised"
                style={{ fontFamily: "var(--font-sans)" }}
                onSelect={() => handleSwitch(org.id)}
              >
                <span className="truncate">{org.name}</span>
                {org.id === activeOrgId && <Check size={14} className="text-accent" />}
              </DropdownMenu.Item>
            ))}

            <DropdownMenu.Separator className="my-1 border-t border-subtle" />

            {/* Create workspace action */}
            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-sm cursor-pointer hover:bg-surface-raised outline-none select-none text-ink-secondary data-[highlighted]:text-ink data-[highlighted]:bg-surface-raised"
              style={{ fontFamily: "var(--font-sans)" }}
              onSelect={(e) => {
                // Prevent Radix from closing and stealing focus before dialog mounts
                e.preventDefault();
                setDialogOpen(true);
              }}
            >
              <Plus size={14} />
              <span>Create workspace</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <CreateWorkspaceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
