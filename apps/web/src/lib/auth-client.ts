"use client";
import { createAuthClient } from "better-auth/react";

/** Browser auth client. Same-origin, so no baseURL needed. */
export const authClient = createAuthClient();
