import { expect } from 'chai';
import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

describe('E2E Protocol Governance Test', function () {
  let templatePath: string;
  let e2ePath: string;

  before(async function () {
    // Set up paths
    templatePath = path.join(__dirname, '../deployments/e2e/_template-1');
    e2ePath = path.join(__dirname, '../deployments/e2e');

    console.log('📁 Copying template files to e2e root...');
    console.log(`Template path: ${templatePath}`);
    console.log(`E2E path: ${e2ePath}`);

    // Copy template files to e2e root
    await copyDirectory(templatePath, e2ePath, ['_template-1']);

    console.log('✅ Template files copied successfully');
  });

  after(async function () {
    // Clean up copied files
    console.log('🧹 Cleaning up copied files...');
    await cleanupCopiedFiles();
    console.log('✅ Cleanup completed');
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

    console.log('✅ Template files verification passed');
  });
});

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
async function cleanupCopiedFiles(): Promise<void> {
  const e2ePath = path.join(__dirname, '../deployments/e2e');
  
  try {
    const items = await fs.promises.readdir(e2ePath, { withFileTypes: true });
    
    for (const item of items) {
      if (item.name === '_template-1') {
        continue; // Don't delete the template
      }

      const itemPath = path.join(e2ePath, item.name);
      
      if (item.isDirectory()) {
        await fs.promises.rm(itemPath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(itemPath);
      }
    }
  } catch (error) {
    console.warn('Warning: Could not clean up copied files:', error);
  }
}
