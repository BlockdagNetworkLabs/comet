import { expect } from 'chai';
import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';
import hre from 'hardhat';
import { DeploymentManager } from '../../plugins/deployment_manager';
import { Deployed } from '../../plugins/deployment_manager';
import relationConfigMap from '../../deployments/relations';

// Configuration
const NETWORK_NAME = 'e2e-network';
const TEMPLATES = ['_template-1'];

describe('E2E Protocol Governance Test Suite', function () {
  // Run tests for each template
  TEMPLATES.forEach(templateName => {
    describe(`Template: ${templateName}`, function () {
      let deploymentManager: DeploymentManager;
      let deployedContracts: Deployed;
      let templatePath: string;
      let e2ePath: string;

      before(async function () {
        // Set up paths - template is now in the same directory as the test file
        templatePath = path.join(__dirname, templateName);
        e2ePath = path.join(__dirname, '../../deployments', NETWORK_NAME);

        console.log(`📁 Copying ${templateName} files to ${e2ePath}`);
        console.log(`Template path: ${templatePath}`);
        console.log(`E2E path: ${e2ePath}`);

        // Copy template files to e2e root
        await copyDirectory(templatePath, e2ePath, [templateName]);

        // Setup relation configs for e2e-network
        await setupRelationConfigs(e2ePath, templateName);

        // Initialize deployment manager
        deploymentManager = new DeploymentManager(NETWORK_NAME, NETWORK_NAME, hre, {
          writeCacheToDisk: false,
          importRetries: 0,
        });

        console.log(`✅ ${templateName} files copied and relation configs loaded successfully`);
      });

      after(async function () {
        // Clean up copied files for this template
        console.log(`🧹 Cleaning up ${templateName} files...`);
        await cleanupCopiedFiles(templateName);
        console.log(`✅ ${templateName} cleanup completed`);
      });

      it('should have copied template files', async function () {
        // Verify that the template files were copied
        const infrastructurePath = path.join(e2ePath, '_infrastructure');
        const daiPath = path.join(e2ePath, 'dai');
        const usdcPath = path.join(e2ePath, 'usdc');

        expect(fs.existsSync(infrastructurePath)).to.be.true;
        expect(fs.existsSync(daiPath)).to.be.true;
        expect(fs.existsSync(usdcPath)).to.be.true;

        // Verify specific files exist
        expect(fs.existsSync(path.join(infrastructurePath, 'deploy.ts'))).to.be.true;
        expect(fs.existsSync(path.join(infrastructurePath, 'relations.ts'))).to.be.true;
        expect(fs.existsSync(path.join(daiPath, 'deploy.ts'))).to.be.true;
        expect(fs.existsSync(path.join(usdcPath, 'deploy.ts'))).to.be.true;

        console.log(`✅ ${templateName} files verification passed`);
      });

      it('should have relation config available', async function () {
        // Verify that relation config is available for e2e-network
        expect(hre.config.deploymentManager).to.not.be.undefined;
        expect(hre.config.deploymentManager.networks[NETWORK_NAME]).to.not.be.undefined;
        expect(hre.config.deploymentManager.networks[NETWORK_NAME]._infrastructure).to.not.be.undefined;
        expect(hre.config.deploymentManager.networks[NETWORK_NAME].dai).to.not.be.undefined;
        expect(hre.config.deploymentManager.networks[NETWORK_NAME].usdc).to.not.be.undefined;

        console.log(`✅ ${templateName} relation config verification passed`);
      });

      // Add template-specific tests here
      it('should deploy infrastructure successfully', async function () {
        // This test will be specific to each template
        console.log(`🚀 Testing infrastructure deployment for ${templateName}`);
        // Add your deployment logic here
      });

      it('should deploy markets successfully', async function () {
        // This test will be specific to each template
        console.log(`🚀 Testing market deployment for ${templateName}`);
        // Add your market deployment logic here
      });
    });
  });

  // Global cleanup after all tests complete
  after(async function () {
    console.log('🧹 Cleaning up entire e2e-network folder...');
    await cleanupEntireNetworkFolder();
    console.log('✅ e2e-network folder cleanup completed');
  });
});

// Helper function to cleanup entire e2e-network folder
async function cleanupEntireNetworkFolder(): Promise<void> {
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

// Helper function to setup relation configs for e2e-network
async function setupRelationConfigs(e2ePath: string, templateName: string): Promise<void> {
  // Ensure deploymentManager config exists
  if (!hre.config.deploymentManager) {
    hre.config.deploymentManager = { relationConfigMap, networks: {} };
  }
  if (!hre.config.deploymentManager.networks) {
    hre.config.deploymentManager.networks = {};
  }
  if (!hre.config.deploymentManager.networks[NETWORK_NAME]) {
    hre.config.deploymentManager.networks[NETWORK_NAME] = {};
  }

  // Load infrastructure relation config first
  try {
    const infrastructureRelationPath = path.join(e2ePath, '_infrastructure', 'relations.ts');
    if (fs.existsSync(infrastructureRelationPath)) {
      delete require.cache[require.resolve(infrastructureRelationPath)];
      const infrastructureRelationConfig = require(infrastructureRelationPath).default;
      hre.config.deploymentManager.networks[NETWORK_NAME]._infrastructure = infrastructureRelationConfig;
      console.log(`✅ Loaded infrastructure relation config for ${templateName}`);
    }
  } catch (error) {
    console.warn(`Warning: Could not load infrastructure relation config for ${templateName}:`, error);
    hre.config.deploymentManager.networks[NETWORK_NAME]._infrastructure = relationConfigMap;
  }

  // Dynamically discover and load relation configs for all deployment folders (excluding _infrastructure)
  try {
    const items = await fs.promises.readdir(e2ePath, { withFileTypes: true });
    
    for (const item of items) {
      // Skip _infrastructure (already loaded), template folders, and non-directories
      if (item.name === '_infrastructure' || item.name.startsWith('_template-') || !item.isDirectory()) {
        continue;
      }

      const deploymentName = item.name;
      const relationPath = path.join(e2ePath, deploymentName, 'relations.ts');
      
      if (fs.existsSync(relationPath)) {
        try {
          delete require.cache[require.resolve(relationPath)];
          const deploymentRelationConfig = require(relationPath).default;
          hre.config.deploymentManager.networks[NETWORK_NAME][deploymentName] = deploymentRelationConfig;
          console.log(`✅ Loaded ${deploymentName} relation config for ${templateName}`);
        } catch (error) {
          console.warn(`Warning: Could not load ${deploymentName} relation config for ${templateName}:`, error);
          // Fallback to base relation config
          hre.config.deploymentManager.networks[NETWORK_NAME][deploymentName] = relationConfigMap;
        }
      } else {
        console.log(`ℹ️  No relations.ts found for ${deploymentName} in ${templateName}, using base relation config`);
        hre.config.deploymentManager.networks[NETWORK_NAME][deploymentName] = relationConfigMap;
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not discover deployment folders for ${templateName}:`, error);
  }
}

// Helper function to copy directory recursively
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

// Helper function to clean up copied files
async function cleanupCopiedFiles(templateName: string): Promise<void> {
  const e2ePath = path.join(__dirname, '../../deployments', NETWORK_NAME);
  
  try {
    const items = await fs.promises.readdir(e2ePath, { withFileTypes: true });
    
    for (const item of items) {
      // Don't delete template folders
      if (item.name.startsWith('_template-')) {
        continue;
      }

      const itemPath = path.join(e2ePath, item.name);
      
      if (item.isDirectory()) {
        await fs.promises.rm(itemPath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(itemPath);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not clean up copied files for ${templateName}:`, error);
  }
}
