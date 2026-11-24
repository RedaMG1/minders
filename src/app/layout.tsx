import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, Lora, Nunito } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Minders",
  description: "Notes, reminders and plans for today and tomorrow.",
  appleWebApp: {
    capable: true,
    title: "Minders",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2f2f7",
};

// Runs before the first paint so a saved theme never flashes the default one.
const applySavedTheme = `try{var d=document.documentElement,t=localStorage.getItem("minders-theme"),c=localStorage.getItem("minders-color");if(["pastel","black","paper","custom"].indexOf(t)>-1)d.dataset.theme=t;if(/^#[0-9a-f]{6}$/i.test(c))d.style.setProperty("--brand",c)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${nunito.variable} ${lora.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: applySavedTheme }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
