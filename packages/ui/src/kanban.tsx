"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as HoverCard from "@radix-ui/react-hover-card";
import { Clock, Copy, Check, User, Bot, UserPlus, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { SkeletonCard } from "./skeleton";
import { motion, AnimatePresence } from "framer-motion";

export interface TaskItem {
  id: number;
  featureRequestId: number;
  title: string;
  description?: string | null;
  type: "FEATURE" | "BUG" | "CHORE" | "TEST" | "DOCS";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "todo" | "in_progress" | "in_review" | "done";
  assigneeId?: string | null;
  assignedToAI?: boolean | null;
  estimatedHours?: number | null;
  suggestedBranch?: string | null;
  order?: number | null;
  assignee?: { id: string; name?: string | null; email?: string | null } | null;
}

export interface KanbanBoardProps {
  tasks: TaskItem[];
  isLoading?: boolean;
  members?: { userId: string; user?: { name: string; email: string } }[];
  onTaskStatusChange: (taskId: number, newStatus: string) => Promise<void>;
  onTaskOrderChange: (reorderedTasks: { id: number; order: number }[]) => Promise<void>;
  onTaskAssign: (taskId: number, assigneeId: string | null, assignedToAI: boolean) => Promise<void>;
  onSeedSampleTasks?: () => Promise<void>;
}

const COLUMNS: { id: TaskItem["status"]; title: string }[] = [
  { id: "todo", title: "Todo" },
  { id: "in_progress", title: "In progress" },
  { id: "in_review", title: "In review" },
  { id: "done", title: "Done" },
];

function getColumnTier(status: TaskItem["status"]) {
  switch (status) {
    case "todo": return { bg: "var(--kanban-todo-bg)", fg: "var(--kanban-todo-fg)", pulse: false };
    case "in_progress": return { bg: "var(--kanban-inprogress-bg)", fg: "var(--kanban-inprogress-fg)", pulse: true };
    case "in_review": return { bg: "var(--kanban-inreview-bg)", fg: "var(--kanban-inreview-fg)", pulse: false };
    case "done": return { bg: "var(--kanban-done-bg)", fg: "var(--kanban-done-fg)", pulse: false };
    default: return { bg: "var(--status-neutral-bg)", fg: "var(--status-neutral-fg)", pulse: false };
  }
}

function getPriorityColor(priority: TaskItem["priority"]) {
  switch (priority) {
    case "CRITICAL":
      return "var(--status-error-fg)";
    case "HIGH":
      return "var(--status-warning-fg)";
    case "MEDIUM":
      return "var(--status-warning-border)"; // Verified yellow-gold
    case "LOW":
    default:
      return "var(--ink-tertiary)";
  }
}

function TaskCard({
  task,
  isDragging = false,
  members = [],
  onAssign,
}: {
  task: TaskItem;
  isDragging?: boolean;
  members?: KanbanBoardProps["members"];
  onAssign: (taskId: number, assigneeId: string | null, assignedToAI: boolean) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [copied, setCopied] = useState(false);

  const handleCopyBranch = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!task.suggestedBranch) return;
    navigator.clipboard.writeText(task.suggestedBranch);
    setCopied(true);
    toast.success("Branch copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`kanban-card group relative ${isDragging ? "kanban-card--dragging" : ""} ${
        task.assignedToAI ? "kanban-card--ai" : ""
      }`}
      tabIndex={0}
    >
      {/* Top right copy icon */}
      {task.suggestedBranch && (
        <button
          type="button"
          onClick={handleCopyBranch}
          className="absolute top-2 right-2 p-1 text-ink-tertiary opacity-60 hover:opacity-100 hover:text-ink transition-opacity z-10 rounded hover:bg-surface-overlay focus:opacity-100"
          title={copied ? "Copied!" : "Copy branch"}
        >
          {copied ? <Check size={14} className="text-status-success-fg" /> : <GitBranch size={14} />}
        </button>
      )}

      {/* Header: Title */}
      <div className="kanban-card__header pr-8">
        <span className="kanban-card__title">{task.title}</span>
      </div>

      {/* Footer: Meta Row & Assignee */}
      <div className="kanban-card__footer mt-1" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {task.type && (
            <span className="badge badge--neutral flex-shrink-0">{task.type}</span>
          )}
          {task.priority && (
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: getPriorityColor(task.priority) }}
              title={`Priority: ${task.priority}`}
            />
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {task.estimatedHours != null && (
            <div className="flex items-center gap-1 text-xs text-ink-tertiary font-mono">
              <Clock size={12} />
              <span>{task.estimatedHours}h</span>
            </div>
          )}
          
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="btn btn-ghost px-2 py-1 h-auto text-xs text-ink-secondary hover:text-ink flex items-center gap-1.5 border border-transparent hover:border-border rounded">
                {task.assignedToAI ? (
                  <>
                    <span className="badge__dot badge__dot--pulse text-status-info-fg" />
                    <span className="font-mono text-xs hidden sm:inline">AI Agent</span>
                  </>
                ) : task.assigneeId ? (
                  <>
                    <User size={13} className="text-ink-tertiary" />
                    <span className="truncate max-w-[100px] hidden sm:inline">
                      {task.assignee?.name || task.assignee?.email?.split('@')[0] || "Member"}
                    </span>
                  </>
                ) : (
                  <>
                    <UserPlus size={13} className="text-ink-tertiary" />
                  </>
                )}
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content className="kanban-popover-content" sideOffset={4}>
                <DropdownMenu.Item
                  className="kanban-popover-item"
                  onSelect={() => onAssign(task.id, null, true)}
                >
                  <div className="flex items-center gap-2">
                    <Bot size={14} className="text-status-info-fg" />
                    <span>AI Agent</span>
                  </div>
                  {task.assignedToAI && <Check size={14} className="text-accent" />}
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="h-px bg-border-subtle my-1" />

                {members?.map((m) => {
                  const isSelected = task.assigneeId === m.userId && !task.assignedToAI;
                  return (
                    <DropdownMenu.Item
                      key={m.userId}
                      className="kanban-popover-item"
                      onSelect={() => onAssign(task.id, m.userId, false)}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <User size={14} className="text-ink-tertiary flex-shrink-0" />
                        <span className="truncate">{m.user?.name || m.user?.email || m.userId}</span>
                      </div>
                      {isSelected && <Check size={14} className="text-accent flex-shrink-0" />}
                    </DropdownMenu.Item>
                  );
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Hover Popup using Radix HoverCard for Portal & Collision Detection */}
      {/* We use a visually hidden trigger that fills the card to avoid interfering with dnd-kit refs on the card itself */}
      {(task.description || task.suggestedBranch) && !isDragging && (
        <HoverCard.Root openDelay={150} closeDelay={0}>
          <HoverCard.Trigger asChild>
            <div className="absolute inset-0 z-0" aria-hidden="true" tabIndex={-1} />
          </HoverCard.Trigger>
          <HoverCard.Portal>
            <HoverCard.Content
              side="right"
              align="start"
              sideOffset={10}
              collisionPadding={12}
              avoidCollisions={true}
              className="z-tooltip w-72 bg-surface border border-border shadow-md rounded-md p-3 text-sm flex flex-col gap-3 hover-card-content"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
            >
              {task.description && (
                <p className="text-xs text-ink-secondary leading-relaxed line-clamp-4">
                  {task.description}
                </p>
              )}
              
              {task.suggestedBranch && (
                <div className={`flex flex-col gap-1.5 ${task.description ? "border-t border-border-subtle pt-2 mt-1" : ""}`}>
                  <span className="text-[10px] text-ink-tertiary font-medium uppercase tracking-wider">Suggested Branch</span>
                  <div className="flex items-center gap-2 bg-canvas border border-border-subtle rounded px-2 py-1.5">
                    <code className="text-[11px] text-ink font-mono flex-1 truncate" title={task.suggestedBranch}>{task.suggestedBranch}</code>
                    <button onClick={handleCopyBranch} className="text-ink-tertiary hover:text-ink pointer-events-auto outline-none focus:ring-1 focus:ring-accent rounded p-0.5">
                       {copied ? <Check size={12} className="text-status-success-fg" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-ink-tertiary leading-snug">
                    Create & push this branch in GitHub. Make sure your PR body includes <code className="font-mono text-ink">claire-request-{task.featureRequestId}</code> — Claire auto-links the PR to this task.
                  </p>
                </div>
              )}
            </HoverCard.Content>
          </HoverCard.Portal>
        </HoverCard.Root>
      )}
    </div>
  );
}

export function KanbanBoard({
  tasks,
  isLoading = false,
  members = [],
  onTaskStatusChange,
  onTaskOrderChange,
  onTaskAssign,
  onSeedSampleTasks,
}: KanbanBoardProps) {
  const [localTasks, setLocalTasks] = useState<TaskItem[]>(tasks);
  const [activeId, setActiveId] = useState<number | null>(null);

  // Sync localTasks when upstream tasks change, unless we are currently dragging
  useEffect(() => {
    if (activeId === null) {
      setLocalTasks(tasks);
    }
  }, [tasks, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Requires 5px drag to trigger, allowing clicks on popover/buttons
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeTask = useMemo(
    () => localTasks.find((t) => t.id === activeId),
    [localTasks, activeId]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(Number(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdNum = Number(active.id);
    const overIdStr = String(over.id);

    // Snapshot pre-drag state for complete error reconciliation
    const preDragSnapshot = [...localTasks];

    const activeItem = localTasks.find((t) => t.id === activeIdNum);
    if (!activeItem) return;

    // Check if dropped directly onto a column container
    const targetColumn = COLUMNS.find((col) => col.id === overIdStr);

    if (targetColumn) {
      if (activeItem.status !== targetColumn.id) {
        // Dragged to an empty column or column drop area
        const newStatus = targetColumn.id;
        const updatedTasks = localTasks.map((t) =>
          t.id === activeIdNum ? { ...t, status: newStatus } : t
        );
        setLocalTasks(updatedTasks);

        try {
          await onTaskStatusChange(activeIdNum, newStatus);
        } catch (err) {
          setLocalTasks(preDragSnapshot);
          toast.error("Failed to update task status. Please try again.");
        }
      }
      return;
    }

    // Otherwise dropped over another task card
    const overIdNum = Number(over.id);
    const overItem = localTasks.find((t) => t.id === overIdNum);
    if (!overItem) return;

    if (activeItem.status !== overItem.status) {
      // Dragged across columns onto another card
      const newStatus = overItem.status;
      const activeIndex = localTasks.findIndex((t) => t.id === activeIdNum);
      const overIndex = localTasks.findIndex((t) => t.id === overIdNum);

      let updatedTasks = localTasks.map((t) =>
        t.id === activeIdNum ? { ...t, status: newStatus } : t
      );
      updatedTasks = arrayMove(updatedTasks, activeIndex, overIndex);
      setLocalTasks(updatedTasks);

      try {
        await onTaskStatusChange(activeIdNum, newStatus);
        // Also update order within the new column
        const columnTasks = updatedTasks
          .filter((t) => t.status === newStatus)
          .map((t, idx) => ({ id: t.id, order: idx }));
        await onTaskOrderChange(columnTasks);
      } catch (err) {
        setLocalTasks(preDragSnapshot);
        toast.error("Failed to update task status and order. Please try again.");
      }
    } else if (activeItem.id !== overItem.id) {
      // Reordering within the same column
      const activeIndex = localTasks.findIndex((t) => t.id === activeIdNum);
      const overIndex = localTasks.findIndex((t) => t.id === overIdNum);

      const updatedTasks = arrayMove(localTasks, activeIndex, overIndex);
      setLocalTasks(updatedTasks);

      const columnTasks = updatedTasks
        .filter((t) => t.status === activeItem.status)
        .map((t, idx) => ({ id: t.id, order: idx }));

      try {
        await onTaskOrderChange(columnTasks);
      } catch (err) {
        setLocalTasks(preDragSnapshot);
        toast.error("Failed to update task order. Please try again.");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="kanban-board">
        {COLUMNS.map((col) => (
          <div key={col.id} className="kanban-column">
            <div className="kanban-column__header">
              <div className="flex items-center gap-2">
                <span className="kanban-column__title">{col.title}</span>
                <span className="kanban-column__count">{0}</span>
              </div>
            </div>
            <SkeletonCard />
          </div>
        ))}
      </div>
    );
  }

  if (localTasks.length === 0) {
    return (
      <div className="card p-12 text-center border border-border bg-surface space-y-4">
        <h3 className="text-xl font-display text-ink">No tasks here yet.</h3>
        <p className="text-sm text-ink-secondary max-w-md mx-auto">
          Engineering tasks will appear here once the PRD is approved and the plan is generated.
        </p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 min-h-0 min-w-0 pb-4">
          <div className="kanban-board p-6">
            {COLUMNS.map((col) => {
              const columnTasks = localTasks.filter((t) => t.status === col.id);
              const columnTaskIds = columnTasks.map((t) => t.id);
              const tier = getColumnTier(col.id);

              return (
                <div key={col.id} id={col.id} className="kanban-column">
              <div 
                className="kanban-column__header border-t-2"
                style={{ borderTopColor: tier.fg, paddingTop: 'calc(var(--space-3) - 2px)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="kanban-column__title">{col.title}</span>
                  <span 
                    className="kanban-column__count"
                    style={{ backgroundColor: tier.bg, color: tier.fg }}
                  >
                    {columnTasks.length}
                  </span>
                </div>
                <div className="flex items-center">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${tier.pulse ? "badge__dot--pulse" : ""}`}
                    style={{ backgroundColor: tier.pulse ? tier.fg : "transparent" }}
                  />
                </div>
              </div>

              <SortableContext items={columnTaskIds} strategy={verticalListSortingStrategy}>
                <div className="kanban-column__body">
                  {columnTasks.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center border border-dashed border-border-subtle rounded-md p-4 text-xs text-ink-tertiary mt-2">
                      No tasks in this column
                    </div>
                  ) : (
                    columnTasks.map((task) => (
                      <TaskCard key={task.id} task={task} members={members} onAssign={onTaskAssign} />
                    ))
                  )}
                </div>
              </SortableContext>
            </div>
          );
        })}
          </div>
        </div>

      <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }) }}>
        {activeTask ? <TaskCard task={activeTask} isDragging members={members} onAssign={onTaskAssign} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
