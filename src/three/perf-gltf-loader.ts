import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js"
import { isPerfEnabled, recordGlbFetchMs, recordGlbParseMs } from "@/perf"

type OnLoad = (gltf: GLTF) => void
type OnProgress = (event: ProgressEvent) => void
type OnError = (err: unknown) => void

/**
 * Same as GLTFLoader when `?perf=1` is absent.
 * With the flag, splits wall time into fetch (arrayBuffer) and parse.
 */
export class PerfGltfLoader extends GLTFLoader {
  override load(
    url: string,
    onLoad: OnLoad,
    onProgress?: OnProgress,
    onError?: OnError,
  ): void {
    if (!isPerfEnabled()) {
      super.load(url, onLoad, onProgress, onError)
      return
    }

    const fail: OnError = (reason) => {
      const message = reason instanceof Error ? reason.message : String(reason)
      onError?.(new ErrorEvent("error", { message }))
    }

    const fetchStarted = performance.now()
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`GLB fetch failed: ${response.status} ${url}`)
        return response.arrayBuffer()
      })
      .then((buffer) => {
        recordGlbFetchMs(performance.now() - fetchStarted)
        if (onProgress) {
          onProgress(
            new ProgressEvent("progress", {
              lengthComputable: true,
              loaded: buffer.byteLength,
              total: buffer.byteLength,
            }),
          )
        }
        const parseStarted = performance.now()
        this.parse(
          buffer,
          "",
          (gltf) => {
            recordGlbParseMs(performance.now() - parseStarted)
            onLoad(gltf)
          },
          fail,
        )
      })
      .catch(fail)
  }
}
