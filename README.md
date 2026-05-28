# CloakOps

**Private allocations. Public rules. TokenOps execution.**

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
  app/                   landing, /admin, /claim, /public-audit/[id], /campaign/[id], /api/relayer/[chainId]
  lib/zama               dual-mode FHE: DemoZamaProvider + RealZamaProvider (Relayer SDK)
  lib/tokenops           TokenOps adapter: DemoTokenOpsAdapter + RealTokenOpsAdapter (@tokenops/sdk), op-log
  lib/campaigns          local campaign store, create-flow orchestrator, hooks
  lib/csv, lib/demo      CSV parse/validate + the "AI x Crypto Seed Contributors" dataset
  lib/contracts          generated ABI + typed bindings (exported from the contracts package)
packages/contracts       Hardhat + @fhevm/solidity
  contracts/             ConfidentialCampaign.sol, MockConfidentialToken.sol
  test/                  FHEVM mock-mode tests
  scripts/               deploy.ts, create-demo-campaign.ts, export-abi.ts
docs/                    architecture, privacy-model, tokenops-integration, video-script, x-thread
```

More: [`docs/architecture.md`](docs/architecture.md).

---

## Dual-mode design (the demo never breaks)

Both the FHE layer and the TokenOps layer run in **demo** or **real** mode:

- **Demo (default)** — deterministic local FHE simulation + a faithful TokenOps
  lifecycle simulation. No deployed contract, relayer, API keys, or testnet
  funds required. The full product flow always works.
- **Real** — the Zama Relayer SDK encrypts/decrypts against the deployed
  `ConfidentialCampaign` contract; the `@tokenops/sdk` confidential-airdrop
  rails handle the TokenOps side. Enabled via env vars once deployed.

---

## Getting started

### Prerequisites

- Node.js >= 20
- npm >= 9

### Install

```bash
npm install
```

### Run the web app (demo mode, no setup needed)

```bash
npm run dev
# http://localhost:3000
```

Try it:

1. **/admin** → *Load Demo CSV* → *Create confidential campaign* and watch the
   5-step flow (parse → Zama encrypt → contract submit → TokenOps sync → ready).
2. **/claim** → connect a wallet → *Add my wallet to demo campaign* → decrypt
   your allocation/tier/vesting and claim.
3. **/public-audit/1** → verify public rules while private fields stay locked.

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

Then set the frontend env and enable real mode:

```env
NEXT_PUBLIC_CLOAKOPS_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_ZAMA_MODE=real
NEXT_PUBLIC_TOKENOPS_MODE=real
ZAMA_RELAYER_URL=...
```

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
- **Real-mode frontend** (on-chain writes + relayer encrypt/decrypt) is wired
  and gated behind a deployed contract; demo mode is the default so the
  experience always runs.
- **Roadmap**: confidential ERC-7984 claim transfers via TokenOps rails,
  encrypted vesting schedule enforcement on-chain, multi-admin campaigns,
  on-chain campaign indexing.

## Out of scope (intentionally)

ERC-20↔ERC-7984 wrapper registry, wrap/unwrap UI, payroll, governance,
cross-chain, billing, KYC, and mainnet deployment.

## License

MIT
