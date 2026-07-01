"use client";

import * as React from "react";
import { OrgSwitcher } from "./org-switcher";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./sidebar";
import { SetupBar } from "./setup-bar";
import { ActionCenter } from "./action-center";

export function TopBar() {
  return (
    <div className="flex flex-col w-full shrink-0 z-[var(--z-sticky)] sticky top-0 bg-canvas">
      <header className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-subtle">
        <div className="flex items-center gap-4 h-full">
          <MobileNav />
          <OrgSwitcher />
        </div>
        <div className="flex items-center gap-3 h-full">
          <ActionCenter />
          <UserMenu />
        </div>
      </header>
      <SetupBar />
    </div>
  );
}
