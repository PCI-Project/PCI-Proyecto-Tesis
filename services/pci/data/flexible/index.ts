import { alligatorCrackingCurves } from './1_alligator_cracking';
import { bleedingCurves } from './2_bleeding';
import { blockCrackingCurves } from './3_block_cracking';
import { bumpsAndSagsCurves } from './4_bumps_and_sags';
import { corrugationCurves } from './5_corrugation';
import { depressionCurves } from './6_depression';
import { edgeCrackingCurves } from './7_edge_cracking';
import { jointReflectionCrackingCurves } from './8_joint_reflection_cracking';
import { laneShoulderDropoffCurves } from './9_lane_shoulder_dropoff';
import { longTransCrackingCurves } from './10_long_trans_cracking';
import { patchingCurves } from './11_patching';
import { polishedAggregateCurves } from './12_polished_aggregate';
import { potholesCurves } from './13_potholes';
import { railroadCrossingCurves } from './14_railroad_crossing';
import { ruttingCurves } from './15_rutting';
import { shovingCurves } from './16_shoving';
import { slippageCrackingCurves } from './17_slippage_cracking';
import { swellCurves } from './18_swell';
import { ravelingCurves } from './19-1_raveling';
import { weatheringCurves } from './19-2_weathering';

export const FLEXIBLE_DISTRESS_CURVES = {
  '1': alligatorCrackingCurves,
  '2': bleedingCurves,
  '3': blockCrackingCurves,
  '4': bumpsAndSagsCurves,
  '5': corrugationCurves,
  '6': depressionCurves,
  '7': edgeCrackingCurves,
  '8': jointReflectionCrackingCurves,
  '9': laneShoulderDropoffCurves,
  '10': longTransCrackingCurves,
  '11': patchingCurves,
  '12': polishedAggregateCurves,
  '13': potholesCurves,
  '14': railroadCrossingCurves,
  '15': ruttingCurves,
  '16': shovingCurves,
  '17': slippageCrackingCurves,
  '18': swellCurves,
  '19.1': ravelingCurves,
  '19.2': weatheringCurves,
};
