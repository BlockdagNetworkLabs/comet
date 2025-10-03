#!/usr/bin/env ts-node
import { log } from '../../../helpers/ioUtil';
import { proposeGovernanceUpdate as proposeGovernanceUpdateCommand, extractProposalId } from '../../../helpers/commandUtil';

interface GovernanceUpdateOptions {
  network: string;
}

export class GovernanceUpdater {
  private options: GovernanceUpdateOptions;

  constructor(options: GovernanceUpdateOptions) {
    this.options = options;
  }


  private async proposeGovernanceUpdate(): Promise<string> {
    const output = await proposeGovernanceUpdateCommand(
      this.options.network
    );
    
    return extractProposalId(output);
  }

  public async run(): Promise<string> {
    try {
      log(`\n🚀 Starting Governance Update Process`, 'info');
      log(`Network: ${this.options.network}`, 'info'); 

      const proposalId = await this.proposeGovernanceUpdate();
      
      console.log(`Successfully created proposal! 📋 Proposal ID: ${proposalId}`,'success')
      
      return proposalId;
      
    } catch (error) {
      log(`\n❌ Governance update proposal process failed: ${error}`, 'error');
      throw error;
    }
  }
}

// Parse command line arguments
function parseArgs(): GovernanceUpdateOptions {
  const args = process.argv.slice(2);
  let network = 'local';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--network':
        network = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
🔧 Governance Update Proposal Script

Usage: yarn ts-node scripts/governor/propose/governance-update/index.ts [options]

Options:
  --network <network>      Network to use (default: local)
  --help, -h              Show this help message

Examples:
  # Create a governance update proposal on local network
  yarn ts-node scripts/governor/propose/governance-update/index.ts --network local

  # Create a governance update proposal on polygon network
  yarn ts-node scripts/governor/propose/governance-update/index.ts --network polygon

Note: This script creates a governance proposal to update governance configuration.
The actual update will occur after the proposal goes through the governance process.
        `);
        process.exit(0);
    }
  }

  return { network };
}

// Main execution
async function main() {
  const options = parseArgs();
  const updater = new GovernanceUpdater(options);
  await updater.run();
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}
