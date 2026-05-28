// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, euint8, externalEuint64, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

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
/// OUT OF SCOPE for v1: this contract does not custody or transfer real tokens.
/// It is the confidential *campaign metadata + claim* layer. Distribution rails
/// (actual token movement) are handled off this contract via the TokenOps layer.
/// `claim()` records confidential claim status; wiring it to a confidential
/// ERC-7984 transfer is the documented mainnet roadmap item.
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

    /// @notice Recipient marks their confidential allocation as claimed.
    /// @dev v1 records claim status only (no token custody). claimedCount is public.
    function claim(uint256 campaignId) external campaignExists(campaignId) {
        EncryptedAllocation storage alloc = _allocations[campaignId][msg.sender];
        if (!alloc.eligible) revert NotEligible();
        if (alloc.claimed) revert AlreadyClaimed();

        PublicCampaign storage c = _campaigns[campaignId];
        if (block.timestamp < c.claimStart || block.timestamp > c.claimEnd) {
            revert ClaimWindowNotOpen();
        }

        alloc.claimed = true;
        c.claimedCount += 1;

        emit Claimed(campaignId, msg.sender);
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
