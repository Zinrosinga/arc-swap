"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';

const ARC_TESTNET_CHAIN_ID = 5042002;

export const WalletButton = () => {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [mounted, setMounted] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toastShownRef = useRef(false);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Auto switch to Arc Testnet after connecting
  useEffect(() => {
    // Reset toast flag when network is correct or disconnected
    if (!isConnected || (chainId && chainId === ARC_TESTNET_CHAIN_ID)) {
      toastShownRef.current = false;
      return;
    }

    // Only show toast once when network is wrong
    if (isConnected && chainId && chainId !== ARC_TESTNET_CHAIN_ID && !toastShownRef.current) {
      toastShownRef.current = true;

      if (switchChain) {
        try {
          switchChain({ chainId: ARC_TESTNET_CHAIN_ID });
        } catch {
          // Show toast notification when network is wrong
          toast.error(
            <div className="flex flex-col gap-1">
              <span>⚠️ Wrong network detected</span>
              <span className="text-xs opacity-90">Please switch to Arc Testnet</span>
            </div>,
            {
              duration: 5000,
              icon: '⚠️',
              id: 'wrong-network', // Use same ID to prevent duplicates
            }
          );
        }
      } else {
        // Show toast notification if network is wrong (even without switchChain)
        toast.error(
          <div className="flex flex-col gap-1">
            <span>⚠️ Wrong network detected</span>
            <span className="text-xs opacity-90">Please switch to Arc Testnet</span>
          </div>,
          {
            duration: 5000,
            icon: '⚠️',
            id: 'wrong-network', // Use same ID to prevent duplicates
          }
        );
      }
    }
  }, [isConnected, chainId, switchChain]);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Avoid hydration mismatches
  if (!mounted) {
    return (
      <button className="bg-active text-black text-sm font-medium h-9 px-4 min-w-[140px] rounded-lg hover:opacity-90 transition-colors disabled:opacity-50" disabled>
        Connect Wallet
      </button>
    );
  }

  if (isConnected) {


    return (
      <div className="flex items-center gap-2">
        {/* Wallet Address Button */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="bg-active text-black text-sm font-medium h-9 px-4 min-w-[140px] rounded-lg hover:opacity-90 transition-colors"
          >
            <div className="font-mono text-sm">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-secondary rounded-lg shadow-lg border border-custom-2 z-50">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-white font-semibold">Wallet Address</span>
                  <button
                    onClick={() => setIsDropdownOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-3 p-2 bg-secondary-2 rounded border border-custom-2">
                  <span className="font-mono text-sm flex-1 text-white">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  <button
                    onClick={copyAddress}
                    className={`p-1 transition-all ${copied
                        ? 'text-green-400 scale-110'
                        : 'text-gray-400 hover:text-white'
                      }`}
                    title="Copy address"
                  >
                    <img
                      src="/copy.svg"
                      alt="Copy"
                      className={`w-4 h-4 transition-transform ${copied ? 'scale-110' : ''}`}
                    />
                  </button>
                </div>

                {chainId !== ARC_TESTNET_CHAIN_ID && (
                  <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-gray-700">
                    ⚠️ Wrong network. Please switch to Arc Testnet.
                    <button
                      onClick={() => switchChain({ chainId: ARC_TESTNET_CHAIN_ID })}
                      className="block w-full mt-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium py-1 px-2 rounded"
                    >
                      Switch to Arc Testnet
                    </button>
                  </div>
                )}

                <button
                  onClick={() => {
                    disconnect();
                    setIsDropdownOpen(false);
                  }}
                  className="w-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-2 px-4 rounded"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        // Use first connector (injected = MetaMask, OKX, etc.)
        if (connectors[0]) {
          connect({ connector: connectors[0] });
        }
      }}
      disabled={isPending}
      className="bg-active text-black text-sm font-medium h-9 px-4 min-w-[140px] rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
    >
      {isPending ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
};

