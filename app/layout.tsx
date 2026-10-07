import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบของฉัน",
  description: "ระบบที่พัฒนาตาม Blueprint",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
