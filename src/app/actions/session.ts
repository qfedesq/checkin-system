"use server";

import { signOut } from "@/lib/auth";

// Auth.js v5 exige el token CSRF en el POST a /api/auth/signout. El form crudo
// `action="/api/auth/signout"` no lo incluía → el botón "Cerrar sesión" no cerraba
// la sesión. Esta server action llama a signOut() del lado del servidor (maneja
// CSRF y cookies) y redirige a /login.
export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
