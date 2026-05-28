<p align="center">
  <img src="docs/brand/cloakops-logo.png" alt="CloakOps" width="250" />
</p>

<p align="center"><strong>Private allocations. Public rules. TokenOps execution.</strong></p>

CloakOps is a **confidential campaign layer for TokenOps**, built on **Zama FHE**.
Token teams run private rounds, contributor rewards, advisor vesting, and
community distributions where **allocation amounts, tiers, and vesting metadata
stay encrypted on-chain** — while **campaign rules and totals remain publicly
verifiable**.

> Built for the Zama Developer Program (Mainnet Season 3) — **Builder Track**
> and the **TokenOps Special Bounty**.

---

## The problem

Public chains leak distribution strategy. Anyone can read token transfers and
vesting contracts to infer who got the biggest allocation, which contributors
are top-tier, what advisors received, and when each party claimed. For a token
team, that's a confidentiality and competitive problem.

Ordinary encryption doesn't solve it: you can't run claim logic or prove
campaign totals over data nobody can compute on.

## The solution

**Fully Homomorphic Encryption (FHE)** lets a smart contract operate on
encrypted values directly. CloakOps stores each recipient's allocation
(`euint64`), tier (`euint8`), and vesting class (`euint8`) encrypted, with
per-recipient FHE access control so **only the recipient can decrypt their own
values**. Campaign budget, type, claim window, recipient count, and claimed
count stay public and verifiable.

TokenOps provides the **campaign and distribution lifecycle rail**; CloakOps
adds the **confidential metadata layer**. Together they form a confidential
campaign operations layer.

## Why both tracks

- **Builder Track** — a real-world confidential dApp solving a genuine financial
  privacy problem with FHE, end to end (contract + relayer + polished product).
- **TokenOps Special Bounty** — TokenOps is central: the admin flow creates a
  TokenOps campaign, syncs recipients, and prepares a confidential distribution
  operation, with live connection status and an operation log surfaced in the
  UI. See [`docs/tokenops-integration.md`](docs/tokenops-integration.md).

---

## Privacy model

| Public & verifiable | Encrypted (Zama FHE) | Honestly not hidden (MVP) |
| --- | --- | --- |
| Campaign name & type | Allocation amount (`euint64`) | Recipient wallet addresses |
| Total budget | Recipient tier (`euint8`) | Transaction timing |
| Recipient count | Vesting class (`euint8`) | Admin address |
| Claim window | (decryptable only by recipient) | |
| Claimed count | | |
| Contract address | | |

Full detail: [`docs/privacy-model.md`](docs/privacy-model.md).

---

## Architecture

```
apps/web                 Next.js App Router frontend (TS + Tailwind + wagmi/viem)
  app/                   landing, /admin, /claim, /public-audit, /public-audit/[id], /campaign/[id], /api/relayer/[chainId]
  lib/zama               RealZamaProvider — Zama Relayer SDK encrypt/decrypt
  lib/tokenops           RealTokenOpsAdapter (@tokenops/sdk) + op-log store
  lib/campaigns          local campaign cache, create-flow orchestrator, hooks
  lib/csv, lib/sample    CSV parse/validate + the "AI x Crypto Seed Contributors" sample dataset
  lib/contracts          generated ABI + typed bindings + on-chain read/write helpers
  lib/wagmi              wallet/public client resolution for on-chain signing
packages/contracts       Hardhat + @fhevm/solidity
  contracts/             ConfidentialCampaign.sol, MockConfidentialToken.sol
  test/                  FHEVM mock-mode tests
  scripts/               deploy.ts, create-demo-campaign.ts, export-abi.ts
docs/                    architecture, privacy-model, tokenops-integration, video-script, x-thread
```

More: [`docs/architecture.md`](docs/architecture.md).

---

## Real, on-chain by design

CloakOps runs against live infrastructure end to end — there is no simulated
fallback:

- **Zama FHE** — the Zama Relayer SDK encrypts allocations client-side and
  performs user-decryption against the deployed `ConfidentialCampaign` contract
  on Sepolia. Only the recipient wallet can decrypt its own values.
- **TokenOps** — the `@tokenops/sdk` confidential-distribution rails link each
  campaign to a live TokenOps vesting schedule, with connection status and an
  operation log surfaced in the UI.

All writes (create campaign, add recipients, claim) are signed by the connected
wallet and settled on Sepolia.

---

## Getting started

### Prerequisites

