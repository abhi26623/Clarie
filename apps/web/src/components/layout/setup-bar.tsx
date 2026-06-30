"use client";

import * as React from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Check, Circle, X } from "lucide-react";
import { Reveal } from "@claire/ui";

export function SetupBar() {
  const [isDismissed, setIsDismissed] = React.useState(true); // Default true until mounted to prevent flash

  const { data, isLoading } = trpc.organization.getSetupState.useQuery(undefined, {
    retry: false, // Don't block/retry heavily if it fails
  });

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setIsDismissed(sessionStorage.getItem("clario_setup_dismissed") === "true");
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem("clario_setup_dismissed", "true");
    setIsDismissed(true);
  };

  if (isLoading || !data) return null;
  if (data.isComplete || isDismissed) return null;

  const { steps, completed, total } = data;

  const StepItem = ({ isDone, label, href }: { isDone: boolean; label: string; href: string }) => {
    const content = (
      <span className={`flex items-center gap-1 text-sm ${isDone ? "text-ink-tertiary" : "text-ink font-medium hover:text-accent transition-colors"}`}>
        {isDone ? <Check size={14} className="text-green-600" /> : <Circle size={14} className="text-ink-tertiary" />}
        {label}
      </span>
    );
    
    return isDone ? content : <Link href={href}>{content}</Link>;
  };

  return (
    <Reveal>
      <div className="flex items-center justify-between px-4 py-2 bg-surface-raised border-b border-subtle">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-semibold text-ink-secondary mr-2">
            {completed}/{total} complete —
          </span>
          <StepItem isDone={steps.workspace} label="Workspace" href="/settings" />
          <span className="text-ink-tertiary text-xs">•</span>
          <StepItem isDone={steps.firstRequest} label="First request" href="/features" />
          <span className="text-ink-tertiary text-xs">•</span>
          <StepItem isDone={steps.connectGithub} label="Connect GitHub" href="/settings/github" />
          <span className="text-ink-tertiary text-xs">•</span>
          <StepItem isDone={steps.inviteTeam} label="Invite team" href="/settings/members" />
        </div>
        
        <button 
          onClick={handleDismiss}
          className="p-1 text-ink-tertiary hover:text-ink transition-colors rounded-sm hover:bg-surface"
          aria-label="Dismiss setup progress"
        >
          <X size={16} />
        </button>
      </div>
    </Reveal>
  );
}
