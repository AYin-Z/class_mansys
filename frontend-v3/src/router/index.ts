import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { isAdmin as isAdminRole, USER_ROLES } from '@/types/roles'

// Lazy-loaded components — top-level const to help Rollup static analysis
const Features = () => import('@/pages/features/index.vue')

// Login
const PasswordLogin = () => import('@/pages/login/password-login.vue')
const PhoneLogin = () => import('@/pages/login/phone-login.vue')
const EmailLogin = () => import('@/pages/login/email-login.vue')

// Home
const HomePage = () => import('@/pages/index/index.vue')

// Notice
const NoticeList = () => import('@/pages/notice/index.vue')
const NoticeDetail = () => import('@/pages/notice/detail.vue')
const NoticeAdmin = () => import('@/pages/notice/admin.vue')

// Dashboard
const Dashboard = () => import('@/pages/dashboard/index.vue')
const CompanyIndex = () => import('@/pages/company/index.vue')
const AgentPage = () => import('@/pages/agent/index.vue')
const HelpPage = () => import('@/pages/help/index.vue')

// Leave
const LeaveList = () => import('@/pages/leave/index.vue')
const LeaveApply = () => import('@/pages/leave/apply.vue')
const LeaveDetail = () => import('@/pages/leave/detail.vue')
const LeaveApprovals = () => import('@/pages/leave/approvals.vue')

// Homework
const HomeworkList = () => import('@/pages/homework/index.vue')
const HomeworkDetail = () => import('@/pages/homework/detail.vue')

// Fee
const FeeIndex = () => import('@/pages/fee/index.vue')
const FeeExpenseApply = () => import('@/pages/fee/expense-apply.vue')
const FeeExpenseDetail = () => import('@/pages/fee/expense-detail.vue')
const FeeApprovals = () => import('@/pages/fee/approvals.vue')
const FeePublicationDetail = () => import('@/pages/fee/publication-detail.vue')

// Profile
const Profile = () => import('@/pages/profile/index.vue')
const Settings = () => import('@/pages/profile/settings.vue')
const AboutUs = () => import('@/pages/profile/about.vue')

// Announcement
const AnnouncementList = () => import('@/pages/announcement/index.vue')
const AnnouncementDetail = () => import('@/pages/announcement/detail.vue')
const AnnouncementAdmin = () => import('@/pages/announcement/admin.vue')

// Album
const AlbumList = () => import('../pages/album/index.vue')
const AlbumDetail = () => import('../pages/album/detail.vue')

// Vote
const VoteList = () => import('../pages/vote/index.vue')
const VoteDetail = () => import('../pages/vote/detail.vue')

// Psychological
const Psychological = () => import('../pages/psychological/index.vue')

// Challenge
const ChallengeList = () => import('../pages/challenge/index.vue')
const ChallengeDetail = () => import('../pages/challenge/detail.vue')

// Suggestion
const SuggestionIndex = () => import('../pages/suggestion/index.vue')
const SuggestionInbox = () => import('../pages/suggestion/inbox.vue')

// Lottery
const LotteryList = () => import('../pages/lottery/index.vue')
const LotteryDetail = () => import('../pages/lottery/detail.vue')

// Points
const PointsIndex = () => import('../pages/points/index.vue')

// Super Admin
const AdminLogin = () => import('@/pages/admin/login.vue')
const AdminPanel = () => import('@/pages/admin/panel.vue')

// Admin
const AdminMembers = () => import('@/pages/admin/members.vue')
const AdminMemberDetail = () => import('@/pages/admin/member-detail.vue')

