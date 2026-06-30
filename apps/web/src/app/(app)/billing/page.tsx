"use client";

import * as React from "react";
import { useRef, useEffect } from "react";
import Script from "next/script";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CreditCard, CheckCircle2, AlertTriangle } from "lucide-react";
import { SkeletonCard } from "@claire/ui";

export default function BillingPage() {
  const utils = trpc.useUtils();
  const { data: membership, isLoading: isLoadingMembership } = trpc.organization.getMyMembership.useQuery();
  const { data: setupState, isLoading: isLoadingSetup } = trpc.organization.getSetupState.useQuery();

  const createOrder = trpc.billing.createOrder.useMutation();
  const verifyPayment = trpc.billing.verifyPayment.useMutation();

  const isPro = setupState?.plan === "PRO";
  const isAdmin = membership?.role === "admin" || membership?.role === "owner";

  // ── 90% warning toast — fires at most once per threshold crossing ——————————
  // useRef prevents re-firing on every refetch/poll after the threshold is crossed.
  const didWarn90Ref = useRef(false);
  useEffect(() => {
    if (!setupState) return;
    const { aiCreditsUsed, aiCreditsLimit } = setupState;
    if (!aiCreditsLimit || didWarn90Ref.current) return;
    const pct = aiCreditsUsed / aiCreditsLimit;
    if (pct >= 0.9) {
      didWarn90Ref.current = true;
      toast.warning(
        `You've used ${Math.round(pct * 100)}% of your AI credits (${aiCreditsUsed}/${aiCreditsLimit}). Upgrade to Pro to avoid interruptions.`,
        { duration: 8000 }
      );
    }
  }, [setupState?.aiCreditsUsed, setupState?.aiCreditsLimit]);

  const handleUpgrade = async () => {
    try {
      const order = await createOrder.mutateAsync();
      
      const options = {
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: "Claire",
        description: "Upgrade to PRO",
        order_id: order.orderId,
        theme: {
          color: "#0B462C"
        },
        handler: async function (response: any) {
          try {
            await verifyPayment.mutateAsync({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            toast.success("Successfully upgraded to PRO!");
            utils.organization.getSetupState.invalidate();
          } catch (err: any) {
            toast.error(err.message || "Payment verification failed");
          }
        },
        modal: {
          ondismiss: function() {
            // Cancelled silently
          }
        }
      };
      
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        toast.error("Payment failed. Please try again.");
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate upgrade");
    }
  };

  if (isLoadingMembership || isLoadingSetup) {
    return <div className="p-8 max-w-3xl"><SkeletonCard /></div>;
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="container py-8 space-y-8" style={{ maxWidth: 840 }}>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink mb-1">Billing & Plans</h1>
          <p className="text-sm text-ink-secondary">
            Manage your workspace limits and upgrade to PRO.
          </p>
        </div>

        <div className="card border border-subtle rounded-lg overflow-hidden bg-surface">
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-semibold text-ink">
                    {isPro ? "PRO Plan" : "FREE Plan"}
                  </h2>
                  {isPro && <CheckCircle2 className="text-success" size={20} />}
                </div>
                <p className="text-sm text-ink-secondary">
                  {isPro 
                    ? "You are on the PRO plan. Enjoy higher limits and advanced features."
                    : "Upgrade to PRO for higher limits and unlimited access."}
                </p>
              </div>
              
              {!isPro && (
                <button
                  onClick={handleUpgrade}
                  disabled={!isAdmin || createOrder.isPending}
                  className="btn inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium shadow-sm transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: "var(--green-800, #0B462C)", color: "white" }}
                >
                  <CreditCard size={18} />
                  {createOrder.isPending ? "Loading..." : "Upgrade to Pro"}
                </button>
              )}

              {isPro && (
                <span
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-mono text-xs"
                  style={{
                    background: "var(--status-success-bg)",
                    color: "var(--status-success-fg)",
                    border: "1px solid var(--status-success-border)",
                  }}
                >
                  <CheckCircle2 size={13} /> Your workspace is upgraded to PRO
                </span>
              )}
            </div>

            {!isAdmin && !isPro && (
              <p className="text-xs text-error mt-2">Only workspace owners or admins can upgrade the plan.</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-subtle">
              <div className="p-4 rounded-md bg-canvas border border-subtle sm:col-span-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-ink-secondary uppercase font-medium">AI Credits Used</p>
                  <span className="text-xs font-mono text-ink-secondary">
                    {setupState?.aiCreditsUsed ?? 0} / {setupState?.aiCreditsLimit ?? 500}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-surface-raised rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.round(((setupState?.aiCreditsUsed ?? 0) / (setupState?.aiCreditsLimit ?? 500)) * 100))}%`,
                      background: ((setupState?.aiCreditsUsed ?? 0) / (setupState?.aiCreditsLimit ?? 500)) >= 0.9
                        ? "var(--status-warning-fg)"
                        : "var(--accent)",
                    }}
                  />
                </div>
                {((setupState?.aiCreditsUsed ?? 0) / (setupState?.aiCreditsLimit ?? 500)) >= 0.9 && (
                  <p className="text-xs text-status-warning-fg mt-1.5 flex items-center gap-1">
                    <AlertTriangle size={12} /> Approaching credit limit
                  </p>
                )}
              </div>
              <div className="p-4 rounded-md bg-canvas border border-subtle">
                <p className="text-xs text-ink-secondary mb-1 uppercase font-medium">AI Credits Limit</p>
                <p className="text-2xl font-semibold text-ink">{setupState?.aiCreditsLimit}</p>
              </div>
              <div className="p-4 rounded-md bg-canvas border border-subtle">
                <p className="text-xs text-ink-secondary mb-1 uppercase font-medium">Repositories</p>
                <p className="text-2xl font-semibold text-ink">{setupState?.repoLimit}</p>
              </div>
              <div className="p-4 rounded-md bg-canvas border border-subtle">
                <p className="text-xs text-ink-secondary mb-1 uppercase font-medium">Members</p>
                <p className="text-2xl font-semibold text-ink">{setupState?.memberLimit}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
