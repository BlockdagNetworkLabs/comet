#!/usr/bin/env ts-node

import { runCommand } from '../../helpers/commandUtil';
import { log, updateCometImplAddress } from '../../helpers/ioUtil';
import * as readline from 'readline';

interface TestMarketOptions {
  network: string;
  deployment: string;
  newImplementationAddress?: string;
}

class MarketTester {
  private options: TestMarketOptions;

  constructor(options: TestMarketOptions) {
    this.options = options;
  }

  public async testMarket(): Promise<void> {
    try {
      log(`\n🧪 Testing market implementation for ${this.options.deployment} on ${this.options.network}`, 'info');
      
      // Step 1: Get new implementation address from user if not provided
      const newImplementationAddress = await this.getNewImplementationAddress();
      
      // Step 2: Update aliases.json with new implementation (only if address provided)
      if (newImplementationAddress) {
        await this.updateDeploymentFiles(newImplementationAddress);
      } else {
        log(`\n⏭️  Skipping deployment file updates (no implementation address provided)`, 'info');
      }
      
      // Step 3: Run deployment verification test (includes spider)
      await this.runDeploymentVerification();
      
      log(`\n🎉 Market testing completed successfully!`, 'success');
      
    } catch (error) {
      log(`\n❌ Market testing failed: ${error}`, 'error');
      log(`\n💡 Troubleshooting tips:`, 'info');
      log(`   - Check your .env file has all required API keys`, 'info');
      log(`   - Verify network configuration in hardhat.config.ts`, 'info');
      log(`   - Ensure the new implementation address is valid and deployed`, 'info');
      log(`   - Check that the deployment exists in deployments/${this.options.network}/${this.options.deployment}/`, 'info');
      log(`   - Verify the new implementation is compatible with the current market`, 'info');
      process.exit(1);
    }
  }

  /**
   * Get new implementation address from user input
   */
  private async getNewImplementationAddress(): Promise<string | null> {
    if (this.options.newImplementationAddress) {
      log(`\n🔧 Using provided implementation address: ${this.options.newImplementationAddress}`, 'info');
      return this.options.newImplementationAddress;
    }

    log(`\n📝 Do you want to update the implementation address? (Leave empty to skip)`, 'info');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve, reject) => {
      rl.question('New implementation address (or press Enter to skip): ', (address) => {
        rl.close();
        
        if (!address || address.trim() === '') {
          log(`\n⏭️  Skipping implementation address update`, 'info');
          resolve(null);
          return;
        }

        // Basic validation for Ethereum address format
        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
          reject(new Error('Invalid Ethereum address format'));
          return;
        }

        resolve(address.trim());
      });
    });
  }

  /**
   * Update aliases.json with new implementation address
   */
  private async updateDeploymentFiles(newImplementationAddress: string): Promise<void> {
    log(`\n🔧 Updating deployment files with new implementation address...`, 'info');
    log(`   New implementation: ${newImplementationAddress}`, 'info');
    updateCometImplAddress(this.options.network, this.options.deployment, newImplementationAddress);
  }

  /**
   * Run deployment verification test (includes spider)
   */
  private async runDeploymentVerification(): Promise<void> {
    log(`\n🧪 Running deployment verification test (includes spider)...`, 'info');
    const verificationCommand = `MARKET=${this.options.deployment} yarn hardhat test test/deployment-verification-test.ts --network ${this.options.network}`;
    const result = await runCommand(verificationCommand, `Running deployment verification for ${this.options.deployment}`);
    console.log(result);
  }
}

// Parse command line arguments
function parseArguments(): TestMarketOptions {
  const args = process.argv.slice(2);
  const options: TestMarketOptions = {
    network: '',
    deployment: '',
    newImplementationAddress: undefined
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--network':
        options.network = args[++i];
        break;
      case '--deployment':
        options.deployment = args[++i];
        break;
      case '--implementation':
        options.newImplementationAddress = args[++i];
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
🧪 Test Market Script

Usage: yarn ts-node scripts/governor/test-market/index.ts [options]

Options:
  --network <network>                    Network to use (required)
  --deployment <market>                  Market to test (required)
  --implementation <addr>                New implementation address (optional - will prompt if not provided)

  --help, -h                            Show this help message

Examples:
  # Test DAI market implementation on local network (will prompt for address)
  yarn ts-node scripts/governor/test-market/index.ts --network local --deployment dai

  # Test USDC market implementation with specific address
  yarn ts-node scripts/governor/test-market/index.ts --network polygon --deployment usdc --implementation 0x1234567890123456789012345678901234567890

  # Test WETH market implementation on mainnet (skip implementation update)
  yarn ts-node scripts/governor/test-market/index.ts --network mainnet --deployment weth

Available networks: local, hardhat, mainnet, polygon, arbitrum, optimism, base, etc.
Available markets: dai, usdc, usdt, weth, wbtc, etc.

Features:
  - Prompts for new implementation address if not provided (can skip)
  - Updates aliases.json with new implementation address (only if provided)
  - Executes deployment verification test (includes spider)
  - Provides comprehensive error handling and troubleshooting tips
  - Validates Ethereum address format
  - Continues execution despite non-critical failures

Note: This script can be used to test a market implementation. If no new implementation
address is provided, it will skip the file updates and just run the verification test.
The verification test includes running spider to refresh roots.json.
  `);
}

// Main execution
async function main(): Promise<void> {
  const options = parseArguments();
  
  if (!options.network || !options.deployment) {
    console.error('❌ Network and deployment are both required');
    showHelp();
    process.exit(1);
  }

  const tester = new MarketTester(options);
  await tester.testMarket();
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

export { MarketTester, TestMarketOptions };
