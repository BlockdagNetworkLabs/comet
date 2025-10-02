#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { runGovernanceFlow } from '../../helpers/governanceFlow';
import { log, confirm } from '../../helpers/ioUtil';
import { 
  extractProposalId, 
  extractImplementationAddresses, 
  buildProject,
  clearProposalStack,
  deployInfrastructure as deployInfrastructureCommand,
  deployMarket as deployMarketCommand,
  executeBatchProposal as executeBatchProposalCommand,
  runDeploymentVerification as runDeploymentVerificationCommand,
  proposeUpgrade as proposeUpgradeCommand,
  proposeFundRewards as proposeFundRewardsCommand,
  proposeGovernanceUpdate as proposeGovernanceUpdateCommand
} from '../../helpers/commandUtil';
import { getValidGovConfig } from '../../../src/deploy/helpers/govValidation';
import { DEFAULT_REWARDS_FUNDING_AMOUNT } from '../../../src/constants';

interface DeployOptions {
  network: string;
  deployments: string[];
  clean?: boolean;
}

class MarketsDeployer {
  private options: DeployOptions;

  constructor(options: DeployOptions) {
    this.options = options;
  }

  public async deploy(): Promise<void> {
    try {
      const deploymentList = this.options.deployments.join(', ');
      log(`\n🚀 Starting market deployment for ${this.options.deployments.length} markets: ${deploymentList} on ${this.options.network}`, 'info');
      
      log(`🔧 Using BDAG custom governor`, 'info');

      // Step 1: Prepare deployment environment
      await this.prepareDeployment();
      
      // Step 2: Deploy infrastructure and validate configurations
      await this.deployInfrastructureAndValidate();
      
      // Step 3: Deploy all markets in batch mode
      await this.deployAllMarkets();
      
      // Step 4: Execute batch proposal for market implementations
      const implBatchProposalId = await this.executeImplementationBatchProposal();
      
      // Step 5: Run governance flow to accept implementations
      const implementationAddresses = await this.runGovernanceToAcceptImplementations(implBatchProposalId);

      // Step 6: Propose upgrades to new implementations
      await this.proposeUpgrade(implementationAddresses);
        
      // Step 7: Execute batch proposal for market upgrades
      const upgradeBatchProposalId = await this.executeUpgradeBatchProposal();

      // Step 8: Run governance flow to accept upgrades
      await this.runGovernanceToAcceptUpgrade(upgradeBatchProposalId, implementationAddresses, this.options.deployments);

      // Step 9: Fund rewards contracts
      await this.fundRewardContract();

      // Step 10: Propose governance update
      const { governorSigners, multisigThreshold, timelockDelay } = getValidGovConfig();
      await this.governanceUpdate(governorSigners, multisigThreshold, timelockDelay);

      // Step 11: Run verification tests (optional)
      await this.runVerificationTests();
      
      // Step 12: Display deployment summary
      this.displayDeploymentSummary();
      
    } catch (error) {
      log(`\n❌ Deployment failed: ${error}`, 'error');
      log(`\n💡 Troubleshooting tips:`, 'info');
      log(`   - Check your .env file has all required API keys`, 'info');
      log(`   - Verify network configuration in hardhat.config.ts`, 'info');
      log(`   - Ensure you have sufficient funds for deployment`, 'info');
      log(`   - Check that all dependencies are installed (yarn install)`, 'info');
      process.exit(1);
    } 
  }

  /**
   * Step 1: Prepare deployment environment
   * - Build project
   * - Clean deployment cache if requested
   * - Clear proposal stack
   */
  private async prepareDeployment(): Promise<void> {
    // Build project before deployment
    await buildProject();

    if (this.options.clean) {
      log(`🧹 Clean mode enabled`, 'info');
      await this.cleanDeployment();
    }
    
    // Clear proposal stack
    await clearProposalStack(this.options.network);
  }

