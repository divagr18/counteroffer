import { useState } from "react";
import type { CampaignSpec, Requirement } from "../lib/types";
import { formatDate, formatINR } from "../lib/format";
import { Button, Card, SectionLabel } from "./ui";

export function RequirementReview({
  title,
  spec,
  onStart,
  onSave,
}: {
  title: string;
  spec: CampaignSpec;
  onStart?: () => void;
  onSave?: (title: string, spec: CampaignSpec) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CampaignSpec | null>(null);

  const required = spec.requirements.filter((r) => r.kind === "required");
  const preferred = spec.requirements.filter((r) => r.kind === "preferred");

  const draftValid = (s: CampaignSpec) =>
    s.targetBudget > 0 &&
    s.hardBudget >= s.targetBudget &&
    s.requirements.every((r) => r.label.trim().length > 0);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <SectionLabel>Interpreted requirements</SectionLabel>
      <h2 className="mt-1 text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {spec.location}
        {spec.targetDate ? ` · ${formatDate(spec.targetDate)}` : ""}
        {spec.quantity ? ` · ${spec.quantity} people` : ""}
      </p>

      <Card className="mt-6 p-5">
        <div className="flex items-start justify-between">
          <SectionLabel>Budget</SectionLabel>
          {onSave && !editing && (
            <button
              onClick={() => {
                setDraft(JSON.parse(JSON.stringify(spec)) as CampaignSpec);
                setEditing(true);
              }}
              className="text-[12px] font-semibold text-brand hover:underline"
            >
              Edit
            </button>
          )}
        </div>
        {editing && draft ? (
          <div className="mt-3 flex flex-wrap items-end gap-6">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-ink-faint">
                target
              </span>
              <input
                type="number"
                min={0}
                value={draft.targetBudget}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    targetBudget: Number(e.target.value) || 0,
                  })
                }
                className="tabular mt-1 block w-32 rounded-lg border border-line px-3 py-1.5 text-lg font-bold text-brand focus:border-brand focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-ink-faint">
                maximum
              </span>
              <input
                type="number"
                min={0}
                value={draft.hardBudget}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    hardBudget: Number(e.target.value) || 0,
                  })
                }
                className="tabular mt-1 block w-32 rounded-lg border border-line px-3 py-1.5 text-lg font-bold text-ink focus:border-brand focus:outline-none"
              />
            </label>
            <div className="self-end pb-2 text-xs text-ink-faint">
              {draft.budgetType === "per_person"
                ? "per person"
                : draft.budgetType}
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-8">
            <div>
              <div className="tabular text-2xl font-bold text-brand">
                {formatINR(spec.targetBudget)}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-ink-faint">
                target
              </div>
            </div>
            <div>
              <div className="tabular text-2xl font-bold text-ink">
                {formatINR(spec.hardBudget)}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-ink-faint">
                maximum
              </div>
            </div>
            <div className="self-start pt-1.5 text-xs text-ink-faint">
              {spec.budgetType === "per_person" ? "per person" : spec.budgetType}
            </div>
          </div>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <SectionLabel>Required</SectionLabel>
        <ul className="mt-2 space-y-1.5">
          {editing && draft
            ? draft.requirements
                .filter((r) => r.kind === "required")
                .map((r) => (
                  <RequirementRow
                    key={r.id}
                    requirement={r}
                    onChange={(next) =>
                      setDraft({
                        ...draft,
                        requirements: draft.requirements.map((x) =>
                          x.id === next.id ? next : x,
                        ),
                      })
                    }
                    onRemove={() =>
                      setDraft({
                        ...draft,
                        requirements: draft.requirements.filter(
                          (x) => x.id !== r.id,
                        ),
                      })
                    }
                  />
                ))
            : required.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 text-sm text-ink"
                >
                  <span className="text-money">✓</span> {r.label}
                </li>
              ))}
        </ul>
        {editing && draft ? (
          <>
            <div className="mt-4">
              <SectionLabel>Preferred</SectionLabel>
            </div>
            <ul className="mt-2 space-y-1.5">
              {draft.requirements
                .filter((r) => r.kind === "preferred")
                .map((r) => (
                  <RequirementRow
                    key={r.id}
                    requirement={r}
                    onChange={(next) =>
                      setDraft({
                        ...draft,
                        requirements: draft.requirements.map((x) =>
                          x.id === next.id ? next : x,
                        ),
                      })
                    }
                    onRemove={() =>
                      setDraft({
                        ...draft,
                        requirements: draft.requirements.filter(
                          (x) => x.id !== r.id,
                        ),
                      })
                    }
                  />
                ))}
            </ul>
            <button
              onClick={() =>
                setDraft({
                  ...draft,
                  requirements: [
                    ...draft.requirements,
                    { id: crypto.randomUUID(), label: "", kind: "required" },
                  ],
                })
              }
              className="mt-3 text-[12px] font-semibold text-brand hover:underline"
            >
              + Add requirement
            </button>
            {!draftValid(draft) && (
              <p className="mt-2 text-[12px] text-warn">
                Maximum must be ≥ target and requirements need labels.
              </p>
            )}
          </>
        ) : (
          preferred.length > 0 && (
            <>
              <div className="mt-4">
                <SectionLabel>Preferred</SectionLabel>
              </div>
              <ul className="mt-2 space-y-1.5">
                {preferred.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 text-sm text-ink-soft"
                  >
                    <span className="text-ink-faint">○</span> {r.label}
                  </li>
                ))}
              </ul>
            </>
          )
        )}
      </Card>

      <div className="mt-6 flex justify-end gap-2">
        {editing && draft ? (
          <>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              disabled={!draftValid(draft)}
              onClick={() => {
                onSave?.(title, draft);
                setEditing(false);
              }}
            >
              Save
            </Button>
          </>
        ) : (
          onStart && <Button onClick={onStart}>Start sourcing →</Button>
        )}
      </div>
    </div>
  );
}

function RequirementRow({
  requirement,
  onChange,
  onRemove,
}: {
  requirement: Requirement;
  onChange: (next: Requirement) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2">
      <input
        value={requirement.label}
        onChange={(e) => onChange({ ...requirement, label: e.target.value })}
        placeholder="Requirement"
        className="flex-1 rounded-lg border border-line px-3 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
      />
      <select
        value={requirement.kind}
        onChange={(e) =>
          onChange({
            ...requirement,
            kind: e.target.value as Requirement["kind"],
          })
        }
        className="rounded-lg border border-line bg-surface px-2 py-1.5 text-[12px] text-ink-soft focus:border-brand focus:outline-none"
      >
        <option value="required">required</option>
        <option value="preferred">preferred</option>
      </select>
      <button
        onClick={onRemove}
        title="Remove requirement"
        className="px-1 text-sm text-ink-faint hover:text-warn"
      >
        ×
      </button>
    </li>
  );
}
