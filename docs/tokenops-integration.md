# TokenOps Integration

CloakOps treats **TokenOps as the confidential vesting / distribution rail** and
adds a **confidential allocation, tier, and vesting metadata layer with Zama
FHE** on top. This document explains exactly where TokenOps is integrated, what
the real integration does on-chain, what each side owns, and the honest
limitations.

The integration is **real-only** — there is no demo/simulation mode. Every
TokenOps write hits live Sepolia contracts.

## Where TokenOps lives in the code

```
apps/web/lib/tokenops/
  types.ts            # Adapter interface + DTOs + operation-log types
  real-adapter.ts     # RealTokenOpsAdapter — factory create/fund + Multicall3
  vesting-helpers.ts  # initArgs encoding, factory/Multicall3 ABIs, setOperator, mint
  index.ts            # createTokenOpsAdapter(opts) factory
  context.tsx         # React provider: status, operation log, lifecycle calls
apps/web/components/tokenops/
  status-pill.tsx     # Header connection-status pill
  tokenops-panel.tsx  # Status card (factory) + live operation log
```

The adapter contract (`TokenOpsCampaignAdapter`):

```ts
getStatus()
createCampaign(input)
syncRecipients(input)
createDistributionOperation(input)
getAnalytics(campaignId)
```

## The on-chain target: TokenOps confidential vesting factory

CloakOps writes directly to the same contract the **app.tokenops.xyz dashboard**
uses to deploy confidential vesting wallets on Sepolia:

`TokenOpsVestingWalletCliffExecutorConfidentialFactory`
(`NEXT_PUBLIC_TOKENOPS_VESTING_FACTORY`, default
`0x98c519f9de1dc8c8cb3eb9b0b09b3ce057beb72a`).

Relevant factory surface:

- `createVestingWalletConfidential(bytes initArgs) → address` — deploys a
  deterministic clone (`Clones.cloneDeterministic`, salt = `keccak256(initArgs)`).
- `predictVestingWalletConfidential(bytes initArgs) → address` — the wallet
  address for a given `initArgs` (no deploy).
- `batchFundVestingWalletConfidential(address token, VestingPlan[] plans, bytes inputProof)`
  — pulls confidential tokens from the caller into each (predicted) wallet via
  `IERC7984(token).confidentialTransferFrom(msg.sender, wallet, amount)`.

`initArgs` is ABI-encoded as:

```solidity
abi.encode(
  address beneficiary,
  uint48  startTimestamp,
  uint48  durationSeconds,
  uint48  cliffSeconds,
  address executor
)
```

The confidential vesting token is an **ERC-7984** test faucet
(`TestConfidentialWrapper`) whose `mint(address,uint64)` is permissionless on
Sepolia, so any campaign creator can fund themselves.

## What the integration does (real, on-chain)

`RealTokenOpsAdapter` runs three steps, all wired into the admin create flow
(`lib/campaigns/create-flow.ts`). The Zama SDK pieces
(`@tokenops/sdk/fhe`, `@tokenops/sdk/fhe-vesting`) are imported dynamically and
used only for encryption (`createSepoliaEncryptorWeb`, `encryptUint64Batch`) and
the `erc7984OperatorAbi`.

### 1. `getStatus`
Reports the configured factory (`NEXT_PUBLIC_TOKENOPS_VESTING_FACTORY`) and
whether the chain is supported.

### 2. `createCampaign`
Resolves the factory address — the logical "campaign" is the factory itself, so
there is no per-campaign manager deploy.

### 3. `syncRecipients` — minimal signatures, full deploy

Builds deterministic `initArgs` per stakeholder (`executor = funder`), then:

1. **One Multicall3 tx** (`0xcA11bde05977b3631167028862bE2a173976CA11`,
   `aggregate3`): `mint(funder, totalAllocation)` **plus** one
   `createVestingWalletConfidential(initArgs)` per stakeholder. Both calls are
   independent of `msg.sender`, so batching them keeps wallet **deployment** a
   single signature regardless of stakeholder count. Create calls use
   `allowFailure: true` so re-runs (clone already exists) stay idempotent.
2. `setOperator(factory, deadline)` on the ERC-7984 token — **skipped** when
   `isOperator(funder, factory)` is already true (the deadline is far future).
