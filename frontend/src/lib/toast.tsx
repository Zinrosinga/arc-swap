"use client";

import React from "react";
import toast from "react-hot-toast";

const ARC_EXPLORER_URL = 'https://testnet.arcscan.app';

interface ToastOptions {
  id?: string;
  duration?: number;
  showExplorer?: boolean;
  txHash?: `0x${string}`;
}

/**
 * Show success toast with optional View Explorer button
 */
export const showSuccessToast = (
  message: string,
  options: ToastOptions = {}
) => {
  const { id, duration = 5000, showExplorer = false, txHash } = options;

  if (showExplorer && txHash) {
    return toast.success(
      <div className="flex flex-col gap-1" style={{ fontFamily: 'var(--font-inter), var(--font-manrope), "PingFang SC", "Microsoft YaHei", sans-serif' }}>
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span style={{ fontSize: '14px', fontWeight: '400' }}>{message}</span>
        </div>
        <button
          onClick={() => window.open(`${ARC_EXPLORER_URL}/tx/${txHash}`, '_blank', 'noopener,noreferrer')}
          className="mt-1 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-medium rounded-md transition-colors"
          style={{ fontSize: '12px', fontWeight: '500' }}
        >
          View Explorer
        </button>
      </div>,
      { id, duration }
    );
  }

  return toast.success(message, { id, duration });
};

/**
 * Show error toast
 */
export const showErrorToast = (
  message: string,
  options: { id?: string; duration?: number } = {}
) => {
  const { id, duration = 5000 } = options;
  return toast.error(message, { id, duration });
};

/**
 * Show loading toast (infinite duration by default)
 */
export const showLoadingToast = (
  message: string,
  options: { id?: string; duration?: number } = {}
) => {
  const { id, duration = Infinity } = options;
  return toast.loading(message, { id, duration });
};

/**
 * Dismiss toast by id
 */
export const dismissToast = (id: string) => {
  toast.dismiss(id);
};

