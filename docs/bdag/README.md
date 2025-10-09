# BlockDAG Development Guide

Welcome to the BlockDAG fork of Compound Comet. This documentation provides comprehensive guides for deploying, testing, and configuring lending markets on the BlockDAG network.

## Documentation Overview

### 📋 Development Guides
- **[Local Development](./local-development.md)** - Complete local development workflow and deployment process
- **[Environment Configuration](./environment-configuration.md)** - Required environment variables and API keys
- **[New Network Support](./new-network-support.md)** - Adding support for a new blockchain network
- **[New Market Support](./new-market-support.md)** - Adding a new asset/market to an existing network
- **[Market Configuration](./market-configuration.md)** - Configuring lending market parameters

### 🧪 Testing
- **[Testing Guide](./testing-guide.md)** - Running tests and validation procedures

### 🔧 Governance & Configuration
- **[Governance System](./governance-system.md)** - Custom BDAG governor implementation

### 📚 Advanced Topics
- **[Deployment Caching](./deployment-caching.md)** - Understanding the caching system
- **[Spider Tool](./spider-tool.md)** - Contract discovery and management

## Automated Scripts

We provide automated scripts for common operations:

### 🚀 Deployment Scripts
- **[Deploy Markets](../../scripts/deployer/deploy-markets/)** - Automated market deployment

### 🏛️ Governance Scripts

#### Proposal Creation
- **[Market Phase 1 Proposal](../../scripts/governor/propose/market-phase-1/)** - Create phase 1 market deployment proposal
- **[Market Phase 2 Proposal](../../scripts/governor/propose/market-phase-2/)** - Create phase 2 market deployment proposal
- **[Comet Reward Funding Proposal](../../scripts/governor/propose/comet-reward-funding/)** - Propose reward funding
- **[Governance Update Proposal](../../scripts/governor/propose/governance-update/)** - Propose governance parameter changes

#### Proposal Management
- **[Accept Proposal](../../scripts/governor/accept-proposal/)** - Accept/approve governance proposals
- **[Queue Proposal](../../scripts/governor/queue-proposal/)** - Queue proposals for execution
- **[Execute Proposal](../../scripts/governor/execute-proposal/)** - Execute approved proposals

#### Testing & Validation
- **[Test Governor Setup](../../scripts/governor/test-governor-setup/)** - Validate governor configuration
- **[Test Market Setup](../../scripts/governor/test-market-setup/)** - Validate market setup

## Troubleshooting

- **[Common Issues](./troubleshooting.md)** - Solutions to frequently encountered problems

## Contact & Support

For questions, issues, or contributions related to BlockDAG-specific features:
- Technical questions: [Create an issue](../../issues)
- Development discussions: [Pull Request discussions](../../pulls)

---

*This documentation is specific to the BlockDAG fork and supplements the original [Compound Comet documentation](../README.md).*
