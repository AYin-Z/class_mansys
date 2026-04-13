const ADMIN_ROLES = {
  CLASS_LEADER: '区队长',
  LIFE_VICE: '生活副区',
  STUDY_VICE: '学习副区',
  PSYCHOLOGICAL_VICE: '心理副区',
  LEAGUE_SECRETARY: '团支书',
  ORGANIZATION_COMMITTEE: '组织委员',
  PUBLICITY_COMMITTEE: '宣传委员'
}

const SUPER_ADMIN_PASSWORD = 'kskblzdjdwqzkbl'
const MAX_ADMIN_COUNT = 7

function getCurrentUser() {
  const encryptedUserInfo = uni.getStorageSync('userInfo')
  if (encryptedUserInfo) {
    return {
      ...encryptedUserInfo,
      studentId: decodeBase64(encryptedUserInfo.studentId),
      phone: decodeBase64(encryptedUserInfo.phone),
      email: decodeBase64(encryptedUserInfo.email)
    }
  }
  return null
}

function setCurrentUser(user) {
  uni.setStorageSync('userInfo', user)
  uni.setStorageSync('isRegistered', true)
}

function isAdmin() {
  const user = getCurrentUser()
  return user && user.isAdmin
}

function isAdminRole(role) {
  const user = getCurrentUser()
  return user && user.isAdmin && user.adminRole === role
}

function getAdminRole() {
  const user = getCurrentUser()
  return user ? user.adminRole : null
}

function canPublishHomework() {
  const user = getCurrentUser()
  return isAdminRole(ADMIN_ROLES.STUDY_VICE) || (user && user.is_kclass_representative)
}

function canPublishNotice() {
  return isAdmin()
}

function canApproveNotice() {
  return isAdminRole(ADMIN_ROLES.CLASS_LEADER)
}

function canApproveLeave() {
  return isAdmin()
}

function isTreasurer() {
  return isAdminRole(ADMIN_ROLES.LIFE_VICE)
}

function isBookkeeper() {
  return isAdminRole(ADMIN_ROLES.ORGANIZATION_COMMITTEE)
}

function isClassLeader() {
  return isAdminRole(ADMIN_ROLES.CLASS_LEADER)
}

function verifySuperAdminPassword(password) {
  return password === SUPER_ADMIN_PASSWORD
}

function getSuperAdminPassword() {
  return SUPER_ADMIN_PASSWORD
}

function getMaxAdminCount() {
  return MAX_ADMIN_COUNT
}

function getAdminRoles() {
  return Object.values(ADMIN_ROLES)
}

function encodeBase64(str) {
  return uni.arrayBufferToBase64(new Uint8Array([...str].map(c => c.charCodeAt(0))).buffer)
}

function decodeBase64(str) {
  const bytes = uni.base64ToArrayBuffer(str)
  return String.fromCharCode(...new Uint8Array(bytes))
}

export {
  ADMIN_ROLES,
  getCurrentUser,
  setCurrentUser,
  isAdmin,
  isAdminRole,
  getAdminRole,
  canPublishHomework,
  canPublishNotice,
  canApproveNotice,
  canApproveLeave,
  isTreasurer,
  isBookkeeper,
  isClassLeader,
  verifySuperAdminPassword,
  getSuperAdminPassword,
  getMaxAdminCount,
  getAdminRoles,
  encodeBase64,
  decodeBase64
}