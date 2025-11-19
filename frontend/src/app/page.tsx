"use client";

import { useTab } from "@/contexts/TabContext";
import Liquidity from "@/components/dex/Liquidity";
import Swap from "@/components/dex/Swap";
import Faucet from "@/components/faucet/Faucet";

export default function Home() {
  const { activeTab } = useTab();

  return (
    <>
      {activeTab === "liquidity" && <Liquidity />}
      {activeTab === "swap" && <Swap />}
      {activeTab === "faucet" && <Faucet />}
    </>
  );
}
