import { serve } from "inngest/next";
import { inngest, functions } from "@shipflow/jobs";
export const { GET, POST, PUT } = serve({ client: inngest, functions });
