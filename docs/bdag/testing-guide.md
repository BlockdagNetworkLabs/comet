# Testing Guide

*This document provides comprehensive testing procedures and validation workflows for BlockDAG development.*

## Overview

The project includes extensive testing capabilities that unit test all components of the protocol.

For BlockDAG, we included specific unit tests to ensure the CustomGovernor is working as expected. This test can be found at: `test/governance/custom-governor-test.ts`

Similarly, we added `proposal-manager.test.ts` to test the batching of proposals, a custom logic that was created and used during the protocol deployment. This test can be found in `test/governance/proposal-manager.test.ts`

Finally, we added E2E tests to ensure the custom logic regarding the deployment of the protocol and how it's governed is working as expected through the scripts we developed. These tests can be found in: `./e2e/deployment-verification-test.ts` and `./e2e/protocol-governance-test.ts`


## Already built

The project includes 40+ test files covering all protocol functionality including supply, withdraw, liquidation, governance, bridges, and more.

### Run all tests
```bash
yarn hardhat test --network local
```

### Run specific tests using grep
```bash
# Run tests matching a pattern
yarn hardhat test --network local --grep "supply"
yarn hardhat test --network local --grep "governance"
yarn hardhat test --network local --grep "liquidation"
yarn hardhat test --network local --grep "rewards"
yarn hardhat test --network local --grep "price"
```

## Custom unit tests for BlockDAG

BlockDAG has implemented custom unit tests to validate the specific governance and deployment logic that extends the standard Comet protocol.

### CustomGovernor Tests
```bash
# Run CustomGovernor tests
yarn hardhat test test/governance/custom-governor-test.ts --network local

```

**What it tests:**
- Proposal creation and submission
- Voting mechanisms and threshold validation
- Timelock integration and execution
- Multisig operations (2 out of 3 admins)
- Proposal state transitions
- Access control and permissions

### Proposal Manager Tests
```bash
# Run proposal manager tests
yarn hardhat test test/governance/proposal-manager.test.ts --network local

# Test specific market configurations
export MARKET=dai && yarn hardhat test test/governance/proposal-manager.test.ts --network local
```

**What it tests:**
- Proposal batching logic
- Custom deployment procedures
- Configuration validation
- Market-specific parameter setting

## E2E tests

End-to-end tests validate complete protocol deployment and governance workflows to ensure all components work together correctly.

### Deployment Verification Tests
```bash
# Run deployment verification
yarn hardhat test e2e/deployment-verification-test.ts --network local

# Test specific market deployments
export MARKET=dai && yarn hardhat test e2e/deployment-verification-test.ts --network local
```

**What it tests:**
- Ownership relationships (timelock admin, comet governor, proxy admin)
- Base token configuration (token address, price feed)
- Asset configurations (supply caps, collateral factors, price feeds)
- Custom governor setup

### Protocol Governance E2E Tests
```bash
# Run complete governance workflow test
yarn hardhat test e2e/protocol-governance-test.ts

# Test with specific template
export E2E_TEMPLATE="_template-1" && yarn hardhat test e2e/protocol-governance-test.ts

# Test in specific chain
export E2E_CHAIN_ID="1043" && E2E_RPC_URL="https://node-blockdag.spacedev.io/rpc" && yarn hardhat test e2e/protocol-governance-test.ts
```

**What it tests:**
- Complete protocol deployment from scratch
- Proposal creation and submission
- Voting mechanisms and threshold validation
- Timelock operations and execution
- Multisig coordination and approval


**Configuration:**
Before running E2E tests, you need to configure the following environment variables:
```bash
# Test deployer (can be anyone)
export TEST_PK="your_test_private_key"

# Test admin private keys (must match the governor admins of the current network)
export TEST_ADMIN_PKS="admin1_pk,admin2_pk,admin3_pk"
```

**Important**: The `TEST_ADMIN_PKS` should match the governor admins of the current network, while the `TEST_PK` (deployer) can be anyone.



## Related Documentation

- [Local Development](./local-development.md) - Setting up local testing environment
- [Deployment Process](./deployment-process.md) - Testing after deployment
- [Network Configuration](./network-configuration.md) - Testing across different networks
