import { z } from "zod";
import { router, protectedOrgProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { db, member, workspaceSettings, payments, eq, and, PLAN_LIMITS, PRO_PRICE_PAISE } from "@claire/db";
import Razorpay from "razorpay";
import crypto from "crypto";

export const billingRouter = router({
  getUsage: protectedOrgProcedure
    .query(async ({ ctx }) => {
      throw new TRPCError({ code: 'NOT_IMPLEMENTED' });
    }),

  createOrder: protectedOrgProcedure
    .mutation(async ({ ctx }) => {
      const [membership] = await db.select().from(member).where(and(eq(member.userId, ctx.session.user.id), eq(member.organizationId, ctx.orgId))).limit(1);
      if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owners or admins can upgrade" });
      }

      const [settings] = await db.select().from(workspaceSettings).where(eq(workspaceSettings.organizationId, ctx.orgId)).limit(1);
      if (settings?.plan === "PRO") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Organization is already on PRO" });
      }

      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Razorpay credentials not configured" });
      }

      const rzp = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });

      let order;
      try {
        const receipt = `rcpt_${Date.now().toString(36)}_${ctx.orgId.slice(0, 8)}`;
        if (receipt.length > 40) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Receipt length exceeds 40 characters" });
        }
        
        order = await rzp.orders.create({
          amount: PRO_PRICE_PAISE,
          currency: "INR",
          receipt,
        });
      } catch (err: any) {
        console.error("[billing.createOrder] Razorpay SDK error:", err?.message, err?.error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err?.error?.description ?? err?.message ?? "Razorpay order creation failed" });
      }

      if (!order?.id) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Razorpay returned no order id" });
      }

      await db.insert(payments).values({
        organizationId: ctx.orgId,
        razorpayOrderId: order.id,
        amount: PRO_PRICE_PAISE,
        currency: "INR",
        status: "created",
        createdBy: ctx.session.user.id,
      });

      return {
        orderId: order.id,
        amount: PRO_PRICE_PAISE,
        currency: "INR",
        key: process.env.RAZORPAY_KEY_ID!,
      };
    }),

  verifyPayment: protectedOrgProcedure
    .input(z.object({ orderId: z.string(), paymentId: z.string(), signature: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [membership] = await db.select().from(member).where(and(eq(member.userId, ctx.session.user.id), eq(member.organizationId, ctx.orgId))).limit(1);
      if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owners or admins can upgrade" });
      }

      const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!);
      hmac.update(`${input.orderId}|${input.paymentId}`);
      const generatedSignature = hmac.digest("hex");
      
      let isSignatureValid = false;
      try {
        isSignatureValid = crypto.timingSafeEqual(
          Buffer.from(generatedSignature),
          Buffer.from(input.signature)
        );
      } catch (e) {
        // Length mismatch
      }

      if (!isSignatureValid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid payment signature" });
      }

      const [payment] = await db.select().from(payments).where(eq(payments.razorpayOrderId, input.orderId));
      if (!payment || payment.organizationId !== ctx.orgId || payment.amount !== PRO_PRICE_PAISE) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid order details" });
      }

      if (payment.status === "paid") {
        return { success: true, plan: "PRO" };
      }

      await db.update(payments)
        .set({ status: "paid", razorpayPaymentId: input.paymentId, paidAt: new Date().toISOString() })
        .where(eq(payments.razorpayOrderId, input.orderId));

      await db.update(workspaceSettings)
        .set({
          plan: "PRO",
          aiCreditsLimit: PLAN_LIMITS.PRO.credits,
          repoLimit: PLAN_LIMITS.PRO.repos,
          memberLimit: PLAN_LIMITS.PRO.members,
        })
        .where(and(
          eq(workspaceSettings.organizationId, ctx.orgId),
          eq(workspaceSettings.plan, "FREE")
        ));

      return { success: true, plan: "PRO" };
    }),

  getHistory: protectedOrgProcedure
    .query(async ({ ctx }) => {
      throw new TRPCError({ code: 'NOT_IMPLEMENTED' });
    }),
});
