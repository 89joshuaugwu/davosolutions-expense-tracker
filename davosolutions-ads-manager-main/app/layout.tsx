import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";


export const metadata: Metadata = {
  title: "DavoPay Ads Manager",
  description: "Internal TikTok Ads Manager account hierarchy, funding, spend and loss tracker.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#173b8c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
