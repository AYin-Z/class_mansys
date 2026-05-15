import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/pages/index/index'
  },
  {
    path: '/pages/index/index',
    name: 'index',
    component: () => import('@/pages/index/index.vue')
  },
  {
    path: '/pages/auth/register',
    name: 'auth-register',
    component: () => import('@/pages/auth/register.vue')
  },
  {
    path: '/pages/login/password-login',
    name: 'login-password-login',
    component: () => import('@/pages/login/password-login.vue')
  },
  {
    path: '/pages/login/phone-login',
    name: 'login-phone-login',
    component: () => import('@/pages/login/phone-login.vue')
  },
  {
    path: '/pages/login/email-login',
    name: 'login-email-login',
    component: () => import('@/pages/login/email-login.vue')
  },
  {
    path: '/pages/leave/index',
    name: 'leave-index',
    component: () => import('@/pages/leave/index.vue')
  },
  {
    path: '/pages/leave/apply',
    name: 'leave-apply',
    component: () => import('@/pages/leave/apply.vue')
  },
  {
    path: '/pages/leave/approve',
    name: 'leave-approve',
    component: () => import('@/pages/leave/approve.vue')
  },
  {
    path: '/pages/leave/cancel',
    name: 'leave-cancel',
    component: () => import('@/pages/leave/cancel.vue')
  },
  {
    path: '/pages/leave/detail',
    name: 'leave-detail',
    component: () => import('@/pages/leave/detail.vue')
  },
  {
    path: '/pages/leave/overview',
    name: 'leave-overview',
    component: () => import('@/pages/leave/overview.vue')
  },
  {
    path: '/pages/notice/index',
    name: 'notice-index',
    component: () => import('@/pages/notice/index.vue')
  },
  {
    path: '/pages/notice/detail',
    name: 'notice-detail',
    component: () => import('@/pages/notice/detail.vue')
  },
  {
    path: '/pages/notice/publish',
    name: 'notice-publish',
    component: () => import('@/pages/notice/publish.vue')
  },
  {
    path: '/pages/announcement/index',
    name: 'announcement-index',
    component: () => import('@/pages/announcement/index.vue')
  },
  {
    path: '/pages/announcement/publish',
    name: 'announcement-publish',
    component: () => import('@/pages/announcement/publish.vue')
  },
  {
    path: '/pages/announcement/upload',
    name: 'announcement-upload',
    component: () => import('@/pages/announcement/upload.vue')
  },
  {
    path: '/pages/album/index',
    name: 'album-index',
    component: () => import('@/pages/album/index.vue')
  },
  {
    path: '/pages/album/create',
    name: 'album-create',
    component: () => import('@/pages/album/create.vue')
  },
  {
    path: '/pages/album/upload',
    name: 'album-upload',
    component: () => import('@/pages/album/upload.vue')
  },
  {
    path: '/pages/fee/index',
    name: 'fee-index',
    component: () => import('@/pages/fee/index.vue')
  },
  {
    path: '/pages/fee/collection',
    name: 'fee-collection',
    component: () => import('@/pages/fee/collection.vue')
  },
  {
    path: '/pages/fee/apply',
    name: 'fee-apply',
    component: () => import('@/pages/fee/apply.vue')
  },
  {
    path: '/pages/fee/apply-approve',
    name: 'fee-apply-approve',
    component: () => import('@/pages/fee/apply-approve.vue')
  },
  {
    path: '/pages/fee/vote',
    name: 'fee-vote',
    component: () => import('@/pages/fee/vote.vue')
  },
  {
    path: '/pages/fee/records',
    name: 'fee-records',
    component: () => import('@/pages/fee/records.vue')
  },
  {
    path: '/pages/fee/publication',
    name: 'fee-publication',
    component: () => import('@/pages/fee/publication.vue')
  },
  {
    path: '/pages/fee/supervision',
    name: 'fee-supervision',
    component: () => import('@/pages/fee/supervision.vue')
  },
  {
    path: '/pages/fee/reimbursement',
    name: 'fee-reimbursement',
    component: () => import('@/pages/fee/reimbursement.vue')
  },
  {
    path: '/pages/psychological/index',
    name: 'psychological-index',
    component: () => import('@/pages/psychological/index.vue')
  },
  {
    path: '/pages/psychological/apply',
    name: 'psychological-apply',
    component: () => import('@/pages/psychological/apply.vue')
  },
  {
    path: '/pages/psychological/status',
    name: 'psychological-status',
    component: () => import('@/pages/psychological/status.vue')
  },
  {
    path: '/pages/challenge/index',
    name: 'challenge-index',
    component: () => import('@/pages/challenge/index.vue')
  },
  {
    path: '/pages/challenge/detail',
    name: 'challenge-detail',
    component: () => import('@/pages/challenge/detail.vue')
  },
  {
    path: '/pages/challenge/create',
    name: 'challenge-create',
    component: () => import('@/pages/challenge/create.vue')
  },
  {
    path: '/pages/vote/index',
    name: 'vote-index',
    component: () => import('@/pages/vote/index.vue')
  },
  {
    path: '/pages/vote/detail',
    name: 'vote-detail',
    component: () => import('@/pages/vote/detail.vue')
  },
  {
    path: '/pages/vote/create',
    name: 'vote-create',
    component: () => import('@/pages/vote/create.vue')
  },
  {
    path: '/pages/homework/index',
    name: 'homework-index',
    component: () => import('@/pages/homework/index.vue')
  },
  {
    path: '/pages/homework/detail',
    name: 'homework-detail',
    component: () => import('@/pages/homework/detail.vue')
  },
  {
    path: '/pages/homework/publish',
    name: 'homework-publish',
    component: () => import('@/pages/homework/publish.vue')
  },
  {
    path: '/pages/external/index',
    name: 'external-index',
    component: () => import('@/pages/external/index.vue')
  },
  {
    path: '/pages/external/webview',
    name: 'external-webview',
    component: () => import('@/pages/external/webview.vue')
  },
  {
    path: '/pages/suggestion/index',
    name: 'suggestion-index',
    component: () => import('@/pages/suggestion/index.vue')
  },
  {
    path: '/pages/suggestion/submit',
    name: 'suggestion-submit',
    component: () => import('@/pages/suggestion/submit.vue')
  },
  {
    path: '/pages/suggestion/status',
    name: 'suggestion-status',
    component: () => import('@/pages/suggestion/status.vue')
  },
  {
    path: '/pages/lottery/index',
    name: 'lottery-index',
    component: () => import('@/pages/lottery/index.vue')
  },
  {
    path: '/pages/lottery/detail',
    name: 'lottery-detail',
    component: () => import('@/pages/lottery/detail.vue')
  },
  {
    path: '/pages/lottery/create',
    name: 'lottery-create',
    component: () => import('@/pages/lottery/create.vue')
  },
  {
    path: '/pages/points/index',
    name: 'points-index',
    component: () => import('@/pages/points/index.vue')
  },
  {
    path: '/pages/points/rank',
    name: 'points-rank',
    component: () => import('@/pages/points/rank.vue')
  },
  {
    path: '/pages/points/rate',
    name: 'points-rate',
    component: () => import('@/pages/points/rate.vue')
  },
  {
    path: '/pages/profile/index',
    name: 'profile-index',
    component: () => import('@/pages/profile/index.vue')
  },
  {
    path: '/pages/profile/settings',
    name: 'profile-settings',
    component: () => import('@/pages/profile/settings.vue')
  },
  {
    path: '/pages/admin/members/index',
    name: 'admin-members-index',
    component: () => import('@/pages/admin/members/index.vue')
  },
  {
    path: '/pages/admin/members/detail',
    name: 'admin-members-detail',
    component: () => import('@/pages/admin/members/detail.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
