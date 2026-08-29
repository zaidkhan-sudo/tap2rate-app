import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, QrCode, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { api, ApiError } from "@/lib/api";

interface QrItem {
  qrId: string;
  businessName: string | null;
  status: "ACTIVE" | "UNUSED" | "DISABLED";
  createdAt: string;
  updatedAt: string;
}

interface DashboardStats {
  TOTAL: number;
  ACTIVE: number;
  UNUSED: number;
  DISABLED: number;
}

interface ListResponse {
  data: {
    items: QrItem[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

const PAGE_SIZE = 20;

const FILTERS = [
  { label: "All", value: "" },
  { label: "Active", value: "ACTIVE" },
  { label: "Unused", value: "UNUSED" },
  { label: "Disabled", value: "DISABLED" },
] as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function QrCodesPage() {
  const [items, setItems] = useState<QrItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
    }, 350);
  }

  function applyFilter(value: string) {
    setStatusFilter(value);
    setPage(1);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);

    try {
      const res = await api<ListResponse>(`/api/qr?${params.toString()}`);
      setItems(res.data.items);
      setTotal(res.data.total);
      setPages(Math.max(res.data.pages, 1));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load QR codes");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    load();
    
    api<{ data: DashboardStats }>("/api/qr/stats")
      .then((res) => setStats(res.data))
      .catch((err) => console.error("Failed to load stats", err));
  }, [load]);

  const hasQuery = Boolean(search || statusFilter);

  return (
    <div className="flex min-h-dvh flex-col bg-black text-white">
      <PageHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">QR Codes</h1>
          {!loading && !error && (
            <span className="text-[13px] text-neutral-500">
              {total} {total === 1 ? "code" : "codes"}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:grid sm:grid-cols-[1fr_auto] sm:gap-x-4 sm:gap-y-5">
          <div className="relative order-1 sm:order-none sm:col-start-1 sm:col-end-2">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-neutral-500" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by business or code…"
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-4 text-[14.5px] text-white placeholder:text-neutral-500 outline-none transition focus:border-violet-500/70 focus:bg-white/[0.06]"
            />
          </div>

          <div className="order-3 flex gap-2 overflow-x-auto pb-0.5 sm:order-none sm:col-start-2 sm:col-end-3 sm:items-center sm:pb-0">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => applyFilter(f.value)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
                  statusFilter === f.value
                    ? "border-violet-500/60 bg-violet-500/15 text-violet-200"
                    : "border-white/10 text-neutral-400 hover:border-white/25 hover:text-neutral-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {stats && (
            <div className="order-2 grid w-full grid-cols-2 gap-4 sm:order-none sm:col-start-1 sm:col-end-3 sm:grid-cols-4">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] py-4 transition hover:bg-white/[0.05]">
                <span className="text-2xl font-bold text-white">{stats.TOTAL}</span>
                <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Total QR</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 py-4 transition hover:bg-emerald-500/20">
                <span className="text-2xl font-bold text-emerald-400">{stats.ACTIVE}</span>
                <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-500/80">Active</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 py-4 transition hover:bg-amber-500/20">
                <span className="text-2xl font-bold text-amber-400">{stats.UNUSED}</span>
                <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-amber-500/80">Unused</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 py-4 transition hover:bg-rose-500/20">
                <span className="text-2xl font-bold text-rose-400">{stats.DISABLED}</span>
                <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-rose-500/80">Disabled</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3">
            <span className="text-[13.5px] text-red-300">{error}</span>
            <button
              type="button"
              onClick={load}
              className="shrink-0 rounded-full border border-red-400/30 px-3 py-1 text-[12.5px] text-red-200 hover:bg-red-500/10"
            >
              Retry
            </button>
          </div>
        )}

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {loading ? (
            <ul className="divide-y divide-white/5">
              {[...Array(5)].map((_, i) => (
                <li key={i} className="px-4 py-4">
                  <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
                  <div className="mt-2 h-3 w-24 animate-pulse rounded bg-white/5" />
                </li>
              ))}
            </ul>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <QrCode className="h-10 w-10 text-neutral-700" />
              <p className="mt-4 text-[15px] font-medium text-neutral-300">
                {hasQuery ? "Nothing matches" : "No QR codes yet"}
              </p>
              <p className="mt-1 max-w-xs text-[13.5px] text-neutral-500">
                {hasQuery
                  ? "Try a different search term or filter."
                  : "Generate your first code and it will show up here."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {items.map((qr) => (
                <li key={qr.qrId}>
                  <Link
                    to={`/qrs/${qr.qrId}`}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-white/[0.04]"
                  >
                    <div className="min-w-0">
                      <p
                        className={`truncate text-[15px] font-medium ${
                          qr.businessName ? "text-white" : "italic text-neutral-500"
                        }`}
                      >
                        {qr.businessName ?? "Not assigned yet"}
                      </p>
                      <p className="mt-0.5 font-mono text-[12px] tracking-wide text-neutral-400">
                        {qr.qrId} · upd. {formatDate(qr.updatedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={qr.status} />
                      <ChevronRight className="h-4 w-4 text-neutral-600" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!loading && !error && pages > 1 && (
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-full border border-white/10 px-4 py-2 text-[13px] text-neutral-300 transition hover:border-white/25 hover:text-white disabled:pointer-events-none disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-[13px] text-neutral-500">
              Page {page} of {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-white/10 px-4 py-2 text-[13px] text-neutral-300 transition hover:border-white/25 hover:text-white disabled:pointer-events-none disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
