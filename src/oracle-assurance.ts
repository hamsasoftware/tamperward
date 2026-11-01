import { isRecord } from './narrow';

export const SUITE_EXIT_LIMITATION = 'candidate source executes inside the configured suite process and may terminate or interpose on that in-process oracle; isolated-container is execution-domain isolation, not semantic/oracle isolation';

export interface OracleAssuranceReport {
  level: 'suite-exit-only';
  semantic_isolation: false;
  candidate_code_executes_in_oracle_process: true;
  limitation: string;
}

export function suiteExitAssurance(): OracleAssuranceReport {
  return {
    level: 'suite-exit-only',
    semantic_isolation: false,
    candidate_code_executes_in_oracle_process: true,
    limitation: SUITE_EXIT_LIMITATION,
  };
}

export function isSuiteExitAssurance(value: unknown): value is OracleAssuranceReport {
  return isRecord(value)
    && Object.keys(value).sort().join('\0') === ['candidate_code_executes_in_oracle_process', 'level', 'limitation', 'semantic_isolation'].join('\0')
    && value.level === 'suite-exit-only'
    && value.semantic_isolation === false
    && value.candidate_code_executes_in_oracle_process === true
    && value.limitation === SUITE_EXIT_LIMITATION;
}
