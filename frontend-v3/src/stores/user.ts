import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  USER_ROLES,
  type UserRoleId,
  type PermissionKey,
  isAdmin as isAdminRole,
  hasAnyRole,
  hasPermission as hasPerm,
  getRoleLabel
} from '@/types/roles';
import { getToken, setToken, clearToken } from '@/utils/request';
import { getUserInfo as fetchUserInfo, logout as apiLogout } from '@/api/auth';

const STORAGE_KEY = 'user_profile';

export interface UserProfile {
  id: number;
  name: string;
  nickName?: string;
  student_id?: string;
  class_id?: string;
  role: number;          // 与后端 INT 对齐
  phone?: string;
  email?: string;
  avatarUrl?: string;
}

const PERM_STORAGE_KEY = 'user_permissions';

export const useUserStore = defineStore('user', () => {
  const profile = ref<UserProfile | null>(null);
  const _hydrated = ref(false);
  /**
   * token 的响应式真源。
   *
   * 历史坑：isAuthenticated 直接调 getToken()（读 localStorage，非响应式），
   * computed 不会重算 → App.vue 里「未登录就跳登录页」的 watch 永不触发，
   * 401 被踢回登录页后内存态还留着权限快照，管理入口继续可见。
   */
  const token = ref<string>(getToken());
  /** 服务端下发的权限快照（权限矩阵可在超管后台配置，因此以服务端为准） */
  const permissions = ref<Record<string, boolean> | null>(null);
  /** 是否已成功拉取过服务端权限快照 */
  const permissionsLoaded = ref(false);

  const isAuthenticated = computed(() => !!token.value && !!profile.value);
  const role = computed<number>(() => profile.value?.role ?? -1);
  const isAdmin = computed(() => isAdminRole(role.value));
  const roleLabel = computed(() => getRoleLabel(role.value));
  const displayName = computed(() => profile.value?.name || profile.value?.nickName || '未命名');

  /** 同步：仅从本地存储恢复，不发起请求 */
  function hydrate() {
    if (_hydrated.value) return;
    token.value = getToken();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        profile.value = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
      const perms = localStorage.getItem(PERM_STORAGE_KEY);
      if (perms) permissions.value = JSON.parse(perms);
    } catch (e) {
      console.warn('[user store] hydrate failed:', e);
      profile.value = null;
    }
    _hydrated.value = true;
  }

  function setProfile(p: UserProfile) {
    profile.value = p;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }

  function setPermissions(next: Record<string, boolean> | null | undefined) {
    if (!next) return;
    permissions.value = next;
    permissionsLoaded.value = true;
    try { localStorage.setItem(PERM_STORAGE_KEY, JSON.stringify(next)); } catch (_) { /* ignore */ }
  }

  function setTokenAndProfile(token_: string, p: UserProfile) {
    setToken(token_);
    token.value = token_;
    setProfile(p);
  }

  /**
   * 清空登录态（内存 + 本地）。
   * 由 utils/request.ts 的 401 处理回调调用，保证「被踢回登录页」时
   * Pinia 里的 profile / permissions 一起失效。
   */
  function resetAuth() {
    token.value = '';
    profile.value = null;
    permissions.value = null;
    permissionsLoaded.value = false;
    _hydrated.value = false;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PERM_STORAGE_KEY);
    } catch (_) { /* ignore */ }
  }

  /**
   * 首启/进入受保护路由时拉一次权限快照（并发去重）。
   * 此前只有超管后台会 refresh()，其余页面一直用前端硬编码角色镜像，
   * 后台改了权限矩阵前端不生效。
   */
  let _refreshInFlight: Promise<UserProfile | null> | null = null;
  async function refreshPermissionsOnce(): Promise<void> {
    if (!getToken()) return;
    if (permissionsLoaded.value) return;
    if (_refreshInFlight) { await _refreshInFlight; return; }
    _refreshInFlight = refresh();
    try { await _refreshInFlight; } finally { _refreshInFlight = null; }
  }

  /** 异步：调用 /auth/userinfo 拉取最新用户信息 */
  async function refresh(): Promise<UserProfile | null> {
    if (!getToken()) return null;
    try {
      const res = await fetchUserInfo();
      if (res?.success && res.user) {
        const next: UserProfile = {
          id: res.user.id,
          name: res.user.name,
          nickName: res.user.nickName,
          student_id: res.user.student_id,
          class_id: res.user.class_id,
          role: typeof res.user.role === 'number' ? res.user.role : 0,
          phone: res.user.phone,
          email: res.user.email,
          avatarUrl: res.user.avatarUrl
        };
        setProfile(next);
        setPermissions(res.permissions as Record<string, boolean> | undefined);
        permissionsLoaded.value = true;
        return next;
      }
    } catch (e) {
      console.warn('[user store] refresh failed:', e);
    }
    return null;
  }

  async function logout() {
    try { await apiLogout(); } catch (_) { /* ignore */ }
    token.value = '';
    profile.value = null;
    clearToken();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('userInfo');     // 清旧 key
    localStorage.removeItem('isRegistered');
    localStorage.removeItem(PERM_STORAGE_KEY);
    permissions.value = null;
    permissionsLoaded.value = false;
    _hydrated.value = false;
  }

  function hasPermission(perm: PermissionKey): boolean {
    // 服务端快照优先（后台可改权限矩阵）；无快照时回落到前端镜像
    if (permissions.value && perm in permissions.value) return !!permissions.value[perm];
    return hasPerm(role.value, perm);
  }

  function isRoleOneOf(targets: readonly UserRoleId[]): boolean {
    return hasAnyRole(role.value, targets);
  }

  return {
    profile,
    permissions,
    permissionsLoaded,
    setPermissions,
    isAuthenticated,
    role,
    isAdmin,
    roleLabel,
    displayName,
    hydrate,
    setProfile,
    setTokenAndProfile,
    resetAuth,
    refresh,
    refreshPermissionsOnce,
    logout,
    hasPermission,
    isRoleOneOf,
    USER_ROLES
  };
});