// Management pages
const PointsManage = () => import('@/pages/points/manage.vue')
const VoteManage = () => import('@/pages/vote/manage.vue')
const ChallengeManage = () => import('@/pages/challenge/manage.vue')
const LotteryManage = () => import('@/pages/lottery/manage.vue')

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/pages/index/index' },
  { path: '/pages/features/index', name: 'features-index', component: Features },

  // ===== 登录 =====
  { path: '/pages/login/password-login', name: 'login-password', component: PasswordLogin, meta: { public: true } },
  { path: '/pages/login/phone-login', name: 'login-phone', component: PhoneLogin, meta: { public: true } },
  { path: '/pages/login/email-login', name: 'login-email', component: EmailLogin, meta: { public: true } },

  // ===== 首页 =====
  { path: '/pages/index/index', name: 'index', component: HomePage },

  // ===== 通知 =====
  { path: '/pages/notice/index', name: 'notice-index', component: NoticeList },
  { path: '/pages/notice/detail', name: 'notice-detail', component: NoticeDetail },
  { path: '/pages/notice/admin', name: 'notice-admin', component: NoticeAdmin, meta: { requiresAdmin: true } },

  // ===== 仪表盘 =====
  { path: '/pages/dashboard/index', name: 'dashboard-index', component: Dashboard, meta: { requiresAdmin: true } },
  { path: '/pages/company/index', name: 'company-index', component: CompanyIndex, meta: { requiresAdmin: true } },
  { path: '/pages/agent/index', name: 'agent-index', component: AgentPage },
  { path: '/pages/help/index', name: 'help-index', component: HelpPage },

  // ===== 请假 =====
  { path: '/pages/leave/index', name: 'leave-index', component: LeaveList },
  { path: '/pages/leave/apply', name: 'leave-apply', component: LeaveApply },
  { path: '/pages/leave/detail', name: 'leave-detail', component: LeaveDetail },
  { path: '/pages/leave/approvals', name: 'leave-approvals', component: LeaveApprovals, meta: { requiresAdmin: true } },

  // ===== 作业 =====
  { path: '/pages/homework/index', name: 'homework-index', component: HomeworkList },
  { path: '/pages/homework/detail', name: 'homework-detail', component: HomeworkDetail },

  // ===== 班费 =====
  { path: '/pages/fee/index', name: 'fee-index', component: FeeIndex },
  { path: '/pages/fee/expense-apply', name: 'fee-expense-apply', component: FeeExpenseApply },
  { path: '/pages/fee/expense-detail', name: 'fee-expense-detail', component: FeeExpenseDetail },
  { path: '/pages/fee/approvals', name: 'fee-approvals', component: FeeApprovals },
  { path: '/pages/fee/publication-detail', name: 'fee-publication-detail', component: FeePublicationDetail },

  // ===== 个人中心 =====
  { path: '/pages/profile/index', name: 'profile-index', component: Profile },
  { path: '/pages/profile/settings', name: 'profile-settings', component: Settings },
  { path: '/pages/profile/about', name: 'profile-about', component: AboutUs },

  // ===== 公告 =====
  { path: '/pages/announcement/index', name: 'announcement-index', component: AnnouncementList },
  { path: '/pages/announcement/detail', name: 'announcement-detail', component: AnnouncementDetail },
  { path: '/pages/announcement/admin', name: 'announcement-admin', component: AnnouncementAdmin, meta: { requiresAdmin: true } },

  // ===== 区队相册 =====
  { path: '/pages/album/index', name: 'album-index', component: AlbumList },
  { path: '/pages/album/detail', name: 'album-detail', component: AlbumDetail },

  // ===== 投票 =====
  { path: '/pages/vote/index', name: 'vote-index', component: VoteList },
  { path: '/pages/vote/detail', name: 'vote-detail', component: VoteDetail },

  // ===== 心理 =====
  { path: '/pages/psychological/index', name: 'psychological-index', component: Psychological },

  // ===== 擂台 =====
  { path: '/pages/challenge/index', name: 'challenge-index', component: ChallengeList },
  { path: '/pages/challenge/detail', name: 'challenge-detail', component: ChallengeDetail },

  // ===== 建议 =====
  { path: '/pages/suggestion/index', name: 'suggestion-index', component: SuggestionIndex },
  { path: '/pages/suggestion/inbox', name: 'suggestion-inbox', component: SuggestionInbox, meta: { requiresAdmin: true } },

  // ===== 抽奖 =====
  { path: '/pages/lottery/index', name: 'lottery-index', component: LotteryList },
  { path: '/pages/lottery/detail', name: 'lottery-detail', component: LotteryDetail },

  // ===== 积分 =====
  { path: '/pages/points/index', name: 'points-index', component: PointsIndex },

  // ===== 管理员 =====
  { path: '/pages/admin/members', name: 'admin-members', component: AdminMembers, meta: { requiresAdmin: true } },
  { path: '/pages/admin/member-detail', name: 'admin-member-detail', component: AdminMemberDetail, meta: { requiresAdmin: true } },

  // ===== 管理后台 =====
  { path: '/pages/points/manage', name: 'points-manage', component: PointsManage, meta: { requiresAdmin: true } },
  { path: '/pages/vote/manage', name: 'vote-manage', component: VoteManage, meta: { requiresAdmin: true } },
  { path: '/pages/challenge/manage', name: 'challenge-manage', component: ChallengeManage, meta: { requiresAdmin: true } },
  { path: '/pages/lottery/manage', name: 'lottery-manage', component: LotteryManage, meta: { requiresAdmin: true } },

  // ===== 超管后台（独立入口） =====
  { path: '/admin/login', name: 'admin-login', component: AdminLogin, meta: { public: true } },
  { path: '/admin/panel', name: 'admin-panel', component: AdminPanel },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// ========== 路由守卫 ==========
const PUBLIC_ROUTES = ['/pages/login/password-login', '/pages/login/phone-login', '/pages/login/email-login', '/admin/login']
const DEFAULT_LOGIN = '/pages/login/password-login'
const DEFAULT_AUTHENTICATED = '/pages/index/index'

function readStoredRole(): number | null {
  try {
    const raw = localStorage.getItem('user_profile')
    if (!raw) return null
    const profile = JSON.parse(raw)
    return typeof profile?.role === 'number' ? profile.role : null
  } catch {
    return null
  }
}

router.beforeEach(async (to) => {
  // 公开路由：登录页 & 超管登录页放行
  for (const prefix of PUBLIC_ROUTES) {
    if (to.path.startsWith(prefix)) return true
  }

  // 超管后台：必须 role=8
  if (to.path.startsWith('/admin/')) {
    const token = localStorage.getItem('backend_token')
    if (!token) return { path: '/admin/login' }
    const role = readStoredRole()
    if (role !== USER_ROLES.SUPER_ADMIN) {
      return { path: '/admin/login' }
    }
    return true
  }

  const token = localStorage.getItem('backend_token')
  if (!token) return { path: DEFAULT_LOGIN, query: { redirect: to.fullPath } }
  const profileRaw = localStorage.getItem('user_profile')
  if (!profileRaw) {
    localStorage.removeItem('backend_token')
    return DEFAULT_LOGIN
  }
  if (to.meta?.requiresAdmin && !isAdminRole(readStoredRole())) {
    return DEFAULT_AUTHENTICATED
  }
  return true
})

export default router
