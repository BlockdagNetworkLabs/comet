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
const PROPOSE_MARKET_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const TEST_HARDHAT_CONFIG_PATH = path.join(__dirname, TEMP_HARDHAT_CONFIG_FILE_NAME);
const TEST_DEPLOYMENT_PATH = path.join(__dirname, '../../deployments', NETWORK_NAME);

async function reloadHardhatConfigToIncorporateSigner(signer: string) {
  const dynamicHardhatConfig = new DynamicHardhatConfig(NETWORK_NAME, { ...E2E_NETWORK_CONFIG, accounts:[signer] }, TEST_HARDHAT_CONFIG_PATH, TEST_DEPLOYMENT_PATH);
  await dynamicHardhatConfig.generateTestHardhatConfig();
}

async function runWithSigner<T>(
  signer: string, 
  operation: () => Promise<T>
): Promise<T> {
  const originalTestPk = process.env.TEST_PK;
  try {
    // Set the new signer
    await reloadHardhatConfigToIncorporateSigner(signer);
    console.log(`📝 Running operation with signer: ${signer}`);
    // Execute the operation
    return await operation();
  } catch (error) {
    console.error(`❌ Operation failed with signer ${signer}:`, error);
    throw error;
  } finally {
    await reloadHardhatConfigToIncorporateSigner(originalTestPk);
    console.log(`📝 Reverted back to original signer: ${originalTestPk}`);
  }
}

