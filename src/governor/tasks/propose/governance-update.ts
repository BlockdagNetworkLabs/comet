import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { GovernanceService } from '../../services/GovernanceService';
import { GovernanceUpdateAction } from '../../actions/GovernanceUpdateAction';
import { GovernanceUpdate } from '../../models/GovernanceConfig';
import { getGovConfiguration, getOnchainGovConfiguration } from '../../../deploy/helpers/govConfiguration';

/**
 * Task for proposing governance updates (admins/threshold and/or timelock delay)
 */
export default async function proposeGovernanceUpdateTask(
  hre: HardhatRuntimeEnvironment,
): Promise<any> {
  const deploymentManager = (hre as any).deploymentManager;

  const { governorAdmins, multisigThreshold, timelockDelay } = await getGovConfiguration(hre.network.name);
    
  const onchainGovConfiguration = await getOnchainGovConfiguration(deploymentManager);
  
  const update: GovernanceUpdate = {};

  const set1 = new Set(...onchainGovConfiguration.admins);
  const set2 = new Set(...governorAdmins);
  const isAdminsEqual = set1.size === set2.size && [...set1].every(item => set2.has(item));

  if(!isAdminsEqual || multisigThreshold !== onchainGovConfiguration.multisigThreshold) {
    update.admins = governorAdmins;
    update.threshold = multisigThreshold;
  }
  if(timelockDelay !== onchainGovConfiguration.timelockDelay) {
    update.timelockDelay = timelockDelay;
  }
  
  try {

    const action = new GovernanceUpdateAction(deploymentManager, update);
    const proposal = await action.build();

    // Create the service and submit the proposal
    const service = new GovernanceService(deploymentManager);
    const result = await service.createProposal(proposal);

    const summary = action.getUpdateSummary();
    console.log(`   Actions: ${summary.actions} (${summary.updatingGovernance ? 'governance config' : ''}${summary.updatingGovernance && summary.updatingTimelock ? ' + ' : ''}${summary.updatingTimelock ? 'timelock delay' : ''})`);

    return {
      ...result,
      newAdmins: summary.updatingGovernance ? update.admins : null,
      newThreshold: summary.updatingGovernance ? update.threshold : null,
      newTimelockDelay: summary.updatingTimelock ? update.timelockDelay : null,
      updatingGovernance: summary.updatingGovernance,
      updatingTimelock: summary.updatingTimelock
    };
  } catch (error) {
    console.error(`❌ Failed to propose governance update:`, error);
    throw error;
  }
}
