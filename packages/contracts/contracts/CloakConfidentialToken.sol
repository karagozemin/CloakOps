// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title CloakConfidentialToken
/// @notice A minimal confidential-balance token (ERC-7984-style) used as the
///         claim payout asset for CloakOps campaigns. Balances are stored as
///         encrypted `euint64` handles: only the contract and the account owner
///         can decrypt a balance.
///
/// @dev When a recipient claims, `ConfidentialCampaign` calls
///      `creditConfidential` with the recipient's (still-encrypted) allocation.
///      The credit is computed on-chain with `FHE.add`, so the payout amount is
///      never revealed publicly — the running balance stays confidential and is
///      only decryptable by its owner.
///
///      This is a testnet/demo asset: any caller may credit (faucet-style). On
///      mainnet, `creditConfidential` would be gated to authorized distributor
///      contracts.
contract CloakConfidentialToken is ZamaEthereumConfig {
    string public name;
    string public symbol;
    uint8 public constant decimals = 6;

    /// @dev Encrypted balances. Each handle is ACL-gated to the contract + owner.
    mapping(address => euint64) private _balances;

    event ConfidentialCredit(address indexed from, address indexed to);

    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
    }

    /// @notice Credit `to` with an encrypted `amount`. The caller must have
    ///         granted this contract access to `amount` (e.g. via
    ///         `FHE.allowTransient` in the same transaction).
    function creditConfidential(address to, euint64 amount) external {
        euint64 current = FHE.isInitialized(_balances[to])
            ? _balances[to]
            : FHE.asEuint64(0);

        euint64 newBalance = FHE.add(current, amount);
        _balances[to] = newBalance;

        // Persistent ACL: contract can keep computing, owner can decrypt.
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, to);

        emit ConfidentialCredit(msg.sender, to);
    }

    /// @notice Returns the encrypted balance handle for `account`. Decryption is
    ///         gated off-chain by the FHE ACL (only the owner can decrypt).
    function confidentialBalanceOf(address account) external view returns (euint64) {
        return _balances[account];
    }
}
