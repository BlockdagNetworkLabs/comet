import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { DynamicHardhatConfig } from './helpers/dynamic-hardhat-config';


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
  describe(`Template: ${TEMPLATE_NAME}`, function () {

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
      console.log('🧹 Cleaning up folder...');
      await deleteDirectory();
      console.log('✅ folder cleanup completed');

      // Clean up test hardhat config file
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
          stdio: 'inherit',
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

  async function copyDirectory(src: string, dest: string, exclude: string[] = []): Promise<void> {
    try {
      const items = await fs.promises.readdir(src, { withFileTypes: true });
      
      for (const item of items) {
        if (exclude.includes(item.name)) {
          continue;
        }

        const srcPath = path.join(src, item.name);
        const destPath = path.join(dest, item.name);

        if (item.isDirectory()) {
          await fs.promises.mkdir(destPath, { recursive: true });
          await copyDirectory(srcPath, destPath, exclude);
        } else {
          await fs.promises.copyFile(srcPath, destPath);
        }
      }
    } catch (error) {
      console.error('Error copying directory:', error);
      throw error;
    }
  }

  async function deleteDirectory(): Promise<void> {
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
    try {
      if (fs.existsSync(TEST_HARDHAT_CONFIG_PATH)) {
        await fs.promises.unlink(TEST_HARDHAT_CONFIG_PATH);
        console.log(`✅ Deleted test hardhat config: ${TEST_HARDHAT_CONFIG_PATH}`);
      }
    } catch (error) {
      console.warn(`Warning: Could not delete test hardhat config:`, error);
    }
  }
});