# Deployment Caching

*This document explains how the deployment caching system works and its implications for BlockDAG development.*

## Overview

The BlockDAG deployment system uses caching to avoid re-deploying existing contracts, improving development efficiency and ensuring consistency across team members.

## Cache Structure

### Cache Location
```
deployments/{network}/{deployment}/.contracts/
├── [contract_address1].json
├── [contract_address2].json
├── [contract_address3].json
├── ...
```

### Cache Behavior
1. **First Deployment**: Contracts are deployed and cached
2. **Subsequent Runs**: Contracts are loaded from cache

## BlockDAG-Specific Considerations

### No Explorer APIs
Unlike standard networks, BlockDAG networks don't have block explorer APIs yet, which means:

- **Manual Cache Management**: Contract addresses must be committed to repository
- **Team Consistency**: All team members need access to same contract instances
- **Deployment Preservation**: Cache files preserve contract state across repository clones

### Cache Management

Clear the cache before deploying a new market using the -c/ --clean flag (recommended):
```bash
./scripts/deploy-markets/index.sh -n local -d dai -c
```
Or manually clear the cache:
```bash
rm -rf deployments/local/dai/.contracts/
```

## Benefits

- **Faster Development**: No need to re-deploy for each test
- **Consistent State**: Tests use same contract instances
- **Cost Savings**: Avoid unnecessary gas costs on real networks

## The Spider System

### What is Spider?

Spider is an automated contract discovery system that "crawls" through your deployed contracts to map out all relationships and dependencies. Think of it as a web crawler that follows links between contracts.

### How Spider Works

1. **Starting from Roots**: Spider begins with "root" contracts (like `comet`, `configurator`, `governor`) that are stored in the cache
2. **Following Relations**: It reads contract methods to discover related contracts (e.g., `comet.baseTokenPriceFeed()`)
3. **Building the Map**: Spider creates a complete map of all contracts and their relationships
4. **Caching Results**: All discovered contracts are cached with human-readable aliases

### The Crawling Process

```typescript
// Example: Spider discovers contracts like this:
comet (root)
├── baseToken → USDC (via comet.baseToken())
├── baseTokenPriceFeed → USDC:priceFeed (via comet.baseTokenPriceFeed())
├── assets[0] → WETH (via comet.getAssetInfo(0))
├── assets[1] → WBTC (via comet.getAssetInfo(1))
├── cometAdmin → ProxyAdmin (via storage slot)
│   └── timelock → Timelock (via cometAdmin.owner())
│       └── governor → Governor (via timelock.admin())
└── comet:implementation → CometImpl (via proxy storage slot)
```

### Relation Configuration

Spider uses relation configurations defined in `deployments/relations.ts` and `deployments/relations.bdag.ts`:

```typescript
// Example from relations.bdag.ts
comet: {
  delegates: {
    field: { slot: '0x360894a...' }  // Find implementation via proxy pattern
  },
  relations: {
    baseToken: {
      alias: async (token) => token.symbol(),  // Name it by symbol (e.g., "USDC")
    },
    assets: {
      field: async (comet) => {
        // Discover all collateral assets
        const n = await comet.numAssets();
        return Promise.all(
          Array(n).fill(0).map((_, i) => 
            (await comet.getAssetInfo(i)).asset
          )
        );
      },
      alias: async (token) => token.symbol(),  // "WETH", "WBTC", etc.
    }
  }
}
```

### When Spider Runs

Spider automatically runs:
- **After deployments**: To discover newly deployed contracts
- **Before tests**: To load contract addresses for testing
- **On demand**: Via `yarn hardhat spider --deployment dai`

### Spider Cache Output

Spider stores discovered contracts in:
```
deployments/{network}/{deployment}/
├── .contracts/[contract_address].json      # Contract addresses and metadata
├── aliases.json               # Human-readable name → address mapping
└── roots.json                 # Starting points for spider
```

### Example Aliases Output
```json
{
  "comet": "0x5FbDB...",
  "USDC": "0x9A9f...",
  "USDC:priceFeed": "0x7B8f...",
  "WETH": "0x4C5D...",
  "WETH:priceFeed": "0x8E2A...",
  "configurator": "0x1F3E...",
  "governor": "0x6D7C..."
}
```

## Deployment Manager

### What is Deployment Manager?

The Deployment Manager is the central orchestrator for all deployment operations. It manages:
- **Contract Deployment**: Deploying new contracts with proper configuration
- **Caching**: Reading/writing contract data to disk
- **Spidering**: Discovering contract relationships
- **Verification**: Verifying contracts on block explorers (when available)
- **Migrations**: Running governance migrations

### Key Responsibilities

1. **Cache Management**
   - Loads existing contract addresses from cache
   - Saves newly deployed contracts
   - Manages cache invalidation

2. **Contract Discovery (via Spider)**
   - Runs spider to discover all related contracts
   - Builds contract map for easy access in tests/scripts
   - Maintains alias mappings

### Usage in Code

```typescript
// Creating a DeploymentManager instance
const dm = new DeploymentManager(
  'local',              // network
  'dai',                // deployment name
  hre,                  // Hardhat Runtime Environment
  {
    writeCacheToDisk: true,
    verificationStrategy: 'lazy'
  }
);

// Running deployment script
await dm.runDeployScript({ allMissing: true });

// Running spider to discover contracts
await dm.spider();

// Accessing contracts
const comet = await dm.contract('comet');
const usdc = await dm.contract('USDC');
```

### How It Works Together

1. **Deploy**: Deployment Manager runs deployment scripts
2. **Cache**: New contracts are saved to `.contracts/[contract_address].json`
3. **Spider**: Spider discovers relationships and creates aliases

```bash
# Full workflow example
yarn hardhat deploy --network local --deployment dai
# → Deployment Manager deploys contracts
# → Contracts cached in deployments/local/dai/.contracts/
# → Spider runs automatically to discover relationships
# → Aliases saved in deployments/local/dai/aliases.json
# → Ready for testing!
```

## Related Documentation

- [Local Development](./local-development.md) - Complete deployment workflow with caching details
- [Troubleshooting](./troubleshooting.md) - Common caching issues
