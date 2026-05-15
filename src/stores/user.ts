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
} from '@/constants/roles';
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

export const useUserStore = defineStore('user', () => {
  const profile = ref<UserProfile | null>(null);
  const _hydrated = ref(false);

  const isAuthenticated = computed(() => !!getToken() && !!profile.value);
  const role = computed<number>(() => profile.value?.role ?? -1);
  const isAdmin = computed(() => isAdminRole(role.value));
  const roleLabel = computed(() => getRoleLabel(role.value));
  const displayName = computed(() => profile.value?.name || profile.value?.nickName || '未命名');

  /** 同步：仅从本地存储恢复，不发起请求 */
  function hydrate() {
    if (_hydrated.value) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        profile.value = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
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

  function setTokenAndProfile(token: string, p: UserProfile) {
    setToken(token);
    setProfile(p);
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
        return next;
      }
    } catch (e) {
      console.warn('[user store] refresh failed:', e);
    }
    return null;
  }

  async function logout() {
    try { await apiLogout(); } catch (_) { /* ignore */ }
    profile.value = null;
    clearToken();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('userInfo');     // 清旧 key
    localStorage.removeItem('isRegistered');
  }

  function hasPermission(perm: PermissionKey): boolean {
    return hasPerm(role.value, perm);
  }

  function isRoleOneOf(targets: readonly UserRoleId[]): boolean {
    return hasAnyRole(role.value, targets);
  }

  return {
    profile,
    isAuthenticated,
    role,
    isAdmin,
    roleLabel,
    displayName,
    hydrate,
    setProfile,
    setTokenAndProfile,
    refresh,
    logout,
    hasPermission,
    isRoleOneOf,
    USER_ROLES
  };
});
