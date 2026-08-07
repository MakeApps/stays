"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SearchIcon } from "@/components/layout/icons";
import { useSearch } from "@/features/dashboard/api";
import type { SearchHit } from "@/types/api";

/**
 * Cross-entity search for the topbar.
 *
 * The design's search only filtered the calendar (line 2328); this actually
 * searches condos, bookings and expenses. Results are grouped because a guest
 * name and a vendor name are different kinds of answer.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // 250ms: fast enough to feel live, slow enough not to query per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(id);
  }, [term]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data, isFetching } = useSearch(debounced);
  const groups: [string, SearchHit[]][] = [
    ["Condos", data?.condos ?? []],
    ["Bookings", data?.bookings ?? []],
    ["Expenses", data?.expenses ?? []],
  ];
  const total = groups.reduce((n, [, hits]) => n + hits.length, 0);

  function go(href: string) {
    setOpen(false);
    setTerm("");
    router.push(href as never);
  }

  return (
    <div ref={box} style={{ position: "relative", flex: 1, maxWidth: 420 }}>
      <div className="search-box">
        <SearchIcon />
        <input
          placeholder="Search guests, condos, expenses…"
          aria-label="Search"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        />
      </div>

      {open && debounced.trim().length >= 2 ? (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            zIndex: 40,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            boxShadow: "var(--shadow-lg)",
            padding: 8,
            maxHeight: 420,
            overflowY: "auto",
            animation: "lsPop 160ms var(--ease-out) both",
          }}
        >
          {total === 0 ? (
            <div className="t-small" style={{ padding: "16px 12px", textAlign: "center" }}>
              {isFetching ? "Searching…" : `Nothing matches “${debounced.trim()}”.`}
            </div>
          ) : (
            groups
              .filter(([, hits]) => hits.length > 0)
              .map(([label, hits]) => (
                <div key={label} style={{ marginBottom: 4 }}>
                  <div className="t-eyebrow" style={{ padding: "8px 10px 4px" }}>
                    {label}
                  </div>
                  {hits.map((hit) => (
                    <button
                      key={hit.id}
                      role="option"
                      aria-selected={false}
                      onClick={() => go(hit.href)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
                        border: 0,
                        borderRadius: 8,
                        background: "transparent",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--bg-alt)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div style={{ font: "600 13px/1.3 var(--font-sans)", color: "var(--fg)" }}>
                        {hit.title}
                      </div>
                      <div className="t-caption" style={{ marginTop: 2 }}>
                        {hit.subtitle}
                      </div>
                    </button>
                  ))}
                </div>
              ))
          )}
        </div>
      ) : null}
    </div>
  );
}
