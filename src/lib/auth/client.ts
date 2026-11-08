"use client";
import { createAuthClient } from "better-auth/react";

// Same-origin requests let Better Auth manage its HttpOnly session cookie.
export const authClient = createAuthClient();
