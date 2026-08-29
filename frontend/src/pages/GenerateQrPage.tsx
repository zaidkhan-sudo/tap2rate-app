import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, Download, QrCode } from "lucide-react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import PageHeader from "@/components/PageHeader";
import RealismButton from "@/components/ui/shiny-borders-button";
import { ApiError, apiPost } from "@/lib/api";

interface GeneratedQr {
  qrId: string;
  qrUrl: string;
}

export default function GenerateQrPage() {
  const [qr, setQr] = useState<GeneratedQr | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const svgWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  async function generate() {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiPost<{ data: GeneratedQr }>("/api/qr");
      setQr(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate QR code");
    } finally {
      setLoading(false);
    }
  }

  async function copyUrl() {
    if (!qr) return;
    try {
      await navigator.clipboard.writeText(qr.qrUrl);
    } catch {
      const el = document.createElement("textarea");
      el.value = qr.qrUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadSvg() {
    if (!qr || !svgWrapRef.current) return;
    const svg = svgWrapRef.current.querySelector("svg");
    if (!svg) return;

    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "1024");
    clone.setAttribute("height", "1024");

    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([`<?xml version="1.0" standalone="no"?>\n${serialized}`], {
      type: "image/svg+xml;charset=utf-8",
    });
    triggerDownload(blob, `tap2rate-${qr.qrId}.svg`);
  }

  function downloadPng() {
    if (!qr || !canvasRef.current) return;
    const canvas = canvasRef.current.querySelector("canvas");
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, `tap2rate-${qr.qrId}.png`);
    }, "image/png");
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

        {!qr ? (
          <div className="mt-14 flex flex-col items-center text-center">
            <span className="grid h-16 w-16 place-items-center rounded-3xl border border-white/10 bg-white/[0.04]">
              <QrCode className="h-8 w-8 text-violet-300" />
            </span>
            <h1 className="mt-5 text-2xl font-bold tracking-tight">Generate a new QR code</h1>
            <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-neutral-400">
              Every code gets a permanent URL that never changes — assign it to any business now
              or later.
            </p>
            <div className="mt-7">
              <RealismButton
                text={loading ? "Generating…" : "Generate QR code"}
                onClick={generate}
                disabled={loading}
              />
            </div>
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center">
            <p className="text-[11.5px] font-semibold uppercase tracking-wider text-emerald-300">
              Code created
            </p>

            <div className="mt-5 rounded-[28px] bg-white p-6 shadow-[0_0_60px_-15px_rgba(168,85,247,0.45)]">
              <div ref={svgWrapRef}>
                <QRCodeSVG value={qr.qrUrl} size={220} level="M" bgColor="#ffffff" fgColor="#000000" />
              </div>
            </div>

            <p className="mt-5 font-mono text-lg tracking-wide">{qr.qrId}</p>

            <button
              type="button"
              onClick={copyUrl}
              className="mt-2 flex items-center gap-2 font-mono text-[13px] text-neutral-400 transition hover:text-white"
            >
              {qr.qrUrl}
              {copied ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            {copied && <span className="sr-only">Copied</span>}

            <div className="mt-7 flex w-full flex-row flex-wrap items-center justify-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={downloadSvg}
                className="inline-flex items-center gap-2 rounded-full border border-violet-500/50 bg-violet-500/15 px-4 py-2.5 text-[13.5px] font-medium text-violet-200 transition hover:bg-violet-500/25"
              >
                <Download className="h-4 w-4" /> Download SVG
              </button>
              <button
                type="button"
                onClick={downloadPng}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2.5 text-[13.5px] font-medium text-neutral-200 transition hover:bg-white/10"
              >
                <Download className="h-4 w-4" /> Download PNG
              </button>
              <RealismButton text="Generate another" onClick={generate} />
            </div>

            <div className="mt-9 w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
              <p className="text-[14px] font-medium">Next step</p>
              <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
                This code is unused. Assign it to a business to start sending customers to their
                Google Reviews page.
              </p>
              <Link
                to={`/qrs/${qr.qrId}`}
                className="mt-3 inline-block text-[13.5px] font-medium text-violet-400 transition hover:text-violet-300"
              >
                Activate &amp; assign this code →
              </Link>
            </div>
          </div>
        )}
      </main>

      <div ref={canvasRef} className="hidden" aria-hidden="true">
        {qr && <QRCodeCanvas value={qr.qrUrl} size={1024} level="M" bgColor="#ffffff" fgColor="#000000" />}
      </div>
    </div>
  );
}
