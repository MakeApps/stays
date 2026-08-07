"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { CondoIcon, PlusIcon, TrashIcon } from "@/components/layout/icons";
import { useCan } from "@/components/providers/Providers";
import { CondoCard, CondoCardSkeleton } from "@/features/condos/CondoCard";
import { CondoDetailDrawer } from "@/features/condos/CondoDetailDrawer";
import { CondoFormModal } from "@/features/condos/CondoFormModal";
import { useCondos, useDeleteCondo } from "@/features/condos/api";
import { ApiError } from "@/services/http";
import type { Condo, UnitStatus } from "@/types/api";

const FILTERS: { key: UnitStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "available", label: "Available" },
  { key: "occupied", label: "Occupied" },
  { key: "reserved", label: "Reserved" },
  { key: "maintenance", label: "Maintenance" },
];

export function CondosScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const can = useCan();

  // Overlays are driven by the URL so they are deep-linkable and the browser
  // Back button closes them.
  const detailId = params.get("condo");
  const editId = params.get("edit");
  const creating = params.get("new") === "1";
  const confirmId = params.get("confirm");
  const status = (params.get("status") ?? "all") as UnitStatus | "all";

  const [search, setSearch] = useState("");
  const filters = useMemo(
    () => ({ status, q: search || undefined, per_page: 60, sort: "name" as const }),
    [status, search],
  );
  const { data, isLoading, isError, error, refetch } = useCondos(filters);
  const remove = useDeleteCondo();

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `/condos?${qs}` : "/condos", { scroll: false });
    },
    [params, router],
  );

  const condos = data?.items ?? [];
  const facets = data?.facets.status;
  const byId = (id: string | null) => condos.find((c) => c.id === id) ?? null;
  const editing = byId(editId);
  const detail = byId(detailId);
  const pendingDelete = byId(confirmId);

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await remove.mutateAsync(pendingDelete.id);
      toast.success("Condo removed", { description: `${pendingDelete.name} is no longer listed.` });
      setParam({ confirm: null, condo: null });
    } catch (err) {
      toast.error("Could not remove", {
        description: err instanceof ApiError ? err.message : "Please try again.",
      });
    }
  }

  const summary = facets
    ? `${facets.all} units · ${facets.available} available · ${facets.maintenance} in maintenance`
    : "Loading units…";

  return (
    <section style={{ animation: "lsFade 280ms var(--ease-out) both" }}>
      <div className="page-header">
        <div>
          <h1>Condos</h1>
          <div className="t-small" style={{ marginTop: 6 }}>
            {summary}
          </div>
        </div>
        {can("condo:write") ? (
          <div className="actions">
            <button
              className="btn btn-primary"
              style={{ padding: "12px 20px", fontSize: 15 }}
              onClick={() => setParam({ new: "1" })}
            >
              <PlusIcon size={17} />
              Add condo
            </button>
          </div>
        ) : null}
      </div>

      {/* Filter pills — design lines 421–425, styles 2105–2113 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {FILTERS.map(({ key, label }) => {
          const on = status === key;
          const count = facets?.[key] ?? 0;
          return (
            <button
              key={key}
              onClick={() => setParam({ status: key === "all" ? null : key })}
              aria-pressed={on}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 999,
                cursor: "pointer",
                font: "600 13px/1 var(--font-sans)",
                transition: "all 120ms var(--ease-out)",
                border: `1px solid ${on ? "var(--brand-purple)" : "var(--line-strong)"}`,
                background: on ? "var(--brand-purple)" : "var(--surface)",
                color: on ? "#fff" : "var(--fg-2)",
              }}
            >
              {label}
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: 999,
                  font: "600 11px/1.5 var(--font-sans)",
                  background: on ? "rgba(255,255,255,.22)" : "var(--bg-alt)",
                  color: on ? "#fff" : "var(--fg-3)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}

        <div style={{ flex: 1 }} />
        <div className="search-box" style={{ minWidth: 220, padding: "7px 12px" }}>
          <input
            placeholder="Search name, code or address"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search condos"
          />
        </div>
      </div>

      {isError ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div className="t-h4">Could not load condos</div>
          <div className="t-small" style={{ margin: "8px 0 16px" }}>
            {error instanceof ApiError ? error.message : "The API did not respond."}
          </div>
          <button className="btn btn-outline" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div style={GRID}>
          {Array.from({ length: 6 }, (_, i) => (
            <CondoCardSkeleton key={i} />
          ))}
        </div>
      ) : condos.length > 0 ? (
        <div style={GRID}>
          {condos.map((condo) => (
            <CondoCard
              key={condo.id}
              condo={condo}
              onOpen={() => setParam({ condo: condo.id })}
              onEdit={() => setParam({ edit: condo.id })}
              onCalendar={() => router.push({ pathname: "/calendar", query: { condo: condo.code } } as never)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          filtered={status !== "all" || search !== ""}
          onAdd={can("condo:write") ? () => setParam({ new: "1" }) : undefined}
          onClear={() => {
            setSearch("");
            setParam({ status: null });
          }}
        />
      )}

      <CondoFormModal
        open={creating || Boolean(editing)}
        condo={editing}
        onClose={() => setParam({ new: null, edit: null })}
      />

      <CondoDetailDrawer
        condo={detail}
        onClose={() => setParam({ condo: null })}
        onEdit={() => detail && setParam({ condo: null, edit: detail.id })}
        onDelete={() => detail && setParam({ condo: null, confirm: detail.id })}
      />

      <AlertDialog.Root
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setParam({ confirm: null })}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="modal-bg" style={{ zIndex: 120 }} />
          {/* Centred by this wrapper — see the note in CondoFormModal: lsPop
              animates transform and would cancel a translate-based centring. */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 121,
              display: "grid",
              placeItems: "center",
              padding: 20,
              pointerEvents: "none",
            }}
          >
          <AlertDialog.Content
            className="modal"
            style={{
              maxWidth: 420,
              pointerEvents: "auto",
              animation: "lsPop 240ms var(--ease-out) both",
            }}
          >
            <div style={{ padding: "26px 26px 20px", textAlign: "center" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "var(--danger-bg)",
                  color: "var(--danger)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <TrashIcon size={22} />
              </div>
              <AlertDialog.Title
                style={{ font: "700 18px/1.3 var(--font-sans)", color: "var(--fg)", margin: 0 }}
              >
                Remove {pendingDelete?.name}?
              </AlertDialog.Title>
              <AlertDialog.Description
                className="t-small"
                style={{ margin: "8px auto 0", maxWidth: 300 }}
              >
                The unit stops appearing in lists and calendars. Its history is kept, and the code
                becomes available again.
              </AlertDialog.Description>
            </div>
            <div
              className="modal-foot"
              style={{
                justifyContent: "center",
                background: "var(--surface)",
                borderTop: 0,
                paddingBottom: 24,
              }}
            >
              <AlertDialog.Cancel className="btn btn-outline">Keep it</AlertDialog.Cancel>
              <button
                className="btn"
                style={{ background: "var(--danger)", color: "#fff" }}
                onClick={confirmDelete}
                disabled={remove.isPending}
              >
                {remove.isPending ? "Removing…" : "Remove condo"}
              </button>
            </div>
          </AlertDialog.Content>
          </div>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}

const GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
  gap: 20,
};

/** Design lines 493–502. */
function EmptyState({
  filtered,
  onAdd,
  onClear,
}: {
  filtered: boolean;
  onAdd?: () => void;
  onClear: () => void;
}) {
  return (
    <div className="card" style={{ padding: "72px 24px", textAlign: "center" }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          background: "var(--brand-purple-50)",
          color: "var(--brand-purple)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
      >
        <CondoIcon size={28} />
      </div>
      <div className="t-h4">{filtered ? "Nothing matches those filters" : "No condos yet"}</div>
      <div className="t-small" style={{ margin: "8px auto 20px", maxWidth: 320 }}>
        {filtered
          ? "Try another status, or clear the search."
          : "Add your units once and every booking, calendar bar and income figure follows from them."}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        {filtered ? (
          <button className="btn btn-outline" onClick={onClear}>
            Clear filters
          </button>
        ) : null}
        {onAdd ? (
          <button className="btn btn-primary" onClick={onAdd}>
            {filtered ? "Add condo" : "Add your first condo"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
