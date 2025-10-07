# Adding New Network Support to BDAG Comet

This guide explains how to add support for a new blockchain network to the BDAG Comet project. Adding a new network requires modifications to the Hardhat configuration and the creation of network-specific deployment files.

## Overview

The BDAG Comet project supports multiple blockchain networks through a structured deployment system. Each network requires:

1. **Hardhat Configuration Updates** - Network definition and RPC endpoints
2. **Relations Import** - Network-specific contract relationship mappings
3. **Deployment Structure** - Network-specific deployment configurations and scripts

## Step-by-Step Guide

### 1. Update Hardhat Configuration (`hardhat.config.ts`)

#### 1.1 Add Network Configuration

Add your new network to the `networkConfigs` array:

```typescript
const networkConfigs: NetworkConfig[] = [
  // ... existing networks
  {
    network: 'your-new-network',
    chainId: 12345, // Replace with actual chain ID
    url: `https://rpc.ankr.com/your-network/${ANKR_KEY}`, // Or custom RPC URL
  },
];
```

#### 1.2 Add Etherscan Configuration

Add your network to the `etherscan.apiKey` section:

```typescript
etherscan: {
  customChains: [
    // ... existing custom chains
    {
      network: 'your-new-network',
      chainId: 12345,
      urls: {
        apiURL: 'https://api.yournetwork.com/api',
        browserURL: 'https://yournetwork.com/'
      }
    }
  ]
}
```

#### 1.3 Add Relations Import

Import your network's relations configuration at the top of the file:

```typescript
// Add this import with other relation imports
import networkInfraestructureRelationConfigMap from './deployments/your-network/_infraestructure/relations';
import networkAssetRelationConfigMap from './deployments/your-network/your_asset/relations';
```

#### 1.5 Add to Deployment Manager Configuration

Add your network to the `deploymentManager.networks` section:

```typescript
deploymentManager: {
  relationConfigMap,
  networks: {
    // ... existing networks
    'your-new-network': {
      '_infraestructure': networkInfraestructureRelationConfigMap,
      'your-asset': networkAssetRelationConfigMap
    }
  }
}
```

### 2. Create Network Deployment Structure

Create the following directory structure under `deployments/` following the local deployment pattern:

```
deployments/
└── your-new-network/
    ├── _infrastructure/
    │   ├── aliases.json
    │   ├── configuration.json
    │   ├── deploy.ts
    │   ├── relations.ts
    │   └── roots.json
    ├── your-asset/
    │   ├── aliases.json
    │   ├── configuration.json
    │   ├── deploy.ts
    │   ├── relations.ts
    │   └── roots.json
```

### 3. Create Network-Specific Files

#### 3.1 Infrastructure Configuration (`_infrastructure/configuration.json`)

Create the infrastructure configuration file for base contracts. See [governance-system.md](./governance-system.md) for details.

#### 3.2 Infrastructure Relations (`_infrastructure/relations.ts`)

Copy the infrastructure relations from `deployments/local/_infrastructure/relations.ts`.

#### 3.3 Infrastructure Deploy Script (`_infrastructure/deploy.ts`)

Copy the infrastructure deploy script from `deployments/local/_infrastructure/deploy.ts` and modify it if needed.

#### 3.4 Asset-Specific Files

For creating the asset-specific files (`configuration.json`, `relations.ts`, `deploy.ts`, `roots.json`), see [new-market-support.md](./new-market-support.md) for detailed instructions.