  /**
   * Step 2: Deploy infrastructure and validate configurations
   * - Deploy infrastructure contracts
   * - Check configuration files for all markets
   * - Prompt for configuration updates
   */
  private async deployInfrastructureAndValidate(): Promise<void> {
    // Deploy Infrastructure
    await deployInfrastructureCommand(this.options.network, true, true);
    
    // Check configuration files for all markets
    await this.checkAllConfigurationFiles();
    
    // Prompt for configuration update
    await this.promptForConfigurationUpdate();
  }

  /**
   * Step 3: Deploy all markets in batch mode
   * - Deploy each market using batch deploy mode
   * - Each deployment adds actions to the proposal stack
   */
  private async deployAllMarkets(): Promise<void> {
    for (let i = 0; i < this.options.deployments.length; i++) {
      const deployment = this.options.deployments[i];
      log(`\n🎯 Deploying market ${i + 1}/${this.options.deployments.length}: ${deployment} and proposing implementation`, 'info');
      
      // Deploy the market using batch deploy mode
      await deployMarketCommand(this.options.network, deployment, true, true);
    }
  }

  /**
   * Step 4: Execute batch proposal for market implementations
   * - Execute the batch proposal containing all market implementation actions
   * - Return the proposal ID for governance flow
   */
  private async executeImplementationBatchProposal(): Promise<string> {
    log(`\n🎯 Executing batch proposal for all market implementations...`, 'info');
    
    const implBatchProposalResult = await executeBatchProposalCommand(this.options.network);
    
    // Extract proposal ID from the batch proposal result
    const implBatchProposalId = extractProposalId(implBatchProposalResult);
    log(`\n📋 Batch proposal created with ID: ${implBatchProposalId}`, 'success');
    
    return implBatchProposalId;
  }

  /**
   * Step 6: Execute batch proposal for market upgrades
   * - Execute the batch proposal containing all market upgrade actions
   * - Return the proposal ID for governance flow
   */
  private async executeUpgradeBatchProposal(): Promise<string> {
    log(`\n🎯 Executing batch proposal for all market upgrades...`, 'info');
    
    const upgradeBatchProposalResult = await executeBatchProposalCommand(this.options.network);
    const upgradeBatchProposalId = extractProposalId(upgradeBatchProposalResult);
    log(`\n📋 Batch proposal created with ID: ${upgradeBatchProposalId}`, 'success');
    
    return upgradeBatchProposalId;
  }

  /**
   * Step 9: Fund rewards contracts for all markets
   * - Propose funding CometRewards contract with COMP tokens
   * - Run governance flow to execute the funding proposal
   */
  private async fundRewardContract(): Promise<void> {
    // Use environment variable or default constant
    const amount = process.env.DEFAULT_REWARDS_FUNDING_AMOUNT || DEFAULT_REWARDS_FUNDING_AMOUNT;
    const amountFormatted = this.formatAmountForDisplay(amount);
    
    log(`\n💰 Proposing to fund CometRewards with ${amountFormatted}...`, 'info');
    log(`💡 To change this amount, set the DEFAULT_REWARDS_FUNDING_AMOUNT environment variable`, 'info');
    
    try {
      // Propose funding CometRewards
      const output = await proposeFundRewardsCommand(this.options.network, amount);
      const proposalId = extractProposalId(output);
      
      log(`\n📋 Rewards funding proposal created with ID: ${proposalId}`, 'success');

      // Run governance flow to execute the funding
      const governanceFlowResponse = await runGovernanceFlow({
        network: this.options.network,
        proposalId,
        executionType: 'comet-reward-funding'
      });

      log(`\n🎉 Governance flow response for rewards funding: ${governanceFlowResponse}`, 'success');
      log(`\n✅ CometRewards funding completed successfully!`, 'success');
      
    } catch (error) {
      log(`\n❌ Failed to fund CometRewards: ${error}`, 'error');
      throw error;
    }
  }


  /**
   * Format amount for display purposes (convert wei to COMP tokens)
   * @param amount - Amount in wei
   * @returns Formatted string showing COMP tokens
   */
  private formatAmountForDisplay(amount: string): string {
    try {
      const amountInWei = BigInt(amount);
      const amountInComp = Number(amountInWei) / Math.pow(10, 18);
      return `${amount} (${amountInComp.toLocaleString()} COMP)`;
    } catch (error) {
      return `${amount} (wei)`;
    }
  }

