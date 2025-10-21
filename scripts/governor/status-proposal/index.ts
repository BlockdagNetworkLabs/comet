#!/usr/bin/env ts-node

import { GovernanceFlowHelper } from '../../helpers/governanceFlow';
import { log } from '../../helpers/ioUtil';

interface StatusProposalOptions {
  network: string;
  proposalId: string;
}

class ProposalStatusChecker {
  private options: StatusProposalOptions;
  private governanceFlow: GovernanceFlowHelper;

  constructor(options: StatusProposalOptions) {
    this.options = options;
    this.governanceFlow = new GovernanceFlowHelper();
  }

  public async checkStatus(): Promise<void> {
    try {
      log(`\n🔍 Checking status of proposal ${this.options.proposalId} on ${this.options.network}`, 'info');
      
      // Use the governance flow helper to check the proposal status
      const result = await this.governanceFlow.getProposalStatus({
        network: this.options.network,
        proposalId: this.options.proposalId
      });
      
      log(`\n✅ Status check completed!`, 'success');
      log(`📋 Status result:`, 'info');
      log(result, 'info');
      
    } catch (error) {
      log(`\n❌ Failed to check proposal status: ${error}`, 'error');
      log(`\n💡 Troubleshooting tips:`, 'info');
      log(`   - Check your .env file has all required API keys`, 'info');
      log(`   - Verify network configuration in hardhat.config.ts`, 'info');
      log(`   - Check that all dependencies are installed (yarn install)`, 'info');
      log(`   - Verify the proposal ID exists on the specified network`, 'info');
      log(`   - Ensure you have RPC access to the network`, 'info');
      process.exit(1);
    }
  }
}

// Parse command line arguments
function parseArguments(): StatusProposalOptions {
  const args = process.argv.slice(2);
  const options: StatusProposalOptions = {
    network: '',
    proposalId: ''
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--network':
        options.network = args[++i];
        break;
      case '--proposal-id':
        options.proposalId = args[++i];
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
🎯 Check Proposal Status Script

Usage: yarn ts-node scripts/governor/status-proposal/index.ts [options]

Options:
  --network <network>           Network to use (required)
  --proposal-id <id>           Proposal ID to check (required)

  --help, -h                   Show this help message

Examples:
  # Check status of proposal 1 on local network
  yarn ts-node scripts/governor/status-proposal/index.ts --network local --proposal-id 1

  # Check status of proposal 5 on polygon network
  yarn ts-node scripts/governor/status-proposal/index.ts --network polygon --proposal-id 5

  # Check status of proposal 10 on mainnet
  yarn ts-node scripts/governor/status-proposal/index.ts --network mainnet --proposal-id 10

Available networks: local, hardhat, mainnet, polygon, arbitrum, optimism, base, etc.

Features:
  - Uses the governor:status command to check proposal status
  - Shows detailed proposal information including state, approvals, and timing
  - Provides clear feedback on proposal status
  - Includes comprehensive error handling and troubleshooting tips
  - Shows next steps based on current state

Note: This script provides read-only information and does not modify the proposal.
  `);
}

// Main execution
async function main(): Promise<void> {
  const options = parseArguments();
  
  if (!options.network || !options.proposalId) {
    console.error('❌ Network and proposal ID are both required');
    showHelp();
    process.exit(1);
  }

  const checker = new ProposalStatusChecker(options);
  await checker.checkStatus();
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

export { ProposalStatusChecker, StatusProposalOptions };

