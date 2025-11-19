"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useBalance } from "wagmi";
import { formatUnits } from "viem";
import toast from "react-hot-toast";
import { TOKENS, ARC_CHAIN_ID } from "@/constants/tokens";

const ARC_EXPLORER_URL = 'https://testnet.arcscan.app';

const TEST_TOKEN_ABI = [
  {
    name: "faucet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "hasClaimedFaucet",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export default function Faucet() {
  const { address, isConnecting, isConnected } = useAccount();

  const tokens = TOKENS;

  type ClaimState = Record<string, { success: boolean; message: string }>;

  const [claimResults, setClaimResults] = useState<ClaimState>({});

  const FaucetRow = ({ token, isLast }: { token: (typeof tokens)[number]; isLast?: boolean }) => {
    const isExternalFaucet = token.symbol === "USDC" || token.symbol === "EURC";

    // Get token balance using wagmi useBalance
    const { data: balanceData, isLoading, refetch } = useBalance({
      address: address as `0x${string}` | undefined,
      token: token.address as `0x${string}` | undefined,
      query: { enabled: Boolean(address && token.address) },
    });

    const balance = useMemo(() => {
      if (!balanceData) return BigInt(0);
      return balanceData.value;
    }, [balanceData]);

    const {
      data: hasClaimedRaw,
      refetch: refetchClaimStatus,
    } = useReadContract({
      address: token.address as `0x${string}`,
      abi: TEST_TOKEN_ABI,
      functionName: "hasClaimedFaucet",
      args: address ? [address as `0x${string}`] : undefined,
      query: {
        enabled: !!address && !isExternalFaucet,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
    });

    const { writeContractAsync } = useWriteContract();
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
    const [pendingToastId, setPendingToastId] = useState<string | number | null>(null);

    const {
      isLoading: isTxPending,
      isSuccess: isTxSuccess,
      isError: isTxError,
      error: txError,
    } = useWaitForTransactionReceipt({
      hash: txHash,
    });

    useEffect(() => {
      if (!txHash) return;

      if (isTxSuccess) {
        if (pendingToastId !== null) {
          toast.dismiss(String(pendingToastId));
          setPendingToastId(null);
        }
        toast.success(
          <div className="flex flex-col gap-1">
            <span>Successfully claimed {token.symbol}!</span>
            {txHash && (
              <button
                onClick={() => window.open(`${ARC_EXPLORER_URL}/tx/${txHash}`, '_blank', 'noopener,noreferrer')}
                className="mt-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors"
              >
                View Explorer
              </button>
            )}
          </div>,
          { duration: 5000 }
        );
        setClaimResults((prev) => ({
          ...prev,
          [token.symbol]: { success: true, message: "" },
        }));
        void refetch();
        if (!isExternalFaucet) {
          void refetchClaimStatus();
        }
        setTxHash(undefined);
      } else if (isTxError) {
        if (pendingToastId !== null) {
          toast.dismiss(String(pendingToastId));
          setPendingToastId(null);
        }
        const wagmiError = txError as { shortMessage?: string; message?: string } | undefined;
        const message = wagmiError?.shortMessage || wagmiError?.message || `Failed to claim ${token.symbol}`;
        toast.error(message);
        setClaimResults((prev) => ({
          ...prev,
          [token.symbol]: { success: false, message },
        }));
        setTxHash(undefined);
      }
    }, [isTxSuccess, isTxError, txHash, txError, pendingToastId, token.symbol, isExternalFaucet, refetch, refetchClaimStatus]);

    const handleClaim = async () => {
      if (isExternalFaucet) {
        window.open("https://faucet.circle.com/", "_blank");
        return;
      }

      if (!address || !isConnected) {
        toast.error("Please connect wallet first");
        return;
      }

      try {
        toast.loading(`Claiming ${token.symbol}...`, { id: `claim-${token.symbol}` });

        const tx = await writeContractAsync({
          address: token.address,
          abi: TEST_TOKEN_ABI,
          functionName: "faucet",
        });

        toast.dismiss(`claim-${token.symbol}`);
        const pendingId = toast.loading(`Claiming ${token.symbol}...`, { id: `pending-${token.symbol}` });
        if (pendingId) {
          setPendingToastId(pendingId);
        }

        setTxHash(tx);
      } catch (error: unknown) {
        toast.dismiss(`claim-${token.symbol}`);
        const err = error as { shortMessage?: string; message?: string } | null;
        const message = err?.shortMessage || err?.message || `Failed to claim ${token.symbol}`;
        toast.error(message);
        setClaimResults((prev) => ({
          ...prev,
          [token.symbol]: { success: false, message },
        }));
      }
    };

    const displayBalance = useMemo(() => {
      if (isLoading) return "Loading...";
      if (!balanceData) return "0.00";
      const formatted = formatUnits(balance, token.decimals);
      return parseFloat(formatted).toLocaleString(undefined, { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
    }, [isLoading, balanceData, balance, token.decimals]);

    const isAlreadyClaimed = isExternalFaucet
      ? false
      : claimResults[token.symbol]?.success || hasClaimedRaw === true;

    return (
      <tr className="hover:bg-secondary-2 transition-colors" style={!isLast ? { borderBottomColor: '#454851', borderBottomWidth: '1px' } : {}}>
        <td className="px-5 py-3 w-[30%]">
          <div className="flex items-center gap-3">
            <img src={token.icon} alt={token.symbol} className="w-10 h-10 rounded-full" />
            <div>
              <div className="font-medium text-white">{token.symbol}</div>
              <div className="text-xs text-gray-400">{token.name}</div>
            </div>
          </div>
        </td>
        <td className="px-5 py-3 text-center text-sm text-white w-[40%]">
          {displayBalance}
        </td>
        <td className="px-5 py-3 text-right w-[30%]">
          <button
            onClick={handleClaim}
            disabled={
              isExternalFaucet ? false : !address || !isConnected || isConnecting || isTxPending || isAlreadyClaimed
            }
            className="px-4 py-2 text-sm rounded-lg transition-colors bg-active text-black hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isExternalFaucet
              ? "Claim"
              : isAlreadyClaimed
              ? "Claimed"
              : isTxPending
              ? "Claiming..."
              : "Claim"}
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div className="w-[35%] max-w-6xl mx-auto">
        <div className="relative bg-secondary border-t border-b border-custom-2 rounded-xl pt-6 pb-0 overflow-x-auto">
          <h2 className="text-xl font-semibold text-white m-0 p-0 mb-4 ml-5">Faucet Tokens</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-secondary-2 font-medium text-sm text-white" style={{ borderBottomColor: '#454851', borderBottomWidth: '1px' }}>
                  <th className="px-10 py-2 text-left w-[30%]">Asset</th>
                  <th className="px-10 py-2 text-center w-[40%]">Wallet Balance</th>
                  <th className="px-10 py-2 text-right w-[30%]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token, index) => (
                  <FaucetRow key={token.symbol} token={token} isLast={index === tokens.length - 1} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

