"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Inbox, Code2, CheckSquare, FileText, CreditCard, Settings, Menu, Users } from "lucide-react";
import { SlideOver } from "@claire/ui";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/features", label: "Feature requests", icon: Inbox },
  { href: "/settings/github", label: "GitHub", icon: Code2 },
  { href: "/settings/members", label: "Team members", icon: Users },
  { href: "/reviews", label: "Reviews", icon: FileText },
  { href: "/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ className = "" }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside className={`flex flex-col border-r border-subtle bg-canvas ${className}`}>
      <div className="flex h-14 shrink-0 items-center px-4 border-b border-subtle">
        <img src="/logo.png" alt="Claire Logo" className="h-8 w-auto object-contain" />
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                isActive
                  ? "bg-surface-raised text-accent"
                  : "text-ink-secondary hover:text-ink hover:bg-surface"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileNav() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <button 
        className="md:hidden p-2 text-ink-secondary hover:text-ink" 
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
      <SlideOver isOpen={isOpen} onClose={() => setIsOpen(false)} title="Navigation" side="left">
        <Sidebar className="w-full h-full border-r-0" />
      </SlideOver>
    </>
  );
}
