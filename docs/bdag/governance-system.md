# BDAG Governance System

*This document describes the custom BDAG governance implementation and how it differs from standard Compound governance.*

## Overview

The BDAG fork implements a custom multisig governance system as an alternative to token-based voting systems, designed specifically for BlockDAG network requirements.

## Governance Architecture

### Custom Governor Implementation

- **Contract**: `contracts/CustomGovernor.sol`
- **Pattern**: Multisig with admin approvals instead of token voting
- **Upgradeability**: UUPS upgradeable for future improvements
- **Interface**: Implements `IGovernorBravo` for compatibility

### Key Differences from Standard Governance

| Feature | Standard Governor Bravo | BDAG Custom Governor |
|---------|------------------------|---------------------|
| **Approval Mechanism** | Token voting | Admin multisig |
| **Threshold** | Token vote count | Admin signature count |
| **Upgradeability** | Upgradeable proxy | UUPS upgradeable |
| **Security Model** | Token holders | Multisig signers |

### Security Considerations

#### Why UUPS over Transparent Proxy:

UUPS was chosen over Transparent Proxy because in Transparent Proxy we would need to choose a proxyAdmin owner, and there is no other admin that can govern the governor. If an EOA controls the proxy admin, all future security would be compromised. UUPS ensures the governor contract itself manages upgrades, maintaining security regardless of who controls the proxy admin.

#### CustomTimelock Integration

The BDAG governance uses a timelock where:

- **Governor**: Encodes function signatures in calldata
- **Timelock**: Executes pre-encoded calldata directly

The repository already included `SimpleTimelock` and `Timelock` contracts, but we created a custom `CustomTimelock` implementation for the following reasons:

**SimpleTimelock Limitations:**
- The absence of a `setDelay` function - changing the delay was not an option
- Limited flexibility for governance parameter adjustments

**Timelock Limitations:**
- The absence of a `setAdmin` function
- The timelock owns/manages several contracts such as the Configurator contract. Consider the case where a new governor needs to be set. In this scenario, the new governor contract could use a different Timelock. However, if the current Timelock is abandoned, the Configurator contract and others that are managed by this Timelock would need to be updated. Therefore, the simplest approach is to keep the Timelock and provide a function to set the admin of the Timelock to a new governor.

**CustomTimelock Benefits:**
- Includes `setDelay` function for governance parameter flexibility
- Includes `setAdmin` function to allow governor transitions without contract migration
- Avoids the complexity of transferring ownership of multiple managed contracts
- Maintains stable governance while enabling necessary administrative changes

## Protocol Governance

