import { DeploymentManager } from '../../plugins/deployment_manager';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

/**
 * Proposes a Comet implementation upgrade through governance
 * This function is separated from Network.ts to avoid circular dependencies
 * when imported by governor tasks.
 */
export async function proposeCometUpgrade(
  deploymentManager: DeploymentManager,
  newImplementationAddress: string,
  adminSigner?: SignerWithAddress
): Promise<any> {
  const admin = adminSigner ?? await deploymentManager.getSigner();
  const trace = deploymentManager.tracer();
  
  // Get required contracts
  const governor = await deploymentManager.getContractOrThrow('governor');
  const cometAdmin = await deploymentManager.getContractOrThrow('cometAdmin');
  const comet = await deploymentManager.getContractOrThrow('comet');
  
  // Prepare proposal data
  const targets: string[] = [];
  const values: number[] = [];
  const calldatas: string[] = [];
  
  // Action: upgrade the Comet proxy to the new implementation
  targets.push(cometAdmin.address);
  values.push(0);
  calldatas.push(
    cometAdmin.interface.encodeFunctionData('upgrade', [
      comet.address,
      newImplementationAddress
    ])
  );
  
  const description = `Upgrade Comet implementation to ${newImplementationAddress}`;
  
  trace(`Creating upgrade proposal:`);
  trace(`1. upgrade(${comet.address}, ${newImplementationAddress})`);
  
  // Submit proposal to governor
  trace(`Submitting upgrade proposal to governor`);
  
  const tx = await governor.connect(admin).propose(
    targets,
    values,
    calldatas,
    description
  );
  
  const receipt = await tx.wait();
  trace(`Upgrade proposal submitted! Transaction hash: ${receipt.transactionHash}`);
  trace(`Proposal ID: ${await governor.proposalCount()}`);
  
  return {
    targets,
    values,
    calldatas,
    description,
    governor: governor.address,
    cometAdmin: cometAdmin.address,
    comet: comet.address,
    newImplementation: newImplementationAddress,
    tx: receipt
  };
} 