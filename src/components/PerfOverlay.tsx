import { useSyncExternalStore } from "react"
import {
  formatPerfOverlay,
  getPerfSnapshot,
  isPerfEnabled,
  logPerfTable,
  subscribePerf,
} from "@/perf"

/**
 * DOM overlay for `?perf=1`. Renders nothing when the flag is off.
 */
export function PerfOverlay() {
  const enabled = isPerfEnabled()
  const snapshot = useSyncExternalStore(
    enabled ? subscribePerf : () => () => {},
    getPerfSnapshot,
    getPerfSnapshot,
  )

  if (!enabled) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: 8,
        bottom: 8,
        zIndex: 80,
        maxWidth: "min(320px, calc(100vw - 16px))",
        padding: "8px 10px",
        borderRadius: 6,
        background: "rgba(12, 16, 20, 0.82)",
        color: "#e8eef2",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: 11,
        lineHeight: 1.45,
        whiteSpace: "pre-wrap",
        pointerEvents: "auto",
        boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ marginBottom: 6 }}>{formatPerfOverlay(snapshot)}</div>
      <button
        type="button"
        onClick={() => logPerfTable()}
        style={{
          font: "inherit",
          color: "#c9e6ff",
          background: "transparent",
          border: "1px solid #4a5c6a",
          borderRadius: 4,
          padding: "2px 8px",
          cursor: "pointer",
        }}
      >
        console.table
      </button>
    </div>
  )
}
