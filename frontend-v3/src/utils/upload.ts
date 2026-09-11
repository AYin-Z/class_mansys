/**
 * 客户端上传管线（2026-09 文件通路改造）
 *
 * 为什么需要它：相册此前是「一次一张、无进度、无重试、原始大图直传」。
 * 手机拍一张照片 3–6MB，4G 上传一张要十几秒，批量 20 张既看不到进度也容易失败，
 * 失败后整批重来 —— 这是"相册不可用"的另一半原因。
 *
 * 这里提供四件事：
 *  1. compressImage：上传前用 canvas 压缩 + 按 EXIF 摆正（3MB → 300KB 量级）
 *  2. uploadWithProgress：XHR 上传，带真实进度（fetch 拿不到上传进度）
 *  3. uploadMedia：走统一端点 /api/media/upload?kind=…，返回 thumb/medium 等元数据
 *  4. uploadBatch：并发 3、失败重试 2 次、可取消，逐张回调进度
 */

import { getToken } from './request'

export interface MediaUploadResult {
  url: string
  thumbUrl?: string | null
  mediumUrl?: string | null
  filename: string
  size: number
  width?: number | null
  height?: number | null
  id?: number
  autoApproved?: boolean
}

export interface BatchItemState {
  file: File
  /** 压缩后的实际上传对象 */
  upload: File
  status: 'pending' | 'compressing' | 'uploading' | 'done' | 'failed' | 'canceled'
  progress: number
  error?: string
  result?: MediaUploadResult
}

const IMAGE_RE = /^image\//

/** 是否需要压缩（动图压缩会丢帧，直接跳过） */
function shouldCompress(file: File): boolean {
  if (!IMAGE_RE.test(file.type)) return false
  if (/gif/i.test(file.type)) return false
  return true
}

/**
 * 压缩图片（长边限制 + 质量），并按 EXIF 方向摆正。
 * 失败/不支持时原样返回，绝不因为压缩而让上传失败。
 */
export async function compressImage(
  file: File,
  { maxEdge = 2560, quality = 0.85 }: { maxEdge?: number; quality?: number } = {},
): Promise<File> {
  if (!shouldCompress(file)) return file
  // 小于 400KB 的原图没必要压（再压收益有限，反而损失质量）
  if (file.size < 400 * 1024) return file
  if (typeof createImageBitmap !== 'function') return file

  try {
    // imageOrientation: 'from-image' 让浏览器按 EXIF 自动旋转（手机竖拍照片的关键）
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close?.(); return file }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
    )
    if (!blob) return file
    // 压缩后反而更大就用原图
    if (blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}

export interface UploadProgressOptions {
  onProgress?: (percent: number) => void
  signal?: AbortSignal
  timeoutMs?: number
}

