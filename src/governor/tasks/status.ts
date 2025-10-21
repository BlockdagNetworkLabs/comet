import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ProposalService } from '../services/ProposalService';
import { ProposalState } from '../models/Proposal';
import { DeploymentManager } from '../../../plugins/deployment_manager';
import { ethers } from 'ethers';

/**
 * Get proposal state name from state number
 */
function getStateName(state: number): string {
  const stateNames: { [key: number]: string } = {
    [ProposalState.Pending]: 'Pending',
    [ProposalState.Active]: 'Active',
    [ProposalState.Canceled]: 'Canceled',
    [ProposalState.Defeated]: 'Defeated',
    [ProposalState.Succeeded]: 'Succeeded',
    [ProposalState.Queued]: 'Queued',
    [ProposalState.Expired]: 'Expired',
    [ProposalState.Executed]: 'Executed'
  };
  
  return stateNames[state] || `Unknown (${state})`;
}

/**
 * Format time remaining
 */
function formatTimeRemaining(eta: number): string {
  const now = Math.floor(Date.now() / 1000);
  
  if (eta === 0) {
    return 'Not queued yet';
  }
  
  if (now >= eta) {
    return 'Ready to execute';
  }
  
  const remaining = eta - now;
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

/**
 * Format ETA as a readable date
 */
function formatETA(eta: number): string {
  if (eta === 0) {
    return 'N/A';
  }
  
  const date = new Date(eta * 1000);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
}

/**
 * Get next steps based on current state
 */
function getNextSteps(state: number, hasEnoughApprovals: boolean, eta: number, network: string, proposalId: number): string[] {
  switch (state) {
    case ProposalState.Pending:
    case ProposalState.Active:
      if (!hasEnoughApprovals) {
        return [
          'Wait for more approvals from admins',
          `yarn hardhat governor:approve --network ${network} --proposal-id ${proposalId}`
        ];
      } else {
        return [
          'Proposal has enough approvals, ready to queue',
          `yarn hardhat governor:queue --network ${network} --proposal-id ${proposalId}`
        ];
      }
    
    case ProposalState.Succeeded:
      return [
        'Proposal has succeeded, ready to queue',
        `yarn hardhat governor:queue --network ${network} --proposal-id ${proposalId}`
      ];
    
    case ProposalState.Queued: {
      const now = Math.floor(Date.now() / 1000);
      if (now >= eta) {
        return [
          'Timelock delay has passed, ready to execute',
          `./scripts/governor/execute-proposal/index.sh -n ${network} -p ${proposalId} -t governance-update`
        ];
      } else {
        return [
          `Wait for timelock delay to pass (${formatTimeRemaining(eta)} remaining)`,
          `Check status again later or wait until ${formatETA(eta)}`
        ];
      }
    }
    
    case ProposalState.Executed:
      return [
        'Proposal has been executed successfully',
        'No further action needed'
      ];
    
    case ProposalState.Canceled:
      return [
        'Proposal has been canceled',
        'Create a new proposal if needed'
      ];
    
    case ProposalState.Defeated:
      return [
        'Proposal was defeated',
        'Review and create a new proposal if needed'
      ];
    
    case ProposalState.Expired:
      return [
        'Proposal has expired',
        'Create a new proposal'
      ];
    
    default:
      return ['Unknown state', 'Check proposal details'];
  }
}

/**
 * Decode calldata to show action details
 */
async function decodeAction(hre: HardhatRuntimeEnvironment, _deploymentManager: DeploymentManager, target: string, calldata: string): Promise<string> {
  try {
    // Try common contract ABIs to decode the calldata
    const contractNames = [
      'CustomTimelock',
      'Timelock',
      'CustomGovernor',
      'Configurator',
      'ConfiguratorProxy',
      'CometProxyAdmin',
      'Comet',
      'CometProxy',
      'CometFactory'
    ];
    
    for (const contractName of contractNames) {
      try {
        const contract = await hre.ethers.getContractAt(contractName, target);
        const decoded = contract.interface.parseTransaction({ data: calldata });
        
        if (decoded && decoded.functionFragment) {
          const args = decoded.args.map((arg, idx: number) => {
            const inputName = decoded.functionFragment.inputs[idx]?.name || `arg${idx}`;
            if (typeof arg === 'object' && arg._isBigNumber) {
              return `${inputName}: ${arg.toString()}`;
            }
            return `${inputName}: ${arg}`;
          }).join(', ');
          
          return `${decoded.name}(${args})`;
        }
      } catch {
        // Try next contract name
        continue;
      }
    }

    return calldata;
  } catch {
    return calldata;
  }
}

/**
 * Get proposal actions from events
 */
async function getProposalActions(hre: HardhatRuntimeEnvironment, deploymentManager: DeploymentManager, proposalId: number): Promise<void> {
  const governor = await deploymentManager.getContractOrThrow('governor');
  
  try {
    console.log(`\n📋 Proposal Actions:`);
    
    // Get all ProposalCreated events (proposalId is not indexed, so we can't filter by it)
    const filter = governor.filters.ProposalCreated();
    const events = await governor.queryFilter(filter);
    
    // Find the event that matches our proposalId
    const proposalEvent = events.find(event => {
      // proposalId is the first argument in ProposalCreated event
      return event.args && event.args[0] && event.args[0].toNumber() === proposalId;
    });
    
    if (proposalEvent && proposalEvent.args) {
      const targets = proposalEvent.args.targets || [];
      const values = proposalEvent.args.values || [];
      const calldatas = proposalEvent.args.calldatas || [];
      const description = proposalEvent.args.description || '';
      
      console.log(`   Description: ${description}`);
      console.log(`   Number of actions: ${targets.length}`);
      
      for (let i = 0; i < targets.length; i++) {
        try {
          console.log(`\n   Action ${i + 1}:`);
          console.log(`      Target: ${targets[i] || 'N/A'}`);
          
          // Safely handle value formatting
          try {
            const value = values[i];
            if (value !== undefined && value !== null) {
              console.log(`      Value: ${ethers.utils.formatEther(value)} ETH`);
            } else {
              console.log(`      Value: 0 ETH`);
            }
          } catch {
            console.log(`      Value: Unable to parse`);
          }
          
          // Safely handle calldata decoding
          const calldata = calldatas[i];
          if (calldata) {
            const decodedCalldata = await decodeAction(hre, deploymentManager, targets[i], calldata);
            console.log(`      Calldata: ${decodedCalldata}`);
          } else {
            console.log(`      Calldata: N/A`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`      ⚠️  Error processing action: ${errorMessage}`);
        }
      }
    } else {
      console.log(`   No proposal creation event found for proposal ${proposalId}`);
      console.log(`   This could mean the proposal is very old or was created on a different network`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   ⚠️  Could not fetch proposal actions: ${errorMessage}`);
    console.log(`   This is normal for some governor implementations`);
  }
}

/**
 * Task for getting proposal status
 */
export default async function getProposalStatusTask(
  hre: HardhatRuntimeEnvironment, 
  proposalId: number
): Promise<any> {
  if (proposalId === undefined || proposalId === null) {
    throw new Error('Proposal ID is required');
  }
  
  const deploymentManager = (hre as any).deploymentManager;
  
  if (!deploymentManager) {
    throw new Error('DeploymentManager not found. Make sure to call createDeploymentManager first.');
  }
  
  console.log(`\n🔍 Checking status of proposal ${proposalId}...`);
  
  try {
    const service = new ProposalService(deploymentManager);
    const statusResult = await service.getProposalStatus(proposalId);
    const { proposal, state } = statusResult;
    
    // Get approval information
    const approvalInfo = await service.getProposalApprovalInfo(proposalId);
    
    // Display status information
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 PROPOSAL STATUS - ID: ${proposalId}`);
    console.log(`${'='.repeat(70)}`);
    
    // State information
    console.log(`\n🎯 Current State:`);
    console.log(`   ${getStateName(state)}`);
    
    // Approval information (only relevant for active proposals)
    const terminalStates = [ProposalState.Executed, ProposalState.Canceled, ProposalState.Defeated, ProposalState.Expired];
    if (!terminalStates.includes(state)) {
      console.log(`\n👥 Approval Status:`);
      console.log(`   Current approvals: ${approvalInfo.currentApprovals}`);
      console.log(`   Required approvals: ${approvalInfo.requiredApprovals}`);
      console.log(`   Total admins: ${approvalInfo.totalAdmins}`);
      console.log(`   Has enough approvals: ${approvalInfo.hasEnoughApprovals ? '✅ Yes' : '❌ No'}`);
      
      if (!approvalInfo.hasEnoughApprovals && approvalInfo.requiredApprovals > 0) {
        const remaining = approvalInfo.requiredApprovals - approvalInfo.currentApprovals;
        console.log(`   Approvals needed: ${remaining}`);
      }
    }
    
    // Timing information
    console.log(`\n⏰ Timing Information:`);
    console.log(`   Proposer: ${proposal.proposer}`);
    console.log(`   ETA (Execution Time After): ${formatETA(proposal.eta.toNumber())}`);
    
    if (state === ProposalState.Queued) {
      const timeRemaining = formatTimeRemaining(proposal.eta.toNumber());
      console.log(`   Time until executable: ${timeRemaining}`);
      
      const now = Math.floor(Date.now() / 1000);
      if (now >= proposal.eta.toNumber()) {
        console.log(`   ✅ Ready to execute!`);
      } else {
        console.log(`   ⏳ Waiting for timelock delay`);
      }
    }
    
    // Status flags
    console.log(`\n🚩 Status Flags:`);
    console.log(`   Canceled: ${proposal.canceled ? '❌ Yes' : '✅ No'}`);
    console.log(`   Executed: ${proposal.executed ? '✅ Yes' : '❌ No'}`);
    
    // Proposal actions
    await getProposalActions(hre, deploymentManager, proposalId);
    
    // Next steps
    const nextSteps = getNextSteps(state, approvalInfo.hasEnoughApprovals, proposal.eta.toNumber(), hre.network.name, proposalId);
    console.log(`\n💡 Next Steps:`);
    nextSteps.forEach((step, idx) => {
      if (idx === 0) {
        console.log(`   ${step}`);
      } else {
        console.log(`   📝 ${step}`);
      }
    });
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`\n✅ Status check completed successfully!`);
    
    return { proposal, state, approvalInfo };
  } catch (error) {
    console.error(`❌ Failed to check proposal ${proposalId}:`, error);
    throw error;
  }
}
