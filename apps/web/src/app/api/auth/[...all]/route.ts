import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Better Auth owns /api/auth/* (sign-in, sign-out, verify-email, reset-password, Google OAuth).
export const dynamic = "force-dynamic";

export const GET = (req: Request) => toNextJsHandler(auth()).GET(req);
export const POST = (req: Request) => toNextJsHandler(auth()).POST(req);
