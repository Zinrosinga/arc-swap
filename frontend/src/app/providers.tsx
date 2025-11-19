"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/config/wagmi";
import { Toaster } from "react-hot-toast";

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {Array.isArray(children)
          ? children.map((child, idx) => <div key={idx}>{child}</div>)
          : children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 5000,
            style: {
              background: '#153554',
              color: '#fff',
              border: '1px solid #454851',
              borderRadius: '8px',
              padding: '8px 32px',
              fontFamily: 'var(--font-inter), var(--font-manrope), "PingFang SC", "Microsoft YaHei", sans-serif',
              fontSize: '14px',
              fontWeight: '400',
            },
            success: {
              icon: null,
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
