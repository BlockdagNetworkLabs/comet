# Quick Start Guide

*This document provides a quick overview of getting started with BlockDAG development.*

## Prerequisites

- Node.js and Yarn installed
- Git access to the repository
- Basic understanding of Ethereum/blockchain development

## Overview of Process

1. **Environment Setup** - Configure API keys and environment variables
2. **Deploy Comet Protocol** - Deploy the protocol locally

## Quick Commands

### Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit the .env file and update your private key
# Change ETH_PK=your_private_key_here to your actual private key
ETH_PK=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
LOCAL_CHAIN_ID=1337|31337 #depending if using hardhat or anvil local networks
```

```bash
# Install dependencies
yarn install
yarn build
```

### Network Deployment

```bash
# Start anvil in a different terminal
anvil
```

or

```bash
# Start hardhat in a different terminal
yarn hardhat node
```

```bash
# Deploy with BDAG governor
 yes | ./scripts/deployer/deploy-markets/index.sh -n local -d all -c
```