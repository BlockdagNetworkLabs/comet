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
```

**You can use LOCAL_CHAIN_ID=1337 for hardhat or LOCAL_CHAIN_ID=31337 for anvil**

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
 yes | ./scripts/deployer/deploy-markets/index.sh -n local -d dai -c
```