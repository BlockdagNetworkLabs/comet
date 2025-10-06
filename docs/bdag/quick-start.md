# Quick Start Guide

*This document provides a quick overview of getting started with BlockDAG development.*

## Prerequisites

- Node.js and Yarn installed
- Git access to the repository
- Basic understanding of Ethereum/blockchain development

## Overview of Process

1. **Environment Setup** - Configure API keys and environment variables
2. **Local Testing** - Deploy and test on local network

## Quick Commands

### Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Install dependencies
yarn install
yarn build
```

### Network Deployment

```bash
# Start anvil in a different terminal
anvil
```

```bash
# Deploy with BDAG governor
 yes | ./scripts/deployer/deploy-markets/index.sh -n local -d dai -c
```