import type { PipelineRow } from "./types";
import { formatINR, pct } from "./format";

/**
 * Deterministic ranking explanation (doc §20): why one vendor outranks
 * another, expressed as plain bullets a judge can inspect. No LLM involved.
 */
export function explainRanking(
  row: PipelineRow,
  leader: PipelineRow,
  requiredCount: number,
): string[] {
  const offer = row.offer!;
  const leaderOffer = leader.offer!;
  const satisfied = Math.min(row.cv.satisfiedRequirements.length, requiredCount);

  if (row.cv._id === leader.cv._id) {
    return [
      `Best overall — ${formatINR(offer.estimatedTotal)} with ${satisfied} of ${requiredCount} required met and ${pct(offer.completenessScore)} complete quote.`,
    ];
  }

  const leaderName = leader.vendor?.name ?? "the leader";
  const delta = leaderOffer.estimatedTotal - offer.estimatedTotal;
  const priceBullet =
    delta > 0
      ? `${formatINR(delta)} cheaper than ${leaderName}`
      : delta < 0
        ? `${formatINR(-delta)} more than ${leaderName}`
        : `same price as ${leaderName}`;

  const negatives: string[] = [];
  if (requiredCount > 0 && satisfied < requiredCount) {
    negatives.push(
      `covers ${satisfied} of ${requiredCount} required requirements`,
    );
  }
  if (offer.missingFields.length > 0) {
    negatives.push(`unresolved: ${offer.missingFields.join(", ")}`);
  }
  if (row.cv.availability !== true) {
    negatives.push("availability unconfirmed");
  }
  if (offer.completenessScore < 0.9) {
    negatives.push(`quote only ${pct(offer.completenessScore)} complete`);
  }

  if (delta > 0 && negatives.length > 0) {
    return [`${priceBullet}, but:`, ...negatives];
  }
  if (delta > 0) {
    return [`${priceBullet} and meets every tracked requirement.`];
  }
  return [
    priceBullet,
    ...(negatives.length > 0 ? negatives : ["meets every tracked requirement"]),
  ];
}
