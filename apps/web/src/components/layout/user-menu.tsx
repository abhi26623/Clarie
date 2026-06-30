"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { trpc } from "@/lib/trpc";
import { authClient } from "@claire/auth/client";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";

export function UserMenu() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  if (!session?.user) {
    return <div className="skeleton w-8 h-8 rounded-full" />;
  }

  const initials = session.user.name?.slice(0, 2).toUpperCase() || "U";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-raised border border-subtle hover:border-strong transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 overflow-hidden">
        {session.user.image ? (
          <img src={session.user.image} alt={session.user.name || "User"} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-medium text-ink-secondary">{initials}</span>
        )}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[200px] bg-canvas border border-subtle rounded-md shadow-lg p-1 z-[var(--z-dropdown)]"
          align="end"
          sideOffset={8}
        >
          <div className="px-3 py-2 border-b border-subtle mb-1">
            <p className="text-sm font-medium text-ink truncate">{session.user.name}</p>
            <p className="text-xs text-ink-tertiary truncate">{session.user.email}</p>
          </div>
          
          <DropdownMenu.Item
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-sm cursor-pointer outline-none select-none text-red-600 data-[highlighted]:bg-red-50"
            onClick={handleSignOut}
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
