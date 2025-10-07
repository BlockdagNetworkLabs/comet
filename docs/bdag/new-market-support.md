# Adding New Market Support to BDAG Comet

This guide explains how to add a new asset/market to an existing blockchain network in the BDAG Comet project. This is simpler than adding a new network since the infrastructure already exists.

## Overview

Adding a new market to an existing network requires:

1. **Hardhat Configuration Updates** - Add the new market to deployment manager
2. **Market-Specific Files** - Create asset configuration and deployment files
3. **No Infrastructure Changes** - Reuse existing governance and admin contracts

## Step-by-Step Guide

### 1. Update Hardhat Configuration (`hardhat.config.ts`)

#### 1.1 Add Relations Import

Import your new market's relations configuration:

```typescript
// Add this import with other relation imports
import yourNewMarketRelationConfigMap from './deployments/existing-network/your-new-asset/relations';
```

#### 1.2 Add to Deployment Manager Configuration

Add your new market to the existing network in the `deploymentManager.networks` section:

```typescript
deploymentManager: {
  relationConfigMap,
  networks: {
    // ... existing networks
    'existing-network': {
      '_infraestructure': existingInfrastructureRelationConfigMap,
      'existing-asset': existingAssetRelationConfigMap,
      'your-new-asset': yourNewMarketRelationConfigMap  // Add this line
    }
  }
}
```

### 2. Create Market-Specific Files

Create the following directory structure under `deployments/existing-network/`:

```
deployments/
└── existing-network/
    ├── _infrastructure/ (already exists)
    ├── existing-asset/ (already exists)
    └── your-new-asset/ (create this)
        ├── aliases.json
        ├── configuration.json
        ├── deploy.ts
        ├── relations.ts
        └── roots.json
```

### 3. Create Market-Specific Files

#### 3.1 Asset Configuration File (`your-new-asset/configuration.json`)

Create a configuration file based on existing network configurations. See [market-configuration.md](./market-configuration.md) for details.

#### 3.2 Asset Relations File (`your-new-asset/relations.ts`)

Copy the asset relations from `deployments/local/dai/relations.ts`.

#### 3.3 Asset Deploy Script (`your-new-asset/deploy.ts`)

Copy the asset deploy script from `deployments/local/dai/deploy.ts` and modify it if needed. In this script, you will configure whether to deploy new tokens or use existing tokens on the network.

#### 3.4 Asset Roots File (`your-new-asset/roots.json`)

Create a roots file with deployed contract addresses:

```json
{
  "comet": "0x...",
  "configurator": "0x...",
  "rewards": "0x...",
  "bulker": "0x..."
}
```

### 4. Testing Your New Market

After adding market support:

1. **Compile contracts**: `npx hardhat compile`
2. **Run tests**: `npx hardhat test --network existing-network`
3. **Deploy**: `npx hardhat deploy --network existing-network`
4. **Verify contracts**: `npx hardhat verify --network existing-network`

## Key Differences from New Network

- ✅ **No infrastructure setup** - Reuse existing `_infrastructure/` directory
- ✅ **No network configuration** - Network already exists in hardhat.config.ts
- ✅ **Simpler process** - Only need to add one new asset directory
- ✅ **Faster deployment** - No need to deploy governance contracts

## Examples

### Existing Market Patterns

- **Base Network**: See `deployments/base/` for multiple assets (usdbc, weth, usdc, aero, usds)
- **Arbitrum Network**: See `deployments/arbitrum/` for multiple assets (usdc.e, usdc, usdt, weth)
- **Mainnet**: See `deployments/mainnet/` for multiple assets (usdc, weth, usdt, wsteth, usds, wbtc)

## Best Practices

1. **Follow Naming Conventions**: Use consistent naming for asset directories
2. **Reuse Existing Patterns**: Base your configuration on similar existing assets
3. **Test Thoroughly**: Always test deployments before mainnet
4. **Security Review**: Have market-specific configurations reviewed for security

## Support

For questions or issues with adding new market support:

1. Check existing market implementations for reference
2. Review the deployment manager plugin documentation
3. Consult the project's technical documentation
4. Reach out to the development team for assistance
