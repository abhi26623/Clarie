import { serve } from "inngest/next";
import { inngest, functions } from "@claire/jobs";
export const { GET, POST, PUT } = serve({ client: inngest, functions });
