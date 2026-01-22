import type { Prd, VerificationResult } from "@/types.ts";
import type { TechnicalDebtReport } from "./TechnicalDebtHandler.ts";

export type PrdUpdateCallback = (prd: Prd) => void;
export type RestartIterationCallback = () => void;
export type VerificationStateCallback = (
	isVerifying: boolean,
	result: VerificationResult | null,
) => void;
export type TechnicalDebtStateCallback = (
	isReviewing: boolean,
	report: TechnicalDebtReport | null,
) => void;
