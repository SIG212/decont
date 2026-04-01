import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
const dmSans = DM_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Decont — Scanner bonuri",
  description: "Scanează bonuri și exportă decont Excel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body className={dmSans.className}>{children}</body>
    </html>
  );
}
