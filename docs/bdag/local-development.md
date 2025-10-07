# Local Development Guide

*This document provides comprehensive guidance for local BlockDAG development, including environment setup, testing, deployment, and understanding the deployment process.*

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

# Edit .env and configure your private key
# ETH_PK=your_private_key_here
```

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

Refer to the [Testing Guide](./testing-guide.md) for more information on running tests.

## Deploying Markets Locally

### Quick Start Deployment

The automated deployment script handles the complete flow including infrastructure, market deployment, governance proposals, and verification:

```bash
# Start Anvil first (in separate terminal)
anvil

# Deploy DAI market (automated with confirmations)
./scripts/deployer/deploy-markets/index.sh -n local -d dai

# Deploy with auto-confirmation (non-interactive)
yes | ./scripts/deployer/deploy-markets/index.sh -n local -d dai -c
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

### What the Deployment Script Does

The automated script performs these steps:

1. **Builds the project** - Compiles contracts
2. **Clears proposal stack** - Resets governance queue
3. **Deploys infrastructure** - Governor, Timelock, COMP token
4. **Prompts for configuration** - Asks you to update `configuration.json`
5. **Deploys market(s)** - Deploys Comet implementations
6. **Creates governance proposals** - Proposes market additions
7. **Runs governance flow** - Approve, queue, execute proposals
8. **Proposes upgrades** - Upgrades to new implementations
9. **Funds rewards** - Transfers COMP to CometRewards
10. **Runs verification** - Tests deployment validity

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

#### 5. Verification & Caching
- Contract verification (when applicable)
- Cache storage for future deployments
- Logging of deployment statistics and gas usage

### Contract Cloning Mechanism

For efficiency, some contracts are cloned from Ethereum mainnet:

```typescript
const clone = {
  comp: '0xc00e94cb662c3520282e6f5717214004a7f26888',
  governorBravoImpl: '0xef3b6e9e13706a8f01fe98fdcf66335dc5cfdeed',
  governorBravo: '0xc0da02939e1441f497fd74f78ce7decb17b66529',
};
```

**What Gets Cloned:**
- Contract bytecode and storage layout
- Constructor arguments and initial state
- Verification data for compatibility

**Note**: This requires `ETHERSCAN_KEY` in your `.env` file.

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

Before deploying markets, you need to configure two files:

**1. Infrastructure Configuration** (`deployments/{network}/_infrastructure/configuration.json`):
```json
{
  "governorAdmins": ["0x...", "0x...", "0x..."],
  "multisigThreshold": 2,
  "timelockDelay": 60,
  "gracePeriod": 1209600,
  "minimumDelay": 0,
  "maximumDelay": 2592000
}
```

**2. Market Configuration** (`deployments/{network}/{market}/configuration.json`):
```json
{
  "baseToken": "USDC",
  "baseTokenPriceFeed": "0x...",
  "trackingIndexScale": "1e6",
  "assets": [...]
}
```

For detailed configuration guidance, see [Market Configuration](./market-configuration.md).

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

**Example Governance Flow:**
```bash
# 1. Create a market proposal
./scripts/governor/propose/market-phase-1/index.sh -n local -d dai
# Output: Proposal ID: 1

# 2. Approve the proposal
./scripts/governor/accept-proposal/index.sh -n local -p 1

# 3. Queue the proposal
./scripts/governor/queue-proposal/index.sh -n local -p 1

# 4. Execute the proposal
./scripts/governor/execute-proposal/index.sh -n local -p 1 -t comet-impl-in-configuration
```

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

### Interactive Console

```bash
# Connect to Anvil for interactive contract interaction
yarn hardhat console --network local
```

### Deployment Verification

```bash
# Verify specific market deployment
./scripts/governor/test-market-setup/index.sh -n local -d dai

# Verify governance configuration
./scripts/governor/test-governor-setup/index.sh -n local
```

### Spider Tool

The Spider tool discovers and maps contract relationships:

```bash
# Refresh contract relationships for a market
yarn hardhat spider --network local --deployment dai
```

**What Spider Does:**
- Discovers deployed contracts
- Maps contract relationships
- Updates `roots.json` and `aliases.json`
- Validates contract configurations

### Gas Reporting

```bash
# Run tests with detailed gas usage
REPORT_GAS=true yarn hardhat test
```

### Debug Logging

```bash
# Enable debug output for deployment
DEBUG=* yarn hardhat deploy --network local --deployment dai --bdag
```

## Deployment Caching System

### Cache Structure

The deployment system uses caching to avoid re-deploying existing contracts:

```
deployments/{network}/{deployment}/.contracts/
├── cache.json          # Contract addresses and metadata
├── governor.json       # Governor contract details
├── comet.json         # Comet contract details
├── configurator.json  # Configurator contract details
└── ...                # Other deployed contracts
```

### Cache Behavior

1. **First Deployment**: Contracts are deployed and cached
2. **Subsequent Runs**: Contracts are loaded from cache
3. **Tests**: Use cached contract addresses automatically

### Cache Management

```bash
# Check if contracts are cached
ls deployments/local/dai/.contracts/

# View cached contract addresses
cat deployments/local/dai/.contracts/cache.json

# Clear cache to force re-deployment (for a specific market)
rm -rf deployments/local/dai/.contracts/

# Clear all deployment cache for network
rm -rf deployments/local/*/.contracts/
rm -rf deployments/local/*/aliases.json
rm -rf deployments/local/*/roots.json
```

### Using the Clean Flag

The deployment script provides a `--clean` flag for convenience:

```bash
# Automatically clears cache before deployment
./scripts/deployer/deploy-markets/index.sh -n local -d dai -c
```

### Cache Benefits

- **Faster Development**: No need to re-deploy for each test
- **Consistent State**: Tests use same contract instances
- **Cost Savings**: Avoid unnecessary gas costs
- **Team Consistency**: Share deployment state across team members

### BlockDAG-Specific Considerations

Unlike standard networks, BlockDAG networks don't have block explorer APIs yet:

- **Manual Cache Management**: Contract addresses must be committed to repository
- **Team Consistency**: All team members need access to same contract instances
- **Deployment Preservation**: Cache files preserve contract state across repository clones

For more details, see [Deployment Caching](./deployment-caching.md).

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

### Common Issues

**1. "Contract already deployed" Error**

Clear the deployment cache:
```bash
./scripts/deployer/deploy-markets/index.sh -n local -d dai -c
```

**2. "Insufficient Funds" Error**

Ensure Anvil is running and your account has ETH:
```bash
# Check Anvil is running on default port
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://127.0.0.1:8545
```

**3. "Proposal Already Queued" Error**

Clear the proposal stack:
```bash
yarn hardhat governor:clear-stack --network local
```

**4. Tests Failing After Deployment**

Ensure you're using Hardhat network for tests (no --network flag):
```bash
# Correct - uses Hardhat network
yarn hardhat test

# Incorrect - don't specify network for tests
yarn hardhat test --network local
```

For more troubleshooting, see [Troubleshooting Guide](./troubleshooting.md).

## Related Documentation

- [Quick Start Guide](./quick-start.md) - Fast-track setup
- [Environment Configuration](./environment-configuration.md) - API keys and environment setup
- [Market Configuration](./market-configuration.md) - Configuring market parameters
- [Governance System](./governance-system.md) - Understanding BDAG governance
- [Testing Guide](./testing-guide.md) - Comprehensive testing documentation
- [Deployment Caching](./deployment-caching.md) - Deep dive into caching system
- [Troubleshooting](./troubleshooting.md) - Solutions to common issues
