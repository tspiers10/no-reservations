import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PostHogInit } from "@/components/PostHogInit";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "No Reservations",
  description: "Find restaurants you can walk into right now.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PostHogInit />
        {children}
      </body>
    </html>
  );
}
