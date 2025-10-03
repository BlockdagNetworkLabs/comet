#!/usr/bin/env ts-node
import { log, question, confirm as defaultConfirm } from '../../../helpers/ioUtil';
import { runCommand, extractProposalId } from '../../../helpers/commandUtil';

interface FundingOptions {
  network: string;
}

export class CometRewardFunder {
  private options: FundingOptions;
  private confirmFunction: (prompt: string) => Promise<boolean>;
  private questionFunction: (prompt: string) => Promise<string>;

  constructor(options: FundingOptions) {
    this.options = options;
    // Use default functions, no global loading
    this.confirmFunction = defaultConfirm;
    this.questionFunction = question;
  }

  /**
   * Set custom confirm and question functions for testing or automation
   * @param confirmFn - Function that takes a prompt and returns a boolean
   * @param questionFn - Function that takes a prompt and returns a string
   */
  public setMockFunctions(confirmFn: (prompt: string) => Promise<boolean>, questionFn: (prompt: string) => Promise<string>): void {
    this.confirmFunction = confirmFn;
    this.questionFunction = questionFn;
  }

  private async proposeFunding(amount: string): Promise<string> {
    const command = `yarn hardhat governor:propose-fund-comet-rewards --network ${this.options.network} --amount ${amount}`;
    
    const output = await runCommand(command, 'Proposing comet reward funding');
    
    return extractProposalId(output);
  }

  public async run(): Promise<string> {
    try {
      log(`\n🚀 Starting Comet Reward Funding Proposal Process`, 'info');
      log(`Network: ${this.options.network}`, 'info');
      
      // Ask for amount interactively
      const amount = await this.questionFunction(`\nEnter the amount of COMP tokens to fund (in wei, e.g., 1000000000000000000000 for 1000 COMP): `);
      
      if (!amount) {
        log(`\n❌ Amount is required`, 'error');
        return;
      }
      
      log(`Amount: ${amount} COMP tokens (wei)`, 'info');
      
      // Confirm before proceeding
      const shouldProceed = await this.confirmFunction(`\nDo you want to proceed with creating a proposal to fund CometRewards with ${amount} COMP tokens?`);
      
      if (!shouldProceed) {
        log(`\n⏸️  Proposal creation cancelled.`, 'warning');
        return;
      }
      
      const proposalId = await this.proposeFunding(amount);
      
      console.log(`Successfully created proposal! 📋 Proposal ID: ${proposalId}`,'success')
      
      return proposalId;
    } catch (error) {
      log(`\n❌ Comet reward funding proposal process failed: ${error}`, 'error');
      throw error;
    }
  }
}

// Parse command line arguments
function parseArgs(): FundingOptions {
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
🚀 Comet Reward Funding Proposal Script

Usage: yarn ts-node scripts/governor/propose/comet-reward-funding/index.ts [options]

Options:
  --network <network>    Network to use (default: local)
  --help, -h            Show this help message

Examples:
  # Create a proposal to fund CometRewards on local network (amount will be asked interactively)
  yarn ts-node scripts/governor/propose/comet-reward-funding/index.ts --network local

  # Create a proposal to fund CometRewards on polygon network (amount will be asked interactively)
  yarn ts-node scripts/governor/propose/comet-reward-funding/index.ts --network polygon

Note: This script creates a governance proposal to fund CometRewards with COMP tokens.
The actual funding will occur after the proposal goes through the governance process.
        `);
        process.exit(0);
    }
  }

  return { network };
}

// Main execution
async function main() {
  const options = parseArgs();
  const funder = new CometRewardFunder(options);
  await funder.run();
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
} 