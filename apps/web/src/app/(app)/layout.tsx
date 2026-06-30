import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { AppShell } from "@/components/layout/AppShell";
import { headers } from "next/headers";
import { auth } from "@claire/auth";
import { resolveDestination } from "@claire/auth/routing";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Pre-fetch session if needed for server rendering.
  const session = await auth.api.getSession({
    headers: headers(),
  });

  const dest = await resolveDestination(session);
  // (app) layout protects dashboard and other app pages
  if (dest !== "/dashboard") {
    redirect(dest);
  }

  return (
    <AppShell>
      <div className="flex h-screen overflow-hidden bg-canvas text-ink">
        {/* Desktop Sidebar */}
        <Sidebar className="hidden md:flex w-64 flex-shrink-0" />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            {children}
          </main>
        </div>
      </div>
    </AppShell>
  );
}
