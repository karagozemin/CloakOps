# 3-Minute Video Script — CloakOps

**Format:** real-person on camera + screen recording of the live dApp.
**Goal:** show a real confidential token-distribution product on Zama FHE with
TokenOps at the center. Tone: confident, product-led, concrete.

---

## 0:00 – 0:25 — Hook & problem (on camera)

> "When a token team raises a round or rewards contributors, they put it
> on-chain — and accidentally publish everyone's deal. Anyone can see who got
> the biggest allocation, which advisor got the sweetest terms, who's top-tier.
> That's a real confidentiality problem, and normal encryption can't fix it,
> because you still need to run claim logic and prove totals on-chain."

(Cut to a block explorer showing transparent transfers / vesting amounts.)

## 0:25 – 0:45 — Solution & positioning (on camera + title card)

> "This is CloakOps — a confidential campaign layer for TokenOps, built on
> Zama's FHE. Private allocations. Public rules. TokenOps execution.
> Allocation amounts, tiers, and vesting stay encrypted on-chain. Budgets and
> rules stay publicly verifiable."

(Title card: CloakOps — Private allocations. Public rules. TokenOps execution.)

## 0:45 – 1:35 — Admin flow (screen recording)

> "Here's the admin dashboard. I'll load our demo campaign — 'AI x Crypto Seed
> Contributors', one million tokens across investors, advisors, and
> contributors."

(Click **Load Demo CSV**. Recipients table appears with gold locks on every
allocation, tier, and vesting value.)

> "Notice the gold locks — those values get encrypted client-side with Zama
> before anything touches the chain. Now I create the confidential campaign."

(Click **Create confidential campaign**. Narrate the 5-step flow as it runs.)

> "Step by step: the CSV is validated, the allocations are encrypted with Zama
> FHE, the confidential contract is submitted, and — this is the TokenOps part —
> we write directly to the same confidential vesting factory the TokenOps
> dashboard uses: it deploys a vesting wallet per stakeholder and funds each one
> with the browser-encrypted amount, batched so the signature count stays fixed."

(Point to the TokenOps panel: mode, connection, operation log entries.)

> "And this is real, not a mock — I'll click the TokenOps vesting link, which
> opens the actual funding transaction on Etherscan. You can see one
> `VestingWalletConfidentialFunded` event per stakeholder — real wallets,
> deployed and funded with encrypted amounts."

(Click the campaign's **TokenOps vesting** link → Etherscan tx → highlight the
`VestingWalletConfidentialFunded` events on the factory.)

## 1:35 – 2:15 — Recipient claim (screen recording)

> "Now I'm a recipient. I connect my wallet on the claim page."

(Go to **/claim**, connect wallet, click **Add my wallet to demo campaign**.)

> "My allocation, tier, and vesting class are all encrypted — I can't see anyone
> else's, and no one can see mine. I decrypt my own values..."

(Click **Decrypt** on each field; values reveal.)

> "...only my wallet is on the FHE access-control list for these handles. Then I
> claim."

(Click **Claim allocation**; status flips to Claimed.)

## 2:15 – 2:45 — Public audit (screen recording)

> "And here's the trust part. Anyone can open the public audit page and verify
> the campaign: total budget, recipient count, claim window, how many have
> claimed. But every individual allocation and tier stays locked. Public rules,
> private deals — provable, side by side."

(Show **/public-audit/1**: public fields vs the explicit encrypted-fields list,
recipients ledger with addresses visible but amounts locked.)

## 2:45 – 3:00 — Close (on camera)

> "CloakOps brings confidential campaign operations to TokenOps with Zama FHE.
> The contract compiles and is tested, the app is deploy-ready for Sepolia, and
> the whole flow runs today. Private allocations, public rules, TokenOps
> execution. Thanks for watching."

(End card: CloakOps · Zama Builder Track · TokenOps Special Bounty · repo link.)

---

### Shot list / b-roll
- Block explorer with visible transfer amounts (problem).
- Admin: Load Demo CSV → locks → 5-step flow → TokenOps log.
- Etherscan: funding tx with one `VestingWalletConfidentialFunded` per stakeholder.
- Claim: connect → decrypt three fields → claim.
- Public audit: public vs encrypted split, recipients ledger.

### Key phrases to land
- "Private allocations. Public rules. TokenOps execution."
- "Encrypted with Zama FHE — only the recipient can decrypt."
- "TokenOps is the distribution rail; CloakOps adds the confidential layer."
