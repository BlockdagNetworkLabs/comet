#!/usr/bin/env ts-node

import { runGovernanceFlow, GovernanceFlowOptions } from '../../../helpers/governanceFlow';
import { log } from '../../../helpers/ioUtil';
import { proposeGovernanceUpdate as proposeGovernanceUpdateCommand, extractProposalId } from '../../../helpers/commandUtil';

interface GovernanceUpdateOptions {
  network: string;
}

class GovernanceUpdater {
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

  private async runGovernanceFlow(proposalId: string): Promise<void> {
    log(`\n🎉 Governance update proposal created successfully!`, 'success');
    
    const options: GovernanceFlowOptions = {
      network: this.options.network,
      proposalId: proposalId,
      executionType: 'governance-update'
    };
    
    const successMessage = `\n🎉 Governance update completed successfully!\n🔧 New governance configuration and timelock settings are now active`;
    
    await runGovernanceFlow(options, successMessage);
  }

  private formatDelay(delaySeconds: number): string {
    if (delaySeconds < 60) {
      return `${delaySeconds} seconds`;
    } else if (delaySeconds < 3600) {
      const minutes = Math.floor(delaySeconds / 60);
      return `${minutes} minutes (${delaySeconds} seconds)`;
    } else if (delaySeconds < 86400) {
      const hours = Math.floor(delaySeconds / 3600);
      return `${hours} hours (${delaySeconds} seconds)`;
    } else {
      const days = Math.floor(delaySeconds / 86400);
      return `${days} days (${delaySeconds} seconds)`;
    }
  }

  public async run(): Promise<void> {
    try {
      log(`\n🚀 Starting Governance Update Process`, 'info');
      log(`Network: ${this.options.network}`, 'info'); 
      // Step 1: Propose governance update
      const proposalId = await this.proposeGovernanceUpdate();
      
      // Step 2: Run governance flow
      await this.runGovernanceFlow(proposalId);
      
    } catch (error) {
      log(`\n❌ Governance update process failed: ${error}`, 'error');
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
            log(`
  🔧 Governance Update Script
  
  Usage: yarn ts-node scripts/governor/propose/governance-update/index.ts [options]
  
  Options:
    --network <network>      Network to use (default: local)
    --deployment <market>    Deployment to use (default: dai)
    --help, -h              Show this help message
  
  Examples:
    # Update governance configuration on local network
    yarn ts-node scripts/governor/propose/governance-update/index.ts --network local
  
    # Update governance configuration on polygon network
    yarn ts-node scripts/governor/propose/governance-update/index.ts --network polygon
  
  Note: This script will guide you through the complete governance process:
  1. Create proposal
  2. Approve proposal (if you choose to)
  3. Queue proposal (if you choose to)
  4. Execute proposal (if you choose to)
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
