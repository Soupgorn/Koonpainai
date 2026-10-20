import "server-only";
import NextAuth from "next-auth";
import { createAuthConfig } from "./lib/auth/config";
import { readAuthSettings } from "./lib/auth/settings";
import { getMemberRepository } from "./db";
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const settings = readAuthSettings();
  if (!settings)
    return { providers: [], secret: process.env.AUTH_SECRET, debug: false };
  return createAuthConfig(settings, getMemberRepository());
});
