"use client";

import * as React from "react";
import { OrgSwitcher } from "./org-switcher";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./sidebar";
import { SetupBar } from "./setup-bar";

export function TopBar() {
  return (
    <div className="flex flex-col w-full z-[var(--z-sticky)] sticky top-0 bg-canvas">
      <header className="flex h-14 items-center justify-between px-4 border-b border-subtle">
        <div className="flex items-center gap-4">
          <MobileNav />
          <OrgSwitcher />
        </div>
        <div className="flex items-center">
          <UserMenu />
        </div>
      </header>
      <SetupBar />
    </div>
  );
}