/** XHR 上传单文件（带进度与取消） */
export function uploadWithProgress(
  url: string,
  file: File,
  fields: Record<string, string> = {},
  opts: UploadProgressOptions = {},
): Promise<MediaUploadResult> {
  const { onProgress, signal, timeoutMs = 120000 } = opts
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('已取消'))
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append('file', file)
    for (const [k, v] of Object.entries(fields)) form.append(k, v)

    const onAbort = () => xhr.abort()
    signal?.addEventListener('abort', onAbort, { once: true })

    xhr.open('POST', url, true)
    const token = getToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.timeout = timeoutMs

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      signal?.removeEventListener('abort', onAbort)
      let body: any = null
      try { body = JSON.parse(xhr.responseText) } catch { /* 非 JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && body?.success) {
        onProgress?.(100)
        const data = body.data || body
        resolve({
          url: data.url,
          thumbUrl: data.thumbUrl,
          mediumUrl: data.mediumUrl,
          filename: data.filename || file.name,
          size: data.size ?? file.size,
          width: data.width,
          height: data.height,
          id: data.id,
          autoApproved: data.autoApproved,
        })
      } else {
        reject(new Error(body?.error || `上传失败（${xhr.status}）`))
      }
    }
    xhr.onerror = () => { signal?.removeEventListener('abort', onAbort); reject(new Error('网络异常，上传失败')) }
    xhr.ontimeout = () => { signal?.removeEventListener('abort', onAbort); reject(new Error('上传超时，请检查网络后重试')) }
    xhr.onabort = () => { signal?.removeEventListener('abort', onAbort); reject(new Error('已取消')) }
    xhr.send(form)
  })
}

export type MediaKind = 'album' | 'proof' | 'resource' | 'agent' | 'homework' | 'fee'

/** 走统一媒体端点上传（自动压缩） */
export async function uploadMedia(
  file: File,
  kind: MediaKind,
  fields: Record<string, string> = {},
  opts: UploadProgressOptions & { compress?: boolean } = {},
): Promise<MediaUploadResult> {
  const { compress = true, ...rest } = opts
  const prepared = compress ? await compressImage(file) : file
  return uploadWithProgress(`/api/media/upload?kind=${kind}`, prepared, fields, rest)
}

export interface BatchUploadOptions {
  kind: MediaKind
  fields?: Record<string, string>
  concurrency?: number
  retries?: number
  /** 只要图片（相册场景）：非图片会被标记为 failed 并跳过 */
  imagesOnly?: boolean
  signal?: AbortSignal
  onItem?: (index: number, state: BatchItemState) => void
  onOverall?: (done: number, total: number) => void
}

/**
 * 批量上传：并发受控 + 单张重试 + 整批可取消
 * 返回每张的最终状态（成功/失败/取消），供界面逐张展示与「重试失败项」。
 */
export async function uploadBatch(files: File[], options: BatchUploadOptions): Promise<BatchItemState[]> {
  const {
    kind, fields = {}, concurrency = 3, retries = 2, imagesOnly = false,
    signal, onItem, onOverall,
  } = options

  const states: BatchItemState[] = files.map((file) => ({
    file,
    upload: file,
    status: 'pending',
    progress: 0,
  }))

  let done = 0
  let cursor = 0
  const emit = (i: number) => onItem?.(i, states[i])

  async function worker() {
    while (cursor < files.length) {
      const index = cursor++
      const state = states[index]
      if (signal?.aborted) { state.status = 'canceled'; emit(index); continue }

      if (imagesOnly && !IMAGE_RE.test(state.file.type)) {
        state.status = 'failed'
        state.error = '不是图片文件'
        done++; onOverall?.(done, files.length); emit(index)
        continue
      }

      let lastError = ''
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          if (attempt === 0) {
            state.status = 'compressing'
            emit(index)
            state.upload = await compressImage(state.file)
          }
          state.status = 'uploading'
          emit(index)
          state.result = await uploadWithProgress(
            `/api/media/upload?kind=${kind}`,
            state.upload,
            fields,
            {
              signal,
              onProgress: (p) => { state.progress = p; emit(index) },
            },
          )
          state.status = 'done'
          state.progress = 100
          lastError = ''
          break
        } catch (err) {
          lastError = (err as Error)?.message || '上传失败'
          if (signal?.aborted) { state.status = 'canceled'; lastError = '已取消'; break }
          if (attempt < retries) {
            // 指数退避：1s / 2s，避免弱网下连续失败
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
          }
        }
      }
      if (state.status !== 'done') {
        state.status = state.status === 'canceled' ? 'canceled' : 'failed'
        state.error = lastError
      }
      done++
      onOverall?.(done, files.length)
      emit(index)
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, files.length)) }, () => worker())
  await Promise.all(workers)
  return states
}

/** 把上传结果拼成 mediaUrl 可用的受保护地址（原图/缩略图） */
export function resultUrls(result: MediaUploadResult) {
  return {
    full: result.url,
    thumb: result.thumbUrl || result.url,
    medium: result.mediumUrl || result.url,
  }
}
