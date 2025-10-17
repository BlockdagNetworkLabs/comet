# Local Development Guide

*This document provides comprehensive guidance for local Mercury (Compound Comet v3) development on BlockDAG, including environment setup, testing, deployment, and understanding the deployment process.*

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Running a Local Blockchain](#running-a-local-blockchain)
4. [Running Tests](#running-tests)
5. [Deploying Markets Locally](#deploying-markets-locally)
6. [Understanding the Deployment Process](#understanding-the-deployment-process)
7. [Deployment Scripts Reference](#deployment-scripts-reference)
8. [Debugging and Development Tools](#debugging-and-development-tools)
9. [Deployment Caching System](#deployment-caching-system)

## Prerequisites

- Node.js and Yarn installed
- Foundry (For Anvil) or Hardhat installed
- Git access to the repository
- Basic understanding of Ethereum/blockchain development
- Familiarity with command-line tools

## Initial Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd comet

# Install dependencies
yarn install

# Build the project
yarn build

# Verify setup
yarn hardhat compile
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env and configure required variables
# ETH_PK=your_private_key_here
# LOCAL_CHAIN_ID=31337  # for Anvil, or 1337 for Hardhat
```

**Required Environment Variables:**

The project requires the following API keys (can use placeholders if not needed):
- `ETHERSCAN_KEY`, `SNOWTRACE_KEY`, `INFURA_KEY`, `ANKR_KEY`
- `POLYGONSCAN_KEY`, `ARBISCAN_KEY`, `LINEASCAN_KEY`, `OPTIMISMSCAN_KEY`
- `MANTLESCAN_KEY`, `SCROLLSCAN_KEY`, `UNICHAIN_QUICKNODE_KEY`

**Required:**
- `ETH_PK` - Your private key for deployment operations
- `LOCAL_CHAIN_ID` - `31337` for Anvil or `1337` for Hardhat

For detailed environment configuration, see [Environment Configuration](./environment-configuration.md).

## Running a Local Blockchain

### Using Anvil (Recommended for Deployments)

Anvil provides a local Ethereum node with persistent state, ideal for testing deployments:

```bash
# Start Anvil in a separate terminal
anvil
```

Anvil will:
- Create test accounts with pre-funded ETH
- Provide instant block mining
- Maintain state between deployments
- Listen on `http://127.0.0.1:8545` by default

### Using Hardhat Network (For Tests)

Hardhat automatically uses its built-in network when running tests:

```bash
# Tests run on Hardhat's network automatically
yarn hardhat test
```

**Key Differences:**
- **Hardhat Network**: Ephemeral, used for automated testing, no explicit network specification needed
- **Anvil**: Persistent, used for local deployments, requires `--network local` flag

## Running Tests

Mercury includes 40+ test files covering all protocol functionality including supply, withdraw, liquidation, governance, and custom BlockDAG features (CustomGovernor, Proposal Manager, E2E deployment verification).

**Quick Start:**
```bash
# Run all tests
yarn hardhat test

# Run specific test pattern
yarn hardhat test --grep "governance"
```

For comprehensive testing documentation including E2E tests, custom tests, and configuration, see [Testing Guide](./testing-guide.md).

## Deploying Markets Locally

### Quick Start Deployment

The automated deployment script handles the complete flow including infrastructure, market deployment, governance proposals, and verification:

```bash
# Start Anvil first (in separate terminal)
anvil

# Deploy DAI market (automated with confirmations)
./scripts/deployer/deploy-markets/index.sh -n local -d dai

# Deploy with auto-confirmation (non-interactive)
./scripts/deployer/deploy-markets/index.sh -n local -d dai -c -y
```

### Deployment Options

```bash
# Deploy single market
./scripts/deployer/deploy-markets/index.sh -n local -d dai

# Deploy multiple markets at once
./scripts/deployer/deploy-markets/index.sh -n local -d dai,usdc,weth

# Deploy with clean cache (removes existing artifacts)
./scripts/deployer/deploy-markets/index.sh -n local -d dai -c

# Deploy all available markets
./scripts/deployer/deploy-markets/index.sh -n local -d all
```

For more information on how to add new networks or markets, check the respective documentation:
- [Adding New Network Support](./new-network-support.md)
- [Adding New Market Support](./new-market-support.md)

### What the Deployment Script Does

The automated script performs these steps:

1. **Builds the project** - Compiles contracts
2. **Clears proposal stack** - Resets governance queue to avoid conflicts
3. **Deploys infrastructure** - Governor, Timelock, COMP token and other shared contracts
4. **Prompts for configuration** - Asks you to update `configuration.json`
5. **Deploys market(s)** - Deploys Comet implementations
6. **Proposes Market upgrades** - Upgrades markets to new implementations
7. **Funds rewards** - Transfers COMP to CometRewards
8. **Runs Deployment verification** - Tests deployment validity

## Understanding the Deployment Process

### Deployment Architecture

The BlockDAG deployment system consists of several layers:

```
Deployment Scripts (bash wrappers)
    ↓
TypeScript Scripts (logic layer)
    ↓
Hardhat Tasks (deployment primitives)
    ↓
DeploymentManager (contract management)
    ↓
Blockchain (Anvil/Network)
```

### Deployment Execution Flow

#### 1. Task Registration & Loading
- Hardhat loads task definitions from `tasks/deployment_manager/task.ts`
- Command line arguments are parsed: `network`, `deployment`, `bdag` flag
- Environment and network configuration is established

#### 2. DeploymentManager Initialization
- Creates DeploymentManager instance with network and deployment parameters
- Establishes deployment cache for contract reuse
- Sets up contract discovery and relationship mapping

#### 3. Deployment Script Execution
- Loads appropriate `deployments/{network}/{deployment}/deploy.ts` script
- Imports and executes the deployment function
- Handles governance contract cloning (COMP token, Governor implementation)

#### 4. Contract Deployment Sequence

**Phase 1: Infrastructure Deployment**
1. **Governance Contracts**: Deploy CustomGovernor, CustomTimelock, COMP token
2. **Shared Protocol Contracts**: Deploy CometProxyAdmin, Configurator, CometFactory, CometRewards

**Phase 2: Market Deployment**
1. **Token Deployment**: Deploy market tokens (DAI, USDC, etc.) if needed
2. **Price Feed Setup**: Configure asset price feeds
3. **Comet Implementation**: Deploy Comet implementation contract
4. **Governance Proposal**: Create proposal to add implementation to configuration

**Phase 3: Market Activation**
1. **Governance Approval**: Approve the proposal (multisig voting)
2. **Queue Proposal**: Queue proposal for execution
3. **Execute Proposal**: Execute after timelock delay
4. **Upgrade Proposal**: Create and execute upgrade to new implementation

**Phase 4: Rewards & Verification**
1. **Fund Rewards**: Transfer COMP tokens to CometRewards
2. **Verify Deployment**: Run automated verification tests

**Note**: When executing the deploy-markets script, for multiple markets, the script will use the [Proposal Service](../../src/governor/services/ProposalService.ts) to create batched proposals for the market implementations and upgrades. This means that the script will create a single proposal for all the market implementations and upgrades, and then execute it.

#### 5. Verification & Caching
- Contract verification (when applicable)
- Cache storage for future deployments
- Logging of deployment statistics and gas usage

### Infrastructure vs Market Deployment

**Infrastructure** (`_infrastructure` folder):
- Deployed **once per network**
- Contains shared contracts: Governor, Timelock, COMP, CometFactory, CometRewards
- Configuration in `deployments/{network}/_infrastructure/configuration.json`

**Market** (e.g., `dai`, `usdc` folders):
- Deployed **per market**
- Contains market-specific: Comet implementation, market configuration
- Configuration in `deployments/{network}/{market}/configuration.json`

### Configuration Files

Before deploying markets, configure two key files:

**1. Infrastructure Configuration** (`deployments/{network}/_infrastructure/configuration.json`):
- Governor admins and multisig threshold
- Timelock delay and grace period settings

**2. Market Configuration** (`deployments/{network}/{market}/configuration.json`):
- Protocol settings (name, symbol, base token)
- Interest rate models (`rates` section)
- Reward tracking (`tracking` section)
- Collateral assets with price feeds and risk parameters

For complete configuration examples and detailed parameter explanations, see:
- [Market Configuration](./market-configuration.md) - Configuring market parameters
- [Governance System](./governance-system.md) - Infrastructure configuration

## Deployment Scripts Reference

### Market Deployment Scripts

Located in `scripts/deployer/deploy-markets/`:

**Main Script:**
- `index.sh` - Bash wrapper for user-friendly interface
- `index.ts` - TypeScript implementation with full deployment logic

**Usage:**
```bash
./scripts/deployer/deploy-markets/index.sh [options]

Options:
  -n, --network <network>     Network to deploy to (default: local)
  -d, --deployment <market>   Market(s) to deploy
  -c, --clean                 Clean deployment cache before deploying
  -h, --help                  Show help message
```

### Governance Scripts

Located in `scripts/governor/`:

**Proposal Creation** (`propose/`):
- `market-phase-1/` - Deploy new market implementation
- `market-phase-2/` - Propose upgrade to new implementation
- `comet-reward-funding/` - Propose CometRewards funding
- `governance-update/` - Propose governance parameter changes

**Proposal Management:**
- `accept-proposal/` - Approve proposals (multisig voting)
- `queue-proposal/` - Queue approved proposals
- `execute-proposal/` - Execute queued proposals

**Testing & Verification:**
- `test-governor-setup/` - Verify governance configuration
- `test-market-setup/` - Verify market deployment

**Governance Proposal Workflow:**

Mercury's governance follows a structured workflow with clear states:

**Proposal States:**
- **Pending**: Proposal created, waiting for approvals
- **Approved**: Multisig threshold reached, queued in Timelock
- **Queued**: In timelock delay period
- **Executable**: Delay passed, ready for execution
- **Executed**: Successfully executed on-chain

**Example: Deploy New Market**
```bash
# Phase 1: Deploy market implementation
./scripts/governor/propose/market-phase-1/index.sh -n local -d wbtc
# Output: Proposal ID: 1

# Phase 2: Approve, queue, and execute implementation
./scripts/governor/accept-proposal/index.sh -n local -p 1
./scripts/governor/queue-proposal/index.sh -n local -p 1
./scripts/governor/execute-proposal/index.sh -n local -p 1 -t comet-impl-in-configuration

# Phase 3: Propose upgrade to new implementation
./scripts/governor/propose/market-phase-2/index.sh -n local -d wbtc -i <IMPLEMENTATION_ADDRESS>
# Output: Proposal ID: 2

# Phase 4: Approve, queue, and execute upgrade
./scripts/governor/accept-proposal/index.sh -n local -p 2
./scripts/governor/queue-proposal/index.sh -n local -p 2
./scripts/governor/execute-proposal/index.sh -n local -p 2 -t comet-upgrade

# Verify market setup
./scripts/governor/test-market-setup/index.sh -n local -d wbtc
```

**Execution Types:**
- `comet-impl-in-configuration` - For market implementation deployments (Phase 1)
- `comet-upgrade` - For market upgrades (Phase 2)
- `governance-update` - For governance configuration changes
- `comet-reward-funding` - For CometRewards funding proposals

### Manual Deployment (Advanced)

If you need fine-grained control, you can use Hardhat tasks directly:

**Infrastructure Deployment:**
```bash
yarn hardhat deploy_infrastructure --network local --bdag
```

**Market Deployment:**
```bash
yarn hardhat deploy --network local --deployment dai --bdag
```

**Governance Commands:**
```bash
# Check proposal status
yarn hardhat governor:status --network local --proposal-id 1

# Approve proposal
yarn hardhat governor:approve --network local --proposal-id 1

# Queue proposal
yarn hardhat governor:queue --network local --proposal-id 1

# Execute proposal
yarn hardhat governor:execute --network local --proposal-id 1 --execution-type comet-impl-in-configuration
```

## Debugging and Development Tools

**Interactive Console:**
```bash
yarn hardhat console --network local
```

**Deployment Verification:**
```bash
./scripts/governor/test-market-setup/index.sh -n local -d dai
./scripts/governor/test-governor-setup/index.sh -n local
```

**Spider Tool** (contract discovery and relationship mapping):
```bash
yarn hardhat spider --network local --deployment dai
```

**Debugging:**
```bash
# Gas reporting
REPORT_GAS=true yarn hardhat test

# Debug logging
DEBUG=* yarn hardhat deploy --network local --deployment dai --bdag
```

## Deployment Caching System

Mercury uses deployment caching to avoid re-deploying existing contracts, improving development efficiency and ensuring consistency.

**Quick Cache Management:**
```bash
# Deploy with clean cache (recommended for fresh start)
./scripts/deployer/deploy-markets/index.sh -n local -d dai -c

# Manually clear specific market cache
rm -rf deployments/local/dai/.contracts/
```

**Cache Location:** `deployments/{network}/{deployment}/.contracts/`

For detailed caching behavior, benefits, and BlockDAG-specific considerations, see [Deployment Caching](./deployment-caching.md).

## Local Development Best Practices

### 1. Always Start Fresh with Anvil

```bash
# Kill any existing Anvil instances
pkill anvil

# Start fresh Anvil instance
anvil
```

### 2. Use Clean Deployments When Needed

```bash
# Use -c flag when you want a complete fresh start
./scripts/deployer/deploy-markets/index.sh -n local -d dai -c
```

### 3. Run Verification After Deployment

```bash
# Always verify your deployment
./scripts/governor/test-market-setup/index.sh -n local -d dai
```

### 4. Test Before Mainnet

Always test your configurations locally before deploying to real networks:

```bash
# Test locally first
./scripts/deployer/deploy-markets/index.sh -n local -d usdc

# Then deploy to real network
./scripts/deployer/deploy-markets/index.sh -n bdag-primordial -d usdc
```

### 5. Keep Configuration Files Updated

Always update your `configuration.json` files with correct:
- Price feed addresses
- Asset configurations
- Supply caps
- Collateral factors

## Troubleshooting

**Common Quick Fixes:**

```bash
# Clear deployment cache
./scripts/deployer/deploy-markets/index.sh -n local -d dai -c

# Clear proposal stack
yarn hardhat governor:clear-stack --network local

# Check Anvil is running
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://127.0.0.1:8545
```

For comprehensive troubleshooting including deployment failures, governance issues, and network problems, see [Troubleshooting Guide](./troubleshooting.md).

## Related Documentation

- [Environment Configuration](./environment-configuration.md) - API keys and environment setup
- [Market Configuration](./market-configuration.md) - Configuring market parameters
- [Governance System](./governance-system.md) - Understanding BDAG governance
- [Testing Guide](./testing-guide.md) - Comprehensive testing documentation
- [Deployment Caching](./deployment-caching.md) - Deep dive into caching system
- [Troubleshooting](./troubleshooting.md) - Solutions to common issues