- Node.js >= 20
- npm >= 9
- A wallet (MetaMask) on **Sepolia** with test ETH

### Install

```bash
npm install
```

### Run the web app

```bash
npm run dev
# http://localhost:3000
```

Try it:

1. **/admin** → connect your wallet on Sepolia → add recipients with the form
   (or paste/upload a CSV) → *Create confidential campaign* and watch the 5-step
   flow (parse → Zama encrypt → contract submit → TokenOps sync → ready). Each
   on-chain step prompts a wallet signature.
2. **/claim** → connect a recipient wallet → the page auto-scans the contract
   for campaigns where the wallet is eligible → decrypt your
   allocation/tier/vesting and claim.
3. **/public-audit** → browse all campaigns and open one to verify public rules
   while private fields stay encrypted.

### Contracts: compile & test

```bash
npm run compile      # hardhat compile (Solidity 0.8.27, cancun, viaIR)
npm run test         # FHEVM mock-mode tests (12 passing)
```

### Deploy to Sepolia

```bash
# configure root .env (see .env.example): SEPOLIA_RPC_URL, PRIVATE_KEY
npm run deploy:sepolia      # deploys ConfidentialCampaign + MockConfidentialToken
npm run export-abi          # syncs ABI + address into apps/web/lib/contracts
npm run demo-campaign       # (optional) seeds the encrypted demo campaign on-chain
```

Then set the frontend env (`apps/web/.env.local`):

```env
NEXT_PUBLIC_CLOAKOPS_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_TOKENOPS_VESTING_SCHEDULE_URL=https://app.tokenops.xyz/contract/schedules/6a189b396f763543bff332be
NEXT_PUBLIC_TOKENOPS_VESTING_CONTRACT=0xE1Fce9e572efFa42BBE851A44D2d00d2c808c494
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
ZAMA_RELAYER_URL=https://relayer.testnet.zama.org/v2
```

### Sepolia deployments (demo)

| Component | Address / link |
| --- | --- |
| CloakOps `ConfidentialCampaign` | `0xe14555024f730D31aDeD9759C0570399EE4eDc78` |
| Mock token (cDEMO, ERC-20 reference) | `0x64b18e14F1A47C4152a69Ad12e50C6B9F0c6dd2E` |
| TokenOps x ZAMA vesting contract | `0xE1Fce9e572efFa42BBE851A44D2d00d2c808c494` |
| TokenOps vesting tracking | [app.tokenops.xyz/contract/schedules/6a189b…](https://app.tokenops.xyz/contract/schedules/6a189b396f763543bff332be) |

CloakOps links to the live TokenOps vesting schedule in `/public-audit` and after
admin create-flow sync (no fake `/campaigns/tops_*` URLs).

### Deploy the frontend (Vercel)

Set the `apps/web` directory as the project root, add the `NEXT_PUBLIC_*` env
vars, and deploy. The relayer proxy lives at `/api/relayer/[chainId]`.

---

## Environment

See [`.env.example`](.env.example) for all keys. No secrets are committed.

---

## Smart contract

`ConfidentialCampaign.sol` (inherits `ZamaEthereumConfig`):

- `createCampaign(...)` — public metadata only.
- `addRecipient(...)` / `batchAddRecipients(...)` — store encrypted
  `euint64`/`euint8` values; grant decryption to contract (`FHE.allowThis`) and
  recipient (`FHE.allow`) only.
- `claim(...)` — records confidential claim status; bumps the public claimed
  count.
- public getters for campaign state; encrypted getters return handles gated by
  the FHE ACL.

`claim()` records claim status in v1 (no token custody); wiring it to a
confidential ERC-7984 transfer via TokenOps is the documented roadmap item.

---

## Limitations & roadmap

- **MVP scope**: the contract is the confidential campaign + claim layer and
  does not custody/transfer real tokens. Recipient addresses, tx timing, and the
  admin address are visible (see privacy model).
- **On-chain by default**: all encrypt/decrypt and writes run against the
  deployed contract + Zama relayer on Sepolia; a connected wallet on Sepolia is
  required.
- **Roadmap**: confidential ERC-7984 claim transfers via TokenOps rails,
  encrypted vesting schedule enforcement on-chain, multi-admin campaigns,
  on-chain campaign indexing.

## Out of scope (intentionally)

ERC-20↔ERC-7984 wrapper registry, wrap/unwrap UI, payroll, governance,
cross-chain, billing, KYC, and mainnet deployment.

## License

MIT