  /**
   * Step 10: Propose governance update
   * - Propose a governance update to set the new admins and threshold
   * - Return the proposal ID for governance flow
   */
  private async governanceUpdate(admins: string[], threshold: number, timelockDelay?: number): Promise<string> {
    const shouldProposeGovernanceUpdate = await confirm(`\nDo you want to propose a governance update?`);

    if (!shouldProposeGovernanceUpdate) {
      log(`\n⏸️  Governance update cancelled.`, 'warning');
      return;
    }

    const output = await proposeGovernanceUpdateCommand(
      this.options.network, 
      this.options.deployments[0], // Use first deployment for governance update
      admins, 
      threshold, 
      timelockDelay
    );
    
    const proposalId = extractProposalId(output);

    const governanceFlowResponse = await runGovernanceFlow({
      network: this.options.network,
      proposalId,
      executionType: 'governance-update'
    });

    log(`\n🎉 Governance flow response for governance update: ${governanceFlowResponse}`, 'success');

    return governanceFlowResponse;
  }


  /**
   * Step 11: Run verification tests (optional)
   * - Prompt user to run verification tests
   * - Run tests for all deployed markets
   */
  private async runVerificationTests(): Promise<void> {
    const runVerification = await confirm(`\nDo you want to run deployment verification tests for all markets?`);
    
    if (runVerification) {
      for (const deployment of this.options.deployments) {
        log(`\n🧪 Running verification test for ${deployment}...`, 'info');
        await runDeploymentVerificationCommand(this.options.network, deployment, true);
      }
    }
  }

  /**
   * Step 12: Display deployment summary
   * - Show success message and list of deployed markets
   */
  private displayDeploymentSummary(): void {
    log(`\n🎉 All ${this.options.deployments.length} markets deployed successfully!`, 'success');
    log(`\n📊 Deployment Summary:`, 'info');
    for (const deployment of this.options.deployments) {
      log(`   ✅ ${deployment}`, 'success');
    }
  }

  private getConfigPath(deployment: string): string {
    return path.join(
      process.cwd(),
      'deployments',
      this.options.network,
      deployment,
      'configuration.json'
    );
  }

