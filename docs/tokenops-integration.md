# TokenOps Integration

CloakOps treats **TokenOps as the campaign / distribution lifecycle rail** and
adds a **confidential allocation, tier, and vesting metadata layer with Zama
FHE** on top. This document explains exactly where TokenOps is integrated, what
the real integration does on-chain, what each side owns, and the honest
limitations.

The integration is **real-only** — there is no demo/simulation mode. Every
TokenOps call goes through `@tokenops/sdk` against live Sepolia contracts.

## Where TokenOps lives in the code

```
apps/web/lib/tokenops/
  types.ts            # Adapter interface + DTOs + operation-log types
  real-adapter.ts     # RealTokenOpsAdapter — wraps @tokenops/sdk/fhe-vesting
  vesting-helpers.ts  # VestingParams mapping, setOperator, salt, relayer URL
  index.ts            # createTokenOpsAdapter(opts) factory
  context.tsx         # React provider: status, operation log, lifecycle calls
apps/web/components/tokenops/
  status-pill.tsx     # Header connection-status pill
  tokenops-panel.tsx  # Status card (factory + manager) + live operation log
```

The adapter contract (`TokenOpsCampaignAdapter`):

```ts
getStatus()
createCampaign(input)
syncRecipients(input)
createDistributionOperation(input)
getAnalytics(campaignId)
```

## The real `@tokenops/sdk` (v1.0.0)

Following Zama's acquisition of TokenOps, the SDK is a **confidential token
operations SDK** built on Zama FHE / the ERC-7984 confidential token standard.
CloakOps uses the **confidential vesting** rail (not airdrop):

- `@tokenops/sdk` — core: `getFheVestingFactoryAddress(chainId)`,
  `getFheAirdropFactoryAddress(chainId)`, `SUPPORTED_CHAINS`, typed errors.
- `@tokenops/sdk/fhe-vesting` — `createConfidentialVestingFactoryClient(...)`
  (`createManager(...)`) and `createConfidentialVestingManagerClient(...)`
  (`createVesting`, `batchCreateVesting`, `claim`, `getAllRecipientsLength`,
  `maxBatchSize`, …). Also exports `erc7984OperatorAbi` for `setOperator`.
- `@tokenops/sdk/fhe` — `createSepoliaEncryptorWeb(...)` wraps the Zama relayer
  to encrypt `euint64` amounts in the browser.

`VestingParams` shape used per recipient:

```ts
{ recipient: Address; startTimestamp: number; endTimestamp: number;
  cliffSeconds: number; releaseIntervalSecs: number; timelockSeconds: number;
  initialUnlockBps: number; cliffAmountBps: number; isRevocable: boolean }
```

## What the integration does (real, on-chain)

`RealTokenOpsAdapter` dynamically imports the SDK (kept out of the default
bundle) and runs three steps, all wired into the admin create flow
(`lib/campaigns/create-flow.ts`):

### 1. `getStatus`
Resolves the on-chain confidential-**vesting** factory via
`getFheVestingFactoryAddress(chainId)` and reports the configured manager
(`NEXT_PUBLIC_TOKENOPS_VESTING_CONTRACT`). Genuine SDK call.

### 2. `createCampaign`
- If `NEXT_PUBLIC_TOKENOPS_VESTING_CONTRACT` is set (default), **reuses** that
  vesting manager clone — no redeploy tx, links to the existing
  app.tokenops.xyz schedule.
- Otherwise deploys a fresh manager via `factory.createManager({ token, userSalt })`
  and reads the address from the `ManagerCreated` event. The salt is derived
  deterministically from the CloakOps campaign id.

### 3. `syncRecipients` (the real stakeholder write)
1. `setOperator(manager, deadline)` on the ERC-7984 token — authorises the
   manager to pull the admin's confidential tokens (one wallet signature).
2. Builds a `createSepoliaEncryptorWeb` encryptor (Zama relayer).
3. `batchCreateVesting({ items })` — each item carries a `VestingParams` plus a
   **plaintext `bigint` amount that the SDK encrypts** before submission.
   Batches respect `maxBatchSize()`.

Vesting class → schedule mapping (`vesting-helpers.ts > buildVestingParams`):

| CloakOps vesting class | TokenOps schedule |
| --- | --- |
| `0` | Fully unlocked at claim start (`initialUnlockBps = 10000`) |
| `n > 0` | `n × 30 days` cliff, daily linear release to claim end |

### `createDistributionOperation` / `getAnalytics`
Read-only verification — calls `getAllRecipientsLength()` on the manager so the
operation log reflects the real on-chain stakeholder count.

## Prerequisites for a successful sync (honest)

`syncRecipients` will **revert** unless:

1. `NEXT_PUBLIC_TOKENOPS_VESTING_TOKEN` is the exact ERC-7984 token the manager
   was deployed with (e.g. the CTestToken on the linked schedule).
2. The connected admin wallet holds a **confidential balance** of that token at
   least equal to the campaign's total allocation.
3. The wallet is on Sepolia and signs both the `setOperator` and
   `batchCreateVesting` transactions.

If the token/funding are missing the SDK throws a typed error which surfaces in
the TokenOps operation log — the adapter never fakes success.

## Division of responsibility

| Concern | Owner |
| --- | --- |
| Campaign lifecycle, vesting schedules, stakeholder set | **TokenOps** (`@tokenops/sdk/fhe-vesting`) |
| Confidential allocation amount / tier / vesting metadata | **CloakOps + Zama FHE** (`ConfidentialCampaign.sol`) |
| Per-recipient decryption authorization | **Zama FHE ACL** (`FHE.allow`) |
| Public budget, rules, claim window, claimed count | **CloakOps contract** (public state) |

## Privacy boundary at the TokenOps edge

Per-recipient amounts that reach TokenOps are **encrypted by the SDK** before
they touch the chain — the plaintext allocation never lands in TokenOps'
public state, and the CloakOps `ConfidentialCampaign` ledger remains the
canonical encrypted source. Recipient addresses and the public schedule
metadata (start/end, counts) are visible, consistent with the
"private allocations, public rules" model.

## Environment variables

```env
# Reuse the manager behind your app.tokenops.xyz schedule (no redeploy tx):
NEXT_PUBLIC_TOKENOPS_VESTING_CONTRACT=0xE1Fce9e572efFa42BBE851A44D2d00d2c808c494
NEXT_PUBLIC_TOKENOPS_VESTING_SCHEDULE_ID=6a189b396f763543bff332be
NEXT_PUBLIC_TOKENOPS_VESTING_SCHEDULE_URL=https://app.tokenops.xyz/contract/schedules/6a189b396f763543bff332be

# REQUIRED for syncRecipients — the ERC-7984 token the manager accepts.
# Must match the manager's immutable token, and the admin wallet must hold a
# confidential balance of it. If empty, falls back to NEXT_PUBLIC_CLOAKOPS_TOKEN_ADDRESS.
NEXT_PUBLIC_TOKENOPS_VESTING_TOKEN=
```
