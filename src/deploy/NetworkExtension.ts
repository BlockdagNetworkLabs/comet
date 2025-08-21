import { DeploymentManager } from '../../plugins/deployment_manager';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

/**
 * Proposes a combined Comet upgrade and reward configuration through governance
 * This function creates a single proposal with both actions
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
  const rewards = await deploymentManager.getContractOrThrow('rewards');
  const COMP = await deploymentManager.getContractOrThrow('COMP');
  
  // Prepare proposal data
  const targets: string[] = [];
  const values: number[] = [];
  const calldatas: string[] = [];

  const rewardTokenAddress = COMP.address;
  
  // Action 1: upgrade the Comet proxy to the new implementation
  targets.push(cometAdmin.address);
  values.push(0);
  calldatas.push(
    cometAdmin.interface.encodeFunctionData('upgrade', [
      comet.address,
      newImplementationAddress
    ])
  );
  
  // Action 2: initialize storage in the Comet contract
  targets.push(comet.address);
  values.push(0);
  calldatas.push(
    comet.interface.encodeFunctionData('initializeStorage', [])
  );
  
  // Action 3: set reward configuration for the Comet instance
  targets.push(rewards.address);
  values.push(0);
  calldatas.push(
    rewards.interface.encodeFunctionData('setRewardConfig', [
      comet.address,
      rewardTokenAddress
    ])
  );
  
  const description = `Upgrade Comet implementation to ${newImplementationAddress}, initialize storage, and set reward token to ${rewardTokenAddress}`;
  
  trace(`Creating combined upgrade and reward config proposal:`);
  trace(`1. upgrade(${comet.address}, ${newImplementationAddress})`);
  trace(`2. initializeStorage()`);
  trace(`3. setRewardConfig(${comet.address}, ${rewardTokenAddress})`);
  
  // Submit proposal to governor
  trace(`Submitting combined proposal to governor`);
  
  const tx = await governor.connect(admin).propose(
    targets,
    values,
    calldatas,
    description
  );
  
  const receipt = await tx.wait();
  trace(`Combined proposal submitted! Transaction hash: ${receipt.transactionHash}`);
  trace(`Proposal ID: ${await governor.proposalCount()}`);
  
  return {
    targets,
    values,
    calldatas,
    description,
    governor: governor.address,
    cometAdmin: cometAdmin.address,
    comet: comet.address,
    rewards: rewards.address,
    newImplementation: newImplementationAddress,
    rewardToken: rewardTokenAddress,
    tx: receipt
  };
} 