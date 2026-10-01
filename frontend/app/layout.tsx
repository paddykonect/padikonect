import type { Metadata } from "next";
import { Baloo_2, Work_Sans } from "next/font/google";
import { AuthProvider } from "@/features/auth/auth-context";
import "./globals.css";

const baloo2 = Baloo_2({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-baloo-2",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-work-sans",
});

export const metadata: Metadata = {
  title: "Paddykonect",
  description: "Discover hangouts, connect with new padis, and build your circle.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${baloo2.variable} ${workSans.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
