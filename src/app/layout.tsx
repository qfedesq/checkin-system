import type { Metadata } from "next";
import "./globals.css";
import { AppSessionProvider } from "@/components/providers/SessionProvider";

export const metadata: Metadata = {
  title: "Emmalva",
  description: "Plataforma de gestión de empleados, vacaciones, documentación y check-in.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AppSessionProvider>{children}</AppSessionProvider>
      </body>
    </html>
  );
}
