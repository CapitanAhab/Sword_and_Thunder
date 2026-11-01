import type { RulesDb } from '../core/defs'
import { magus } from './classes/magus'
import { feats } from './feats'
import { human } from './races/human'

export const db: RulesDb = {
  classes: { magus },
  races: { human },
  feats,
}
