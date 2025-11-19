"use client";

import { useTab } from "@/contexts/TabContext";

export const TabNavigation = () => {
  const { activeTab, setActiveTab } = useTab();
  
  return (
    <div className="flex gap-2">
      <button
        onClick={() => setActiveTab("liquidity")}
        className={`font-medium h-9 px-4 transition-colors min-w-[120px] text-base ${
          activeTab === "liquidity"
            ? "btn-primary text-white"
            : "text-gray-900 btn-transparent"
        }`}
      >
        Liquidity
      </button>
      <button
        onClick={() => setActiveTab("swap")}
        className={`font-medium h-9 px-4 transition-colors min-w-[120px] text-base ${
          activeTab === "swap"
            ? "btn-primary text-white"
            : "text-gray-900 btn-transparent"
        }`}
      >
        Swap
      </button>
      <button
        onClick={() => setActiveTab("faucet")}
        className={`font-medium h-9 px-4 transition-colors min-w-[120px] text-base ${
          activeTab === "faucet"
            ? "btn-primary text-white"
            : "text-gray-900 btn-transparent"
        }`}
      >
        Faucet
      </button>
    </div>
  );
};

