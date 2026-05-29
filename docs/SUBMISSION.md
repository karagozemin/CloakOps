# Zama Developer Program — Submission Pack

Use this when submitting to **Builder Track** and **TokenOps Special Bounty**.
Fill in the video URL when ready; live demo is deployed.

---

## Links (copy into the form)

| Field | Value |
| --- | --- |
| **Live demo** | [https://cloak-ops.vercel.app/](https://cloak-ops.vercel.app/) |
| **Video demo** | _← add your Loom / YouTube URL_ |
| **GitHub** | Repository root |
| **ConfidentialCampaign (Sepolia)** | [0x468d1Ab3…C885](https://sepolia.etherscan.io/address/0x468d1Ab3bd52CbF43E4833A5696E47325De9C885) |
| **CloakConfidentialToken (Sepolia)** | [0x63E80Bb7…746c](https://sepolia.etherscan.io/address/0x63E80Bb781638e604047bc98f405cA6d8058746c) |
| **TokenOps vesting factory** | [0x98c519f9…b72a](https://sepolia.etherscan.io/address/0x98c519f9de1dc8c8cb3eb9b0b09b3ce057beb72a) |
| **Example TokenOps funding tx** | [0x3de4905d…2cd9e](https://sepolia.etherscan.io/tx/0x3de4905d8b5dcd3cfada7d51ddffecf54710c07fe1c6661ddc4e1bac1ef2cd9e) |

---

## One-line pitch

**CloakOps — confidential campaign layer for TokenOps:** private allocations, public rules, TokenOps execution. Allocation amounts, tiers, and vesting stay FHE-encrypted; campaign budget and rules stay publicly verifiable.

---

## Two settlement rails (say this in the video)

| Rail | What it proves | Contract |
| --- | --- | --- |
| **Confidential claim** | Recipient decrypts allocation → `claim()` → `FHE.add` credits encrypted balance | `CloakConfidentialToken` |
| **TokenOps vesting** | Admin encrypts amounts in-browser → factory deploys + funds per-recipient vesting wallets | TokenOps `CliffExecutorConfidentialFactory` |

Same encrypted allocation in `ConfidentialCampaign.sol` is the source of truth for both paths.

---

## 90-second demo order

1. **Problem** — block explorer shows public transfer amounts (5 s).
2. **Admin** — Load sample CSV → green **Verifiable sum** badge → Create campaign → TokenOps operation log (30 s).
3. **Etherscan** — open TokenOps vesting link → `VestingWalletConfidentialFunded` events (15 s).
4. **Claim** — recipient decrypts allocation / tier / vesting → claim (20 s).
5. **Public audit** — public budget vs encrypted fields (10 s).
6. **Close** — “Private allocations. Public rules. TokenOps execution.” (5 s).

Full script: [`video-script.md`](video-script.md).

---

## Differentiation vs encrypted-airdrop projects

- Not just hidden amounts — **tier + vesting class** encrypted (`euint8`).
- **TokenOps factory integration** (deploy + batch fund, fixed signature count via Multicall3).
- **Public audit page** — anyone verifies rules without seeing deals.
- **Verifiable sum** — admin UI proves Σ allocations = public budget before encryption.

---

## Your checklist

- [x] Deploy frontend to Vercel — [cloak-ops.vercel.app](https://cloak-ops.vercel.app/)
- [ ] Set `NEXT_PUBLIC_SITE_URL=https://cloak-ops.vercel.app` on Vercel (Open Graph)
- [x] Paste live demo URL into README + submission form
- [ ] Record 3-minute video ([`video-script.md`](video-script.md))
- [ ] Paste video URL into README + submission form
- [ ] Submit to **TokenOps Special Bounty** (primary) and **Builder Track** (secondary)

---

## Deep-dive docs for judges

- TokenOps integration + on-chain proof: [`tokenops-integration.md`](tokenops-integration.md)
- Privacy model (honest limits): [`privacy-model.md`](privacy-model.md)
- Architecture: [`architecture.md`](architecture.md)
