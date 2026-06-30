"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: "linear" }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}
