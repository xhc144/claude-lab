// Types for update-signer.cjs (a byte-for-byte copy of scripts/windows-release/update-signer.cjs).
export interface SignerCheck { ok: boolean; reason?: string; thumbprint?: string; subject?: string }
export function installSameSignerFallback(autoUpdater: unknown, log?: (level: string, message: string) => void): boolean;
export function verifySameSigner(currentExe: string, candidateFile: string, timeoutMs?: number): Promise<SignerCheck>;
export function judge(report: Record<string, unknown>): SignerCheck;
export const SCRIPT: string;
