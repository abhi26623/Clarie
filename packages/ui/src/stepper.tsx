import * as React from "react";
import { Check } from "lucide-react";

export type StepState = "done" | "active" | "pending";

export interface PhaseStep {
  id: string;
  label: string;
  state: StepState;
  meta?: string; // e.g. "230ms" or timestamp
  isStatusInFlight?: boolean; // If true and state is "active", it pulses.
}

function StepperItem({ step }: { step: PhaseStep }) {
  const showPulse = step.state === "active" && step.isStatusInFlight;
  
  return (
    <div className="stepper__item">
      <div className="stepper__indicator">
        {step.state === "done" ? (
          <Check size={16} strokeWidth={3} className="stepper__icon--done" />
        ) : (
          <span
            className={`stepper__dot stepper__dot--${step.state} ${
              showPulse ? "pulse" : ""
            }`}
          />
        )}
      </div>
      <div className="stepper__content">
        <span
          className={`stepper__title stepper__title--${step.state}`}
        >
          {step.label}
        </span>
        {step.meta && (
          <span className="stepper__meta">{step.meta}</span>
        )}
      </div>
    </div>
  );
}

export function PhaseStepper({ phases, direction = "vertical" }: { phases: PhaseStep[], direction?: "vertical" | "horizontal" }) {
  return (
    <div className={direction === "vertical" ? "stepper" : "flex flex-row items-center gap-8 overflow-x-auto pb-2"}>
      {phases.map((phase) => (
        <StepperItem key={phase.id} step={phase} />
      ))}
    </div>
  );
}

export function WorkflowProgress({ steps }: { steps: PhaseStep[] }) {
  return (
    <div className="stepper">
      {steps.map((step) => (
        <StepperItem key={step.id} step={step} />
      ))}
    </div>
  );
}
