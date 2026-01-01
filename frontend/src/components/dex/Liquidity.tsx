"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { getAddress, formatUnits, parseUnits } from "viem";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useBalance } from "wagmi";
import toast from "react-hot-toast";

import { ROUTER_ADDRESS, FACTORY_ADDRESS, getTokenConfigByAddress } from "@/constants/tokens";

const ARC_EXPLORER_URL = 'https://testnet.arcscan.app';

type Reserves = readonly [bigint, bigint, number];

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
  {
    inputs: [],
    name: "allPairsLength",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "uint256" }],
    name: "allPairs",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "token0", type: "address" },
      { indexed: true, name: "token1", type: "address" },
      { indexed: false, name: "pair", type: "address" },
      { indexed: false, name: "index", type: "uint256" },
    ],
    name: "PairCreated",
    type: "event",
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
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ROUTER_ABI = [
  {
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "amountADesired", type: "uint256" },
      { name: "amountBDesired", type: "uint256" },
      { name: "amountAMin", type: "uint256" },
      { name: "amountBMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    name: "addLiquidity",
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
      { name: "liquidity", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "liquidity", type: "uint256" },
      { name: "amountAMin", type: "uint256" },
      { name: "amountBMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    name: "removeLiquidity",
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
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

// Hook to fetch all pairs dynamically from Factory
function useAllPairs() {
  // 1. Get total number of pairs
  const { data: pairsLength, isError: lengthError } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "allPairsLength",
    query: {
      refetchInterval: 15000, // Faster polling for testnet
      staleTime: 10000,
    },
  });

  // 2. Map indices to contract calls
  const pairIndices = useMemo(() => {
    const len = Number(pairsLength || 0);
    return Array.from({ length: len }, (_, i) => BigInt(i));
  }, [pairsLength]);

  // 3. Fetch all pair addresses in one batch
  const { data: pairAddressesData, isLoading: loadingAddresses, isError: addressesError } = useReadContracts({
    contracts: pairIndices.map((index) => ({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "allPairs",
      args: [index],
    })),
    query: {
      enabled: pairIndices.length > 0,
      staleTime: 60000, // Addresses don't change often
    },
  });

  const pairAddresses = useMemo(() => {
    return (pairAddressesData || [])
      .map((res) => res.result as string | undefined)
      .filter((addr): addr is string => !!addr && addr !== "0x0000000000000000000000000000000000000000")
      .map(addr => getAddress(addr));
  }, [pairAddressesData]);

  // 4. Fetch token0/token1 for all pairs in another batch
  const { data: tokensData, isLoading: loadingTokens, isError: tokensError } = useReadContracts({
    contracts: pairAddresses.flatMap((pairAddr) => [
      { address: pairAddr, abi: PAIR_ABI, functionName: "token0" },
      { address: pairAddr, abi: PAIR_ABI, functionName: "token1" },
    ]),
    query: {
      enabled: pairAddresses.length > 0,
      staleTime: Infinity, // Pair tokens NEVER change
    },
  });

  // 5. Final processing with stabilization
  const pairs = useMemo(() => {
    if (!tokensData || tokensData.length === 0) return [];

    const result = [];
    for (let i = 0; i < pairAddresses.length; i++) {
      const t0 = tokensData[i * 2]?.result as `0x${string}`;
      const t1 = tokensData[i * 2 + 1]?.result as `0x${string}`;
      if (!t0 || !t1) continue;

      const config0 = getTokenConfigByAddress(t0);
      const config1 = getTokenConfigByAddress(t1);

      // Even if unknown, we show it (Scientific approach: trust the chain)
      const t0Info = config0 || { symbol: `T0-${t0.slice(0, 6)}`, decimals: 18, icon: "", address: t0 };
      const t1Info = config1 || { symbol: `T1-${t1.slice(0, 6)}`, decimals: 18, icon: "", address: t1 };

      // Determine quote/token based on common sense (USDC/EURC are quotes)
      const isT1Quote = t1Info.symbol === "USDC" || t1Info.symbol === "EURC";
      const [tokenInfo, quoteInfo] = isT1Quote ? [t0Info, t1Info] : [t1Info, t0Info];

      result.push({
        pairKey: `${tokenInfo.symbol}/${quoteInfo.symbol}`,
        tokenSymbol: tokenInfo.symbol,
        tokenAddress: tokenInfo.address as `0x${string}`,
        tokenDecimals: tokenInfo.decimals,
        quoteSymbol: quoteInfo.symbol,
        quoteAddress: quoteInfo.address as `0x${string}`,
        quoteDecimals: quoteInfo.decimals,
        pairAddress: pairAddresses[i],
        tokenConfig: tokenInfo,
        quoteConfig: quoteInfo
      });
    }
    return result;
  }, [tokensData, pairAddresses]);

  // Prevent UI flickering by keeping last valid state
  const lastValidPairs = useRef(pairs);
  useEffect(() => {
    if (pairs.length > 0) lastValidPairs.current = pairs;
  }, [pairs]);

  const isLoading = (pairsLength === undefined && !lengthError) || loadingAddresses || loadingTokens;

  return {
    pairs: pairs.length > 0 ? pairs : lastValidPairs.current,
    isLoading,
    isError: lengthError || addressesError || tokensError
  };
}

function PoolRow({ tokenSymbol, tokenAddress, tokenDecimals, quoteSymbol, quoteAddress, quoteDecimals, pairAddress, tokenConfig, quoteConfig, isLast }: {
  tokenSymbol: string;
  tokenAddress: `0x${string}`;
  tokenDecimals: number;
  quoteSymbol: string;
  quoteAddress: `0x${string}`;
  quoteDecimals: number;
  pairAddress: `0x${string}`;
  tokenConfig?: { symbol: string; icon: string };
  quoteConfig?: { symbol: string; icon: string };
  isLast?: boolean;
}) {
  const { address, isConnected } = useAccount();
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"add" | "remove">("add");
  const [amountEURC, setAmountEURC] = useState("");
  const [amountToken, setAmountToken] = useState("");
  const [amountLP, setAmountLP] = useState("");
  const [editingField, setEditingField] = useState<"eurc" | "token" | null>(null);
  const [approvedEURCReady, setApprovedEURCReady] = useState(false);
  const [approvedTokenReady, setApprovedTokenReady] = useState(false);
  const [approvedLPReady, setApprovedLPReady] = useState(false);
  const [pendingAddLiquidity, setPendingAddLiquidity] = useState(false);
  const prevAmountEURC = useRef("");
  const prevAmountToken = useRef("");
  const processedTxHash = useRef<string | null>(null);

  // Use pairAddress from props (already known from query)

  // Get reserves
  const { data: reserves, refetch: refetchReserves } = useReadContract({
    address: pairAddress as `0x${string}` | undefined,
    abi: PAIR_ABI,
    functionName: "getReserves",
    query: { enabled: Boolean(pairAddress), refetchInterval: 10000 },
  });

  // Get token0/token1
  const { data: token0 } = useReadContract({
    address: pairAddress as `0x${string}` | undefined,
    abi: PAIR_ABI,
    functionName: "token0",
    query: { enabled: Boolean(pairAddress), refetchInterval: false },
  });

  // Get user LP balance
  const { data: lpBalance, refetch: refetchLPBalance } = useReadContract({
    address: pairAddress as `0x${string}` | undefined,
    abi: PAIR_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(pairAddress && address), refetchInterval: false },
  });

  // Get total supply of LP token
  const { data: lpTotalSupply } = useReadContract({
    address: pairAddress as `0x${string}` | undefined,
    abi: [
      {
        inputs: [],
        name: "totalSupply",
        outputs: [{ type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "totalSupply",
    query: { enabled: Boolean(pairAddress), refetchInterval: false },
  });

  // Parse reserves and calculate TVL
  const poolStats = useMemo(() => {
    if (!reserves || !token0 || !pairAddress) {
      return {
        reserveQuote: "0",
        reserveToken: "0",
        reserveQuoteRaw: "0",
        reserveTokenRaw: "0",
        tvl: "0",
        hasPosition: false,
        price: "0"
      };
    }

    try {
      const isQuoteToken0 = getAddress(token0 as string).toLowerCase() === getAddress(quoteAddress).toLowerCase();
      const reservesArray = reserves as unknown as Reserves;
      if (!reservesArray) throw new Error("No reserves");

      const res0 = reservesArray[0];
      const res1 = reservesArray[1];

      const resQuoteRaw = isQuoteToken0 ? res0 : res1;
      const resTokenRaw = isQuoteToken0 ? res1 : res0;

      const resQuote = formatUnits(resQuoteRaw, quoteDecimals);
      const resToken = formatUnits(resTokenRaw, tokenDecimals);

      // TVL = 2 * reserveQuote (in USD equivalent)
      const tvlNum = Number(resQuote) * 2;
      const tvlFormatted = tvlNum >= 1000000
        ? `${(tvlNum / 1000000).toFixed(2)}M`
        : tvlNum >= 1000
          ? `${(tvlNum / 1000).toFixed(2)}K`
          : tvlNum.toFixed(2);

      const hasPos = lpBalance && (lpBalance as bigint) > BigInt(0);

      const formatValue = (val: string) => {
        const num = Number(val);
        if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
        return num.toFixed(2);
      };

      const resQuoteNum = Number(resQuote);
      const resTokenNum = Number(resToken);
      const calculatedPrice = resQuoteNum > 0 ? resTokenNum / resQuoteNum : 0;

      return {
        reserveQuote: formatValue(resQuote),
        reserveToken: formatValue(resToken),
        reserveQuoteRaw: resQuote,
        reserveTokenRaw: resToken,
        tvl: tvlFormatted,
        hasPosition: Boolean(hasPos),
        price: calculatedPrice.toFixed(6),
      };
    } catch (e) {
      return {
        reserveQuote: "0",
        reserveToken: "0",
        reserveQuoteRaw: "0",
        reserveTokenRaw: "0",
        tvl: "0",
        hasPosition: false,
        price: "0"
      };
    }
  }, [reserves, token0, tokenDecimals, lpBalance, quoteAddress, quoteDecimals, pairAddress]);

  const { reserveQuote, reserveToken, reserveQuoteRaw, reserveTokenRaw, tvl, hasPosition, price } = poolStats;

  // Get balances
  const { data: quoteBalance } = useBalance({
    address,
    token: quoteAddress ? getAddress(quoteAddress) : undefined,
    query: { enabled: Boolean(address && quoteAddress), refetchInterval: 15000 },
  });
  const { data: tokenBalance } = useBalance({
    address,
    token: tokenAddress ? getAddress(tokenAddress) : undefined,
    query: { enabled: Boolean(address && tokenAddress), refetchInterval: 15000 },
  });

  // Get allowances
  const { data: quoteAllowance, refetch: refetchQuoteAllowance } = useReadContract({
    address: quoteAddress ? getAddress(quoteAddress) : undefined,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: "allowance",
    args: address && ROUTER_ADDRESS ? [address, getAddress(ROUTER_ADDRESS)] : undefined,
    query: { enabled: Boolean(address && ROUTER_ADDRESS && quoteAddress), refetchInterval: false },
  });
  const { data: tokenAllowance, refetch: refetchTokenAllowance } = useReadContract({
    address: tokenAddress ? getAddress(tokenAddress) : undefined,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: "allowance",
    args: address && ROUTER_ADDRESS ? [address, getAddress(ROUTER_ADDRESS)] : undefined,
    query: { enabled: Boolean(address && ROUTER_ADDRESS && tokenAddress), refetchInterval: false },
  });

  // Get LP token allowance
  const { data: lpAllowance, refetch: refetchLPAllowance } = useReadContract({
    address: pairAddress ? getAddress(pairAddress) : undefined,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: "allowance",
    args: address && ROUTER_ADDRESS && pairAddress ? [address, getAddress(ROUTER_ADDRESS)] : undefined,
    query: { enabled: Boolean(address && ROUTER_ADDRESS && pairAddress), refetchInterval: false },
  });

  // Write contracts
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const [lastAction, setLastAction] = useState<"approve-eurc" | "approve-token" | "approve-lp" | "add-liquidity" | "remove-liquidity" | null>(null);

  const quoteBalanceFmt = quoteBalance ? formatUnits(quoteBalance.value, quoteDecimals) : "0";
  const tokenBalanceFmt = tokenBalance ? formatUnits(tokenBalance.value, tokenDecimals) : "0";
  const lpBalanceFmt = lpBalance ? formatUnits(lpBalance as bigint, 18) : "0";

  // Calculate expected amounts when removing liquidity
  const expectedAmounts = useMemo(() => {
    if (!amountLP || !reserves || !token0 || !lpTotalSupply || Number(amountLP) <= 0) {
      return { expectedQuote: "0", expectedToken: "0" };
    }

    try {
      const lpAmount = parseUnits(amountLP, 18);
      const totalSupply = lpTotalSupply as bigint;
      if (totalSupply === BigInt(0)) return { expectedQuote: "0", expectedToken: "0" };

      const isQuoteToken0 = getAddress(token0 as string).toLowerCase() === getAddress(quoteAddress).toLowerCase();
      const reservesArray = reserves as Reserves | null;
      if (!reservesArray) return { expectedQuote: "0", expectedToken: "0" };

      const res0 = reservesArray[0];
      const res1 = reservesArray[1];

      const resQuoteRaw = isQuoteToken0 ? res0 : res1;
      const resTokenRaw = isQuoteToken0 ? res1 : res0;

      const expectedQuoteRaw = (lpAmount * resQuoteRaw) / totalSupply;
      const expectedTokenRaw = (lpAmount * resTokenRaw) / totalSupply;

      return {
        expectedQuote: formatUnits(expectedQuoteRaw, quoteDecimals),
        expectedToken: formatUnits(expectedTokenRaw, tokenDecimals),
      };
    } catch {
      return { expectedQuote: "0", expectedToken: "0" };
    }
  }, [amountLP, reserves, token0, lpTotalSupply, tokenDecimals, quoteDecimals, quoteAddress]);

  const { expectedQuote: expectedEURC, expectedToken } = expectedAmounts;

  // Reset approval flags when amounts change significantly
  useEffect(() => {
    if (!amountEURC || amountEURC === "") {
      setApprovedEURCReady(false);
    }
  }, [amountEURC]);

  useEffect(() => {
    if (!amountToken || amountToken === "") {
      setApprovedTokenReady(false);
    }
  }, [amountToken]);

  // Reset flags when form closes
  useEffect(() => {
    if (!showForm) {
      setApprovedEURCReady(false);
      setApprovedTokenReady(false);
      setApprovedLPReady(false);
      setAmountLP("");
    }
  }, [showForm]);

  // Auto calculate ratio when input changes
  useEffect(() => {
    if (!reserveQuoteRaw || !reserveTokenRaw || reserveQuoteRaw === "0" || reserveTokenRaw === "0") return;
    if (!editingField) return;

    const reserveQuoteNum = Number(reserveQuoteRaw);
    const reserveTokenNum = Number(reserveTokenRaw);

    if (editingField === "eurc" && amountEURC !== prevAmountEURC.current) {
      prevAmountEURC.current = amountEURC;
      if (!amountEURC || amountEURC === "") {
        setAmountToken("");
        return;
      }
      const eurcNum = Number(amountEURC);
      if (!isNaN(eurcNum) && eurcNum > 0) {
        const tokenNum = (eurcNum / reserveQuoteNum) * reserveTokenNum;
        prevAmountToken.current = tokenNum.toFixed(6);
        setAmountToken(tokenNum.toFixed(6));
      }
    } else if (editingField === "token" && amountToken !== prevAmountToken.current) {
      prevAmountToken.current = amountToken;
      if (!amountToken || amountToken === "") {
        setAmountEURC("");
        return;
      }
      const tokenNum = Number(amountToken);
      if (!isNaN(tokenNum) && tokenNum > 0) {
        const eurcNum = (tokenNum / reserveTokenNum) * reserveQuoteNum;
        prevAmountEURC.current = eurcNum.toFixed(6);
        setAmountEURC(eurcNum.toFixed(6));
      }
    }
  }, [amountEURC, amountToken, editingField, reserveQuoteRaw, reserveTokenRaw]);

  const needsQuoteApproval = useMemo(() => {
    if (!amountEURC || quoteAllowance === undefined) return false;
    if (approvedEURCReady) return false;
    try {
      const needed = parseUnits(amountEURC, quoteDecimals);
      return needed > BigInt(0) && (quoteAllowance as bigint) < latestAllowanceThreshold(needed);
    } catch {
      return false;
    }
  }, [amountEURC, quoteAllowance, approvedEURCReady, quoteDecimals]);

  // Small helper to avoid flickering with minimal dust
  function latestAllowanceThreshold(needed: bigint) {
    return needed;
  }

  const needsTokenApproval = useMemo(() => {
    if (!amountToken || tokenAllowance === undefined) return false;
    if (approvedTokenReady) return false;
    try {
      const needed = parseUnits(amountToken, tokenDecimals);
      return needed > BigInt(0) && (tokenAllowance as bigint) < needed;
    } catch {
      return false;
    }
  }, [amountToken, tokenAllowance, approvedTokenReady, tokenDecimals]);

  const needsLPApproval = useMemo(() => {
    if (!amountLP || lpAllowance === undefined || !pairAddress) return false;
    if (approvedLPReady) return false;
    try {
      const needed = parseUnits(amountLP, 18);
      return needed > BigInt(0) && (lpAllowance as bigint) < needed;
    } catch {
      return false;
    }
  }, [amountLP, lpAllowance, approvedLPReady, pairAddress]);

  // Check insufficient balance for both tokens
  const insufficientQuoteBalance = useMemo(() => {
    if (!amountEURC || !quoteBalanceFmt) return false;
    const amountNum = Number(amountEURC);
    const balanceNum = Number(quoteBalanceFmt);
    return amountNum > 0 && amountNum > balanceNum;
  }, [amountEURC, quoteBalanceFmt]);

  const insufficientTokenBalance = useMemo(() => {
    if (!amountToken || !tokenBalanceFmt) return false;
    const amountNum = Number(amountToken);
    const balanceNum = Number(tokenBalanceFmt);
    return amountNum > 0 && amountNum > balanceNum;
  }, [amountToken, tokenBalanceFmt]);

  const hasInsufficientBalance = insufficientQuoteBalance || insufficientTokenBalance;

  const handleApproveQuote = async (amount: bigint) => {
    try {
      processedTxHash.current = null; // Reset for new tx
      setLastAction("approve-eurc");
      writeContract({
        address: getAddress(quoteAddress),
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [getAddress(ROUTER_ADDRESS), amount],
      });
      toast.loading(`Approving ${quoteSymbol}...`, { id: "approve-eurc", duration: Infinity });
    } catch (e) {
      toast.error("Approve failed");
      setLastAction(null);
    }
  };

  const handleApproveToken = async (amount: bigint) => {
    try {
      processedTxHash.current = null; // Reset for new tx
      setLastAction("approve-token");
      writeContract({
        address: getAddress(tokenAddress),
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [getAddress(ROUTER_ADDRESS), amount],
      });
      toast.loading(`Approving ${tokenSymbol}...`, { id: "approve-token", duration: Infinity });
    } catch (e) {
      toast.error("Approve failed");
      setLastAction(null);
    }
  };

  const handleApproveLP = async (amount: bigint) => {
    if (!pairAddress) return;
    try {
      processedTxHash.current = null; // Reset for new tx
      setLastAction("approve-lp");
      writeContract({
        address: getAddress(pairAddress),
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [getAddress(ROUTER_ADDRESS), amount],
      });
      toast.loading("Approving LP tokens...", { id: "approve-lp", duration: Infinity });
    } catch (e) {
      toast.error("Approve failed");
      setLastAction(null);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!address) {
      toast.error("Wallet not connected");
      return;
    }
    if (!amountLP || !pairAddress) {
      toast.error("Enter LP amount");
      return;
    }

    try {
      const amtLP = parseUnits(amountLP, 18);
      if (amtLP <= BigInt(0)) {
        toast.error("Amount must be > 0");
        return;
      }

      // Check balance
      if (!lpBalance || amtLP > (lpBalance as bigint)) {
        toast.error("Insufficient LP balance");
        return;
      }

      const t0 = getAddress(tokenAddress);
      const q0 = getAddress(quoteAddress);
      const isToken0 = BigInt(t0) < BigInt(q0);
      const tokenA = isToken0 ? t0 : q0;
      const tokenB = isToken0 ? q0 : t0;

      processedTxHash.current = null;
      setLastAction("remove-liquidity");

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
      const amtTokenMin = (parseUnits(expectedToken || "0", tokenDecimals) * BigInt(95)) / BigInt(100);
      const amtQuoteMin = (parseUnits(expectedEURC || "0", quoteDecimals) * BigInt(95)) / BigInt(100);

      const amountAMin = isToken0 ? amtTokenMin : amtQuoteMin;
      const amountBMin = isToken0 ? amtQuoteMin : amtTokenMin;

      writeContract({
        address: getAddress(ROUTER_ADDRESS),
        abi: ROUTER_ABI,
        functionName: "removeLiquidity",
        args: [tokenA, tokenB, amtLP, amountAMin, amountBMin, address, deadline],
      });
      toast.loading("Removing liquidity...", { id: "remove-liquidity" });
    } catch (e: unknown) {
      const error = e as Error;
      toast.error(error?.message || "Remove liquidity failed");
      setLastAction(null);
    }
  };

  const handleApproveAndRemoveLiquidity = async () => {
    if (!amountLP || !pairAddress) {
      toast.error("Enter LP amount");
      return;
    }

    try {
      const amtLP = parseUnits(amountLP, 18);

      // Validate LP amount
      if (amtLP <= BigInt(0)) {
        toast.error("LP amount must be greater than 0");
        return;
      }

      // Check balance
      if (!lpBalance || amtLP > (lpBalance as bigint)) {
        toast.error("Insufficient LP balance");
        return;
      }

      // Refetch allowance to get latest value
      const lpAllowanceResult = await refetchLPAllowance().catch(() => ({ data: lpAllowance }));
      const latestLPAllowance = (lpAllowanceResult?.data ?? lpAllowance) as bigint | undefined;

      // Check if LP needs approval
      if (!approvedLPReady && (!latestLPAllowance || latestLPAllowance < amtLP)) {
        await handleApproveLP(amtLP);
        return; // Wait for approval to complete
      }

      // Approved, proceed to remove liquidity
      await handleRemoveLiquidity();
    } catch (e: unknown) {
      const error = e as { message?: string } | null;
      toast.error(error?.message || "Operation failed");
      setLastAction(null);
    }
  };

  // Final execution of Add Liquidity
  const executeAddLiquidity = async () => {
    const userAddr = address; // Local copy to avoid closure issues
    if (!userAddr) {
      toast.error("Wallet not connected");
      return;
    }
    if (!amountEURC || !amountToken) {
      toast.error("Enter both amounts");
      return;
    }

    try {
      const amtQuote = parseUnits(amountEURC, quoteDecimals);
      const amtToken = parseUnits(amountToken, tokenDecimals);

      const t0 = getAddress(tokenAddress);
      const q0 = getAddress(quoteAddress);
      const is_token0 = BigInt(t0) < BigInt(q0);

      const tokenA = is_token0 ? t0 : q0;
      const tokenB = is_token0 ? q0 : t0;
      const amountA = is_token0 ? amtToken : amtQuote;
      const amountB = is_token0 ? amtQuote : amtToken;

      const amountAMin = (amountA * BigInt(95)) / BigInt(100);
      const amountBMin = (amountB * BigInt(95)) / BigInt(100);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

      processedTxHash.current = null;
      setLastAction("add-liquidity");
      setPendingAddLiquidity(false);

      writeContract({
        address: getAddress(ROUTER_ADDRESS),
        abi: ROUTER_ABI,
        functionName: "addLiquidity",
        args: [
          tokenA,
          tokenB,
          amountA,
          amountB,
          amountAMin,
          amountBMin,
          userAddr, // Guaranteed address
          deadline,
        ],
      });
      toast.loading("Adding Liquidity...", { id: "add-liquidity" });
    } catch (e: unknown) {
      const error = e as Error;
      toast.error(error?.message || "Add failed");
      setLastAction(null);
    }
  };

  // Combined handler: approve if needed, then add liquidity
  const handleApproveAndAddLiquidity = async () => {
    if (!amountEURC || !amountToken) {
      toast.error("Enter both amounts");
      return;
    }

    try {
      const amtQuote = parseUnits(amountEURC, quoteDecimals);
      const amtToken = parseUnits(amountToken, tokenDecimals);

      // Always refetch allowances to be safe
      const [quoteAllowanceResult, tokenAllowanceResult] = await Promise.all([
        refetchQuoteAllowance(),
        refetchTokenAllowance(),
      ]);

      const latestQuoteAllowance = quoteAllowanceResult?.data || quoteAllowance;
      const latestTokenAllowance = tokenAllowanceResult?.data || tokenAllowance;

      // Approval checks
      if (!approvedEURCReady && (!latestQuoteAllowance || (latestQuoteAllowance as bigint) < amtQuote)) {
        setPendingAddLiquidity(true);
        await handleApproveQuote(amtQuote);
        return;
      }

      if (!approvedTokenReady && (!latestTokenAllowance || (latestTokenAllowance as bigint) < amtToken)) {
        setPendingAddLiquidity(true);
        await handleApproveToken(amtToken);
        return;
      }

      await executeAddLiquidity();
    } catch (e: unknown) {
      const error = e as Error;
      toast.error(error?.message || "Operation failed");
      setLastAction(null);
    }
  };



  // Handle tx confirmation
  useEffect(() => {
    if (!isConfirmed || !lastAction || !txHash) return;
    if (isPending || isConfirming) return;
    if (processedTxHash.current === txHash) return; // Already processed

    processedTxHash.current = txHash;

    if (lastAction === "approve-eurc") {
      toast.dismiss("approve-eurc");
      setApprovedEURCReady(true);
      refetchQuoteAllowance();
      setLastAction(null);
      toast.success(`${quoteSymbol} approved!`);
      if (pendingAddLiquidity) {
        setTimeout(() => handleApproveAndAddLiquidity(), 2000); // 2s delay for testnet sync
      }
    } else if (lastAction === "approve-token") {
      toast.dismiss("approve-token");
      setApprovedTokenReady(true);
      refetchTokenAllowance();
      setLastAction(null);
      if (pendingAddLiquidity) {
        setTimeout(() => handleApproveAndAddLiquidity(), 2000); // 2s delay for testnet sync
      }
    } else if (lastAction === "approve-lp") {
      toast.dismiss("approve-lp");
      toast.success(
        <div className="flex flex-col gap-1">
          <span>LP tokens approved</span>
          {txHash && (
            <button
              onClick={() => window.open(`${ARC_EXPLORER_URL}/tx/${txHash}`, '_blank', 'noopener,noreferrer')}
              className="mt-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors"
            >
              View Explorer
            </button>
          )}
        </div>,
        { id: "approve-lp-success", duration: 5000 }
      );
      setApprovedLPReady(true);
      // Refetch allowance multiple times to ensure we get the updated value
      refetchLPAllowance();
      setTimeout(() => refetchLPAllowance(), 500);
      setTimeout(() => refetchLPAllowance(), 1500);
      setLastAction(null);
      // Continue to remove liquidity after a short delay
      setTimeout(() => {
        handleRemoveLiquidity();
      }, 2000);
    } else if (lastAction === "add-liquidity") {
      setPendingAddLiquidity(false);
      toast.dismiss("add-liquidity");
      toast.success(
        <div className="flex flex-col gap-1">
          <span>Liquidity added successfully!</span>
          {txHash && (
            <button
              onClick={() => window.open(`${ARC_EXPLORER_URL}/tx/${txHash}`, '_blank', 'noopener,noreferrer')}
              className="mt-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors"
            >
              View Explorer
            </button>
          )}
        </div>,
        { id: "add-liquidity-success", duration: 5000 }
      );

      // Refetch data to update UI
      refetchReserves();
      refetchLPBalance();
      // Refetch multiple times to ensure we get updated values (Arc RPC delay)
      setTimeout(() => {
        refetchReserves();
        refetchLPBalance();
      }, 1000);
      setTimeout(() => {
        refetchReserves();
        refetchLPBalance();
      }, 3000);

      if (showForm) {
        setShowForm(false);
        setAmountEURC("");
        setAmountToken("");
        setApprovedEURCReady(false);
        setApprovedTokenReady(false);
      }
      setLastAction(null);
    } else if (lastAction === "remove-liquidity") {
      toast.dismiss("remove-liquidity");
      toast.success(
        <div className="flex flex-col gap-1">
          <span>Liquidity removed successfully!</span>
          {txHash && (
            <button
              onClick={() => window.open(`${ARC_EXPLORER_URL}/tx/${txHash}`, '_blank', 'noopener,noreferrer')}
              className="mt-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors"
            >
              View Explorer
            </button>
          )}
        </div>,
        { id: "remove-liquidity-success", duration: 5000 }
      );

      // Refetch data to update UI
      refetchReserves();
      refetchLPBalance();
      // Refetch multiple times to ensure we get updated values (Arc RPC delay)
      setTimeout(() => {
        refetchReserves();
        refetchLPBalance();
      }, 1000);
      setTimeout(() => {
        refetchReserves();
        refetchLPBalance();
      }, 3000);

      if (showForm) {
        setShowForm(false);
        setAmountLP("");
        setApprovedLPReady(false);
      }
      setLastAction(null);
    }
  }, [isPending, isConfirming, isConfirmed, lastAction, txHash, showForm, tokenSymbol, refetchQuoteAllowance, refetchTokenAllowance, refetchLPAllowance, pendingAddLiquidity, handleApproveAndAddLiquidity, handleRemoveLiquidity, refetchReserves, refetchLPBalance, quoteSymbol]);

  return (
    <>
      <div className="flex items-center gap-4 px-5 py-3 hover:bg-secondary-2 transition-colors min-w-[900px]" style={!isLast ? { borderBottomColor: '#454851', borderBottomWidth: '1px' } : {}}>
        {/* Token Pair */}
        <div className="flex items-center gap-3 w-[200px] flex-shrink-0">
          <div className="flex -space-x-2">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm relative z-10">
              {quoteConfig?.icon ? (
                <img src={quoteConfig.icon} alt={quoteSymbol} className="w-full h-full rounded-full" />
              ) : (
                <span>€</span>
              )}
            </div>
            <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold text-xs relative z-0">
              {tokenConfig?.icon ? (
                <img src={tokenConfig.icon} alt={tokenSymbol} className="w-full h-full rounded-full" />
              ) : (
                <span>{tokenSymbol[0]}</span>
              )}
            </div>
          </div>
          <div>
            <div className="font-medium text-white">{quoteSymbol} / {tokenSymbol}</div>
            <div className="text-xs text-gray-400">Fee: 0.3%</div>
          </div>
        </div>

        {/* Reserves */}
        <div className="flex-1 text-center min-w-[180px]">
          <div className="text-sm text-white">
            <span className="font-semibold">{reserveQuote} {quoteSymbol}</span>
            <span className="text-gray-400"> / {reserveToken} {tokenSymbol}</span>
          </div>
        </div>

        {/* Total Liquidity */}
        <div className="flex-1 text-center min-w-[150px]">
          <div className="text-sm text-white">
            <div className="font-semibold">${tvl}</div>
          </div>
        </div>

        {/* Action */}
        <div className="w-[110px] flex-shrink-0 flex justify-end items-center pr-0">
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-active text-black rounded-lg hover:opacity-90 transition-colors text-sm font-medium"
          >
            Manage
          </button>
        </div>
      </div>

      {/* Add/Remove Liquidity Modal */}
      {showForm && (
        <div
          className="fixed inset-0 backdrop-blur flex items-center justify-center z-50"
          onClick={() => {
            setShowForm(false);
            setAmountEURC("");
            setAmountToken("");
            setAmountLP("");
            setApprovedEURCReady(false);
            setApprovedTokenReady(false);
            setApprovedLPReady(false);
            setActiveTab("add");
          }}
        >
          <div
            className="bg-secondary rounded-lg shadow-xl border-custom-2 max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Liquidity</h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setAmountEURC("");
                  setAmountToken("");
                  setAmountLP("");
                  setApprovedEURCReady(false);
                  setApprovedTokenReady(false);
                  setApprovedLPReady(false);
                  setActiveTab("add");
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Token Pair Info */}
            <div className="mt-5">
              <div className="bg-secondary-2 rounded-lg shadow-sm border-custom-2 px-4 py-3 flex items-center gap-3 w-full">
                {/* Token Icons */}
                <div className="flex -space-x-2">
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm relative z-10">
                    {quoteConfig?.icon ? (
                      <img src={quoteConfig.icon} alt={quoteSymbol} className="w-full h-full rounded-full" />
                    ) : (
                      <span>{quoteSymbol[0]}</span>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold text-xs relative z-0">
                    {tokenConfig?.icon ? (
                      <img src={tokenConfig.icon} alt={tokenSymbol} className="w-full h-full rounded-full" />
                    ) : (
                      <span>{tokenSymbol[0]}</span>
                    )}
                  </div>
                </div>
                {/* Token Pair Name and Price */}
                <div>
                  <div className="font-semibold text-white">{quoteSymbol} / {tokenSymbol}</div>
                  {reserveQuoteRaw && reserveTokenRaw && reserveQuoteRaw !== "0" && reserveTokenRaw !== "0" && (
                    <div className="text-sm text-gray-400">Price: 1 {quoteSymbol} = {price} {tokenSymbol}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mt-4 mb-5">
              <button
                onClick={() => setActiveTab("add")}
                className={`flex-1 py-2 px-4 rounded-t-lg font-medium transition-colors ${activeTab === "add"
                  ? "bg-active text-black"
                  : "bg-secondary text-white hover-bg-custom"
                  }`}
              >
                Add
              </button>
              <button
                onClick={() => setActiveTab("remove")}
                className={`flex-1 py-2 px-4 rounded-t-lg font-medium transition-colors ${activeTab === "remove"
                  ? "bg-active text-black"
                  : "bg-secondary text-white hover-bg-custom"
                  }`}
              >
                Remove
              </button>
            </div>

            {/* Modal Body */}
            <div>
              {activeTab === "add" ? (
                <>
                  {/* EURC Input */}
                  <div>
                    <div className="border-custom-2 rounded-lg bg-secondary-2 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        {/* Icon + Symbol */}
                        <div className="px-3 py-2 h-[48px] bg-secondary border-custom-2 rounded-lg flex items-center gap-2 flex-shrink-0">
                          {quoteConfig?.icon && (
                            <img
                              src={quoteConfig.icon}
                              alt={quoteSymbol}
                              className="w-[30px] h-[30px]"
                            />
                          )}
                          <span className="font-medium text-white">{quoteSymbol}</span>
                        </div>
                        {/* Input field */}
                        <input
                          type="number"
                          value={amountEURC}
                          onChange={(e) => {
                            setAmountEURC(e.target.value);
                            setEditingField("eurc");
                          }}
                          onFocus={() => setEditingField("eurc")}
                          placeholder="0.0"
                          className="flex-1 min-w-0 px-4 py-2 focus:outline-none font-bold bg-transparent text-right text-white text-2xl overflow-hidden"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      {/* Balance and percentage buttons row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-white">
                          <img src="/wallet.svg" alt="Balance" className="w-5 h-5" style={{ filter: 'brightness(0) saturate(100%) invert(35%) sepia(100%) saturate(2476%) hue-rotate(205deg) brightness(98%) contrast(92%)' }} />
                          <span>{Number(quoteBalanceFmt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {quoteSymbol}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const balance = Number(quoteBalanceFmt || "0");
                              const newValue = (balance * 0.25).toString();
                              prevAmountEURC.current = ""; // Reset to force calculation
                              setEditingField("eurc");
                              setAmountEURC(newValue);
                            }}
                            className="text-xs text-white hover:text-gray-200 px-2 py-1 rounded border-custom-2 bg-secondary hover-bg-custom transition-colors"
                          >
                            25%
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const balance = Number(quoteBalanceFmt || "0");
                              const newValue = (balance * 0.5).toString();
                              prevAmountEURC.current = ""; // Reset to force calculation
                              setEditingField("eurc");
                              setAmountEURC(newValue);
                            }}
                            className="text-xs text-white hover:text-gray-200 px-2 py-1 rounded border-custom-2 bg-secondary hover-bg-custom transition-colors"
                          >
                            50%
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const balance = Number(quoteBalanceFmt || "0");
                              const newValue = (balance * 0.75).toString();
                              prevAmountEURC.current = ""; // Reset to force calculation
                              setEditingField("eurc");
                              setAmountEURC(newValue);
                            }}
                            className="text-xs text-white hover:text-gray-200 px-2 py-1 rounded border-custom-2 bg-secondary hover-bg-custom transition-colors"
                          >
                            75%
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              prevAmountEURC.current = ""; // Reset to force calculation
                              setEditingField("eurc");
                              setAmountEURC(quoteBalanceFmt);
                            }}
                            className="text-xs text-white hover:text-gray-200 px-2 py-1 rounded border-custom-2 bg-secondary hover-bg-custom transition-colors"
                          >
                            100%
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Plus Icon */}
                  <div className="flex justify-center my-2 relative z-10">
                    <div className="bg-secondary rounded-full p-2 border border-custom-2">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </div>

                  {/* Token Input */}
                  <div>
                    <div className="border-custom-2 rounded-lg bg-secondary-2 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        {/* Icon + Symbol */}
                        <div className="px-3 py-2 h-[48px] bg-secondary border-custom-2 rounded-lg flex items-center gap-2 flex-shrink-0">
                          {tokenConfig?.icon && (
                            <img
                              src={tokenConfig.icon}
                              alt={tokenSymbol}
                              className="w-[30px] h-[30px]"
                            />
                          )}
                          <span className="font-medium text-white">{tokenSymbol}</span>
                        </div>
                        {/* Input field */}
                        <input
                          type="number"
                          value={amountToken}
                          onChange={(e) => {
                            setAmountToken(e.target.value);
                            setEditingField("token");
                          }}
                          onFocus={() => setEditingField("token")}
                          placeholder="0.0"
                          className="flex-1 min-w-0 px-4 py-2 focus:outline-none font-bold bg-transparent text-right text-white text-2xl overflow-hidden"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      {/* Balance and percentage buttons row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-white">
                          <img src="/wallet.svg" alt="Balance" className="w-5 h-5" style={{ filter: 'brightness(0) saturate(100%) invert(35%) sepia(100%) saturate(2476%) hue-rotate(205deg) brightness(98%) contrast(92%)' }} />
                          <span>{Number(tokenBalanceFmt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {tokenSymbol}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const balance = Number(tokenBalanceFmt || "0");
                              const newValue = (balance * 0.25).toString();
                              prevAmountToken.current = ""; // Reset to force calculation
                              setEditingField("token");
                              setAmountToken(newValue);
                            }}
                            className="text-xs text-white hover:text-gray-200 px-2 py-1 rounded border-custom-2 bg-secondary hover-bg-custom transition-colors"
                          >
                            25%
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const balance = Number(tokenBalanceFmt || "0");
                              const newValue = (balance * 0.5).toString();
                              prevAmountToken.current = ""; // Reset to force calculation
                              setEditingField("token");
                              setAmountToken(newValue);
                            }}
                            className="text-xs text-white hover:text-gray-200 px-2 py-1 rounded border-custom-2 bg-secondary hover-bg-custom transition-colors"
                          >
                            50%
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const balance = Number(tokenBalanceFmt || "0");
                              const newValue = (balance * 0.75).toString();
                              prevAmountToken.current = ""; // Reset to force calculation
                              setEditingField("token");
                              setAmountToken(newValue);
                            }}
                            className="text-xs text-white hover:text-gray-200 px-2 py-1 rounded border-custom-2 bg-secondary hover-bg-custom transition-colors"
                          >
                            75%
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              prevAmountToken.current = ""; // Reset to force calculation
                              setEditingField("token");
                              setAmountToken(tokenBalanceFmt);
                            }}
                            className="text-xs text-white hover:text-gray-200 px-2 py-1 rounded border-custom-2 bg-secondary hover-bg-custom transition-colors"
                          >
                            100%
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Combined Approve/Add Button */}
                  <button
                    onClick={handleApproveAndAddLiquidity}
                    disabled={!amountEURC || !amountToken || Number(amountEURC) <= 0 || Number(amountToken) <= 0 || hasInsufficientBalance || isPending || isConfirming || !isConnected}
                    className="w-full px-4 py-2 bg-active text-black rounded-lg hover:opacity-90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed mt-5"
                  >
                    {isPending || isConfirming ? (
                      lastAction === "approve-eurc" ? `Approving ${quoteSymbol}...` :
                        lastAction === "approve-token" ? `Approving ${tokenSymbol}...` :
                          "Processing..."
                    ) : !amountEURC || !amountToken || Number(amountEURC) <= 0 || Number(amountToken) <= 0 ? (
                      "Enter Amounts"
                    ) : hasInsufficientBalance ? (
                      "Insufficient balance"
                    ) : needsQuoteApproval ? (
                      `Approve ${quoteSymbol}`
                    ) : needsTokenApproval ? (
                      `Approve ${tokenSymbol}`
                    ) : (
                      "Add Liquidity"
                    )}
                  </button>

                  {!isConnected && (
                    <div className="text-sm text-gray-500 text-center">Connect wallet to add liquidity</div>
                  )}
                </>
              ) : (
                <>
                  {/* LP Token Input */}
                  <div>
                    <div className="border-custom-2 rounded-lg bg-secondary-2 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        {/* Icons + Token Pair */}
                        <div className="px-3 py-2 h-[48px] bg-secondary border-custom-2 rounded-lg flex items-center gap-2 flex-shrink-0">
                          {/* Token Icons - Overlapping */}
                          <div className="flex -space-x-2">
                            <div className="w-[30px] h-[30px] rounded-full bg-blue-500 flex items-center justify-center relative z-10">
                              {quoteConfig?.icon ? (
                                <img src={quoteConfig.icon} alt={quoteSymbol} className="w-full h-full rounded-full" />
                              ) : (
                                <span className="text-xs text-white">{quoteSymbol[0]}</span>
                              )}
                            </div>
                            <div className="w-[30px] h-[30px] rounded-full bg-yellow-500 flex items-center justify-center relative z-0">
                              {tokenConfig?.icon ? (
                                <img src={tokenConfig.icon} alt={tokenSymbol} className="w-full h-full rounded-full" />
                              ) : (
                                <span className="text-xs text-white">{tokenSymbol[0]}</span>
                              )}
                            </div>
                          </div>
                          <span className="font-medium text-white">{quoteSymbol} / {tokenSymbol}</span>
                        </div>
                        {/* Input field */}
                        <input
                          type="number"
                          value={amountLP}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "" || (!isNaN(Number(v)) && Number(v) >= 0)) {
                              setAmountLP(v);
                            }
                          }}
                          placeholder="0.0"
                          className="flex-1 min-w-0 px-4 py-2 focus:outline-none font-bold bg-transparent text-right text-white text-2xl overflow-hidden"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      {/* Balance and percentage buttons row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-white">
                          <img src="/wallet.svg" alt="Balance" className="w-5 h-5" style={{ filter: 'brightness(0) saturate(100%) invert(35%) sepia(100%) saturate(2476%) hue-rotate(205deg) brightness(98%) contrast(92%)' }} />
                          <span>{Number(lpBalanceFmt).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} LP</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const balance = Number(lpBalanceFmt || "0");
                              setAmountLP((balance * 0.25).toString());
                            }}
                            className="text-xs text-white hover:text-gray-200 px-2 py-1 rounded border-custom-2 bg-secondary hover-bg-custom transition-colors"
                          >
                            25%
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const balance = Number(lpBalanceFmt || "0");
                              setAmountLP((balance * 0.5).toString());
                            }}
                            className="text-xs text-white hover:text-gray-200 px-2 py-1 rounded border-custom-2 bg-secondary hover-bg-custom transition-colors"
                          >
                            50%
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const balance = Number(lpBalanceFmt || "0");
                              setAmountLP((balance * 0.75).toString());
                            }}
                            className="text-xs text-white hover:text-gray-200 px-2 py-1 rounded border-custom-2 bg-secondary hover-bg-custom transition-colors"
                          >
                            75%
                          </button>
                          <button
                            type="button"
                            onClick={() => setAmountLP(lpBalanceFmt)}
                            className="text-xs text-white hover:text-gray-200 px-2 py-1 rounded border-custom-2 bg-secondary hover-bg-custom transition-colors"
                          >
                            100%
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Arrow Icon Down */}
                  <div className="flex justify-center my-2 relative z-10">
                    <div className="bg-secondary rounded-full p-2 border border-custom-2">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Expected Output */}
                  <div className="bg-secondary-2 rounded-lg p-4 space-y-2 border-custom-2">
                    <div className="text-sm text-white">You will receive:</div>
                    <div className="text-sm font-medium flex items-center gap-2 text-white">
                      {quoteConfig?.icon && (
                        <img
                          src={quoteConfig.icon}
                          alt={quoteSymbol}
                          className="w-5 h-5"
                        />
                      )}
                      {Number(expectedEURC || "0").toFixed(4)} {quoteSymbol}
                    </div>
                    <div className="text-sm font-medium flex items-center gap-2 text-white">
                      {tokenConfig?.icon && (
                        <img
                          src={tokenConfig.icon}
                          alt={tokenSymbol}
                          className="w-5 h-5"
                        />
                      )}
                      {Number(expectedToken || "0").toFixed(4)} {tokenSymbol}
                    </div>
                  </div>

                  {/* Combined Approve/Remove Button */}
                  <button
                    onClick={handleApproveAndRemoveLiquidity}
                    disabled={!amountLP || Number(amountLP) <= 0 || Number(amountLP) > Number(lpBalanceFmt) || isPending || isConfirming || !isConnected || !hasPosition}
                    className="w-full px-4 py-2 bg-active text-black rounded-lg hover:opacity-90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed mt-5"
                  >
                    {isPending || isConfirming ? (
                      lastAction === "approve-lp" ? "Approving LP..." :
                        "Processing..."
                    ) : !amountLP || Number(amountLP) <= 0 ? (
                      "Enter Amount"
                    ) : Number(amountLP) > Number(lpBalanceFmt) ? (
                      "Insufficient Balance"
                    ) : !hasPosition ? (
                      "No Position"
                    ) : needsLPApproval ? (
                      "Approve LP"
                    ) : (
                      "Remove Liquidity"
                    )}
                  </button>

                  {!isConnected && (
                    <div className="text-sm text-gray-500 text-center">Connect wallet to remove liquidity</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Liquidity() {
  const { pairs, isLoading, isError } = useAllPairs();
  const [currentPage, setCurrentPage] = useState(1);
  const [initialized, setInitialized] = useState(false);
  const itemsPerPage = 5;
  const totalItems = pairs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const showPagination = totalItems > itemsPerPage;
  const shouldHideLastBorder = totalItems <= itemsPerPage;

  // Mark as initialized when loading completes (prevents reset on tab switch)
  useEffect(() => {
    if (!isLoading && !initialized) {
      setInitialized(true);
    }
  }, [isLoading, initialized]);

  // Reset to page 1 if current page exceeds total pages
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPairs = pairs.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div className="w-[65%] max-w-6xl mx-auto">
        <div className="relative bg-secondary border-t border-b border-custom-2 rounded-xl pt-6 pb-0 overflow-x-auto">
          <h2 className="text-xl font-semibold text-white m-0 p-0 mb-4 ml-5">Liquidity Pools</h2>

          {/* Header */}
          <div className="flex items-center px-10 py-2 border-b bg-secondary-2 font-medium text-sm text-white min-w-[900px]" style={{ borderBottomColor: '#454851', borderBottomWidth: '1px' }}>
            <div className="w-[200px] flex-shrink-0">Token Pair</div>
            <div className="flex-1 text-center min-w-[180px]">Reserves</div>
            <div className="flex-1 text-center min-w-[150px]">Total Liquidity</div>
            <div className="w-[110px] flex-shrink-0 flex justify-end">Action</div>
          </div>

          {/* Pool Rows */}
          <div className="divide-y divide-custom-2">
            {!initialized ? (
              <div className="px-10 py-8 text-center text-white">Loading pairs...</div>
            ) : isError ? (
              <div className="px-10 py-8 text-center text-red-400">
                Error loading pairs. Please refresh the page.
              </div>
            ) : totalItems === 0 ? (
              <div className="px-10 py-8 text-center text-gray-400">No pairs found</div>
            ) : currentPairs.length === 0 && !isLoading ? (
              <div className="px-10 py-8 text-center text-gray-400">No pairs on this page</div>
            ) : currentPairs.length > 0 ? (
              currentPairs.map((pair, index) => {
                const isLastRow = index === currentPairs.length - 1;
                const isLastItem = shouldHideLastBorder && isLastRow;
                return (
                  <PoolRow
                    key={pair.pairAddress}
                    tokenSymbol={pair.tokenSymbol}
                    tokenAddress={pair.tokenAddress}
                    tokenDecimals={pair.tokenDecimals}
                    quoteSymbol={pair.quoteSymbol}
                    quoteAddress={pair.quoteAddress}
                    quoteDecimals={pair.quoteDecimals}
                    pairAddress={pair.pairAddress}
                    tokenConfig={pair.tokenConfig}
                    quoteConfig={pair.quoteConfig}
                    isLast={isLastItem}
                  />
                );
              })
            ) : null}
          </div>

          {/* Pagination */}
          {showPagination && (
            <div className="flex items-center justify-center gap-2 px-10 py-4">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-secondary-2 text-white rounded-lg hover:bg-secondary hover-bg-custom transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Previous
              </button>
              <span className="text-white text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-secondary-2 text-white rounded-lg hover:bg-secondary hover-bg-custom transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
