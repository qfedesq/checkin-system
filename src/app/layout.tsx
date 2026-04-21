import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppSessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/providers/ThemeProvider";

export const metadata: Metadata = {
  title: "Emmalva",
  description: "Plataforma de gestión de empleados, vacaciones, documentación y check-in.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Emmalva", statusBarStyle: "black-translucent" },
  icons: {
    icon: "/emmalva-vertical.png",
    apple: "/emmalva-vertical.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a101c" },
  ],
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
