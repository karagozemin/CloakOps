# Privacy Model

CloakOps is explicit and honest about what is private, what is public, and what
is intentionally not hidden in this MVP. Over-claiming privacy is worse than
being precise about it.

## What is encrypted (Zama FHE)

Per recipient, stored as ciphertext handles on `ConfidentialCampaign.sol`:

| Field | FHE type | Who can decrypt |
| --- | --- | --- |
| Allocation amount | `euint64` | the recipient only |
| Tier | `euint8` | the recipient only |
| Vesting class | `euint8` | the recipient only |

Decryption authorization is enforced on-chain by the FHE access-control list:

```solidity
FHE.allowThis(alloc.amount);          // the contract can compute on it
FHE.allow(alloc.amount, recipient);   // only this recipient can decrypt it
```

No admin, observer, or other recipient is on the ACL for someone else's values.
The role label is an off-chain private annotation shown only to its recipient
(not stored on-chain in v1).

## What is public and verifiable

Stored as plaintext on-chain, readable by anyone:

- Campaign name and metadata URI
- Campaign type (private round / contributor reward / advisor vesting / community)
- **Total budget** — the headline figure the team chooses to disclose
- Recipient count
- Claim window (start / end)
- Claimed count
- Token address
- Admin address

This is deliberate: the public can audit that a campaign exists, how big it is,
how many recipients it has, and how many have claimed — **without learning any
individual's deal**.

## What is intentionally NOT hidden (honest limitations)

- **Recipient wallet addresses** are visible on-chain. Hiding the recipient set
  would require additional techniques (e.g. stealth addresses / nullifier sets)
  out of scope for this MVP.
- **Transaction timing** is visible — when a recipient was added or claimed.
- **The admin address** is visible.

We surface these limitations directly in the product (footer + public audit
page) so judges and users are never misled.

## Why FHE and not "just encryption"

A normal encrypted blob would force every read or claim check through an
off-chain decryption oracle and could not be verified on-chain. With FHE, the
contract holds ciphertext, the access-control list governs who can decrypt, and
the recipient performs client-side `userDecrypt` via the Zama relayer. The
campaign rules (totals, counts, windows) stay public and trustlessly
verifiable while the sensitive numbers stay private.

## Boundary with TokenOps

The confidential layer never hands plaintext per-recipient allocations to the
TokenOps adapter. `syncRecipients` receives **addresses and counts only**.
Encrypted allocation handles live exclusively on `ConfidentialCampaign.sol`.
This preserves the "private allocations, public rules" guarantee across the
integration boundary.

## Dual-mode and the demo

In **demo mode**, encryption is simulated locally: values produce opaque random
handles and the cleartext is recoverable only through the demo provider, gated
in the UI by wallet ownership — faithfully reproducing the "only the recipient
can decrypt" guarantee without a deployed contract or relayer. In **real mode**,
the Zama Relayer SDK performs genuine encryption and user decryption against the
deployed contract. The privacy semantics are identical; only the cryptographic
backend differs.
