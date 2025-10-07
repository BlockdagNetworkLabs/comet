# Environment Configuration

*This document details the required environment variables and API keys for BlockDAG development.*

## Overview

The BlockDAG environment requires specific environment variables for deployment and testing. The setup is straightforward and can be done by copying the [Environment template](../../.env.example) and updating the required values.


## Setup Environment file

Copy the environment template file and update only the required values:

```bash
# Copy the example file
cp .env.example .env

# Edit the .env file and update your private key
# Change ETH_PK=your_private_key_here to your actual private key
ETH_PK=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

## Required Environment Variables

### API Keys

These next API key variables are required for contract verification and mainnet contract cloning and hardhat expects to be set, if you are not using some of them, you can set them to placeholder values. Check the [Environment example](../../.env.example) for more information.
- **ETHERSCAN_KEY**
- **SNOWTRACE_KEY**
- **INFURA_KEY**
- **ANKR_KEY**
- **POLYGONSCAN_KEY**
- **ARBISCAN_KEY**
- **LINEASCAN_KEY**
- **OPTIMISMSCAN_KEY**
- **MANTLESCAN_KEY**
- **SCROLLSCAN_KEY**
- **UNICHAIN_QUICKNODE_KEY**

### Local Chain Id

If running locally, you can use LOCAL_CHAIN_ID=1337 for hardhat or LOCAL_CHAIN_ID=31337 for anvil

## Related Documentation

- [Quick Start Guide](./quick-start.md) - Initial setup overview
- [Local Development](./local-development.md) - Complete deployment workflow
- [Network Configuration](./network-configuration.md) - Network-specific settings
