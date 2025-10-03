#!/usr/bin/env ts-node

import { runDeploymentVerificationForMarket } from '../../helpers/commandUtil';
import { log } from '../../helpers/ioUtil';

interface TestMarketOptions {
  network: string;
  deployment: string;
}

class MarketTester {
  private options: TestMarketOptions;

  constructor(options: TestMarketOptions) {
    this.options = options;
  }

  public async testMarket(): Promise<void> {
    try {
      log(`\n🧪 Testing market for ${this.options.deployment} on ${this.options.network}`, 'info');
      
      log(`\n🧪 Running deployment verification test (includes spider)...`, 'info');
      const result = await runDeploymentVerificationForMarket(this.options.network, this.options.deployment);
      console.log(result);
      
      log(`\n🎉 Market testing completed successfully!`, 'success');
      
    } catch (error) {
      log(`\n❌ Market testing failed: ${error}`, 'error');
      log(`\n💡 Troubleshooting tips:`, 'info');
      log(`   - Check your .env file has all required API keys`, 'info');
      log(`   - Verify network configuration in hardhat.config.ts`, 'info');
      log(`   - Check that the deployment exists in deployments/${this.options.network}/${this.options.deployment}/`, 'info');
      process.exit(1);
    }
  }

}

// Parse command line arguments
function parseArguments(): TestMarketOptions {
  const args = process.argv.slice(2);
  const options: TestMarketOptions = {
    network: '',
    deployment: ''
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--network':
        options.network = args[++i];
        break;
      case '--deployment':
        options.deployment = args[++i];
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

Usage: yarn ts-node scripts/governor/test-market-setup/index.ts [options]

Options:
  --network <network>                    Network to use (required)
  --deployment <market>                  Market to test (required)
  --help, -h                            Show this help message

Examples:
  # Test DAI market on local network
  yarn ts-node scripts/governor/test-market-setup/index.ts --network local --deployment dai

  # Test USDC market on polygon
  yarn ts-node scripts/governor/test-market-setup/index.ts --network polygon --deployment usdc

  # Test WETH market on mainnet
  yarn ts-node scripts/governor/test-market-setup/index.ts --network mainnet --deployment weth

Available networks: local, hardhat, mainnet, polygon, arbitrum, optimism, base, etc.
Available markets: dai, usdc, usdt, weth, wbtc, etc.

Features:
  - Executes deployment verification test (includes spider)
  - Provides comprehensive error handling and troubleshooting tips
  - Continues execution despite non-critical failures

Note: This script tests a market deployment by running the deployment verification test.
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
