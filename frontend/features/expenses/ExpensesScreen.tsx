"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { Donut, PairedBars } from "@/components/ds/Donut";
import { EditIcon, ExpenseIcon, PlusIcon, TrashIcon } from "@/components/layout/icons";
import { useCan } from "@/components/providers/Providers";
import { ExpenseDrawer } from "@/features/expenses/ExpenseDrawer";
import {
  useDeleteExpense,
  useExpenseSummary,
  useExpenses,
  useLookups,
} from "@/features/expenses/api";
import { useCondos } from "@/features/condos/api";
import { ApiError } from "@/services/http";
import type { Expense } from "@/types/api";

const SLICE_COLORS = [
  "var(--brand-purple)",
  "var(--info)",
  "var(--success)",
  "var(--warning)",
  "var(--gold)",
  "var(--fg-4)",
];

const STATUS_PILL: Record<string, string> = {
  paid: "pill ok",
  pending: "pill warn",
  cancelled: "pill neutral",
};

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function ExpensesScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const can = useCan();

  const tab = params.get("tab") === "list" ? "list" : "overview";
  const editId = params.get("edit");
  const creating = params.get("new") === "1";

  const [search, setSearch] = useState("");
  const [condoId, setCondoId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("all");

  const { data: summary, isLoading: loadingSummary } = useExpenseSummary();
  const { data: lookups } = useLookups();
  const { data: condoData } = useCondos({ per_page: 100, sort: "name" });

  const filters = useMemo(
    () => ({
      q: search || undefined,
      condo_id: condoId || undefined,
      category_id: categoryId || undefined,
      status,
      per_page: 60,
    }),
    [search, condoId, categoryId, status],
  );
  const { data: list, isLoading: loadingList } = useExpenses(filters);
  const remove = useDeleteExpense();

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace((qs ? `/expenses?${qs}` : "/expenses") as never, { scroll: false });
    },
    [params, router],
  );

  const expenses = list?.items ?? [];
  const editing = expenses.find((e) => e.id === editId) ?? null;
  const filtered = Boolean(search || condoId || categoryId || status !== "all");

  async function onDelete(expense: Expense) {
    try {
      await remove.mutateAsync(expense.id);
      toast.success("Expense deleted", {
        description: `${expense.category} · ${expense.amount_label} removed.`,
      });
    } catch (error) {
      toast.error("Could not delete", {
        description: error instanceof ApiError ? error.message : "Please try again.",
      });
    }
  }

  return (
    <section style={{ animation: "lsFade 280ms var(--ease-out) both" }}>
      <div className="page-header">
        <div>
          <h1>Expenses</h1>
          <div className="t-small" style={{ marginTop: 6 }}>
            {summary
              ? `${list?.meta.total ?? 0} recorded · ${summary.pending.label} still to pay`
              : "Loading…"}
          </div>
        </div>
        <div className="actions">
          <div
            style={{
              display: "flex",
              background: "var(--surface)",
              border: "1px solid var(--line-strong)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {(["overview", "list"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setParam({ tab: t === "overview" ? null : t })}
                aria-pressed={tab === t}
                style={{
                  padding: "8px 16px",
                  border: 0,
                  cursor: "pointer",
                  font: "600 13px/1 var(--font-sans)",
                  transition: "all 120ms",
                  background: tab === t ? "var(--brand-purple)" : "transparent",
                  color: tab === t ? "#fff" : "var(--fg-2)",
                }}
              >
                {t === "overview" ? "Overview" : "All expenses"}
              </button>
            ))}
          </div>
          <a className="btn btn-outline" href="/api/v1/dashboard/export?kind=expenses" download>
            Export
          </a>
          {can("expense:write") ? (
            <button className="btn btn-primary" onClick={() => setParam({ new: "1" })}>
              <PlusIcon size={17} />
              Add expense
            </button>
          ) : null}
        </div>
      </div>

      {tab === "overview" ? (
        loadingSummary || !summary ? (
          <div className="ls-kpis" style={GRID_STATS}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="card ls-shimmer" style={{ height: 118 }} />
            ))}
          </div>
        ) : (
          <>
            <div className="ls-kpis" style={{ ...GRID_STATS, marginBottom: 16 }}>
              <Stat tone="amber" label="Today's expenses" value={summary.today.label} />
              <Stat
                tone="red"
                label="Monthly expenses"
                value={summary.month.expenses_label}
                action={{ label: "Breakdown", onClick: () => setParam({ tab: "list" }) }}
              />
              <Stat tone="purple" label="Total revenue" value={summary.month.revenue_label} />
              <Stat
                tone="green"
                label="Net profit"
                value={summary.month.net_label}
                delta={`${summary.month.margin_pct}% margin`}
                emphasis
                negative={Number(summary.month.net) < 0}
              />
              <Stat
                tone="amber"
                label="Pending expenses"
                value={summary.pending.label}
                delta={`${summary.pending.count} ${summary.pending.count === 1 ? "invoice" : "invoices"}`}
              />
            </div>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
              <div className="card" style={{ flex: "1 1 340px", minWidth: 0 }}>
                <div className="card-head">
                  <div>
                    <h3 className="card-title">Expenses by category</h3>
                    <div className="t-caption" style={{ marginTop: 4 }}>
                      This month
                    </div>
                  </div>
                </div>
                {summary.by_category.length === 0 ? (
                  <div className="t-small" style={{ padding: "32px 0", textAlign: "center" }}>
                    Nothing logged this month yet.
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
                    <Donut
                      size={120}
                      segments={summary.by_category.slice(0, 6).map((c, i) => ({
                        label: c.category,
                        value: Number(c.amount),
                        color: SLICE_COLORS[i % SLICE_COLORS.length]!,
                      }))}
                      centerValue={`฿${Math.round(Number(summary.month.expenses) / 1000)}k`}
                      centerLabel="total"
                    />
                    <div
                      style={{
                        flex: 1,
                        minWidth: 160,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {summary.by_category.slice(0, 6).map((c, i) => (
                        <div key={c.category} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: 3,
                              flex: "none",
                              background: SLICE_COLORS[i % SLICE_COLORS.length],
                            }}
                          />
                          <span
                            style={{
                              font: "500 13px/1.3 var(--font-sans)",
                              color: "var(--fg-2)",
                              flex: 1,
                              minWidth: 0,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {c.category}
                          </span>
                          <span className="t-caption" style={{ color: "var(--fg-4)" }}>
                            {c.pct}%
                          </span>
                          <strong
                            style={{
                              font: "600 13px/1.3 var(--font-sans)",
                              color: "var(--fg)",
                              minWidth: 62,
                              textAlign: "right",
                            }}
                          >
                            {c.label}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="card" style={{ flex: "2 1 460px", minWidth: 0 }}>
                <div className="card-head">
                  <div>
                    <h3 className="card-title">Revenue vs expenses</h3>
                    <div className="t-caption" style={{ marginTop: 4 }}>
                      Net printed above each pair
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 14 }}>
                    <Legend color="var(--brand-purple)" label="Revenue" />
                    <Legend color="var(--warning)" label="Expenses" />
                  </div>
                </div>
                <PairedBars
                  data={summary.trend.map((t) => ({
                    month: t.month,
                    revenue: Number(t.revenue),
                    expenses: Number(t.expenses),
                    net: Number(t.net),
                  }))}
                />
              </div>
            </div>
          </>
        )
      ) : (
        <>
          <div
            style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}
          >
            <div className="search-box" style={{ flex: 1, minWidth: 220, maxWidth: 320 }}>
              <input
                placeholder="Search vendor, description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search expenses"
              />
            </div>
            <select
              className="filter-sel"
              value={condoId}
              onChange={(e) => setCondoId(e.target.value)}
              aria-label="Filter by condo"
            >
              <option value="">All condos</option>
              {(condoData?.items ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="filter-sel"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {(lookups?.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="filter-sel"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="table-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "16px 20px 12px",
                flexWrap: "wrap",
              }}
            >
              <div className="t-caption">Showing {expenses.length} expenses</div>
              {filtered ? (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSearch("");
                    setCondoId("");
                    setCategoryId("");
                    setStatus("all");
                  }}
                >
                  Clear filters
                </button>
              ) : null}
            </div>

            {loadingList ? (
              <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="ls-shimmer" style={{ height: 40, borderRadius: 8 }} />
                ))}
              </div>
            ) : expenses.length === 0 ? (
              <EmptyState
                filtered={filtered}
                onAdd={can("expense:write") ? () => setParam({ new: "1" }) : undefined}
              />
            ) : (
              <>
                <div className="desktop-only" style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ minWidth: 900 }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Condo</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th style={{ textAlign: "right" }}>Amount</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((e) => (
                        <tr key={e.id}>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <strong>{dayLabel(e.spent_on)}</strong>
                          </td>
                          <td>
                            {e.condo_name}
                            <div className="t-caption">{e.condo_code}</div>
                          </td>
                          <td>
                            <span className={`pill ${e.category_tone}`}>{e.category}</span>
                          </td>
                          <td>
                            {e.description}
                            <div className="t-caption">{e.vendor}</div>
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              font: "600 14px/1.4 var(--font-sans)",
                              color: e.status === "cancelled" ? "var(--fg-4)" : "var(--fg)",
                              textDecoration: e.status === "cancelled" ? "line-through" : undefined,
                            }}
                          >
                            {e.amount_label}
                          </td>
                          <td>{e.method}</td>
                          <td>
                            <span className={STATUS_PILL[e.status]}>{e.status}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              {can("expense:write") ? (
                                <button
                                  className="icon-btn"
                                  style={{ width: 28, height: 28 }}
                                  aria-label={`Edit ${e.description}`}
                                  onClick={() => setParam({ edit: e.id })}
                                >
                                  ✎
                                </button>
                              ) : null}
                              {can("expense:delete") ? (
                                <button
                                  className="icon-btn danger"
                                  style={{ width: 28, height: 28 }}
                                  aria-label={`Delete ${e.description}`}
                                  onClick={() => onDelete(e)}
                                >
                                  <TrashIcon size={13} />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div
                  className="mobile-only"
                  style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 16px 16px" }}
                >
                  {expenses.map((e) => (
                    <div
                      key={e.id}
                      style={{
                        padding: 14,
                        border: "1px solid var(--line)",
                        borderRadius: 12,
                        background: "var(--surface-2)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ font: "600 14px/1.3 var(--font-sans)", color: "var(--fg)" }}>
                            {e.description}
                          </div>
                          <div className="t-caption" style={{ marginTop: 3 }}>
                            {/* Joined, not interpolated: vendor is optional and
                                a bare template left a trailing separator. */}
                            {[dayLabel(e.spent_on), e.condo_name, e.vendor]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                        <div style={{ font: "600 14px/1.4 var(--font-sans)", color: "var(--fg)" }}>
                          {e.amount_label}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginTop: 12,
                          paddingTop: 10,
                          borderTop: "1px solid var(--line)",
                          flexWrap: "wrap",
                        }}
                      >
                        <span className={`pill ${e.category_tone}`}>{e.category}</span>
                        <span className={STATUS_PILL[e.status]}>{e.status}</span>
                        <span className="t-caption">{e.method}</span>
                      </div>

                      {/* The desktop table has had Edit and Delete since this
                          screen shipped; the card fallback never did, so an
                          expense could be read on a phone but not corrected or
                          removed. Buttons rather than a tap target on the card
                          itself: delete needs its own affordance, and a card
                          that silently opens an editor is a trap next to one. */}
                      {can("expense:write") || can("expense:delete") ? (
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 10,
                            paddingTop: 10,
                            borderTop: "1px solid var(--line)",
                          }}
                        >
                          {can("expense:write") ? (
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ flex: 1, justifyContent: "center" }}
                              onClick={() => setParam({ edit: e.id })}
                            >
                              <EditIcon size={14} />
                              Edit
                            </button>
                          ) : null}
                          {can("expense:delete") ? (
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ justifyContent: "center", color: "var(--danger)" }}
                              aria-label={`Delete ${e.description}`}
                              onClick={() => onDelete(e)}
                            >
                              <TrashIcon size={14} />
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      <ExpenseDrawer
        open={creating || Boolean(editing)}
        expense={editing}
        onClose={() => setParam({ new: null, edit: null })}
      />
    </section>
  );
}

const GRID_STATS: React.CSSProperties = { gap: 16 };

function Stat({
  tone,
  label,
  value,
  delta,
  action,
  emphasis,
  negative,
}: {
  tone: "purple" | "green" | "amber" | "blue" | "red";
  label: string;
  value: string;
  delta?: string;
  action?: { label: string; onClick: () => void };
  emphasis?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className="stat"
      style={emphasis ? { borderColor: "transparent", boxShadow: "var(--shadow-md)" } : undefined}
    >
      <div className={`stat-icon ${tone}`}>
        <ExpenseIcon size={17} />
      </div>
      <div
        className="stat-value"
        style={emphasis ? { color: negative ? "var(--danger)" : "var(--success)" } : undefined}
      >
        {value}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div className="stat-label">{label}</div>
        {delta ? <span className="stat-delta up">{delta}</span> : null}
        {action ? (
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: 0, background: "none" }}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        font: "500 12px/1 var(--font-sans)",
        color: "var(--fg-3)",
      }}
    >
      <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
      {label}
    </span>
  );
}

function EmptyState({ filtered, onAdd }: { filtered: boolean; onAdd?: () => void }) {
  return (
    <div style={{ padding: "64px 24px", textAlign: "center" }}>
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: 16,
          background: "var(--brand-purple-50)",
          color: "var(--brand-purple)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <ExpenseIcon size={26} />
      </div>
      <div className="t-h4">
        {filtered ? "No expenses match those filters" : "No expenses yet"}
      </div>
      <div className="t-small" style={{ margin: "8px auto 20px", maxWidth: 320 }}>
        {filtered
          ? "Try a wider range, or clear the search."
          : "Log your first bill — electricity, cleaning, commission — and net profit starts calculating itself."}
      </div>
      {onAdd ? (
        <button className="btn btn-primary" onClick={onAdd}>
          Add expense
        </button>
      ) : null}
    </div>
  );
}
