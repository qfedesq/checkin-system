import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: "EMPLOYEE" | "ADMIN";
      status: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED";
      mustChangePassword: boolean;
      hasWebauthn: boolean;
      name?: string | null;
    };
  }
  interface User {
    role?: "EMPLOYEE" | "ADMIN";
    status?: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED";
    mustChangePassword?: boolean;
    hasWebauthn?: boolean;
  }
}

type AppJWT = {
  id?: string;
  role?: "EMPLOYEE" | "ADMIN";
  status?: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED";
  mustChangePassword?: boolean;
  hasWebauthn?: boolean;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { webauthnCredentials: { select: { id: true } }, profile: { select: { firstName: true, lastName: true } } },
        });
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        if (user.status === "DISABLED") return null;

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          mustChangePassword: user.mustChangePassword,
          hasWebauthn: user.webauthnCredentials.length > 0,
          name: user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const t = token as AppJWT & Record<string, unknown>;
      if (user) {
        t.id = user.id as string;
        t.role = user.role;
        t.status = user.status;
        t.mustChangePassword = user.mustChangePassword;
        t.hasWebauthn = user.hasWebauthn;
      }
      if (trigger === "update" && session) {
        if (typeof session.mustChangePassword === "boolean") t.mustChangePassword = session.mustChangePassword;
        if (typeof session.hasWebauthn === "boolean") t.hasWebauthn = session.hasWebauthn;
      }
      return t;
    },
    async session({ session, token }) {
      const t = token as AppJWT;
      if (session.user && t.id) {
        session.user.id = t.id;
        session.user.role = t.role ?? "EMPLOYEE";
        session.user.status = t.status ?? "PENDING_APPROVAL";
        session.user.mustChangePassword = t.mustChangePassword ?? false;
        session.user.hasWebauthn = t.hasWebauthn ?? false;
      }
      return session;
    },
  },
});