3. `encryptUint64Batch({ contractAddress: factory, userAddress: funder, values })`
   → handles + single input proof, then
   `batchFundVestingWalletConfidential(token, plans, inputProof)` funds every
   wallet in one confidential batch transfer.

**Signature count is fixed regardless of stakeholder count:**

| Scenario | TokenOps signatures |
| --- | --- |
| First campaign (operator not yet set) | 3 — Multicall3 (mint+creates), setOperator, batchFund |
| Later campaigns (operator cached) | 2 — Multicall3 (mint+creates), batchFund |

1 stakeholder or 50 stakeholders cost the same.

Vesting class → schedule mapping (`vesting-helpers.ts > buildVestingInitArgs`):

| CloakOps vesting class | Cliff |
| --- | --- |
| `0` | No cliff (start..end linear window) |
| `n > 0` | `n × 30 days` cliff (capped below the duration) |

### `createDistributionOperation` / `getAnalytics`
Summary only — `createDistributionOperation` logs the stakeholder count;
`getAnalytics` returns an empty rollup (per-wallet confidential balances are not
read back).

## Prerequisites for a successful sync (honest)

`syncRecipients` will **revert** unless:

1. `NEXT_PUBLIC_TOKENOPS_VESTING_TOKEN` is the ERC-7984 token the factory pulls
   (the CTestToken faucet on Sepolia).
2. The connected wallet holds a **confidential balance** of that token at least
   equal to the campaign's total allocation. With `NEXT_PUBLIC_TOKENOPS_AUTO_MINT`
   enabled (default), the flow mints this balance automatically in step 1, so
   **any** connected wallet works without pre-funding.
3. The wallet is on Sepolia and signs the Multicall3 + (optional) setOperator +
   batchFund transactions.

The adapter never fakes success — a revert surfaces in the TokenOps operation
log and fails the create flow.

## Division of responsibility

| Concern | Owner |
| --- | --- |
| Confidential vesting wallet deploy + funding | **TokenOps factory** (CliffExecutor) |
| Confidential allocation amount / tier / vesting metadata | **CloakOps + Zama FHE** (`ConfidentialCampaign.sol`) |
| Browser-side `euint64` encryption + relayer | **Zama** (`@tokenops/sdk/fhe`) |
| Per-recipient decryption authorization | **Zama FHE ACL** (`FHE.allow`) |
| Public budget, rules, claim window, claimed count | **CloakOps contract** (public state) |

## Privacy boundary at the TokenOps edge

Per-recipient amounts that reach the factory are **encrypted in the browser**
(`encryptUint64Batch`, bound to the factory + funder) before they touch the
chain — the plaintext allocation never lands in public state, and the CloakOps
`ConfidentialCampaign` ledger remains the canonical encrypted source. Recipient
addresses and the schedule metadata (start/end, cliff) are visible, consistent
with the "private allocations, public rules" model.

## Honest limitation

The vesting wallets are real, deployed, and funded on-chain (verifiable on
Etherscan via the factory's `VestingWalletConfidentialCreated` /
`VestingWalletConfidentialFunded` events). Whether they appear under a specific
**app.tokenops.xyz schedule page** depends on that dashboard's own indexer,
which is outside CloakOps' control — we target the same factory + executor to
maximise the chance, but cannot guarantee a particular dashboard view.

## Environment variables

```env
# TokenOps confidential vesting factory (dashboard's CliffExecutor factory).
NEXT_PUBLIC_TOKENOPS_VESTING_FACTORY=0x98c519f9de1dc8c8cb3eb9b0b09b3ce057beb72a

# ERC-7984 token the factory pulls via confidentialTransferFrom (CTestToken faucet).
NEXT_PUBLIC_TOKENOPS_VESTING_TOKEN=0xFaac272CDE1701479932935a3567652873c377EF

# Auto-mint the required confidential balance to the creator before funding.
# Requires a permissionless faucet token; set "false" for non-mintable tokens.
NEXT_PUBLIC_TOKENOPS_AUTO_MINT=true
```

The campaign's "TokenOps vesting" link surfaces the verifiable on-chain proof —
the confidential funding tx (`VestingWalletConfidentialFunded`) on Etherscan —
rather than the dashboard schedule page (see [Honest limitation](#honest-limitation)).
