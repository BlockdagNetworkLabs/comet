import * as fs from 'fs';
import * as path from 'path';

export interface ProtocolDiscoveryOptions {
  excludeInfrastructure?: boolean;
  excludeTemplates?: boolean;
  validateDeployFile?: boolean;
  sort?: boolean;
}

export class ProtocolDiscover {
  /**
   * Discovers protocol deployments in a given path
   * @param discoveryPath - Path to search for deployments
   * @param options - Configuration options for discovery
   * @returns Array of deployment names
   */
  static async discoverDeployments(
    discoveryPath: string, 
    options: ProtocolDiscoveryOptions = {}
  ): Promise<string[]> {
    const {
      excludeInfrastructure = true,
      excludeTemplates = true,
      validateDeployFile = true,
      sort = true
    } = options;

    console.log(`🔍 Discovering protocol deployments in: ${discoveryPath}`);
    
    try {
      const items = await fs.promises.readdir(discoveryPath, { withFileTypes: true });
      const deployments: string[] = [];
      
      for (const item of items) {
        // Skip non-directories
        if (!item.isDirectory()) {
          continue;
        }

        const deploymentName = item.name;
        
        // Skip infrastructure if requested
        if (excludeInfrastructure && deploymentName === '_infrastructure') {
          console.log(`⏭️  Skipping infrastructure: ${deploymentName}`);
          continue;
        }
        
        // Skip templates if requested
        if (excludeTemplates && deploymentName.startsWith('_template')) {
          console.log(`⏭️  Skipping template: ${deploymentName}`);
          continue;
        }
        
        // Skip other special directories starting with _
        if (excludeTemplates && deploymentName.startsWith('_')) {
          console.log(`⏭️  Skipping special directory: ${deploymentName}`);
          continue;
        }

        // Validate deploy.ts file if requested
        if (validateDeployFile) {
          const deployPath = path.join(discoveryPath, deploymentName, 'deploy.ts');
          if (!fs.existsSync(deployPath)) {
            console.log(`⚠️  Skipping ${deploymentName} - no deploy.ts found`);
            continue;
          }
        }

        deployments.push(deploymentName);
        console.log(`✅ Discovered protocol deployment: ${deploymentName}`);
      }

      if (sort) {
        deployments.sort();
      }

      console.log(`📋 Found ${deployments.length} protocol deployments: ${deployments.join(', ')}`);
      return deployments;
      
    } catch (error) {
      console.error('❌ Error discovering protocol deployments:', error);
      throw error;
    }
  }
  /**
   * Discovers markets from copied deployment directory (for runtime)
   * @param deploymentPath - Path to deployment directory
   * @returns Array of market names
   */
  static async discoverMarkets(deploymentPath: string): Promise<string[]> {
    return this.discoverDeployments(deploymentPath, {
      excludeInfrastructure: true,
      excludeTemplates: true,
      validateDeployFile: true, // Markets must have deploy.ts
      sort: true
    });
  }
}
