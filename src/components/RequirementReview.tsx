import { useState } from "react";
import type { CampaignSpec, Requirement } from "../lib/types";
import { formatDate, formatINR } from "../lib/format";
import { Button, Num, Panel } from "./ui";

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

  const active = editing && draft ? draft : spec;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <p className="text-[12px] text-ink-faint">
        Read this back before anything is sent. Nothing leaves until you start.
      </p>
      <h1 className="mt-1.5 text-[26px] font-semibold tracking-[-0.015em] text-ink">
        {title}
      </h1>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-ink-soft">
        <span>{active.location}</span>
        {active.targetDate && <span>{formatDate(active.targetDate)}</span>}
        {active.quantity && (
          <span>
            <Num>{active.quantity}</Num> people
          </span>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Panel
          title="Budget"
          aside={
            onSave && !editing ? (
              <button
                onClick={() => {
                  setDraft(JSON.parse(JSON.stringify(spec)) as CampaignSpec);
                  setEditing(true);
                }}
                className="text-[12px] font-medium text-brand hover:underline"
              >
                Change
              </button>
            ) : undefined
          }
          bodyClassName="p-3.5"
          className="self-start"
        >
          {editing && draft ? (
            <div className="flex flex-col gap-3">
              <label className="block">
                <span className="text-[11.5px] text-ink-soft">
                  What you hope to pay
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
                  className="tabular mt-1 block w-full rounded-md border border-line bg-surface px-3 py-1.5 text-[15px] font-semibold text-ink focus:border-brand focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[11.5px] text-ink-soft">
                  The most you will pay
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
                  className="tabular mt-1 block w-full rounded-md border border-line bg-surface px-3 py-1.5 text-[15px] font-semibold text-ink focus:border-brand focus:outline-none"
                />
              </label>
              <p className="text-[11.5px] text-ink-faint">
                The agent never goes past the second number, and that limit is
                enforced in code rather than asked of the model.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <Num className="text-[22px] font-semibold text-ink">
                  {formatINR(spec.targetBudget)}
                </Num>
                <div className="text-[11.5px] text-ink-faint">
                  what you hope to pay
                  {spec.budgetType === "per_person" ? ", per person" : ""}
                </div>
              </div>
              <div>
                <Num className="text-[22px] font-semibold text-brand">
                  {formatINR(spec.hardBudget)}
                </Num>
                <div className="text-[11.5px] text-ink-faint">
                  the most you will pay
                </div>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="What it will insist on" bodyClassName="p-3.5">
          {editing && draft ? (
            <>
              <ul className="flex flex-col gap-1.5">
                {draft.requirements.map((r) => (
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
                className="mt-2.5 text-[12px] font-medium text-brand hover:underline"
              >
                Add something
              </button>
              {!draftValid(draft) && (
                <p className="mt-2 text-[12px] text-warn">
                  Give every line a name, and keep the maximum at or above what
                  you hope to pay.
                </p>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-[11.5px] text-ink-faint">
                  Must have
                </div>
                <ul className="flex flex-col gap-1">
                  {required.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-baseline gap-2 text-[13px] text-ink"
                    >
                      <span className="text-money">✓</span>
                      {r.label}
                    </li>
                  ))}
                </ul>
              </div>
              {preferred.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[11.5px] text-ink-faint">
                    Nice to have
                  </div>
                  <ul className="flex flex-col gap-1">
                    {preferred.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-baseline gap-2 text-[13px] text-ink-soft"
                      >
                        <span className="text-ink-faint">○</span>
                        {r.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        {editing && draft ? (
          <>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Discard changes
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
          onStart && <Button onClick={onStart}>Start sourcing</Button>
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
    <li className="flex items-center gap-1.5">
      <input
        value={requirement.label}
        onChange={(e) => onChange({ ...requirement, label: e.target.value })}
        placeholder="What the vendor has to provide"
        className="flex-1 rounded-md border border-line bg-surface px-3 py-1.5 text-[13px] text-ink focus:border-brand focus:outline-none"
      />
      <select
        value={requirement.kind}
        onChange={(e) =>
          onChange({
            ...requirement,
            kind: e.target.value as Requirement["kind"],
          })
        }
        className="rounded-md border border-line bg-surface px-2 py-1.5 text-[12px] text-ink-soft focus:border-brand focus:outline-none"
      >
        <option value="required">must have</option>
        <option value="preferred">nice to have</option>
      </select>
      <button
        onClick={onRemove}
        title="Remove"
        aria-label="Remove requirement"
        className="rounded px-1.5 py-1 text-[13px] text-ink-faint hover:bg-raise hover:text-danger"
      >
        ✕
      </button>
    </li>
  );
}
