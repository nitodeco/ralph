import type { Prd, VerificationResult } from "@/types.ts";

export type PrdUpdateCallback = (prd: Prd) => void;
export type RestartIterationCallback = () => void;
export type VerificationStateCallback = (
	isVerifying: boolean,
	result: VerificationResult | null,
) => void;