  private async checkConfigurationFile(deployment: string): Promise<void> {
    const configPath = this.getConfigPath(deployment);
    
    if (!fs.existsSync(configPath)) {
      log(`❌ Configuration file not found at: ${configPath}`, 'error');
      throw new Error(`Configuration file not found for deployment: ${deployment}`);
    }

    log(`📁 Configuration file found at: ${configPath}`, 'info');
    
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent);
      log(`📋 Current configuration loaded successfully for ${deployment}`, 'success');
      return config;
    } catch (error) {
      log(`❌ Failed to parse configuration file: ${error}`, 'error');
      throw error;
    }
  }

  private async checkAllConfigurationFiles(): Promise<void> {
    log(`\n📋 Checking configuration files for ${this.options.deployments.length} markets...`, 'info');
    
    for (const deployment of this.options.deployments) {
      log(`\n🔍 Checking configuration for ${deployment}...`, 'info');
      await this.checkConfigurationFile(deployment);
    }
    
    log(`\n✅ All configuration files checked successfully`, 'success');
  }

  private async promptForConfigurationUpdate(): Promise<void> {
    log(`\n⚠️  IMPORTANT: After infrastructure deployment, you need to update the market configurations.`, 'warning');
    
    log(`\n📁 Configuration file locations:`, 'info');
    for (const deployment of this.options.deployments) {
      log(`   - ${this.getConfigPath(deployment)}`, 'info');
    }
    
    log(`\n📝 You need to update the following in each configuration.json:`, 'info');
    log(`   - Price feeds for your assets`, 'info');
    log(`   - Asset configurations`, 'info');
    log(`   - Supply caps and collateral factors`, 'info');
    log(`   - Any other market-specific settings`, 'info');
    
    const shouldContinue = await confirm(
      `\nHave you updated all configuration.json files for the ${this.options.deployments.length} markets and are ready to continue with deployment?`
    );
    
    if (!shouldContinue) {
      log(`\n⏸️  Deployment paused. Please update the configurations and run the script again.`, 'warning');
      process.exit(0);
    }
  }

  /**
   * Clean deployment cache for the network
   * Removes cached deployment artifacts and configuration files
   */
  private async cleanDeployment(): Promise<void> {
    const network = this.options.network;
    
    log(`\n🧹 Cleaning deployment cache for ${network}...`, 'info');
    
    const cleanCommand = `rm -rf deployments/${network}/_infrastructure/aliases.json deployments/${network}/_infrastructure/roots.json deployments/${network}/.contracts deployments/${network}/*/aliases.json deployments/${network}/*/roots.json`;
    
    try {
      execSync(cleanCommand, { stdio: 'inherit' });
      log(`✅ Cleaned deployment cache successfully`, 'success');
    } catch (error) {
      log(`⚠️  Clean command completed (some files may not have existed)`, 'warning');
    }
  }


  /**
   * Step 5: Run governance flow to accept implementations
   * @param proposalId - The proposal ID to process through governance
   * @returns Array of implementation addresses extracted from the governance flow response
   */
  private async runGovernanceToAcceptImplementations(proposalId: string): Promise<string[]> {
    log(`\n🎉 Market deployment completed successfully for all markets!`, 'success');
    log(`\n🚀 Starting governance flow to accept implementation for all markets...`, 'info');
    
    // Step 1: Run governance flow to accept implementation
    const governanceFlowResponse = await runGovernanceFlow({
      network: this.options.network,
      proposalId,
      executionType: 'comet-impl-in-configuration'
    });
    log(`\n🎉 Governance flow response for all markets: ${governanceFlowResponse}`, 'success');
    log(`\n🎉 Governance flow to accept implementation completed successfully for all markets!`, 'success');
    // Extract implementation address from governance flow response
    const implementationAddresses = extractImplementationAddresses(governanceFlowResponse);
    log(`\n📋 Extracted implementation addresses for all markets:`, 'info');
    implementationAddresses.forEach((addr, index) => {
      log(`   ${this.options.deployments[index]}: ${addr}`, 'info');
    });

    return implementationAddresses;
  }

  /**
   * Step 6: Propose upgrades to new implementations
   * @param implementationAddresses - Array of implementation addresses for each market
   */
  private async proposeUpgrade(implementationAddresses: string[]): Promise<void> {
    // Propose upgrade (if needed)
    try {
      const shouldProposeUpgrade = await confirm(`\nDo you want to propose an upgrade to a new implementation for all markets?`);

      log(`\n🔧 Proposing upgrade to a new implementation for all markets...`, 'info');
      if (shouldProposeUpgrade) {
        // Propose upgrade to new implementation using batch deploy mode for each deployment
        for (let i = 0; i < this.options.deployments.length; i++) {
          const deployment = this.options.deployments[i];
          const implementationAddress = implementationAddresses[i];
          
          if (implementationAddress) {
            await proposeUpgradeCommand(this.options.network, deployment, implementationAddress, true);
          } else {
            log(`\n⚠️  No implementation address found for deployment ${deployment}`, 'warning');
          }
        }
      }
    } catch (error) {
      log(`\n⚠️  Failed to propose upgrade for all markets: ${error}`, 'error');
    }
  }

  /**
   * Step 8: Run governance flow to accept upgrades
   * @param proposalId - The upgrade proposal ID to process through governance
   * @param newImplementationAddresses - Array of new implementation addresses for each market
   * @param deployments - Array of deployment names
   */
  private async runGovernanceToAcceptUpgrade(proposalId: string, newImplementationAddresses: string[], deployments: string[]): Promise<void> {
    if (proposalId) {
      // Approve all upgrade governance steps at once
      const governanceFlowResponse = await runGovernanceFlow({
        network: this.options.network,
        proposalId,
        executionType: 'comet-upgrade'
      });

      log(`\n🎉 Governance flow response for ${deployments}: ${governanceFlowResponse}`, 'success');
    }
  }
}

