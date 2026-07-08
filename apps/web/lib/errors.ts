/**
 * Human-friendly error normalization for every chain interaction.
 *
 * Raw viem / wallet / relayer errors are noisy and scary. We map the common
 * failure modes to short, actionable messages so the same wording appears on
 * the admin, claim, and public-audit pages.
 */

export type FriendlyErrorKind =
  | "wrong-network"
  | "rejected"
  | "insufficient-funds"
  | "not-connected"
  | "decrypt-failed"
  | "not-configured"
  | "unknown";

export interface FriendlyError {
  kind: FriendlyErrorKind;
  /** Short, user-facing message. */
  message: string;
  /** Original message, useful for a "details" disclosure. */
  raw: string;
}

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Turn any thrown value from a chain / FHE interaction into a friendly error.
 *
 * `context` lets callers bias ambiguous cases (e.g. a failed decrypt) toward
 * the right message.
 */
export function toFriendlyError(
  error: unknown,
  context?: "decrypt" | "tx",
): FriendlyError {
  const raw = rawMessage(error);
  const lower = raw.toLowerCase();

  // User rejected the signature / transaction in their wallet.
  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected the request") ||
    lower.includes("request rejected") ||
    lower.includes("action_rejected") ||
    // viem UserRejectedRequestError code
    lower.includes("4001")
  ) {
    return {
      kind: "rejected",
      message: "Transaction cancelled — no changes were made.",
      raw,
    };
  }

  // Not enough Sepolia ETH to cover gas.
  if (
    lower.includes("insufficient funds") ||
    lower.includes("insufficient balance for gas") ||
    lower.includes("gas * price")
  ) {
    return {
      kind: "insufficient-funds",
      message:
        "Insufficient Sepolia ETH for gas. Top up this wallet from a Sepolia faucet and try again.",
      raw,
    };
  }

  // Wrong network / chain mismatch.
  if (
    lower.includes("chain mismatch") ||
    lower.includes("does not match the target chain") ||
    lower.includes("wrong network") ||
    lower.includes("chain not configured") ||
    lower.includes("unsupported chain") ||
    lower.includes("switch") && lower.includes("sepolia")
  ) {
    return {
      kind: "wrong-network",
      message: "Please switch your wallet to the Sepolia network.",
      raw,
    };
  }

  // Wallet not connected.
  if (
    lower.includes("connect your wallet") ||
    lower.includes("no account") ||
    lower.includes("account is required") ||
    lower.includes("wallet client") && lower.includes("undefined")
  ) {
    return {
      kind: "not-connected",
      message: "Connect your wallet on Sepolia to continue.",
      raw,
    };
  }

  // Missing env / contract configuration.
  if (
    lower.includes("not configured") ||
    lower.includes("is not set") ||
    lower.includes("address is not")
  ) {
    return {
      kind: "not-configured",
      message: raw, // configuration messages are already specific
      raw,
    };
  }

  // Decrypt failures (relayer denies re-encryption for non-recipients, etc).
  if (
    context === "decrypt" ||
    lower.includes("decrypt") ||
    lower.includes("re-encrypt") ||
    lower.includes("reencrypt") ||
    lower.includes("not authorized")
  ) {
    return {
      kind: "decrypt-failed",
      message:
        "Could not decrypt — you may not be a recipient of this campaign, or the value hasn't been set yet.",
      raw,
    };
  }

  return {
    kind: "unknown",
    message:
      raw.length > 160
        ? "Something went wrong with the on-chain request. See details below."
        : raw,
    raw,
  };
}

/** Convenience: get just the friendly message string. */
export function friendlyMessage(
  error: unknown,
  context?: "decrypt" | "tx",
): string {
  return toFriendlyError(error, context).message;
}
