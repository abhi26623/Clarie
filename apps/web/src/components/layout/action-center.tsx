"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, MessageCircleQuestion, AlertTriangle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

// ── Token constants (verbatim from globals.css:78-96) ─────────────────────────
const BUCKET_STYLES = {
  clarifications: {
    bg: "var(--status-warning-bg)",
    fg: "var(--status-warning-fg)",
    Icon: MessageCircleQuestion,
    label: "Clarifications needed",
    emptyLabel: "No clarifications",
  },
  approvalsPending: {
    bg: "var(--status-active-bg)",
    fg: "var(--status-active-fg)",
    Icon: CheckCircle,
    label: "Awaiting approval",
    emptyLabel: "No approvals pending",
  },
  needsFixes: {
    bg: "var(--status-error-bg)",
    fg: "var(--status-error-fg)",
    Icon: AlertTriangle,
    label: "Needs fixes",
    emptyLabel: "No fixes needed",
  },
} as const;

// ── Icon chip ─────────────────────────────────────────────────────────────────
function BucketChip({ bg, fg, Icon }: { bg: string; fg: string; Icon: React.ElementType }) {
  return (
    <span
      className="flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0"
      style={{ backgroundColor: bg }}
    >
      <Icon size={13} style={{ color: fg }} />
    </span>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function BucketHeader({
  label,
  count,
  totalCount,
  fg,
  bg,
  Icon,
}: {
  label: string;
  count: number;
  totalCount: number;
  fg: string;
  bg: string;
  Icon: React.ElementType;
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-1.5"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-center gap-2">
        <BucketChip bg={bg} fg={fg} Icon={Icon} />
        <span
          className="text-xs font-medium"
          style={{ color: "var(--ink-secondary)" }}
        >
          {label}
        </span>
      </div>
      {/* True count badge */}
      <span
        className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold font-mono"
        style={{ backgroundColor: bg, color: fg }}
      >
        {totalCount}
      </span>
    </div>
  );
}

// ── Item row ──────────────────────────────────────────────────────────────────
function ItemRow({ title, href }: { title: string; href: string }) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        href={href}
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none"
        style={{ color: "var(--ink)", textDecoration: "none" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--surface-overlay)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
      >
        <span className="truncate">{title}</span>
      </Link>
    </DropdownMenu.Item>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ActionCenter() {
  const [open, setOpen] = React.useState(false);

  const { data, refetch } = trpc.actionCenter.summary.useQuery(undefined, {
    // Fetch fresh data when the dropdown opens
    enabled: true,
    staleTime: 30_000,
  });

  // Refetch when dropdown opens so counts are fresh
  React.useEffect(() => {
    if (open) refetch();
  }, [open, refetch]);

  const counts = data?.counts ?? { clarifications: 0, needsFixes: 0, approvalsPending: 0 };
  const items = data?.items ?? { clarifications: [], needsFixes: [], approvalsPending: [] };

  // True total for the bell badge (never capped at 5)
  const totalBadge = counts.clarifications + counts.needsFixes + counts.approvalsPending;

  // Render a bucket section — only if the bucket has any items at all
  function BucketSection({
    bucketKey,
    linkPrefix,
  }: {
    bucketKey: keyof typeof BUCKET_STYLES;
    linkPrefix: string;
  }) {
    const style = BUCKET_STYLES[bucketKey];
    const bucketItems = items[bucketKey];
    const trueCount = counts[bucketKey];

    if (trueCount === 0) return null;

    const hasMore = trueCount > bucketItems.length;

    return (
      <div>
        <BucketHeader
          label={style.label}
          count={bucketItems.length}
          totalCount={trueCount}
          fg={style.fg}
          bg={style.bg}
          Icon={style.Icon}
        />
        <div className="py-1">
          {bucketItems.map((item) => (
            <ItemRow
              key={item.id}
              title={item.title}
              href={`${linkPrefix}/${item.id}`}
            />
          ))}
          {/* "+N more" if true count exceeds displayed rows */}
          {hasMore && (
            <DropdownMenu.Item asChild>
              <Link
                href={linkPrefix}
                className="flex items-center px-3 py-1.5 text-xs rounded-md outline-none"
                style={{ color: "var(--ink-tertiary)", textDecoration: "none" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--surface-overlay)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                +{trueCount - bucketItems.length} more — view all
              </Link>
            </DropdownMenu.Item>
          )}
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      {/* ── Bell trigger ─────────────────────────────────────────── */}
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Action center"
          className="relative flex items-center justify-center w-8 h-8 rounded-md transition-colors outline-none"
          style={{ color: "var(--ink-secondary)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--surface-overlay)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          <Bell size={16} />
          {totalBadge > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold font-mono"
              style={{
                backgroundColor: "var(--status-error-fg)",
                color: "var(--ink-inverse)",
              }}
            >
              {totalBadge > 99 ? "99+" : totalBadge}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>

      {/* ── Dropdown panel ───────────────────────────────────────── */}
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="rounded-lg shadow-lg overflow-hidden"
          style={{
            width: 320,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            zIndex: "var(--z-dropdown)",
          }}
        >
          {/* Panel header */}
          <div
            className="px-3 py-2.5"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--ink)" }}
            >
              Action Center
            </span>
          </div>

          {totalBadge === 0 ? (
            /* ── Empty state ─────────────────────────────────────── */
            <div
              className="flex flex-col items-center gap-2 px-4 py-6"
              style={{
                backgroundColor: "var(--status-success-bg)",
              }}
            >
              <CheckCircle
                size={20}
                style={{ color: "var(--status-success-fg)" }}
              />
              <p
                className="text-sm font-medium"
                style={{ color: "var(--status-success-fg)" }}
              >
                You&apos;re all caught up.
              </p>
            </div>
          ) : (
            <div className="py-1 divide-y" style={{ borderColor: "var(--border-subtle)" }}>
              {/* Clarifications — /requests/[featureId] */}
              <BucketSection bucketKey="clarifications" linkPrefix="/requests" />
              {/* Approvals — /approvals/[featureId] (proven: approval.getContext takes featureId) */}
              <BucketSection bucketKey="approvalsPending" linkPrefix="/approvals" />
              {/* Needs fixes — /requests/[featureId] (not /reviews/[aiReviewId]) */}
              <BucketSection bucketKey="needsFixes" linkPrefix="/requests" />
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
