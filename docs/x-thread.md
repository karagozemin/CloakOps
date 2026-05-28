# X Thread — CloakOps

A ready-to-post thread for the submission. ~8 tweets.

---

**1/**
Token teams put their cap table on-chain by accident.

Every round, reward, and vesting grant publishes who got what — biggest
allocation, top tier, advisor terms, claim timing. All public.

We built CloakOps to fix that. 🧵

**2/**
CloakOps is a **confidential campaign layer for TokenOps**, built on @zama_fhe.

Private allocations. Public rules. TokenOps execution.

Allocation amounts, tiers, and vesting stay encrypted on-chain — budgets and
rules stay publicly verifiable.

**3/**
Why FHE and not "just encryption"?

Because you still need to run claim logic and prove campaign totals *on-chain*.

Fully Homomorphic Encryption lets the contract hold ciphertext and enforce a
per-recipient access list: only YOU can decrypt your allocation.

**4/**
The admin uploads allocations as a CSV. Amounts, tiers, and vesting are
encrypted client-side with Zama before they ever touch the chain.

Then a 5-step flow runs:
parse → encrypt → contract submit → TokenOps sync → ready.

**5/**
This is where TokenOps is central, not decorative.

CloakOps creates the TokenOps campaign, syncs recipients, and prepares a
confidential distribution operation — with live connection status + an operation
log surfaced right in the product.

**6/**
As a recipient, you connect your wallet and decrypt *only your own* allocation,
tier, and vesting class.

No admin, observer, or other recipient is on the FHE access-control list for
your values. Then you claim.

**7/**
And anyone can audit the campaign: total budget, recipient count, claim window,
claimed count — all public and verifiable.

Every individual allocation stays locked. Public rules, private deals, side by
side. ✅

**8/**
Contract compiles + tested (FHEVM mock mode), Sepolia-ready deploy scripts, and
a polished Next.js app that runs the full flow today.

Built for the @zama_fhe Builder Track + the TokenOps Special Bounty.

Private allocations. Public rules. TokenOps execution.

[repo link] [demo link]

---

### Notes
- Replace `[repo link]` / `[demo link]` and confirm the correct handles
  (`@zama_fhe`, TokenOps) before posting.
- Attach the 3-minute video to tweet 1 and a screenshot of the public-audit
  split to tweet 7.
