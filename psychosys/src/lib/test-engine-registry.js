import { calculateGenericTest } from './generic-test-engine.js';
import { calculateQedp } from './test-engines/qedp.js';
import { calculateScared } from './test-engines/scared.js';
import { calculateSdq } from './test-engines/sdq.js';
import { calculateSnapIv } from './test-engines/snap-iv.js';
import { calculateAssessment } from './test-engines/assessment.js';

const ENGINES = {
  'generic-v1': {
    version: '1',
    calculate: calculateGenericTest,
  },
  'scared-v1': {
    version: '1',
    calculate: calculateScared,
  },
  'sdq-v1': {
    version: '1',
    calculate: calculateSdq,
  },
  'snap-iv-v1': {
    version: '1',
    calculate: calculateSnapIv,
  },
  'qedp-v1': {
    version: '1',
    calculate: calculateQedp,
  },
  'assessment-v1': {
    version: '1',
    calculate: calculateAssessment,
  },
};

export function getTestEngine(engineKey) {
  return ENGINES[engineKey] || null;
}

export function isRenderableTestEngine(engineKey) {
  return Boolean(getTestEngine(engineKey));
}
