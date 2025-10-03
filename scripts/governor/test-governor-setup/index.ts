#!/usr/bin/env ts-node
import { log } from '../../helpers/ioUtil';
import { execSync } from 'child_process';

interface GovernorSetupOptions {
  network: string;
}

export class GovernorSetupVerifier {
  private options: GovernorSetupOptions;

  constructor(options: GovernorSetupOptions) {
    this.options = options;
  }

  private async runGovernanceVerification(): Promise<void> {
    log(`\n🧪 Running Governance Verification Tests`, 'info');
    log(`Network: ${this.options.network}`, 'info');

    try {

      // Build the test command
      let command = `yarn hardhat test test/deployment-verification-test.ts --network ${this.options.network} --grep "Governance Verification"`;
      
      log(`📝 Running command: ${command}`, 'info');

      // Execute the test command
      const result = execSync(command, { 
        encoding: 'utf8',
        stdio: 'inherit',
        cwd: process.cwd(),
      });

      log(`\n✅ Governance Verification Tests Completed Successfully`, 'success');
      
    } catch (error) {
      log(`\n❌ Governance Verification Tests Failed: ${error.message}`, 'error');
      throw error;
    }
  }

  public async run(): Promise<void> {
    try {
      log(`\n🚀 Starting Governor Setup Verification`, 'info');
      log(`Network: ${this.options.network}`, 'info');

      await this.runGovernanceVerification();
      
      log(`\n🔧 Governance configuration has been validated successfully`, 'success');
      
    } catch (error) {
      log(`\n❌ Governor setup verification failed: ${error}`, 'error');
      throw error;
    }
  }
}

// Parse command line arguments
function parseArgs(): GovernorSetupOptions {
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
🧪 Governor Setup Verification Script

Usage: yarn ts-node scripts/governor/test-governor-setup/index.ts [options]

Options:
  --network <network>      Network to test (default: local)
  --help, -h              Show this help message

Examples:
  # Run governance verification tests on local network
  yarn ts-node scripts/governor/test-governor-setup/index.ts --network local

  # Run governance verification tests on polygon network
  yarn ts-node scripts/governor/test-governor-setup/index.ts --network polygon

Note: This script validates the deployed governance configuration
against the expected configuration values.
        `);
        process.exit(0);
    }
  }

  return { network };
}

// Main execution
async function main() {
  const options = parseArgs();
  const verifier = new GovernorSetupVerifier(options);
  await verifier.run();
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}
