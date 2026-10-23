import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "P1llar AI — Customer support that knows your business",
  description: "Create a reliable AI support assistant trained on your business information. Help customers get answers around the clock.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
