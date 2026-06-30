"use client";

import * as React from "react";
import {
  StatusBadge,
  PipelineStrip,
  FeatureCard,
  PhaseStepper,
  WorkflowProgress,
  EmptyState,
  SkeletonList,
  ConfettiCelebration,
  SlideOver,
  Reveal,
  Stagger,
  Crossfade
} from "@claire/ui";
import { Inbox } from "lucide-react";

export default function UITestPage() {
  const [activeStage, setActiveStage] = React.useState("planning");
  const [isSlideOverOpen, setIsSlideOverOpen] = React.useState(false);
  const [triggerConfetti, setTriggerConfetti] = React.useState(0);
  const [crossfadeState, setCrossfadeState] = React.useState("A");

  return (
    <div className="container py-8">
      <h1 className="text-display mb-8">B1 UI Component Test</h1>

      <section className="mb-12">
        <h2 className="text-xl mb-4">PipelineStrip</h2>
        <PipelineStrip
          stages={[
            { id: "discovery", label: "Discovery", count: 2 },
            { id: "planning", label: "Planning", count: 5 },
            { id: "building", label: "Building", count: 1 },
          ]}
          activeStageId={activeStage}
          onStageClick={setActiveStage}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-xl mb-4">FeatureCard</h2>
        <div className="flex flex-col gap-3">
          <FeatureCard
            id="f-1"
            title="Dark mode support"
            submitterName="Alice"
            source="Slack"
            timestamp={new Date(Date.now() - 1000 * 60 * 60 * 2)}
            status="In Progress"
            statusTier="info"
            href="#"
          />
          <FeatureCard
            id="f-2"
            title="Single Sign-On"
            submitterName="Bob"
            source="Portal"
            timestamp={new Date(Date.now() - 1000 * 60 * 60 * 24 * 3)}
            status="Shipped"
            statusTier="success"
            href="#"
          />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-12 mb-12">
        <section>
          <h2 className="text-xl mb-4">PhaseStepper</h2>
          <PhaseStepper
            phases={[
              { id: "1", label: "Discovery", state: "done" },
              { id: "2", label: "Planning", state: "active", isStatusInFlight: true },
              { id: "3", label: "Development", state: "pending" },
            ]}
          />
        </section>

        <section>
          <h2 className="text-xl mb-4">WorkflowProgress</h2>
          <WorkflowProgress
            steps={[
              { id: "s1", label: "Initialize", state: "done", meta: "120ms" },
              { id: "s2", label: "Generating PRD", state: "active", isStatusInFlight: true },
              { id: "s3", label: "Finalize", state: "pending" },
            ]}
          />
        </section>
      </div>

      <section className="mb-12">
        <h2 className="text-xl mb-4">EmptyState</h2>
        <EmptyState
          icon={Inbox}
          title="No features found"
          actionLabel="Submit Request"
          onAction={() => {}}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-xl mb-4">SkeletonList</h2>
        <SkeletonList count={2} />
      </section>

      <section className="mb-12">
        <h2 className="text-xl mb-4">Motion & Modals</h2>
        <div className="flex gap-4">
          <button className="btn btn-secondary" onClick={() => setIsSlideOverOpen(true)}>
            Open SlideOver
          </button>
          <button className="btn btn-secondary" onClick={() => setTriggerConfetti(c => c + 1)}>
            Fire Confetti
          </button>
          <button className="btn btn-secondary" onClick={() => setCrossfadeState(s => s === "A" ? "B" : "A")}>
            Toggle Crossfade ({crossfadeState})
          </button>
        </div>

        <div className="mt-8 border border-subtle p-4 rounded-md">
          <Crossfade stateKey={crossfadeState}>
            {crossfadeState === "A" ? (
              <div key="A" className="p-8 bg-surface-raised rounded text-center">State A: Short</div>
            ) : (
              <div key="B" className="p-16 bg-surface-raised rounded text-center">State B: Much Taller<br/><br/>More content...</div>
            )}
          </Crossfade>
        </div>

        <SlideOver isOpen={isSlideOverOpen} onClose={() => setIsSlideOverOpen(false)} title="Test Drawer">
          <div className="p-6">
            <h2 className="text-xl">New Request</h2>
            <p className="secondary mt-2">This is the slide over panel.</p>
            <button className="btn btn-primary mt-8" onClick={() => setIsSlideOverOpen(false)}>Close</button>
          </div>
        </SlideOver>

        <ConfettiCelebration triggerKey={triggerConfetti > 0 ? triggerConfetti : null} />
      </section>
    </div>
  );
}
