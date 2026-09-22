import { useState } from "react";
import { Button } from "./ui";

const EXAMPLES: { label: string; text: string }[] = [
  {
    label: "Wedding photographer",
    text: "Wedding photographer in Mumbai on October 18. Eight hours, candid photography and a highlight video. Try to stay under ₹40,000.",
  },
  {
    label: "Catering",
    text: "Catering for 35 people in Bandra next Saturday. Vegetarian, preferably North Indian, around ₹900 a head, setup included.",
  },
  {
    label: "Movers",
    text: "Movers for a 2BHK from Andheri to Powai on the 12th. Packing included, fragile items, under ₹18,000.",
  },
  {
    label: "Private tutor",
    text: "Physics tutor for class 11 in Mumbai, twice a week at home, starting next month, under ₹1,200 an hour.",
  },
];

export function Home({ onCreate }: { onCreate: (description: string) => void }) {
  const [value, setValue] = useState("");
  const ready = value.trim().length >= 8;

  const submit = () => {
    if (!ready) return;
    onCreate(value.trim());
  };

  return (
    <div className="min-w-0">
      <div>
        <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
          Tell it what you need.
          <br />
          It makes them compete.
        </h1>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-soft">
          The agent searches the web for vendors, emails them from its own
          inbox, reads the replies, negotiates inside your budget, and puts every
          real quote side by side.
        </p>
      </div>

      <div className="mt-8 rounded-lg border border-line bg-surface">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          rows={3}
          placeholder="Wedding photographer in Mumbai on October 18. Eight hours, candid photography and a highlight video. Try to stay under ₹40,000."
          aria-label="What do you need?"
          className="w-full resize-none bg-transparent px-4 py-3.5 text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink-faint"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2">
          <span className="text-[11.5px] text-ink-faint">
            Include the date, the place and your budget if you have one.
          </span>
          <Button onClick={submit} disabled={!ready}>
            Start sourcing
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[11px] text-ink-faint">try</span>
        {EXAMPLES.map((example) => (
          <button
            key={example.label}
            onClick={() => setValue(example.text)}
            className="rounded-md border border-line px-2.5 py-1 text-[12px] text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
          >
            {example.label}
          </button>
        ))}
      </div>
    </div>
  );
}
