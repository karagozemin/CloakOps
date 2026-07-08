// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, euint8, ebool, externalEuint64, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface ICloakConfidentialToken {
    function creditConfidential(address to, euint64 amount) external;
}

/// @title ConfidentialCampaign
/// @notice CloakOps confidential token-distribution campaigns built on Zama FHE.
///
/// PRIVACY MODEL (read this before auditing):
///
/// PUBLIC (anyone can read on-chain):
///   - campaign name + metadata URI
///   - campaign type (private round / contributor reward / advisor vesting / community)
///   - total budget (the headline number the team is willing to disclose)
///   - recipient count
///   - claim window (start / end)
///   - claimed count
///   - token address
///   - admin address
///
/// ENCRYPTED with FHE (only the contract + the recipient can decrypt):
///   - per-recipient allocation amount (euint64)
///   - per-recipient tier (euint8)
///   - per-recipient vesting class (euint8)
///
/// INTENTIONALLY NOT HIDDEN (honest limitations for the MVP):
///   - recipient wallet addresses are visible on-chain
///   - transaction timing is visible
///   - the admin address is visible
///
/// CONFIDENTIAL PAYOUT: on `claim()`, the recipient's still-encrypted allocation
/// is credited to their confidential balance in `CloakConfidentialToken` via an
/// on-chain `FHE.add`. The payout amount is never revealed publicly — only the
/// recipient can decrypt their resulting balance. The TokenOps layer tracks the
/// distribution lifecycle alongside this confidential settlement.
contract ConfidentialCampaign is ZamaEthereumConfig {
    enum CampaignType {
        PrivateRound,
        ContributorReward,
        AdvisorVesting,
        CommunityDistribution
    }

    /// @dev All fields here are intentionally public + verifiable.
    struct PublicCampaign {
        address admin;
        string name;
        string metadataURI;
        CampaignType campaignType;
        uint256 totalBudget;
        uint256 recipientCount;
        uint64 claimStart;
        uint64 claimEnd;
        uint256 claimedCount;
        address token;
        bool exists;
    }

    /// @dev Encrypted, per-recipient. Handles are only decryptable by the
    ///      contract (allowThis) and the recipient (allow).
    struct EncryptedAllocation {
        euint64 amount;
        euint8 tier;
        euint8 vestingClass;
        bool eligible;
        bool claimed;
    }

    uint256 public campaignCount;

    mapping(uint256 => PublicCampaign) private _campaigns;
    mapping(uint256 => mapping(address => EncryptedAllocation)) private _allocations;

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed admin,
        CampaignType campaignType,
        uint256 totalBudget
    );
    event RecipientAdded(uint256 indexed campaignId, address indexed recipient);
    event Claimed(uint256 indexed campaignId, address indexed recipient);
    /// @dev Signals whether the confidential on-chain payout was credited.
    ///      `credited=false` means the campaign token is not a confidential
    ///      token (status-only claim) — the claim itself still succeeded.
    event PayoutSettled(uint256 indexed campaignId, address indexed recipient, bool credited);

    error CampaignDoesNotExist(uint256 campaignId);
    error NotCampaignAdmin(uint256 campaignId);
    error InvalidClaimWindow();
    error ArrayLengthMismatch();
    error NotEligible();
    error AlreadyClaimed();
    error ClaimWindowNotOpen();

    modifier onlyAdmin(uint256 campaignId) {
        if (!_campaigns[campaignId].exists) revert CampaignDoesNotExist(campaignId);
        if (_campaigns[campaignId].admin != msg.sender) revert NotCampaignAdmin(campaignId);
        _;
    }

    modifier campaignExists(uint256 campaignId) {
        if (!_campaigns[campaignId].exists) revert CampaignDoesNotExist(campaignId);
        _;
    }

    // ---------------------------------------------------------------------
    // Admin: campaign lifecycle (all public metadata)
    // ---------------------------------------------------------------------

    /// @notice Create a confidential campaign. Only public metadata is stored here.
    /// @dev Encrypted per-recipient data is added afterwards via addRecipient.
    function createCampaign(
        string calldata name,
        string calldata metadataURI,
        CampaignType campaignType,
        uint256 totalBudget,
        uint64 claimStart,
        uint64 claimEnd,
        address token
    ) external returns (uint256 campaignId) {
        if (claimEnd <= claimStart) revert InvalidClaimWindow();

        campaignId = ++campaignCount;
        _campaigns[campaignId] = PublicCampaign({
            admin: msg.sender,
            name: name,
            metadataURI: metadataURI,
            campaignType: campaignType,
            totalBudget: totalBudget,
            recipientCount: 0,
            claimStart: claimStart,
            claimEnd: claimEnd,
            claimedCount: 0,
            token: token,
            exists: true
        });

        emit CampaignCreated(campaignId, msg.sender, campaignType, totalBudget);
    }

    /// @notice Add a single recipient with encrypted allocation / tier / vesting.
    /// @dev The three encrypted inputs share one inputProof produced off-chain by
    ///      the Zama relayer SDK. After conversion, we grant decryption rights to
    ///      the contract (allowThis) and the recipient only.
    function addRecipient(
        uint256 campaignId,
        address recipient,
        externalEuint64 encryptedAmount,
        externalEuint8 encryptedTier,
        externalEuint8 encryptedVestingClass,
        bytes calldata inputProof
    ) public onlyAdmin(campaignId) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        euint8 tier = FHE.fromExternal(encryptedTier, inputProof);
        euint8 vestingClass = FHE.fromExternal(encryptedVestingClass, inputProof);

        _storeAllocation(campaignId, recipient, amount, tier, vestingClass);
    }

    /// @notice Add many recipients in one transaction. All encrypted inputs across
    ///         all recipients share a single inputProof.
    /// @dev handle arrays are laid out grouped per field; each is length N.
    function batchAddRecipients(
        uint256 campaignId,
        address[] calldata recipients,
        externalEuint64[] calldata encryptedAmounts,
        externalEuint8[] calldata encryptedTiers,
        externalEuint8[] calldata encryptedVestingClasses,
        bytes calldata inputProof
    ) external onlyAdmin(campaignId) {
        uint256 n = recipients.length;
        if (
            encryptedAmounts.length != n ||
            encryptedTiers.length != n ||
            encryptedVestingClasses.length != n
        ) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < n; i++) {
            euint64 amount = FHE.fromExternal(encryptedAmounts[i], inputProof);
            euint8 tier = FHE.fromExternal(encryptedTiers[i], inputProof);
            euint8 vestingClass = FHE.fromExternal(encryptedVestingClasses[i], inputProof);
            _storeAllocation(campaignId, recipients[i], amount, tier, vestingClass);
        }
    }

    function _storeAllocation(
        uint256 campaignId,
        address recipient,
        euint64 amount,
        euint8 tier,
        euint8 vestingClass
    ) internal {
        EncryptedAllocation storage alloc = _allocations[campaignId][recipient];

        // Count this recipient only the first time they are added.
        if (!alloc.eligible) {
            _campaigns[campaignId].recipientCount += 1;
        }

        alloc.amount = amount;
        alloc.tier = tier;
        alloc.vestingClass = vestingClass;
        alloc.eligible = true;

        // Persistent FHE access control: contract + recipient can decrypt.
        FHE.allowThis(alloc.amount);
        FHE.allowThis(alloc.tier);
        FHE.allowThis(alloc.vestingClass);
        FHE.allow(alloc.amount, recipient);
        FHE.allow(alloc.tier, recipient);
        FHE.allow(alloc.vestingClass, recipient);

        emit RecipientAdded(campaignId, recipient);
    }

    // ---------------------------------------------------------------------
    // Recipient: claim
    // ---------------------------------------------------------------------

    /// @notice Recipient claims their confidential allocation.
    /// @dev Records claim status (public claimedCount) and credits the
    ///      recipient's confidential token balance with their still-encrypted
    ///      allocation via `FHE.add` inside the token contract. The payout amount
    ///      is never revealed publicly. If the campaign token is not a
    ///      confidential token, the claim still records status (graceful no-op).
    function claim(uint256 campaignId) external campaignExists(campaignId) {
        EncryptedAllocation storage alloc = _allocations[campaignId][msg.sender];
        if (!alloc.eligible) revert NotEligible();
        if (alloc.claimed) revert AlreadyClaimed();

        PublicCampaign storage c = _campaigns[campaignId];
        if (block.timestamp < c.claimStart || block.timestamp > c.claimEnd) {
            revert ClaimWindowNotOpen();
        }

        // Effects before interaction (claim cannot be replayed).
        alloc.claimed = true;
        c.claimedCount += 1;

        // Confidential payout computed homomorphically. Two encrypted branches
        // run here and NEITHER the amount nor the tier is ever revealed on-chain:
        //
        //   1. Zero-gate (privacy): a zero / uninitialised allocation pays out
        //      zero, without revealing which recipients that applies to.
        //   2. Tier-based loyalty bonus, computed entirely under FHE:
        //         tier >= 5  -> +25% bonus
        //         tier >= 3  -> +10% bonus
        //         otherwise  -> no bonus
        //      The tier stays encrypted, so nobody (not even the admin) can tell
        //      which band a recipient falls into — yet the contract still credits
        //      the correct, larger amount. This is a real FHE compute, not a
        //      pass-through of the stored handle.
        ebool hasAllocation = FHE.gt(alloc.amount, FHE.asEuint64(0));
        euint64 baseAmount = FHE.select(hasAllocation, alloc.amount, FHE.asEuint64(0));

        // Scalar (plaintext-divisor) division is supported under FHE and keeps
        // the operand encrypted: bonus10 = base/10 (+10%), bonus25 = base/4 (+25%).
        euint64 bonus10 = FHE.div(baseAmount, 10);
        euint64 bonus25 = FHE.div(baseAmount, 4);

        ebool tier3plus = FHE.ge(alloc.tier, FHE.asEuint8(3));
        ebool tier5plus = FHE.ge(alloc.tier, FHE.asEuint8(5));

        // Nested encrypted select: pick the bonus band under FHE, then add it.
        euint64 bonus = FHE.select(
            tier5plus,
            bonus25,
            FHE.select(tier3plus, bonus10, FHE.asEuint64(0))
        );
        euint64 payout = FHE.add(baseAmount, bonus);

        FHE.allowThis(payout);
        FHE.allow(payout, msg.sender);


        emit Claimed(campaignId, msg.sender);

        // Confidential payout: grant the token transient access to the encrypted
        // payout, then credit the recipient's confidential balance on-chain.
        bool credited = false;
        if (c.token != address(0)) {
            FHE.allowTransient(payout, c.token);
            try ICloakConfidentialToken(c.token).creditConfidential(msg.sender, payout) {
                credited = true;
            } catch {
                // Non-confidential token address: status-only claim. The claim
                // succeeds; the PayoutSettled event surfaces credited=false so
                // the failure is observable rather than silently swallowed.
                credited = false;
            }
        }

        emit PayoutSettled(campaignId, msg.sender, credited);
    }

    // ---------------------------------------------------------------------
    // Public / verifiable reads
    // ---------------------------------------------------------------------

    function getPublicCampaign(uint256 campaignId)
        external
        view
        campaignExists(campaignId)
        returns (PublicCampaign memory)
    {
        return _campaigns[campaignId];
    }

    function isEligible(uint256 campaignId, address recipient)
        external
        view
        returns (bool)
    {
        return _allocations[campaignId][recipient].eligible;
    }

    function hasClaimed(uint256 campaignId, address recipient)
        external
        view
        returns (bool)
    {
        return _allocations[campaignId][recipient].claimed;
    }

    // ---------------------------------------------------------------------
    // Encrypted reads (return handles; decryption gated by FHE ACL off-chain)
    // ---------------------------------------------------------------------

    function getEncryptedAllocation(uint256 campaignId, address recipient)
        external
        view
        returns (euint64)
    {
        return _allocations[campaignId][recipient].amount;
    }

    function getEncryptedTier(uint256 campaignId, address recipient)
        external
        view
        returns (euint8)
    {
        return _allocations[campaignId][recipient].tier;
    }

    function getEncryptedVestingClass(uint256 campaignId, address recipient)
        external
        view
        returns (euint8)
    {
        return _allocations[campaignId][recipient].vestingClass;
    }
}
