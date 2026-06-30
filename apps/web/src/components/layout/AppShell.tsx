"use client";

import * as React from "react";
import { MotionConfig } from "framer-motion";
import { ShortcutModal } from "@/components/ShortcutModal";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <ShortcutModal />
    </MotionConfig>
  );
}
