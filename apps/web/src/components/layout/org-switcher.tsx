"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import { authClient } from "@claire/auth/client";

export function OrgSwitcher() {
  const router = useRouter();
  const utils = trpc.useUtils();

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
    router.refresh();
  };

  if (isLoading || !orgs || orgs.length === 0) {
    return <div className="skeleton w-32 h-8" />;
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-surface-raised transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1">
        <span className="font-medium text-sm truncate max-w-[150px]">
          {activeOrg?.name || "Select workspace"}
        </span>
        <ChevronsUpDown size={14} className="text-ink-tertiary" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[200px] bg-canvas border border-subtle rounded-md shadow-lg p-1 z-[var(--z-dropdown)]"
          align="start"
          sideOffset={4}
        >
          {orgs.map((org) => (
            <DropdownMenu.Item
              key={org.id}
              className="flex items-center justify-between px-3 py-2 text-sm rounded-sm cursor-pointer hover:bg-surface-raised outline-none select-none text-ink-secondary data-[highlighted]:text-ink data-[highlighted]:bg-surface-raised"
              onClick={() => handleSwitch(org.id)}
            >
              <span className="truncate">{org.name}</span>
              {org.id === activeOrgId && <Check size={14} className="text-accent" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
