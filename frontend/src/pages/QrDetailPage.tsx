import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Copy, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import RealismButton from "@/components/ui/shiny-borders-button";
import { api, ApiError } from "@/lib/api";

interface QrItem {
  qrId: string;
  businessName: string | null;
  googleReviewUrl: string | null;
  googlePlaceId: string | null;
  status: "ACTIVE" | "UNUSED" | "DISABLED";
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string;
  qrUrl: string;
}

const GOOGLE_DOMAINS = ["g.page", "google.com", "goo.gl"];

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function hostnameAllowed(hostname: string) {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  return GOOGLE_DOMAINS.some((d) => h === d || h.endsWith("." + d));
}

function validateBusinessName(name: string): string | null {
  if (!name.trim()) return "Business name is required";
  return null;
}

function validateReviewUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return "Google Review URL is required";
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "Must be a valid absolute URL";
  }
  if (parsed.protocol !== "https:") return "Must use HTTPS";
  if (!hostnameAllowed(parsed.hostname)) {
    return "Must point to a Google domain (e.g. https://g.page/r/XXXX/review)";
  }
  return null;
}

const inputCls =
  "h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-[15px] text-white placeholder:text-neutral-500 outline-none transition focus:border-violet-500/70 focus:bg-white/[0.06]";

export default function QrDetailPage() {
  const { qrId = "" } = useParams();
  const navigate = useNavigate();

  const [qr, setQr] = useState<QrItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setNotFound(false);

    try {
      const res = await api<{ data: QrItem }>(`/api/qr/${encodeURIComponent(qrId)}`);
      setQr(res.data);
      setBusinessName(res.data.businessName ?? "");
      setReviewUrl(res.data.googleReviewUrl ?? "");
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        setNotFound(true);
      } else {
        setLoadError(err instanceof Error ? err.message : "Failed to load");
      }
    } finally {
      setLoading(false);
    }
  }, [qrId]);

  useEffect(() => {
    load();
  }, [load]);

  const nameError = validateBusinessName(businessName);
  const urlError = validateReviewUrl(reviewUrl);
  const dirty =
    !!qr &&
    (businessName !== (qr.businessName ?? "") || reviewUrl !== (qr.googleReviewUrl ?? ""));
  const canSave =
    !saving && !nameError && !urlError && dirty && qr?.status !== "DISABLED";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || !qr) return;

    setSaving(true);
    setSaveError(null);

    try {
      const res = await api<{ data: QrItem }>(`/api/qr/${encodeURIComponent(qr.qrId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          businessName: businessName.trim(),
          googleReviewUrl: reviewUrl.trim(),
        }),
      });
      setQr(res.data);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: "ACTIVE" | "DISABLED") {
    if (!qr || statusBusy) return;

    setStatusBusy(true);
    setSaveError(null);

    try {
      const res = await api<{ data: QrItem }>(
        `/api/qr/${encodeURIComponent(qr.qrId)}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) }
      );
      setQr(res.data);
      setConfirmingDisable(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update status");
      setConfirmingDisable(false);
    } finally {
      setStatusBusy(false);
    }
  }

  async function deleteQr() {
    if (!qr || deleteBusy) return;

    setDeleteBusy(true);
    setSaveError(null);

    try {
      await api(`/api/qr/${encodeURIComponent(qr.qrId)}`, { method: "DELETE" });
      navigate("/qrs", { replace: true });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to delete QR");
      setConfirmingDelete(false);
      setDeleteBusy(false);
    }
  }

  async function copyUrl() {
    if (!qr) return;
    try {
      await navigator.clipboard.writeText(qr.qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      const el = document.createElement("textarea");
      el.value = qr.qrUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }

  function downloadSvg() {
    if (!qr) return;
    const svg = document.getElementById("qr-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `qr-${qr.qrId}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-black text-white">
      <PageHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-4">
        <button
          type="button"
          onClick={() => navigate("/qrs")}
          className="inline-flex items-center gap-1.5 text-[13.5px] text-neutral-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          All codes
        </button>

        {loading && (
          <div className="mt-8 space-y-4">
            <div className="h-7 w-56 animate-pulse rounded bg-white/10" />
            <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
          </div>
        )}

        {!loading && notFound && (
          <div className="mt-10 flex flex-col items-center text-center">
            <p className="text-[17px] font-semibold">QR code not found</p>
            <p className="mt-1 max-w-xs text-[14px] text-neutral-500">
              This code doesn't exist or the link is wrong.
            </p>
            <Link to="/qrs" className="mt-5 text-[13.5px] font-medium text-violet-400 hover:text-violet-300">
              ← Back to all codes
            </Link>
          </div>
        )}

        {!loading && loadError && !notFound && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3">
            <span className="text-[13.5px] text-red-300">{loadError}</span>
            <button
              type="button"
              onClick={load}
              className="shrink-0 rounded-full border border-red-400/30 px-3 py-1 text-[12.5px] text-red-200 hover:bg-red-500/10"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && qr && (
          <>
            <div className="mt-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1
                  className={`truncate text-2xl font-bold tracking-tight ${
                    qr.businessName ? "" : "italic text-neutral-500"
                  }`}
                >
                  {qr.businessName ?? "Not assigned yet"}
                </h1>
                <p className="mt-1 font-mono text-[12.5px] tracking-wide text-neutral-400">
                  {qr.qrId}
                </p>
              </div>
              <StatusBadge status={qr.status} />
            </div>

            <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:flex-row sm:gap-8">
              <div className="shrink-0 rounded-xl bg-white p-3 shadow-xl">
                <QRCodeSVG
                  id="qr-svg"
                  value={qr.qrUrl}
                  size={140}
                  level="Q"
                  includeMargin={false}
                />
              </div>
              <div className="mt-5 flex flex-col items-center text-center sm:mt-0 sm:items-start sm:text-left">
                <p className="text-[15px] font-semibold text-white">Printable QR Code</p>
                <p className="mt-1 text-[13.5px] text-neutral-400">
                  This is the unique QR code for <span className="font-mono text-neutral-300">{qr.qrId}</span>. Download it as an SVG to print it for the business.
                </p>
                <button
                  type="button"
                  onClick={downloadSvg}
                  className="mt-4 flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13.5px] font-medium text-black transition hover:bg-neutral-200"
                >
                  <Download className="h-4 w-4" />
                  Download SVG
                </button>
              </div>
            </div>

            <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutral-500">
                Scan URL
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate font-mono text-[13.5px] text-violet-200">
                  {qr.qrUrl}
                </code>
                <button
                  type="button"
                  onClick={copyUrl}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[12.5px] text-neutral-300 transition hover:border-white/25 hover:text-white"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>
              <p className="mt-2 text-[12.5px] text-neutral-500">
                Printed inside the physical QR. Scanning it sends customers straight to Google
                Reviews — the destination below can change anytime without reprinting.
              </p>
            </section>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[13px] sm:grid-cols-4">
              <div>
                <dt className="text-neutral-500">Created</dt>
                <dd className="mt-0.5 text-neutral-200">{formatDate(qr.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Assigned</dt>
                <dd className="mt-0.5 text-neutral-200">{formatDate(qr.assignedAt)}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Updated</dt>
                <dd className="mt-0.5 text-neutral-200">{formatDate(qr.updatedAt)}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Place ID</dt>
                <dd className="mt-0.5 truncate text-neutral-200">{qr.googlePlaceId ?? "—"}</dd>
              </div>
            </dl>

            {saveError && (
              <div className="mt-5 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13.5px] text-red-300">
                {saveError}
              </div>
            )}

            {savedFlash && (
              <div className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[13.5px] text-emerald-300">
                Saved.
              </div>
            )}

            {qr.status === "DISABLED" ? (
              <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[15px] font-medium">This code is disabled</p>
                <p className="mt-1 text-[13.5px] text-neutral-400">
                  Customers who scan it see a friendly unavailable page. Re-enable it to make
                  changes.
                </p>
                <div className="mt-4 flex justify-center sm:justify-start">
                  <RealismButton
                    text={statusBusy ? "Working…" : "Re-enable code"}
                    onClick={() => changeStatus("ACTIVE")}
                    disabled={statusBusy}
                  />
                </div>
              </section>
            ) : (
              <form onSubmit={handleSave} className="mt-6 space-y-4" noValidate>
                <div>
                  <label htmlFor="businessName" className="mb-1.5 block text-[12.5px] font-medium uppercase tracking-wider text-neutral-400">
                    Business name
                  </label>
                  <input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Sharma Electronics"
                    className={inputCls}
                  />
                  {nameError && businessName !== "" && (
                    <p className="mt-1.5 text-[12.5px] text-red-300">{nameError}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="reviewUrl" className="mb-1.5 block text-[12.5px] font-medium uppercase tracking-wider text-neutral-400">
                    Google Review URL
                  </label>
                  <input
                    id="reviewUrl"
                    value={reviewUrl}
                    onChange={(e) => setReviewUrl(e.target.value)}
                    placeholder="https://g.page/r/XXXXXXXX/review"
                    className={`${inputCls} font-mono text-[13.5px]`}
                  />
                  {urlError && reviewUrl !== "" && (
                    <p className="mt-1.5 text-[12.5px] text-red-300">{urlError}</p>
                  )}
                </div>

                <div className="flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row">
                  <p className="order-2 text-[12.5px] text-neutral-500 sm:order-1">
                    {qr.status === "UNUSED"
                      ? "Saving activates this code instantly."
                      : "Changes go live immediately."}
                  </p>
                  <div className="order-1 sm:order-2">
                    <RealismButton
                      type="submit"
                      text={
                        saving
                          ? "Saving…"
                          : qr.status === "UNUSED"
                            ? "Activate QR"
                            : "Save changes"
                      }
                      disabled={!canSave}
                    />
                  </div>
                </div>
              </form>
            )}

            <section className="mt-8 rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5">
              <p className="text-[14.5px] font-medium text-rose-200">Danger zone</p>
              
              {qr.status === "ACTIVE" && (
                <>
                  <p className="mt-1 text-[13px] text-neutral-400">
                    Disabled codes stop redirecting customers immediately.
                  </p>
                  <button
                    type="button"
                    onClick={() => setConfirmingDisable(true)}
                    className="mt-4 mb-6 rounded-full border border-rose-500/40 px-4 py-2 text-[13.5px] font-medium text-rose-300 transition hover:bg-rose-500/10"
                  >
                    Disable code
                  </button>
                </>
              )}

              <p className="mt-1 text-[13px] text-neutral-400">
                Permanently delete this code. It will no longer exist in the database.
              </p>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="mt-4 rounded-full border border-rose-500/40 px-4 py-2 text-[13.5px] font-medium text-rose-300 transition hover:bg-rose-500/10"
              >
                Delete code
              </button>
            </section>
          </>
        )}
      </main>

      {confirmingDisable && qr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
          onClick={() => !statusBusy && setConfirmingDisable(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[16.5px] font-semibold">Disable this code?</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-neutral-400">
              <span className="font-mono text-neutral-300">{qr.qrId}</span>
              {qr.businessName ? ` (${qr.businessName})` : ""} will stop sending customers to
              Google Reviews until re-enabled.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmingDisable(false)}
                disabled={statusBusy}
                className="rounded-full border border-white/10 px-4 py-2 text-[13.5px] text-neutral-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => changeStatus("DISABLED")}
                disabled={statusBusy}
                className="rounded-full bg-rose-600 px-4 py-2 text-[13.5px] font-medium text-white transition hover:bg-rose-500 disabled:opacity-50"
              >
                {statusBusy ? "…" : "Disable"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmingDelete && qr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
          onClick={() => !deleteBusy && setConfirmingDelete(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[16.5px] font-semibold">Permanently delete code?</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-neutral-400">
              <span className="font-mono text-neutral-300">{qr.qrId}</span>
              {qr.businessName ? ` (${qr.businessName})` : ""} will be permanently deleted and cannot be recovered.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleteBusy}
                className="rounded-full border border-white/10 px-4 py-2 text-[13.5px] text-neutral-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteQr}
                disabled={deleteBusy}
                className="rounded-full bg-rose-600 px-4 py-2 text-[13.5px] font-medium text-white transition hover:bg-rose-500 disabled:opacity-50"
              >
                {deleteBusy ? "…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
