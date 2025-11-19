"use client";

import { WalletButton } from "./WalletButton";
import { useTab } from "@/contexts/TabContext";

export default function Header() {
  const { activeTab, setActiveTab } = useTab();

  const tabs = [
    { id: "swap" as const, label: "Swap", icon: "/swap.svg" },
    { id: "liquidity" as const, label: "Liquidity", icon: "/add.svg" },
    { id: "faucet" as const, label: "Faucet", icon: "/faucet.svg" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-header border-b w-full" style={{ borderBottomColor: '#454851', borderBottomWidth: '1px' }}>
      <div className="w-[90%] mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: App Name and Navigation */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <img src="/arcswap.png" alt="ArcSwap" className="w-8 h-8 rounded-lg" />
              <span className="text-2xl font-bold text-white">ArcSwap</span>
            </div>
            <nav className="flex items-center gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 h-9 rounded-lg transition-colors font-medium text-sm ${
                    activeTab === tab.id
                      ? "bg-active text-black"
                      : "text-white hover-bg-custom"
                  }`}
                >
                  <img src={tab.icon} alt={tab.label} className={`w-5 h-5 ${activeTab === tab.id ? '' : 'brightness-0 invert'}`} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Right: Wallet Button */}
          <div className="flex items-center">
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  );
}
