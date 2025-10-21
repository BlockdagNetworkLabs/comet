# Market Configuration Guide

*This document explains how to configure lending markets, asset parameters, and market-specific settings based on the Comet protocol implementation.*

## Overview

Market configuration defines the lending market parameters including supported assets, collateralization factors, supply caps, price feeds, and interest rate models. The configuration is defined in a `configuration.json` file for each market deployment.

## Configuration Structure

### Base Market Configuration

Each market deployment requires a `configuration.json` file in `deployments/{network}/{market}/configuration.json`:

**Core Protocol Settings:**
- `name`: Human-readable name for the protocol instance
- `symbol`: Token symbol for the wrapped base token (e.g., "cDAIv3")
- `baseToken`: Primary asset for borrowing (e.g., USDC, DAI)
- `baseTokenPriceFeed`: Price feed address for base token
- `rewardToken`: Token used for protocol rewards (e.g., "COMP")

**Security Parameters:**
- `pauseGuardian`: (Optional) Address authorized to pause protocol operations. The pause guardian can pause specific protocol functions (supply, transfer, withdraw, absorb, buy) in emergency situations without requiring a full governance proposal. If not specified, the Timelock is set as pauseGuardian by default.

**Borrowing Parameters:**
- `borrowMin`: The minimum base amount required to initiate a borrow (prevents dust borrows)

**Liquidation & Trading Parameters:**
- `storeFrontPriceFactor`: The fraction of the liquidation penalty that goes to buyers of collateral instead of the protocol (controls discount when buying collateral)
- `targetReserves`: The minimum base token reserves which must be held before collateral is held (ensures protocol liquidity)

### Interest Rate Model Configuration

The `rates` section defines the interest rate model parameters:

```json
"rates": {
  "supplyKink": 0.8,
  "supplySlopeLow": 0.0325,
  "supplySlopeHigh": 0.4,
  "supplyBase": 0,
  "borrowKink": 0.8,
  "borrowSlopeLow": 0.035,
  "borrowSlopeHigh": 0.25,
  "borrowBase": 0.015
}
```

**Supply Rate Parameters:**
- `supplyKink`: The point in the supply rates separating the low interest rate slope and the high interest rate slope (utilization threshold where curve changes slope)
- `supplySlopeLow`: Per year supply interest rate slope applied when utilization is below kink
- `supplySlopeHigh`: Per year supply interest rate slope applied when utilization is above kink
- `supplyBase`: Per year supply base interest rate (base rate regardless of utilization)

**Borrow Rate Parameters:**
- `borrowKink`: The point in the borrow rate separating the low interest rate slope and the high interest rate slope
- `borrowSlopeLow`: Per year borrow interest rate slope applied when utilization is below kink
- `borrowSlopeHigh`: Per year borrow interest rate slope applied when utilization is above kink
- `borrowBase`: Per year borrow base interest rate

### Reward Tracking Configuration

The `tracking` section defines reward distribution parameters:

```json
"tracking": {
  "indexScale": "1e15",
  "baseSupplySpeed": "0.000011574074074074073e15",
  "baseBorrowSpeed": "0.0011458333333333333e15",
  "baseMinForRewards": "1000000e6"
}
```

**Reward Parameters:**
- `indexScale`: The scale for reward tracking (precision multiplier for calculations)
- `baseSupplySpeed`: The speed at which supply rewards are tracked (in trackingIndexScale)
- `baseBorrowSpeed`: The speed at which borrow rewards are tracked (in trackingIndexScale)
- `baseMinForRewards`: The minimum amount of base principal wei for rewards to accrue (prevents division overflow)

### Collateral Asset Configuration

For each supported collateral asset in the `assets` section:

```json
"WBTC": {
  "priceFeed": "0x59b670e9fA9D0A427751Af201D676719a970857b",
  "decimals": "8",
  "borrowCF": 0.75,
  "liquidateCF": 0.8,
  "liquidationFactor": 0.85,
  "supplyCap": "7500e8"
}
```

**Asset Parameters:**
- `priceFeed`: Contract address for asset price data (must return 8 decimals)
- `decimals`: Number of decimals for the asset token
- `borrowCF`: Borrow collateral factor - maximum ratio for borrowing against this collateral
- `liquidateCF`: Liquidate collateral factor - threshold for liquidation eligibility
- `liquidationFactor`: Liquidation factor - bonus incentive for liquidators (must be > liquidateCF)
- `supplyCap`: Maximum total supply for this asset (in asset units)

## Example Configuration

Here's a complete example based on the DAI market configuration:

```json
{
  "name": "Compound DAI",
  "symbol": "cDAIv3",
  "baseToken": "DAI",
  "baseTokenPriceFeed": "0x68B1D87F95878fE05B998F19b66F4baba5De1aed",
  "borrowMin": "1000e6",
  "storeFrontPriceFactor": 0.5,
  "targetReserves": "5000000e6",
  "pauseGuardian": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "rates": {
    "supplyKink": 0.8,
    "supplySlopeLow": 0.0325,
    "supplySlopeHigh": 0.4,
    "supplyBase": 0,
    "borrowKink": 0.8,
    "borrowSlopeLow": 0.035,
    "borrowSlopeHigh": 0.25,
    "borrowBase": 0.015
  },
  "tracking": {
    "indexScale": "1e15",
    "baseSupplySpeed": "0.000011574074074074073e15",
    "baseBorrowSpeed": "0.0011458333333333333e15",
    "baseMinForRewards": "1000000e6"
  },
  "rewardToken": "COMP",
  "assets": {
    "WBTC": {
      "priceFeed": "0x59b670e9fA9D0A427751Af201D676719a970857b",
      "decimals": "8",
      "borrowCF": 0.75,
      "liquidateCF": 0.8,
      "liquidationFactor": 0.85,
      "supplyCap": "7500e8"
    },
    "WETH": {
      "priceFeed": "0xc6e7DF5E7b4f2A278906862b61205850344D4e7d",
      "decimals": "18",
      "borrowCF": 0.8,
      "liquidateCF": 0.9,
      "liquidationFactor": 0.95,
      "supplyCap": "11000e18"
    }
  }
}
```

## Pause Guardian

The pause guardian can quickly pause specific protocol operations (supply, transfer, withdraw, absorb, buy) in emergency situations. If `pauseGuardian` is not defined in the configuration, the timelock will be set as the pause guardian, which means it won't be able to act fast in case of emergency due to timelock delays and multisig governance.

Foundry's `cast` tool can be used to call the pause function:

```bash
# Pause supply only
cast send <COMET_ADDRESS> "pause(bool,bool,bool,bool,bool)" true false false false false --rpc-url <RPC_URL> --private-key <PAUSE_GUARDIAN_PRIVATE_KEY>
```

### Price Feed Requirements

Different networks require different price feed configurations:

- **Mock Feeds**: Local development networks use mock price feeds
- **Chainlink**: Production networks typically use Chainlink price feeds

## Related Documentation

- [Network Configuration](./network-configuration.md) - Understanding network-specific requirements
- [Governance System](./governance-system.md) - Making configuration changes through governance
- [Environment Configuration](./environment-configuration.md) - Required setup for configuration
- [Local Development](./local-development.md) - Complete deployment workflow