describe('E2E Protocol Governance Test Suite', function () {
  
  describe.skip('E2E Complete Market Deployment', function () {
    // Tests deploying all markets at once

    const templatePath = path.join(__dirname, TEMPLATE_NAME);

    before(async function () {
      // Set test environment variables
      process.env.TEST = 'true';
      process.env.TEST_HARDHAT_CONFIG = TEST_HARDHAT_CONFIG_PATH;
       
      // Copy template files to e2e root
      await copyDirectory(templatePath, TEST_DEPLOYMENT_PATH, [TEMPLATE_NAME]);

      await this.reloadHardhatConfigToIncorporateSigner(process.env.TEST_PK);
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
    let excludedDeployment: string = '';
    let marketPhase1ProposalId: string = '';
    let executionTimestamp: number | null = null; // Add this global variable

    before(async function () {
      // Set test environment variables
      process.env.TEST = 'true';
      process.env.TEST_HARDHAT_CONFIG = TEST_HARDHAT_CONFIG_PATH;

      // Copy template files to e2e root
      const templatePath = path.join(__dirname, TEMPLATE_NAME);
      await copyDirectory(templatePath, TEST_DEPLOYMENT_PATH, [TEMPLATE_NAME]);

      await reloadHardhatConfigToIncorporateSigner(process.env.TEST_PK);
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

      // Fetch all available deployment names
      const availableDeployments = await ProtocolDiscover.discoverMarkets(TEST_DEPLOYMENT_PATH);
      console.log(`📋 Found ${availableDeployments.length} available deployments:`, availableDeployments);
      
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
      this.timeout(PROPOSE_MARKET_TIMEOUT);

      if (!excludedDeployment) {
        throw new Error('⚠️  No excluded deployment to propose');
      }

      await runWithSigner(getAdminPrivateKey(0), async () => {
       
        console.log(`🚀 Testing governance proposal for excluded deployment: ${excludedDeployment}`);
        // Create a proposal to deploy the excluded market
        const command = `yes | npx ts-node scripts/governor/propose/market-phase-1/index.ts --network ${NETWORK_NAME} --deployment ${excludedDeployment}`;
        
        console.log(`📝 Running proposal command: ${command}`);
        console.log(`📝 Test mode enabled with hardhat config: ${process.env.TEST_HARDHAT_CONFIG}`);
        console.log(`📝 Using admin private key for governance operations`);

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

    it('should accept proposal with required admin signatures', async function () {      
      if (!marketPhase1ProposalId) {
        throw new Error('⚠️  No proposal ID available to accept');
      }
      
      // Get threshold from environment (assume it exists)
      const threshold = parseInt(process.env.MULTISIG_THRESHOLD!);
      console.log(`📋 Required threshold for proposal acceptance: ${threshold}`);
      
      // Get admin signers from environment (assume it exists)
      const adminSigners = process.env.TEST_ADMIN_PKS!;
      const adminPkArray = adminSigners.split(',').map(pk => pk.trim());
      console.log(`📋 Available admin signers: ${adminPkArray.length}`);
      
      // Iterate through required number of admins to meet threshold
      for (let i = 0; i < Math.min(threshold, adminPkArray.length); i++) {
        console.log(`🎯 Accepting proposal with admin ${i + 1}/${threshold}`);
        
        await runWithSigner(getAdminPrivateKey(i), async () => {
          const command = `npx ts-node scripts/governor/accept-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${marketPhase1ProposalId}`;
          
          console.log(`📝 Running accept proposal command: ${command}`);
          console.log(`📝 Using admin private key ${i + 1} for proposal acceptance`);
          
          const result = execSync(command, { 
            encoding: 'utf8',
            stdio: 'pipe',
            cwd: process.cwd(),
          });
          
          console.log(`✅ Admin ${i + 1} acceptance result:`, result);
        });
      }
      
      console.log(`✅ Proposal acceptance completed with ${threshold} admin signatures`);
    });

    it('should queue proposal with first admin', async function () {
      this.timeout(PROPOSE_MARKET_TIMEOUT);
      
      if (!marketPhase1ProposalId) {
        throw new Error('⚠️  No proposal ID available to queue');
      }
      
      console.log(`🚀 Queueing proposal: ${marketPhase1ProposalId}`);
      
      // Use only the first admin to queue the proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/queue-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${marketPhase1ProposalId}`;
        
        console.log(`📝 Running queue proposal command: ${command}`);
        console.log(`📝 Using first admin private key for proposal queueing`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Queue proposal result:`, result);
        
        // Extract execution timestamp from the output
        const etaMatch = result.match(/ETA: (\d+)/);
        if (etaMatch) {
          // Store the execution timestamp in the global variable
          executionTimestamp = parseInt(etaMatch[1]);
          console.log(`📅 Execution timestamp captured: ${executionTimestamp}`);
          console.log(`📅 Execution time: ${new Date(executionTimestamp * 1000).toLocaleString()}`);
        } else {
          throw new Error('Could not extract execution timestamp from queue output');
        }
      });
      
      // Remove this line:
      // (this as any).executionTimestamp = executionTimestamp;
      
      console.log(`✅ Proposal queueing completed with first admin`);
    });

    it('should execute proposal with first admin', async function () {
      this.timeout(PROPOSE_MARKET_TIMEOUT);
      
      if (!marketPhase1ProposalId) {
        throw new Error('⚠️  No proposal ID available to execute');
      }
      
      // Use the global variable instead
      if (!executionTimestamp) {
        throw new Error('⚠️  No execution timestamp available from queue test');
      }
      
      console.log(`🚀 Executing proposal: ${marketPhase1ProposalId}`);
      console.log(`📅 Waiting until execution time: ${new Date(executionTimestamp * 1000).toLocaleString()}`);
      
      // Wait until the execution timestamp is reached
      const currentTime = Math.floor(Date.now() / 1000);
      const timeToWait = executionTimestamp - currentTime;
      
      if (timeToWait > 0) {
        console.log(`⏳ Waiting ${timeToWait} seconds until execution time...`);
        await new Promise(resolve => setTimeout(resolve, timeToWait * 1000));
      }
      
      console.log(`✅ Execution time reached, proceeding with execution`);
      
      // Use only the first admin to execute the proposal
      await runWithSigner(getAdminPrivateKey(0), async () => {
        const command = `npx ts-node scripts/governor/execute-proposal/index.ts --network ${NETWORK_NAME} --proposal-id ${marketPhase1ProposalId} --execution-type comet-impl-in-configuration`;
        
        console.log(`📝 Running execute proposal command: ${command}`);
        console.log(`📝 Using first admin private key for proposal execution`);
        
        const result = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        
        console.log(`✅ Execute proposal result:`, result);
      });
      
      console.log(`✅ Proposal execution completed with first admin`);
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
