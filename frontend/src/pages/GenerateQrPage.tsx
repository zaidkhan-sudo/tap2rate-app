import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, QrCode } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import RealismButton from "@/components/ui/shiny-borders-button";
import { getAccessToken, refreshAccessToken } from "@/lib/api";

export default function GenerateQrPage() {
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  async function generate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (loading) return;

    const num = parseInt(quantity, 10);
    if (isNaN(num) || num < 1 || num > 500) {
      setError("Please enter a valid quantity between 1 and 500.");
      return;
    }
    if (quantity.includes(".")) {
      setError("Quantity must be a whole number.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessCount(null);

    try {
      let token = getAccessToken();
      const doFetch = (t: string | null) =>
        fetch("/api/qr/bulk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(t ? { Authorization: `Bearer ${t}` } : {}),
          },
          body: JSON.stringify({ quantity: num }),
        });

      let res = await doFetch(token);

      if (res.status === 401) {
        token = await refreshAccessToken();
        if (token) {
          res = await doFetch(token);
        }
      }

      if (!res.ok) {
        let msg = `Failed to generate QR codes (${res.status})`;
        try {
          const body = await res.json();
          if (body.message || body.error) msg = body.message || body.error;
        } catch {}
        throw new Error(msg);
      }

      const blob = await res.blob();

      const disposition = res.headers.get("content-disposition");
      let filename = `tap2rate-qrs-${new Date().toISOString().split("T")[0]}.zip`;
      if (disposition && disposition.includes("filename=")) {
        filename = disposition.split("filename=")[1].replace(/['"]/g, "");
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessCount(num);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate QR codes");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-black text-white">
      <PageHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24 pt-4">
        <Link
          to="/qrs"
          className="text-[13.5px] text-neutral-400 transition hover:text-white"
        >
          ← All codes
        </Link>

        {error && (
          <div className="mt-5 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13.5px] text-red-300">
            {error}
          </div>
        )}

        <div className="mt-14 flex flex-col items-center text-center">
          <span className="grid h-16 w-16 place-items-center rounded-3xl border border-white/10 bg-white/[0.04]">
            <QrCode className="h-8 w-8 text-violet-300" />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Generate QR codes</h1>
          <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-neutral-400">
            Generate up to 500 unique, unassigned QR codes at once. You will receive a ZIP file containing scalable SVGs ready for printing.
          </p>

          <form onSubmit={generate} className="mt-8 flex w-full max-w-xs flex-col items-center gap-4">
            <div className="w-full text-left">
              <label htmlFor="quantity" className="mb-1.5 block pl-1 text-[13px] font-medium text-neutral-300">
                Quantity (1-500)
              </label>
              <input
                id="quantity"
                type="number"
                min="1"
                max="500"
                step="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-white placeholder-neutral-500 outline-none transition focus:border-violet-500/50 focus:bg-white/[0.04]"
                placeholder="Number of codes"
              />
            </div>

            <div className="mt-3 w-full flex justify-center">
              <RealismButton
                text={loading ? "Generating…" : "Generate QR codes"}
                onClick={generate}
                disabled={loading}
              />
            </div>
          </form>

          {successCount !== null && (
            <div className="mt-10 flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-500">
              <p className="text-[14.5px] font-medium text-emerald-400">
                {successCount} QR code{successCount === 1 ? "" : "s"} generated successfully.
              </p>
              <p className="mt-1.5 text-[13px] text-neutral-400">
                Your ZIP file should have started downloading automatically.
              </p>

              <div className="mt-6 w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
                <p className="text-[14px] font-medium">Next steps</p>
                <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
                  Unzip the file and send the SVGs to your printer. When someone scans a printed code for the first time, Tap2Rate will ask you to assign it to a business.
                </p>
                <Link
                  to="/qrs"
                  className="mt-4 inline-block text-[13.5px] font-medium text-violet-400 transition hover:text-violet-300"
                >
                  View all unused codes →
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
