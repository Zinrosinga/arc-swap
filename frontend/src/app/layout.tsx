import "./globals.css";
import Providers from "./providers";
import Header from "@/components/Header";
import { TabProvider } from "@/contexts/TabContext";
import { Manrope, Inter } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "ArcSwap - The Native AMM of Arc Network",
  description: "The Native AMM of Arc Network",
  icons: {
    icon: [
      { url: '/arcswap.png', type: 'image/png' },
    ],
    apple: '/arcswap.png',
  },
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${inter.variable} min-h-screen bg-primary`}>
        <Providers>
          <TabProvider>
            <div className="flex flex-col min-h-screen">
              <Header />
              <main className="flex-1 px-6 py-8 bg-primary">
                {children}
              </main>
            </div>
          </TabProvider>
        </Providers>
      </body>
    </html>
  );
}
