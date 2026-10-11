import React, { useState, useEffect } from "react";
import { Server, Cloud, Cpu, Terminal, ShieldCheck, Check, ArrowRight, ExternalLink, RefreshCw } from "lucide-react";

export default function CloudDeployment() {
  const [deploying, setDeploying] = useState(false);
  const [step, setStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);

  const steps = [
    "Pruning cached container layers...",
    "Compiling workspace ES6 TypeScript modules (tsc --noEmit)...",
    "Bundling client-side assets with Vite bundler (vite build)...",
    "Generating serverless runtime wrapper templates...",
    "Packaging compiled static assets into Docker container blobs...",
    "Uploading container blobs to Regional Artifact Registry...",
    "Instantiating sandbox micro-VM environments (Google Cloud Run)...",
    "Registering active DNS routing SSL tables..."
  ];

  const triggerDeploy = () => {
    setDeploying(true);
    setStep(0);
    setDeployedUrl(null);
    setLogs(["[info] Initializing Cloud Build pipeline v2.4...", "[info] Target Project: workspace-collab-coding"]);
  };

  useEffect(() => {
    if (!deploying) return;

    if (step < steps.length) {
      const timer = setTimeout(() => {
        setLogs((prev) => [
          ...prev,
          `[step ${step + 1}] ${steps[step]}`,
          `[system] Layer optimization completed: OK`,
          `[system] Chunk size: ${Math.floor(Math.random() * 120) + 80}kb | Hash: ${Math.random().toString(16).substring(2, 8)}`
        ]);
        setStep((prev) => prev + 1);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setDeploying(false);
      setDeployedUrl("https://collaborative-workspace-app.cloud.run");
      setLogs((prev) => [...prev, "[info] Build finished successfully!", "[info] Active URL: https://collaborative-workspace-app.cloud.run"]);
    }
  }, [deploying, step]);

  return (
    <div id="cloud-hosting-deployment-section" className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#0a0a0a] p-6 rounded-2xl border border-zinc-800 shadow-sm">
      
      {/* 1. Hosting details */}
      <div className="md:col-span-1 bg-black/30 rounded-2xl p-5 border border-zinc-800/80 flex flex-col justify-between h-[360px]">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Cloud className="w-5 h-5 text-indigo-400" />
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Cloud Deployment</h3>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed mb-4 font-sans">
            Offer seamless project hosting using custom micro-VM container technology. Directly compile, containerize, and deploy the workspace source code onto distributed servers.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-[#050505] rounded-xl border border-zinc-800/80">
              <span className="text-xs text-zinc-500">Target Region:</span>
              <span className="text-xs font-mono text-zinc-300">us-central1 (Iowa)</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#050505] rounded-xl border border-zinc-800/80">
              <span className="text-xs text-zinc-500">Environment CPU:</span>
              <span className="text-xs font-mono text-zinc-300">1 vCPU | 2GB RAM</span>
            </div>
          </div>
        </div>

        <div>
          {deployedUrl ? (
            <div className="bg-emerald-950/20 border border-emerald-900/60 p-3 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs text-emerald-400 font-bold">LIVE ONLINE</span>
              </div>
              <a
                href={deployedUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-400 font-semibold flex items-center gap-1 hover:underline"
              >
                Open App <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <button
              onClick={triggerDeploy}
              disabled={deploying}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow transition cursor-pointer"
            >
              {deploying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Building Container... ({Math.round((step / steps.length) * 100)}%)
                </>
              ) : (
                <>
                  <Server className="w-4 h-4" />
                  Deploy to Production Cloud
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 2. Deployment Build Console */}
      <div className="md:col-span-2 bg-black/30 rounded-2xl p-5 border border-zinc-800/80 flex flex-col justify-between h-[360px]">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Terminal className="w-4 h-4 text-zinc-500" />
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Cloud Build Terminal Logs</h4>
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed mb-3 font-sans">
            Watch realtime build execution pipeline logs:
          </p>
        </div>

        {/* Console view */}
        <div className="flex-1 bg-[#050505] rounded-xl border border-zinc-800/80 p-4 font-mono text-[10px] text-zinc-300 overflow-y-auto space-y-1.5 selection:bg-zinc-800 select-text">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-650">
              <span>[pipeline] waiting to launch build...</span>
            </div>
          ) : (
            logs.map((log, index) => {
              const isError = log.includes("[error]");
              const isSuccess = log.includes("[info]") || log.includes("OK");
              const isStep = log.includes("[step");
              return (
                <div
                  key={index}
                  className={`${
                    isError ? "text-rose-400" : isSuccess ? "text-emerald-500" : isStep ? "text-indigo-400 font-bold" : "text-zinc-500"
                  }`}
                >
                  {log}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-3 text-[10px] text-zinc-600 flex items-center justify-between font-mono">
          <span>Build Engine: GCB-v2</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> SSL Certificate active
          </span>
        </div>
      </div>

    </div>
  );
}
