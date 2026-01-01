"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { showSuccessToast, showErrorToast, showLoadingToast, dismissToast } from "@/lib/toast";

import { ROUTER_ADDRESS, FACTORY_ADDRESS, QUOTE_SYMBOL, QUOTE_ADDRESS, QUOTE_DECIMALS, DEX_TOKEN_OPTIONS, QUOTE_TOKEN, TOKENS, USDC_ADDRESS, EURC_ADDRESS, getTokenConfigByAddress } from "@/constants/tokens";

type Reserves = readonly [bigint, bigint, number];

// ABIs (minimal)
const ROUTER_ABI = [
  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForTokens",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    name: "getAmountsOut",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const FACTORY_ABI = [
  {
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    name: "getPair",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const PAIR_ABI = [
  { inputs: [], name: "token0", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "token1", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  {
    inputs: [],
    name: "getReserves",
    outputs: [{ type: "uint112" }, { type: "uint112" }, { type: "uint32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ERC20_DECIMALS_ABI = [
  { name: "decimals", stateMutability: "view", type: "function", inputs: [], outputs: [{ type: "uint8" }] },
] as const;
const ERC20_ALLOWANCE_ABI = [
  {
    name: "allowance",
    stateMutability: "view",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;
const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    stateMutability: "nonpayable",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const FEE_BPS = BigInt(30); // 0.3%
const BPS_DENOM = BigInt(10000);



// All available tokens for swap (USDC + EURC + DEX tokens)
const USDC_TOKEN = TOKENS.find((t) => t.symbol === "USDC");
const ALL_TOKEN_OPTIONS = USDC_TOKEN ? [USDC_TOKEN, QUOTE_TOKEN, ...DEX_TOKEN_OPTIONS] : [QUOTE_TOKEN, ...DEX_TOKEN_OPTIONS];

export default function Swap() {
  const { address, isConnected } = useAccount();
  const [tokenInSymbol, setTokenInSymbol] = useState<string>(QUOTE_SYMBOL);
  const [tokenOutSymbol, setTokenOutSymbol] = useState<string>("NBC");
  const [rawAmountIn, setRawAmountIn] = useState<string>("");
  const [amountIn, setAmountIn] = useState<string>(""); // debounced numeric string
  const [slippagePct, setSlippagePct] = useState<string>("1"); // 1%
  const [userEditedSlippage, setUserEditedSlippage] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [manualSlippage, setManualSlippage] = useState<string>("");
  const [showTokenInDropdown, setShowTokenInDropdown] = useState<boolean>(false);
  const [showTokenOutDropdown, setShowTokenOutDropdown] = useState<boolean>(false);
  const tokenInDropdownRef = useRef<HTMLDivElement>(null);
  const tokenOutDropdownRef = useRef<HTMLDivElement>(null);

  // Debounce amountIn input (250ms)
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const sanitizeAmount = (v: string) => {
    // allow empty or numbers with up to 6 decimals
    if (v === "") return true;
    return /^\d*(\.\d{0,6})?$/.test(v);
  };
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setAmountIn(rawAmountIn.trim());
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rawAmountIn]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tokenInDropdownRef.current && !tokenInDropdownRef.current.contains(event.target as Node)) {
        setShowTokenInDropdown(false);
      }
      if (tokenOutDropdownRef.current && !tokenOutDropdownRef.current.contains(event.target as Node)) {
        setShowTokenOutDropdown(false);
      }
    };

    if (showTokenInDropdown || showTokenOutDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTokenInDropdown, showTokenOutDropdown]);

  const routerAddress = ROUTER_ADDRESS;

  // Get tokenIn and tokenOut configs (must be before hooks that use them)
  const tokenInConfig = useMemo(() => {
    return ALL_TOKEN_OPTIONS.find((t) => t.symbol === tokenInSymbol);
  }, [tokenInSymbol]);

  const tokenOutConfigFinal = useMemo(() => {
    return ALL_TOKEN_OPTIONS.find((t) => t.symbol === tokenOutSymbol);
  }, [tokenOutSymbol]);

  // Read pair address from factory (needed to decide if multi-hop is necessary)
  const { data: pairAddress } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getPair",
    args: tokenInConfig && tokenOutConfigFinal
      ? [tokenInConfig.address, tokenOutConfigFinal.address]
      : undefined,
    query: { enabled: Boolean(tokenInConfig && tokenOutConfigFinal) },
  });

  // Read pair reserves for rate/impact display
  const { data: reserves } = useReadContract({
    address: pairAddress as `0x${string}` | undefined,
    abi: PAIR_ABI,
    functionName: "getReserves",
    query: { enabled: Boolean(pairAddress && pairAddress !== "0x0000000000000000000000000000000000000000") },
  });

  const { data: token0 } = useReadContract({
    address: pairAddress as `0x${string}` | undefined,
    abi: PAIR_ABI,
    functionName: "token0",
    query: { enabled: Boolean(pairAddress && pairAddress !== "0x0000000000000000000000000000000000000000") },
  });

  const { data: token1 } = useReadContract({
    address: pairAddress as `0x${string}` | undefined,
    abi: PAIR_ABI,
    functionName: "token1",
    query: { enabled: Boolean(pairAddress && pairAddress !== "0x0000000000000000000000000000000000000000") },
  });

  // Determine swap path (A -> B or A -> USDC/EURC -> B)
  const path = useMemo(() => {
    if (!tokenInConfig || !tokenOutConfigFinal) return [];
    if (tokenInConfig.address === tokenOutConfigFinal.address) return [];

    const isDirectPair = pairAddress && pairAddress !== "0x0000000000000000000000000000000000000000";

    if (isDirectPair) {
      return [tokenInConfig.address, tokenOutConfigFinal.address];
    } else {
      // For NBC -> SDR, if no direct pair, route through USDC or EURC
      // We can try USDC as the primary "bridge" token for this chain if EURC is the default quote
      const bridgeToken = (tokenInSymbol === "USDC" || tokenOutSymbol === "USDC") ? EURC_ADDRESS : USDC_ADDRESS;
      return [tokenInConfig.address, bridgeToken, tokenOutConfigFinal.address];
    }
  }, [tokenInConfig, tokenOutConfigFinal, pairAddress, tokenInSymbol, tokenOutSymbol]);

  // Read preview amounts from router
  const { data: amountsOut } = useReadContract({
    address: ROUTER_ADDRESS,
    abi: ROUTER_ABI,
    functionName: "getAmountsOut",
    args: path.length >= 2 && amountIn && Number(amountIn) > 0
      ? [parseUnits(amountIn, tokenInConfig!.decimals), path]
      : undefined,
    query: { enabled: Boolean(path.length >= 2 && amountIn && Number(amountIn) > 0) },
  });

  const amountOutExpectedRaw = useMemo(() => {
    if (!amountsOut || (amountsOut as bigint[]).length === 0) return BigInt(0);
    const results = amountsOut as bigint[];
    return results[results.length - 1];
  }, [amountsOut]);

  // Read tokenOut decimals
  const { data: tokenOutDecimals } = useReadContract({
    address: tokenOutConfigFinal?.address as `0x${string}` | undefined,
    abi: ERC20_DECIMALS_ABI,
    functionName: "decimals",
    query: { enabled: Boolean(tokenOutConfigFinal) },
  });

  // Read allowance for tokenIn based on direction
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenInConfig?.address as `0x${string}` | undefined,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: "allowance",
    args: address && routerAddress && tokenInConfig ? [address, routerAddress] : undefined,
    query: { enabled: Boolean(address && routerAddress && tokenInConfig) },
  });

  // Read EURC balance (MAX button, UX)


  // Read tokenIn balance
  const { data: tokenInBalance, refetch: refetchTokenInBalance } = useBalance({
    address,
    token: tokenInConfig?.address as `0x${string}` | undefined,
    query: { enabled: Boolean(address && tokenInConfig) },
  });
  const tokenInBalanceFmt = useMemo(() => {
    if (!tokenInBalance || !tokenInConfig) return "0";
    return formatUnits(tokenInBalance.value, tokenInConfig.decimals);
  }, [tokenInBalance, tokenInConfig]);

  // Read tokenOut balance
  const { data: tokenOutBalance, refetch: refetchTokenOutBalance } = useBalance({
    address,
    token: tokenOutConfigFinal?.address as `0x${string}` | undefined,
    query: { enabled: Boolean(address && tokenOutConfigFinal) },
  });
  const tokenOutBalanceFmt = useMemo(() => {
    if (!tokenOutBalance || !tokenOutConfigFinal) return "0";
    return formatUnits(tokenOutBalance.value, tokenOutConfigFinal.decimals);
  }, [tokenOutBalance, tokenOutConfigFinal]);


  // Compute quote and minOut
  const [amountOutExpected, minOutFormatted, minOutRaw] = useMemo(() => {
    try {
      if (!amountOutExpectedRaw || !tokenOutConfigFinal) {
        return ["0", "0", BigInt(0)];
      }

      const out = amountOutExpectedRaw;
      const slipBps = BigInt(Math.max(0, Math.min(10000, Math.floor(Number(slippagePct) * 100))));
      const minOut = (out * (BPS_DENOM - slipBps)) / BPS_DENOM;

      return [
        formatUnits(out, tokenOutConfigFinal.decimals),
        formatUnits(minOut, tokenOutConfigFinal.decimals),
        minOut
      ];
    } catch {
      return ["0", "0", BigInt(0)];
    }
  }, [amountOutExpectedRaw, tokenOutConfigFinal, slippagePct]);

  // Compute price impact (approx) using before/after price
  const priceImpactPct = useMemo(() => {
    try {
      if (!amountIn || !token0 || !token1 || !tokenInConfig) return 0;
      // Skip price impact for multi-hop for now (needs reserves for each hop)
      if (path.length > 2) return 0;
      if (!reserves) return 0;
      const amtIn = parseUnits(amountIn, tokenInConfig.decimals);
      const isQuoteToken0 = (token0 as string).toLowerCase() === tokenInConfig.address.toLowerCase() || (token1 as string).toLowerCase() === tokenInConfig.address.toLowerCase();
      const isTokenInQuote = tokenInConfig.symbol === "USDC" || tokenInConfig.symbol === "EURC";

      let reserveIn: bigint;
      let reserveOut: bigint;

      const reservesArray = reserves as unknown as Reserves;
      if (isTokenInQuote) {
        // Swapping from Quote (EURC/USDC)
        reserveIn = isQuoteToken0 ? (reservesArray?.[0] ?? BigInt(0)) : (reservesArray?.[1] ?? BigInt(0));
        reserveOut = isQuoteToken0 ? (reservesArray?.[1] ?? BigInt(0)) : (reservesArray?.[0] ?? BigInt(0));
      } else {
        // Swapping from Token
        reserveIn = isQuoteToken0 ? (reservesArray?.[1] ?? BigInt(0)) : (reservesArray?.[0] ?? BigInt(0));
        reserveOut = isQuoteToken0 ? (reservesArray?.[0] ?? BigInt(0)) : (reservesArray?.[1] ?? BigInt(0));
      }

      if (reserveIn === BigInt(0) || reserveOut === BigInt(0)) return 0;
      const priceBeforeNum = Number(reserveOut) / Number(reserveIn);
      const amountInWithFee = amtIn * (BPS_DENOM - FEE_BPS);
      const numerator = amountInWithFee * reserveOut;
      const denominator = reserveIn * BPS_DENOM + amountInWithFee;
      const out = denominator === BigInt(0) ? BigInt(0) : numerator / denominator;
      const priceAfterNum =
        Number(reserveOut - out) / Number(reserveIn + amountInWithFee / BPS_DENOM);
      if (priceBeforeNum <= 0 || priceAfterNum <= 0) return 0;
      const impact = 1 - priceAfterNum / priceBeforeNum;
      return Math.max(0, impact * 100);
    } catch {
      return 0;
    }
  }, [amountIn, reserves, token0, token1, tokenInConfig, path.length]);

  // Suggest slippage = clamp(impact + 0.3%, 0.5%, 3%)
  const suggestedSlippage = useMemo(() => {
    const s = Math.min(3, Math.max(0.5, priceImpactPct + 0.3));
    return s.toFixed(2);
  }, [priceImpactPct]);

  // Calculate exchange rate
  const exchangeRate = useMemo(() => {
    try {
      if (!amountIn || !amountOutExpected || Number(amountIn) <= 0) return "0";
      const rate = Number(amountOutExpected) / Number(amountIn);
      return rate.toFixed(6);
    } catch {
      return "0";
    }
  }, [amountIn, amountOutExpected]);

  // Auto-apply suggested slippage unless user has edited manually
  useEffect(() => {
    if (!userEditedSlippage) {
      setSlippagePct(suggestedSlippage);
    } else if (manualSlippage) {
      setSlippagePct(manualSlippage);
    }
    // only react to suggestion changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedSlippage, userEditedSlippage, manualSlippage]);

  const formatTwoDecimals = (s: string) => {
    const n = Number(s);
    if (!isFinite(n)) return "0.00";
    return n.toFixed(2);
  };

  // Actions
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const [lastAction, setLastAction] = useState<"idle" | "approve" | "swap">("idle");
  const [approvedReady, setApprovedReady] = useState(false);
  const autoSwapCalledRef = useRef(false);

  const needsApproval = useMemo(() => {
    // If already approved (approvedReady), don't need approval anymore
    if (approvedReady) return false;
    if (!amountIn || allowance === undefined || !tokenInConfig) return false;
    try {
      const needed = parseUnits(amountIn, tokenInConfig.decimals);
      return needed > BigInt(0) && (allowance as bigint) < needed;
    } catch {
      return false;
    }
  }, [amountIn, allowance, tokenInConfig, approvedReady]);

  const onApprove = async () => {
    if (!isConnected || !routerAddress || !tokenInConfig) {
      showErrorToast("Please connect wallet");
      return;
    }
    try {
      const amt = parseUnits(amountIn || "0", tokenInConfig.decimals);
      if (amt <= BigInt(0)) {
        showErrorToast("Enter amount > 0");
        return;
      }
      writeContract({
        address: tokenInConfig.address,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [routerAddress, amt],
      });
      showLoadingToast(`Approving ${tokenInConfig.symbol}...`, { id: "swap-approve" });
      setApprovedReady(false);
      setLastAction("approve");
      autoSwapCalledRef.current = false; // Reset flag when starting new approve
    } catch (e) {
      showErrorToast("Approve failed");
    }
  };

  const onSwap = async () => {
    if (!isConnected || !routerAddress || !tokenInConfig || !tokenOutConfigFinal || path.length < 2) {
      showErrorToast("Please connect wallet and select tokens");
      return;
    }
    try {
      const amtIn = parseUnits(amountIn || "0", tokenInConfig.decimals);
      if (amtIn <= BigInt(0)) {
        showErrorToast("Enter amount > 0");
        return;
      }
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 mins

      writeContract({
        address: routerAddress,
        abi: ROUTER_ABI,
        functionName: "swapExactTokensForTokens",
        args: [amtIn, minOutRaw, path, address!, deadline],
      });
      showLoadingToast("Swapping...", { id: "swap-tx" });
      setLastAction("swap");
    } catch (e) {
      showErrorToast("Swap failed");
    }
  };

  useEffect(() => {
    if (isPending) return;
    if (isConfirming) {
      // keep loading
      return;
    }
    if (isConfirmed) {
      if (lastAction === "approve") {
        setApprovedReady(true);
        dismissToast("swap-approve");

        // Auto call swap after approve confirmed (only once)
        if (!autoSwapCalledRef.current) {
          autoSwapCalledRef.current = true;
          setTimeout(() => {
            onSwap();
            autoSwapCalledRef.current = false; // Reset after calling
          }, 200);
        }
      } else if (lastAction === "swap") {
        showSuccessToast("Swap confirmed", {
          id: "swap-tx",
          showExplorer: true,
          txHash: txHash || undefined,
        });
        // Reset amount after successful swap
        setRawAmountIn("");
        setAmountIn("");
        setApprovedReady(false);
        setLastAction("idle");

        // Refetch balances to update UI
        refetchTokenInBalance?.();
        refetchTokenOutBalance?.();
        // Refetch multiple times to ensure we get updated values (Arc RPC delay)
        setTimeout(() => {
          refetchTokenInBalance?.();
          refetchTokenOutBalance?.();
        }, 1000);
        setTimeout(() => {
          refetchTokenInBalance?.();
          refetchTokenOutBalance?.();
        }, 3000);
      }
    }
  }, [isPending, isConfirming, isConfirmed, lastAction, refetchTokenInBalance, refetchTokenOutBalance, refetchAllowance, onSwap, txHash]);

  return (
    <div className="space-y-6">
      <div className="w-[35%] mx-auto">
        <div className="relative bg-secondary border-custom-2 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4 mt-0">
            <h2 className="text-xl font-semibold text-white m-0 p-0">Swap</h2>
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1 rounded-lg transition-colors ${showSettings ? "bg-gray-200" : "hover-bg-custom"
                }`}
              title="Settings"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

          <div>
            {/* Settings Panel (toggle) */}
            {showSettings && (
              <div className="mt-4 mb-4 rounded-lg border-custom-2 p-4 bg-secondary-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">Slippage Tolerance (%)</h3>
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* All controls in one row */}
                <div className="flex items-center gap-2">
                  {/* Preset buttons */}
                  {["0.1", "0.5", "1.0"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setManualSlippage(preset);
                        setSlippagePct(preset);
                        setUserEditedSlippage(true);
                      }}
                      className={`px-4 py-2 rounded-lg border transition-colors ${userEditedSlippage && slippagePct === preset
                        ? "bg-active text-black border-custom-2"
                        : "bg-secondary text-white border-custom-2 hover:bg-gray-700"
                        }`}
                    >
                      {preset}%
                    </button>
                  ))}

                  {/* Custom input */}
                  <input
                    type="number"
                    value={manualSlippage}
                    onChange={(e) => {
                      const val = e.target.value;
                      setManualSlippage(val);
                      if (val && Number(val) > 0 && Number(val) <= 100) {
                        setSlippagePct(val);
                        setUserEditedSlippage(true);
                      }
                    }}
                    placeholder="Custom"
                    className="flex-1 px-3 py-2 border-custom-2 rounded-lg bg-secondary text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    step="0.1"
                    min="0"
                    max="100"
                  />

                  {/* Reset to Auto */}
                  <button
                    type="button"
                    onClick={() => {
                      setUserEditedSlippage(false);
                      setManualSlippage("");
                      setSlippagePct(suggestedSlippage);
                    }}
                    className="px-4 py-2 text-white border-custom-2 rounded-lg bg-secondary hover:bg-gray-700 transition-colors whitespace-nowrap"
                  >
                    Auto
                  </button>
                </div>
              </div>
            )}

            {/* From Section */}
            <div className="mt-4 mb-2">
              <div className="border-custom-2 rounded-lg bg-secondary-2 p-4">
                <div className="flex items-center gap-2 mb-2">
                  {/* Currency selector button */}
                  <div className="relative flex-shrink-0" ref={tokenInDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowTokenInDropdown(!showTokenInDropdown)}
                      className="px-3 py-2 h-[48px] bg-secondary border-custom-2 rounded-lg flex items-center gap-2 hover:bg-gray-700 transition-colors"
                    >
                      {tokenInConfig && (
                        <>
                          <img
                            src={tokenInConfig.icon}
                            alt={tokenInConfig.symbol}
                            className="w-[30px] h-[30px]"
                          />
                          <span className="font-medium text-white">{tokenInConfig.symbol}</span>
                          <svg className={`w-4 h-4 text-white transition-transform ${showTokenInDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </>
                      )}
                    </button>
                    {showTokenInDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-secondary border-custom-2 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                        {ALL_TOKEN_OPTIONS.filter((t) => t.symbol !== tokenOutSymbol).map((token) => (
                          <button
                            key={token.symbol}
                            type="button"
                            onClick={() => {
                              setTokenInSymbol(token.symbol);
                              setRawAmountIn("");
                              setAmountIn("");
                              setShowTokenInDropdown(false);
                            }}
                            className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-700 transition-colors ${tokenInSymbol === token.symbol ? 'bg-gray-700' : ''
                              }`}
                          >
                            <img
                              src={token.icon}
                              alt={token.symbol}
                              className="w-[30px] h-[30px]"
                            />
                            <span className="font-medium text-white">{token.symbol}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Input field */}
                  <input
                    type="text"
                    value={rawAmountIn}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (sanitizeAmount(v)) setRawAmountIn(v);
                    }}
                    placeholder="0.0"
                    className="flex-1 min-w-0 focus:outline-none font-bold bg-transparent text-right text-white text-2xl overflow-hidden"
                  />
                </div>
                {/* Balance and percentage buttons row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-white">
                    <img src="/wallet.svg" alt="Balance" className="w-5 h-5" style={{ filter: 'brightness(0) saturate(100%) invert(35%) sepia(100%) saturate(2476%) hue-rotate(205deg) brightness(98%) contrast(92%)' }} />
                    <span>{Number(tokenInBalanceFmt || "0").toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const balance = Number(tokenInBalanceFmt || "0");
                        setRawAmountIn((balance * 0.25).toString());
                      }}
                      className="text-xs text-white hover:text-gray-200 px-2 py-1 rounded border-custom-2 bg-secondary hover-bg-custom transition-colors"
                    >
                      25%
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const balance = Number(tokenInBalanceFmt || "0");
                        setRawAmountIn((balance * 0.5).toString());
                      }}
                      className="text-xs text-white hover:text-gray-200 px-2 py-1 rounded border-custom-2 bg-secondary hover-bg-custom transition-colors"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const balance = Number(tokenInBalanceFmt || "0");
                        setRawAmountIn((balance * 0.75).toString());
                      }}
                      className="text-xs text-white hover:text-gray-200 px-2 py-1 rounded border-custom-2 bg-secondary hover-bg-custom transition-colors"
                    >
                      75%
                    </button>
                    <button
                      type="button"
                      onClick={() => setRawAmountIn(tokenInBalanceFmt)}
                      className="text-xs text-white hover:text-gray-200 px-2 py-1 rounded border-custom-2 bg-secondary hover-bg-custom transition-colors"
                    >
                      100%
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Swap button (between From and To) */}
            <div className="flex justify-center my-0 relative z-10">
              <button
                type="button"
                onClick={() => {
                  // Swap tokenIn and tokenOut
                  const temp = tokenInSymbol;
                  setTokenInSymbol(tokenOutSymbol);
                  setTokenOutSymbol(temp);
                  // Reset amount when swapping
                  setRawAmountIn("");
                  setAmountIn("");
                }}
                className="bg-secondary rounded-full p-2 border border-custom-2 flex items-center justify-center hover-bg-custom transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>

            {/* To Section */}
            <div className={`mt-2 ${rawAmountIn && Number(rawAmountIn) > 0 && path.length > 2 ? 'mb-2' : 'mb-6'}`}>
              <div className="border-custom-2 rounded-lg bg-secondary-2 p-4">
                <div className="flex items-center gap-2 mb-2">
                  {/* Currency selector button */}
                  <div className="relative flex-shrink-0" ref={tokenOutDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowTokenOutDropdown(!showTokenOutDropdown)}
                      className="px-3 py-2 h-[48px] bg-secondary border-custom-2 rounded-lg flex items-center gap-2 hover:bg-gray-700 transition-colors"
                    >
                      {tokenOutConfigFinal && (
                        <>
                          <img
                            src={tokenOutConfigFinal.icon}
                            alt={tokenOutConfigFinal.symbol}
                            className="w-[30px] h-[30px]"
                          />
                          <span className="font-medium text-white">{tokenOutConfigFinal.symbol}</span>
                          <svg className={`w-4 h-4 text-white transition-transform ${showTokenOutDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </>
                      )}
                    </button>
                    {showTokenOutDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-secondary border-custom-2 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                        {ALL_TOKEN_OPTIONS.filter((t) => t.symbol !== tokenInSymbol).map((token) => (
                          <button
                            key={token.symbol}
                            type="button"
                            onClick={() => {
                              setTokenOutSymbol(token.symbol);
                              setRawAmountIn("");
                              setAmountIn("");
                              setShowTokenOutDropdown(false);
                            }}
                            className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-700 transition-colors ${tokenOutSymbol === token.symbol ? 'bg-gray-700' : ''
                              }`}
                          >
                            <img
                              src={token.icon}
                              alt={token.symbol}
                              className="w-[30px] h-[30px]"
                            />
                            <span className="font-medium text-white">{token.symbol}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Input field (read-only, shows amountOutExpected) */}
                  <input
                    type="text"
                    value={amountOutExpected && Number(amountOutExpected) > 0 ? Number(amountOutExpected).toFixed(4) : "--"}
                    readOnly
                    placeholder="--"
                    className="flex-1 min-w-0 focus:outline-none font-bold bg-transparent text-right text-white text-2xl overflow-hidden"
                  />
                </div>
                {/* Balance row */}
                <div className="flex items-center gap-2 text-sm text-white">
                  <img src="/wallet.svg" alt="Balance" className="w-5 h-5" style={{ filter: 'brightness(0) saturate(100%) invert(35%) sepia(100%) saturate(2476%) hue-rotate(205deg) brightness(98%) contrast(92%)' }} />
                  <span>{Number(tokenOutBalanceFmt || "0").toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Route description for multi-hop swaps - NEW POSITION */}
            {rawAmountIn && Number(rawAmountIn) > 0 && path.length > 2 && (
              <div className="flex items-center justify-center gap-4 py-2 mb-2">
                {path.map((addr, idx) => {
                  const config = getTokenConfigByAddress(addr);
                  return (
                    <Fragment key={`${addr}-${idx}`}>
                      <div className="flex items-center gap-2">
                        {config?.icon && (
                          <img
                            src={config.icon}
                            alt={config?.symbol}
                            className="w-5 h-5 rounded-full"
                          />
                        )}
                        <span className="text-sm font-semibold text-white">{config?.symbol}</span>
                      </div>
                      {idx < path.length - 1 && (
                        <div className="text-white/30 font-bold">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      )}
                    </Fragment>
                  );
                })}
              </div>
            )}

            {/* Summary card: Slippage / Rate / Min received / Price impact */}
            {rawAmountIn && Number(rawAmountIn) > 0 && (
              <div className="rounded-lg border-custom-2 p-3 space-y-3 bg-secondary-2 mb-6">
                {/* Slippage row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-white">Slippage (%)</div>
                  <div className="text-sm font-medium text-white">
                    {userEditedSlippage ? slippagePct : `${suggestedSlippage} (Auto)`}
                  </div>
                </div>

                {/* Rate row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-white">Rate</div>
                  <div className="text-sm font-medium text-white">
                    {tokenInConfig && tokenOutConfigFinal && (
                      <>1 {tokenInConfig.symbol} = {exchangeRate} {tokenOutConfigFinal.symbol}</>
                    )}
                  </div>
                </div>

                {/* Min received row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-white">Min. received</div>
                  <div className="text-sm font-medium text-white">
                    {tokenOutConfigFinal && (
                      <>{formatTwoDecimals(minOutFormatted)} {tokenOutConfigFinal.symbol}</>
                    )}
                  </div>
                </div>

                {/* Price impact row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-white">Price impact</div>
                  <div
                    className={`px-2 py-1 rounded border text-sm ${priceImpactPct < 1
                      ? "border-green-200 bg-green-50 text-green-700"
                      : priceImpactPct < 5
                        ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                        : "border-red-200 bg-red-50 text-red-700"
                      }`}
                  >
                    {priceImpactPct.toFixed(2)}%
                  </div>
                </div>
              </div>
            )}

            {/* Action */}
            {(() => {
              // compute parsed amount for safer disables
              let parsedIn: bigint = BigInt(0);
              try {
                const decimals = tokenInConfig?.decimals ?? QUOTE_DECIMALS;
                parsedIn = amountIn ? parseUnits(amountIn, decimals) : BigInt(0);
              } catch {
                parsedIn = BigInt(0);
              }

              // Check if insufficient balance
              const amountInNum = Number(amountIn || "0");
              const balanceNum = Number(tokenInBalanceFmt || "0");
              const insufficientBalance = amountInNum > 0 && amountInNum > balanceNum;

              const canSwap = (!needsApproval || approvedReady) && parsedIn > BigInt(0);
              const disabled =
                !isConnected ||
                parsedIn <= BigInt(0) ||
                insufficientBalance ||
                isPending ||
                isConfirming ||
                path.length < 2 ||
                tokenOutDecimals === undefined;
              return (
                <button
                  onClick={needsApproval ? onApprove : onSwap}
                  disabled={disabled || (!needsApproval && !canSwap && parsedIn > BigInt(0))}
                  className="w-full bg-active text-black font-medium py-2 px-4 rounded-lg disabled:opacity-50"
                >
                  {!isConnected
                    ? "Connect wallet"
                    : insufficientBalance
                      ? "Insufficient balance"
                      : isPending || isConfirming
                        ? "Processing..."
                        : (needsApproval && !approvedReady)
                          ? `Approve ${tokenInConfig?.symbol || ""}`
                          : tokenInConfig && tokenOutConfigFinal
                            ? `Swap ${tokenInConfig.symbol} to ${tokenOutConfigFinal.symbol}`
                            : "Swap"}
                </button>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}


