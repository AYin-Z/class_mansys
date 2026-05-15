import { useRouter } from 'vue-router'

/**
 * 格式化日期
 * @param date 日期对象或时间戳
 * @param format 格式化字符串，默认 'YYYY-MM-DD HH:mm:ss'
 */
export function formatDate(date: Date | number, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const seconds = d.getSeconds().toString().padStart(2, '0');

  return format
    .replace('YYYY', year.toString())
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/** 请假记录时间展示（兼容 MySQL DATETIME / ISO 字符串） */
export function formatLeaveDateTime(input: string | Date | null | undefined): string {
  if (input == null || input === '') return '—'
  const raw = input instanceof Date ? input : String(input).trim()
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return raw
  return formatDate(d.getTime(), 'YYYY-MM-DD HH:mm')
}

/** 解析请假提交用的时间字符串为时间戳（用于校验先后） */
export function parseLeaveDateTimeMs(s: string): number {
  if (!s) return NaN
  const t = s.includes('T') ? s : s.replace(' ', 'T')
  return new Date(t).getTime()
}

/** 页面跳转 — 需要组件内使用，传入 router 实例 */
export function navigateTo(url: string, type: 'navigateTo' | 'redirectTo' | 'reLaunch' = 'navigateTo') {
  return (router: ReturnType<typeof useRouter>) => {
    switch (type) {
      case 'navigateTo':
        router.push(url);
        break;
      case 'redirectTo':
      case 'reLaunch':
        router.replace(url);
        break;
    }
  }
}

/** 获取系统信息（安全区、屏幕尺寸等） */
export function getSystemInfo(): { statusBarHeight: number; screenWidth: number; screenHeight: number } {
  return {
    statusBarHeight: window.innerHeight > window.screen.height ? 0 : 20,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  };
}

/**
 * 深拷贝对象
 * @param obj 要拷贝的对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
  if (typeof obj === 'object') {
    const cloned = {} as any;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone((obj as any)[key]);
      }
    }
    return cloned;
  }
  return obj;
}
