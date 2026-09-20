import { useState } from "react";
import { Button } from "./ui";

const EXAMPLES = [
  "Wedding photographer",
  "Movers",
  "Catering",
  "Private tutor",
  "Repair service",
  "Event venue",
];

export function Home({
  onCreate,
}: {
  onCreate: (description: string) => void;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (value.trim().length < 8) return;
    onCreate(value.trim());
  };

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-20">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">
          P
        </div>
        <span className="text-lg font-semibold tracking-tight">
          Procurement Network
        </span>
      </div>

      <h1 className="max-w-2xl text-center text-4xl font-bold tracking-tight text-ink">
        What do you need?
      </h1>
      <p className="mt-3 max-w-xl text-center text-base text-ink-soft">
        Tell it what you need. It finds vendors, contacts them, negotiates, and
        compares the actual offers — so you don't have to.
      </p>

      <div className="mt-8 w-full max-w-2xl">
        <div className="rounded-2xl border border-line bg-surface p-2 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            placeholder="e.g. Wedding photographer in Mumbai on October 18. Eight hours, candid photography and highlight video. Try to stay under ₹40,000."
            className="w-full resize-none rounded-xl bg-transparent px-4 py-3 text-[15px] text-ink outline-none placeholder:text-ink-faint"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-xs text-ink-faint">
              The agent does the searching, emailing and negotiating.
            </span>
            <Button onClick={submit} disabled={value.trim().length < 8}>
              Make them compete →
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              onClick={() => setValue(`${example} in Mumbai next month`)}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
