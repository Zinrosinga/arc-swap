"use client";

import { useTab } from "@/contexts/TabContext";

export const Sidebar = () => {
  const { activeTab, setActiveTab } = useTab();

  const tabs = [
    { id: "swap" as const, label: "Swap", icon: "/swap.svg" },
    { id: "liquidity" as const, label: "Liquidity", icon: "/add.svg" },
    { id: "faucet" as const, label: "Faucet", icon: "/faucet.svg" },
  ];

  return (
    <aside className="w-64 bg-secondary border-r border-custom-2 flex-shrink-0 h-screen flex flex-col sticky top-0">
      {/* App Name */}
      <div className="px-4 py-6">
        <div className="flex items-center justify-center gap-2">
          <img src="/arcswap.png" alt="ArcSwap" className="w-8 h-8 rounded-lg" />
          <span className="text-2xl font-bold text-white">ArcSwap</span>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="px-4 py-6 flex-1">
        <div className="space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 h-9 rounded-lg transition-colors font-medium ${
                activeTab === tab.id
                  ? "bg-active text-black"
                  : "text-white hover-bg-custom"
              }`}
            >
              <img src={tab.icon} alt={tab.label} className={`w-5 h-5 ${activeTab === tab.id ? '' : 'brightness-0 invert'}`} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </aside>
  );
};