The governance of the protocol starts immediately after deployment. You can read more about the protocol deployment process in **[Local Development Guide](./local-development.md#understanding-the-deployment-process)**.

Before deployment, developers need to configure the governance system with the appropriate parameters. Let's understand how this setup works by examining the deployment structure.

### Governance Configuration Setup

The BDAG implementation uses a structured approach to governance configuration. Each deployment environment includes an `_infrastructure` folder to manage the deployment of all shared contracts used across multiple markets.

#### Infrastructure Contracts Deployed

The infrastructure deployment includes the following core contracts:

**Governance Contracts:**
- **`CustomGovernor`** - UUPS upgradeable multisig governance contract
- **`CustomTimelock`** - Time-delayed execution contract for proposal enforcement
- **`COMP`** - Governance token (used for compatibility, not voting)

**Shared Protocol Contracts:**
- **`CometProxyAdmin`** - Shared proxy admin for all Comet instances and Configurator
- **`Configurator`** - Protocol configuration management contract
- **`ConfiguratorProxy`** - Proxy for the configurator implementation
- **`CometFactory`** - Factory contract for deploying new Comet markets
- **`CometRewards`** - Shared rewards distribution contract

**Contract Relationships:**
- The `CustomTimelock` owns and manages the `CometProxyAdmin`
- The `CustomTimelock` owns and manages the `Configurator`
- The `CustomTimelock` owns and manages the `CometRewards`
- The `CustomGovernor` controls the `CustomTimelock` as its admin
- All contracts are designed to work together as a cohesive governance system


#### Configuration File Structure

The `_infrastructure` folder contains a `configuration.json` file that defines all governance parameters:

```json
{
    "governorAdmins": [
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", 
        "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
    ],
    "multisigThreshold": 2,
    "timelockDelay": 60,
    "gracePeriod": 1209600,
    "minimumDelay": 0,
    "maximumDelay": 2592000
}
```

#### Configuration Parameters Explained

| Parameter | Description | Purpose |
|-----------|-------------|---------|
| **`governorAdmins`** | Array of admin addresses | Defines the multisig signers who can create proposals and vote |
| **`multisigThreshold`** | Number of required approvals | Minimum number of admins that must approve a proposal before it can be queued |
| **`timelockDelay`** | Delay in seconds | Time that must pass between queuing and executing a proposal |
| **`gracePeriod`** | Grace period in seconds | Maximum time a queued proposal can wait before expiring (2 weeks = 1,209,600 seconds) |
| **`minimumDelay`** | Minimum allowed delay | Lower bound for the timelock delay (0 for development, higher for production) |
| **`maximumDelay`** | Maximum allowed delay | Upper bound for the timelock delay (30 days = 2,592,000 seconds) |

### Governing the Protocol

Once the governance system is deployed and configured, the protocol can be governed through the following process:

#### 1. Proposal Creation
- Any admin can create proposals for protocol changes
- Proposals can include multiple actions (upgrades, parameter changes, etc.)
- Each proposal is assigned a unique ID and stored on-chain

#### 2. Multisig Approval
- Admins vote on proposals using the `castVote` function
- Once `multisigThreshold` approvals are reached, the proposal can be queued
- The proposal state changes from "Active" to "Succeeded"

#### 3. Queue and Execute
- An admin queues the proposal, which schedules execution after `timelockDelay`
- After the delay period, any admin can execute the proposal
- All proposal actions execute atomically (all succeed or all fail)

### Scripts to Govern the Protocol

The BDAG governance system includes a comprehensive set of scripts located in `scripts/governor/` that facilitate the entire governance lifecycle. These scripts provide a user-friendly interface for managing proposals, approvals, and execution.

#### Core Governance Scripts

**1. Proposal Creation Scripts (`scripts/governor/propose/`)**
- **`market-phase-1/`** - Deploy new market or a new implementation of an existent market
- **`market-phase-2/`** - Accept the proposal created in the phase 1 to leave a fully integrated market in the protocol
- **`governance-update/`** - Propose governance configuration changes (admins, threshold, timelock delay)
- **`comet-reward-funding/`** - Propose funding for CometRewards with COMP tokens

**2. Proposal Management Scripts**
- **`accept-proposal/`** - Approve proposals (multisig voting)
- **`queue-proposal/`** - Queue approved proposals for execution
- **`execute-proposal/`** - Execute queued proposals after timelock delay

**3. Testing and Verification Scripts**
- **`test-governor-setup/`** - Verify governance configuration deployment
- **`test-market-setup/`** - Test market deployment configurations

#### Usage Examples

**Creating a New Market Proposal:**
```bash
yarn ts-node scripts/governor/propose/market-phase-1/index.ts --network local --deployment usdc
```

**Approving a Proposal:**
```bash
yarn ts-node scripts/governor/accept-proposal/index.ts --network local --proposal-id 5
```

**Queuing a Proposal:**
```bash
yarn ts-node scripts/governor/queue-proposal/index.ts --network local --proposal-id 5
```

**Executing a Proposal:**
```bash
yarn ts-node scripts/governor/execute-proposal/index.ts --network local --proposal-id 5 --execution-type comet-upgrade
```

**Funding Comet Rewards:**
```bash
yarn ts-node scripts/governor/propose/comet-reward-funding/index.ts --network local
```

#### Execution Types for Log Parsing

The `execute-proposal` script is a **generic execution script** that can handle different types of governance proposals. Because it's designed to be versatile and work with various proposal categories, it requires an `--execution-type` flag to specify what type of proposal is being executed. This flag determines how transaction logs are parsed and displayed for each specific proposal category.

**Available Execution Types:**
- **`comet-impl-in-configuration`** - For Comet implementation deployments and configuration updates
- **`comet-upgrade`** - For Comet contract upgrades and implementation changes
- **`governance-update`** - For governance configuration changes (admins, threshold, timelock delay)
- **`comet-reward-funding`** - For CometRewards funding proposals with COMP tokens

**Why Execution Types Matter:**
- **Log Parsing**: Each type parses different contract events and function calls
- **Error Detection**: Specific error patterns are checked based on the execution type
- **Success Validation**: Different success criteria are applied for each proposal category
- **User Feedback**: Tailored output messages and status indicators for each type

**Examples by Proposal Type:**
```bash
# Market phase 1
--execution-type comet-impl-in-configuration

# Market phase 2
--execution-type comet-upgrade

# Governance parameter changes
--execution-type governance-update

# Reward funding
--execution-type comet-reward-funding
```

## Admin Usage Prerequisites

Before using the governance scripts, admins need to set up their environment, see [Environment Configuration Section](./environment-configuration.md)

**Required Changes:**
- **`ETH_PK`**: Replace with your actual private key for admin operations


