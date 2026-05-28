# TokenOps Integration

CloakOps treats **TokenOps as the campaign / distribution lifecycle rail** and
adds a **confidential allocation, tier, and vesting metadata layer with Zama
FHE** on top. This document explains exactly where TokenOps is integrated, the
real vs demo modes, what each side owns, and the honest limitations.

## Where TokenOps lives in the code

```
apps/web/lib/tokenops/
  types.ts          # Adapter interface + DTOs + operation-log types
  demo-adapter.ts   # DemoTokenOpsAdapter (default) — faithful lifecycle simulation
  real-adapter.ts   # RealTokenOpsAdapter — wraps @tokenops/sdk fhe-airdrop, isolated
  index.ts          # createTokenOpsAdapter(mode, opts) factory
  context.tsx       # React provider: status, operation log, wrapped lifecycle calls
apps/web/components/tokenops/
  status-pill.tsx   # Header connection-status pill (mode + connection dot)
  tokenops-panel.tsx# Full status card + live operation log
```

The adapter contract (`TokenOpsCampaignAdapter`):

```ts
getStatus()
createCampaign(input)
syncRecipients(input)
createDistributionOperation(input)
getAnalytics(campaignId)
```

This is the same shape in both modes, so the UI and admin flow are mode-agnostic.

## Spike findings: the real `@tokenops/sdk`

We installed and inspected `@tokenops/sdk@1.0.0`. Following Zama's acquisition of
TokenOps, the SDK is now a **confidential token operations SDK** built on Zama
FHE / the ERC-7984 confidential token standard. Relevant entry points:

- `@tokenops/sdk` — core: `getFheAirdropFactoryAddress(chainId)`, `SUPPORTED_CHAINS`,
  rich typed error classes.
- `@tokenops/sdk/fhe-airdrop` — `createConfidentialAirdropFactoryClient(...)`
  with `createConfidentialAirdrop(...)` / `createAndFundConfidentialAirdrop(...)`,
  plus `createConfidentialAirdropClient(...)` for claim/view.
- `@tokenops/sdk/fhe` — `createSepoliaEncryptorWeb(...)` / `createSepoliaEncryptor(...)`
  which wrap the Zama relayer to encrypt `euint64` values in the browser/node.
- `@tokenops/sdk/fhe-vesting`, `@tokenops/sdk/fhe-disperse` — confidential vesting
  and bulk-transfer rails.

`AirdropParams` shape used by the factory:

```ts
{ token: Address; startTimestamp: number; endTimestamp: number;
  canExtendClaimWindow: boolean; admin: Address }
```

## Real mode (`NEXT_PUBLIC_TOKENOPS_MODE=real`)

`RealTokenOpsAdapter` dynamically imports the SDK (kept out of the default
bundle) and:

- **getStatus** resolves the on-chain confidential-airdrop factory address via
  `getFheAirdropFactoryAddress(chainId)` and reports whether the chain is
  supported. This is a genuine SDK call, not a mock.
- **createCampaign** builds a `createSepoliaEncryptorWeb` encryptor + a
  `ConfidentialAirdropFactoryClient` and calls `createConfidentialAirdrop(...)`,
  returning the deployed clone address and tx hash.

### Real-mode prerequisites and limitations (honest)

Creating and funding a **live** confidential airdrop requires:

1. A TokenOps confidential-airdrop factory deployed on the target chain (the SDK
   resolves the address; if none exists for the chain, status reports it clearly).
2. A connected wallet (viem `walletClient` + account) to sign the deploy tx.
3. A funded ERC-7984 confidential token to fund the claim set.

When these are not present, the adapter does **not** fake success — it surfaces a
clear `TokenOpsRealModeError` / honest status message. Because the hackathon MVP
does not deploy to a live funded environment, **demo mode is the default** so the
end-to-end story always runs.

## Demo mode (`NEXT_PUBLIC_TOKENOPS_MODE=demo`, default)

`DemoTokenOpsAdapter` is a faithful simulation of the same lifecycle
(create campaign -> sync recipients -> create confidential distribution
operation -> analytics) with realistic latency and a streamed operation log. It
mirrors the real SDK's method shapes so the demo is honest about *what* TokenOps
does, without requiring credentials, a funded wallet, or a deployed factory.

## Division of responsibility

| Concern | Owner |
| --- | --- |
| Campaign lifecycle, recipient set, distribution operation | **TokenOps** (rail) |
| Confidential allocation amount / tier / vesting metadata | **CloakOps + Zama FHE** (`ConfidentialCampaign.sol`) |
| Per-recipient decryption authorization | **Zama FHE ACL** (`FHE.allow`) |
| Public budget, rules, claim window, claimed count | **CloakOps contract** (public state) |

## Privacy boundary at the TokenOps edge

The confidential layer **never** passes plaintext per-recipient allocations into
the TokenOps adapter. `syncRecipients` receives **addresses and counts only**.
Encrypted allocation handles live on `ConfidentialCampaign.sol`. This keeps the
"private allocations, public rules" guarantee intact across the integration
boundary.

## Environment variables

```env
NEXT_PUBLIC_TOKENOPS_MODE=demo   # or "real"
TOKENOPS_API_KEY=                # reserved for hosted TokenOps API features
TOKENOPS_API_BASE_URL=
```
