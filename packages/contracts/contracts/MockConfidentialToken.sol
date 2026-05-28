// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockConfidentialToken
/// @notice A plain mock ERC-20 used only as the "campaign token" address in demos
///         and tests. CloakOps does NOT move confidential amounts through this
///         token — the confidential layer lives in ConfidentialCampaign.sol.
/// @dev Exists so the admin flow has a real token address to reference and so
///      tests have a deployable token. On mainnet this slot would be a confidential
///      ERC-7984 token managed via the TokenOps distribution rails.
contract MockConfidentialToken is ERC20 {
    uint8 private immutable _decimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply
    ) ERC20(name_, symbol_) {
        _decimals = decimals_;
        _mint(msg.sender, initialSupply);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Open faucet-style mint for testnet demos only.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