/**
 * Scan all deployment folders for a given network and return their names
 * @param network - The network name to scan
 * @returns Array of deployment folder names (excluding _infrastructure only)
 */
function getAllDeploymentFolders(network: string): string[] {
  const deploymentsPath = path.join(process.cwd(), 'deployments', network);
  
  try {
    if (!fs.existsSync(deploymentsPath)) {
      log(`❌ Deployments directory not found: ${deploymentsPath}`, 'error');
      return [];
    }

    const items = fs.readdirSync(deploymentsPath, { withFileTypes: true });
    const deploymentFolders: string[] = [];

    for (const item of items) {
      // Skip only _infrastructure and non-directories
      if (item.name === '_infrastructure' || !item.isDirectory()) {
        continue;
      }

      // Check if the folder has a configuration.json file
      const configPath = path.join(deploymentsPath, item.name, 'configuration.json');
      if (fs.existsSync(configPath)) {
        deploymentFolders.push(item.name);
      } else {
        log(`⚠️  Skipping ${item.name} - no configuration.json found`, 'warning');
      }
    }

    log(`📁 Found ${deploymentFolders.length} deployment folders: ${deploymentFolders.join(', ')}`, 'info');
    return deploymentFolders;

  } catch (error) {
    log(`❌ Error scanning deployment folders: ${error}`, 'error');
    return [];
  }
}

// Parse command line arguments
function parseArguments(): DeployOptions {
  const args = process.argv.slice(2);
  const options: DeployOptions = {
    network: 'local',
    deployments: []
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--network':
        options.network = args[++i];
        break;
      case '--deployment':
      case '--deployments': {
        const deploymentArg = args[++i];
        
        // Check if user wants to deploy all markets
        if (deploymentArg.toLowerCase() === 'all') {
          options.deployments = getAllDeploymentFolders(options.network);
        } else {
          // Support both single deployment and comma-separated list
          options.deployments = deploymentArg.split(',').map(d => d.trim()).filter(d => d.length > 0);
        }
        break;
      }

      case '--clean':
        options.clean = true;
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
🚀 Market Deployment Script

Usage: yarn ts-node scripts/deployer/deploy-markets/index.ts [options]

Options:
  --network <network>           Network to deploy to (default: local)
  --deployment <market(s)>      Market(s) to deploy (default: dai)
                               Supports single market, comma-separated list, or 'all'
  --deployments <market(s)>     Alias for --deployment

  --clean                       Clean deployment cache before deploying

  --help, -h                   Show this help message

Examples:
  # Deploy single DAI market on local network
  yarn ts-node scripts/deployer/deploy-markets/index.ts --network local --deployment dai

  # Deploy multiple markets on polygon network
  yarn ts-node scripts/deployer/deploy-markets/index.ts --network polygon --deployment dai,usdc,usdt

  # Deploy ALL markets found in the network's deployment folder
  yarn ts-node scripts/deployer/deploy-markets/index.ts --network local --deployment all

  # Deploy all markets with clean cache
  yarn ts-node scripts/deployer/deploy-markets/index.ts --network local --deployment all --clean

  # Deploy all major markets on mainnet
  yarn ts-node scripts/deployer/deploy-markets/index.ts --network mainnet --deployment dai,usdc,usdt,weth,wbtc

Available networks: local, hardhat, mainnet, polygon, arbitrum, optimism, base, etc.
Available markets: dai, usdc, usdt, weth, wbtc, etc.
Use 'all' to deploy all markets found in the network's deployment folder.
  `);
}

// Main execution
async function main(): Promise<void> {
  const options = parseArguments();
  
  if (!options.network || !options.deployments || options.deployments.length === 0) {
    console.error('❌ Network and at least one deployment are required');
    showHelp();
    process.exit(1);
  }

  const deployer = new MarketsDeployer(options);
  await deployer.deploy();
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

export { MarketsDeployer as MarketDeployer, DeployOptions };
