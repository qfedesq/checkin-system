import type { Metadata } from "next";
import "./globals.css";
import { AppSessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/providers/ThemeProvider";

export const metadata: Metadata = {
  title: "Emmalva",
  description: "Plataforma de gestión de empleados, vacaciones, documentación y check-in.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <AppSessionProvider>{children}</AppSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
