import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { DynamicHardhatConfig } from './helpers/dynamic-hardhat-config';
import { ProtocolDiscover } from './helpers/protocol-discover';
import { extractProposalId } from '../../scripts/helpers/commandUtil';

//Parameters
let E2E_NETWORK_CONFIG = {
  chainId: process.env.E2E_CHAIN_ID ? parseInt(process.env.E2E_CHAIN_ID) : 31337, 
  url: process.env.E2E_RPC_URL || 'http://127.0.0.1:8545', 
} as any;
const TEMPLATE_NAME = process.env.E2E_TEMPLATE || '_template-1';

// Configuration
const TEMP_HARDHAT_CONFIG_FILE_NAME = 'temp-hardhat.config.ts';
const NETWORK_NAME = 'e2e-network';

const PROTOCOL_DEPLOYMENT_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const TEST_HARDHAT_CONFIG_PATH = path.join(__dirname, TEMP_HARDHAT_CONFIG_FILE_NAME);
const TEST_DEPLOYMENT_PATH = path.join(__dirname, '../../deployments', NETWORK_NAME);

describe('E2E Protocol Governance Test Suite', function () {
  
  describe.skip('E2E Complete Market Deployment', function () {
    // Tests deploying all markets at once

    const templatePath = path.join(__dirname, TEMPLATE_NAME);

    before(async function () {
      // Copy template files to e2e root
      await copyDirectory(templatePath, TEST_DEPLOYMENT_PATH, [TEMPLATE_NAME]);

      const dynamicHardhatConfig = new DynamicHardhatConfig(NETWORK_NAME, E2E_NETWORK_CONFIG, TEST_HARDHAT_CONFIG_PATH, TEST_DEPLOYMENT_PATH);
      await dynamicHardhatConfig.generateTestHardhatConfig();

      // Set test environment variables
      process.env.TEST = 'true';
      process.env.TEST_HARDHAT_CONFIG = TEST_HARDHAT_CONFIG_PATH;
    });

    after(async function () {
      await deleteDirectory();
      await deleteHardhatConfigFile();
      // Clean up test environment variables
      delete process.env.TEST;
      delete process.env.TEST_HARDHAT_CONFIG;
    });

    it('should deploy protocol successfully', async function () {
      this.timeout(PROTOCOL_DEPLOYMENT_TIMEOUT);
      console.log(`🚀 Testing protocol deployment for ${TEMPLATE_NAME}...`);
      
      try {
        // Run deployment command - all internal hardhat commands will now use the test config
        const command = `yes | npx ts-node scripts/deployer/deploy-markets/index.ts --network ${NETWORK_NAME} --deployments all --clean`;
        
        console.log(`📝 Running deployment command: ${command}`);
        console.log(`📝 Test mode enabled with hardhat config: ${process.env.TEST_HARDHAT_CONFIG}`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        console.log('Deployment output:', result);
        console.log(`✅ Protocol deployment test passed for ${TEMPLATE_NAME}`);
      } catch (error) {
        console.error('Deployment failed:', error.message);
        throw error;
      }
    });
  });

  describe('E2E Incremental Market Deployment', function () {
    // Tests deploying subset of markets + governance proposals
    let availableDeployments: string[] = [];
    let excludedDeployment: string = '';
    let marketPhase1ProposalId: string = '';

    before(async function () {
      // Copy template files to e2e root
      const templatePath = path.join(__dirname, TEMPLATE_NAME);
      await copyDirectory(templatePath, TEST_DEPLOYMENT_PATH, [TEMPLATE_NAME]);

      const dynamicHardhatConfig = new DynamicHardhatConfig(NETWORK_NAME, E2E_NETWORK_CONFIG, TEST_HARDHAT_CONFIG_PATH, TEST_DEPLOYMENT_PATH);
      await dynamicHardhatConfig.generateTestHardhatConfig();

      // Set test environment variables
      process.env.TEST = 'true';
      process.env.TEST_HARDHAT_CONFIG = TEST_HARDHAT_CONFIG_PATH;

      // Fetch all available deployment names
      availableDeployments = await ProtocolDiscover.discoverMarkets(TEST_DEPLOYMENT_PATH);
      console.log(`📋 Found ${availableDeployments.length} available deployments:`, availableDeployments);
    });

    after(async function () {
      await deleteDirectory();
      await deleteHardhatConfigFile();
      // Clean up test environment variables
      delete process.env.TEST;
      delete process.env.TEST_HARDHAT_CONFIG;
    });

    it('should deploy all deployments except one', async function () {
      this.timeout(PROTOCOL_DEPLOYMENT_TIMEOUT);
      
      if (availableDeployments.length < 2) {
        console.log('⚠️  Not enough deployments to test selective deployment (need at least 2)');
        return;
      }

      // Select one deployment to exclude (first one)
      excludedDeployment = availableDeployments[0];
      const deploymentsToDeploy = availableDeployments.slice(1);
      
      console.log(`🚀 Testing selective deployment...`);
      console.log(`📋 Excluding deployment: ${excludedDeployment}`);
      console.log(`📋 Deploying deployments: ${deploymentsToDeploy.join(', ')}`);
      
      try {
        // Build deployment command with specific deployments
        const deploymentsList = deploymentsToDeploy.join(' ');
        const command = `yes | npx ts-node scripts/deployer/deploy-markets/index.ts --network ${NETWORK_NAME} --deployments ${deploymentsList} --clean`;
        
        console.log(`📝 Running deployment command: ${command}`);
        console.log(`📝 Test mode enabled with hardhat config: ${process.env.TEST_HARDHAT_CONFIG}`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        console.log('Deployment output:', result);
        console.log(`✅ Selective deployment test passed - deployed: ${deploymentsToDeploy.join(', ')}`);
        console.log(`✅ Excluded deployment: ${excludedDeployment}`);
      } catch (error) {
        console.error('Selective deployment failed:', error.message);
        throw error;
      }
    });

    it('should propose deployment for excluded market', async function () {
      this.timeout(PROTOCOL_DEPLOYMENT_TIMEOUT);
      
      if (!excludedDeployment) {
        throw new Error('⚠️  No excluded deployment to propose');
      }
      
      console.log(`🚀 Testing governance proposal for excluded deployment: ${excludedDeployment}`)
      // Set the deployer private key for governance operations
      process.env.TEST_PK = getAdminPrivateKey(0);
      
      // Create a proposal to deploy the excluded market
      const command = `yes | npx ts-node scripts/deployer/deploy-markets/index.ts --network ${NETWORK_NAME} --deployments ${excludedDeployment}`;
      
      console.log(`📝 Running proposal command: ${command}`);
      console.log(`📝 Test mode enabled with hardhat config: ${process.env.TEST_HARDHAT_CONFIG}`);
      console.log(`📝 Using test PK: ${process.env.TEST_PK ? 'Set' : 'Not set'}`);

      const result = execSync(command, { 
        encoding: 'utf8',
        stdio: 'pipe',
        cwd: process.cwd(),
      });
      try {
        marketPhase1ProposalId = extractProposalId(result);
        console.log(`📝 Proposal ID: ${marketPhase1ProposalId}`);
        console.log(`✅ Governance proposal test passed for ${excludedDeployment}`);
      } catch (extractError) {
        console.error(`❌ Failed to extract proposal ID: ${extractError.message}`);
        throw new Error(`Proposal ID extraction failed: ${extractError.message}`);
      }
    });
  });

  function getAdminPrivateKey(index: number): string {
    const adminPks = process.env.TEST_ADMIN_PKS;
    if (!adminPks) {
      throw new Error('TEST_ADMIN_PKS environment variable is not set');
    }
    
    const adminPkArray = adminPks.split(',');
    if (index < 0 || index >= adminPkArray.length) {
      throw new Error(`Admin private key index ${index} is out of range. Available admins: 0-${adminPkArray.length - 1}`);
    }
    
    const adminPk = adminPkArray[index].trim();
    if (!adminPk) {
      throw new Error(`Admin private key at index ${index} is empty or invalid`);
    }
    
    console.log(`📝 Using admin private key at index ${index} from TEST_ADMIN_PKS`);
    return adminPk;
  }
  
  async function copyDirectory(src: string, dest: string, exclude: string[] = []): Promise<void> {
    console.log(`📁 Copying directory from ${src} to ${dest}`);
    try {
      const items = await fs.promises.readdir(src, { withFileTypes: true });
      
      for (const item of items) {
        if (exclude.includes(item.name)) {
          console.log(`⏭️  Skipping excluded item: ${item.name}`);
          continue;
        }

        const srcPath = path.join(src, item.name);
        const destPath = path.join(dest, item.name);

        if (item.isDirectory()) {
          console.log(`📂 Creating directory: ${item.name}`);
          await fs.promises.mkdir(destPath, { recursive: true });
          await copyDirectory(srcPath, destPath, exclude);
        } else {
          console.log(`📄 Copying file: ${item.name}`);
          await fs.promises.copyFile(srcPath, destPath);
        }
      }
      console.log(`✅ Directory copy completed: ${src} -> ${dest}`);
    } catch (error) {
      console.error('❌ Error copying directory:', error);
      throw error;
    }
  }

  async function deleteDirectory(): Promise<void> {
    console.log('🧹 Cleaning up folder...');
    const e2eNetworkPath = path.join(__dirname, '../../deployments', NETWORK_NAME);
    
    try {
      if (fs.existsSync(e2eNetworkPath)) {
        await fs.promises.rm(e2eNetworkPath, { recursive: true, force: true });
        console.log(`✅ Deleted entire ${NETWORK_NAME} folder: ${e2eNetworkPath}`);
      } else {
        console.log(`ℹ️  ${NETWORK_NAME} folder does not exist, nothing to clean up`);
      }
    } catch (error) {
      console.warn(`Warning: Could not delete ${NETWORK_NAME} folder:`, error);
    }
  }

  async function deleteHardhatConfigFile(): Promise<void> {
    console.log('🧹 Cleaning up test hardhat config file...');
    try {
      if (fs.existsSync(TEST_HARDHAT_CONFIG_PATH)) {
        await fs.promises.unlink(TEST_HARDHAT_CONFIG_PATH);
        console.log(`✅ Deleted test hardhat config: ${TEST_HARDHAT_CONFIG_PATH}`);
      } else {
        console.log(`ℹ️  Test hardhat config file does not exist, nothing to clean up`);
      }
    } catch (error) {
      console.warn(`Warning: Could not delete test hardhat config:`, error);
    }
  }

});
