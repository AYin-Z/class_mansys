// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, data } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  try {
    switch (action) {
      case 'applyLeave':
        return await applyLeave(data, openid)
      case 'getMyLeaves':
        return await getMyLeaves(openid)
      case 'getAllLeaves':
        return await getAllLeaves()
      case 'approveLeave':
        return await approveLeave(data, openid)
      case 'cancelLeave':
        return await cancelLeave(data, openid)
      default:
        return {
          success: false,
          error: '未知操作'
        }
    }
  } catch (error) {
    console.error('请假管理失败:', error)
    return {
      success: false,
      error: '操作失败',
      details: error.message
    }
  }
}

// 提交请假申请
async function applyLeave(leaveData, openid) {
  // 查找用户
  const user = await db.collection('users').where({ openid }).get()
  if (user.data.length === 0) {
    return {
      success: false,
      error: '用户不存在'
    }
  }
  
  const userId = user.data[0]._id
  
  const newLeave = {
    user_id: userId,
    leave_type: leaveData.leaveType,
    start_time: new Date(leaveData.startTime),
    end_time: new Date(leaveData.endTime),
    reason: leaveData.reason,
    status: 0, // 0: 待审批
    is_cancelled: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  const result = await db.collection('leaves').add(newLeave)
  
  return {
    success: true,
    leave: {
      ...newLeave,
      _id: result._id
    },
    message: '请假申请提交成功'
  }
}

// 获取我的请假记录
async function getMyLeaves(openid) {
  // 查找用户
  const user = await db.collection('users').where({ openid }).get()
  if (user.data.length === 0) {
    return {
      success: false,
      error: '用户不存在'
    }
  }
  
  const userId = user.data[0]._id
  
  const leaves = await db.collection('leaves')
    .where({ user_id: userId })
    .orderBy('createdAt', 'desc')
    .get()
  
  return {
    success: true,
    leaves: leaves.data
  }
}

// 获取所有请假记录（管理员）
async function getAllLeaves() {
  const leaves = await db.collection('leaves')
    .orderBy('createdAt', 'desc')
    .get()
  
  // 关联用户信息
  const leavesWithUser = await Promise.all(leaves.data.map(async (leave) => {
    const user = await db.collection('users').doc(leave.user_id).get()
    return {
      ...leave,
      user: user.data
    }
  }))
  
  return {
    success: true,
    leaves: leavesWithUser
  }
}

// 审批请假
async function approveLeave(approveData, openid) {
  // 查找审批人
  const approver = await db.collection('users').where({ openid }).get()
  if (approver.data.length === 0) {
    return {
      success: false,
      error: '审批人不存在'
    }
  }
  
  const approverId = approver.data[0]._id
  
  await db.collection('leaves').doc(approveData.leaveId).update({
    data: {
      status: approveData.status, // 1: 已批准, 2: 已拒绝
      approver_id: approverId,
      approval_time: new Date(),
      approval_notes: approveData.notes || '',
      updatedAt: new Date()
    }
  })
  
  return {
    success: true,
    message: '审批成功'
  }
}

// 销假
async function cancelLeave(cancelData, openid) {
  // 查找用户
  const user = await db.collection('users').where({ openid }).get()
  if (user.data.length === 0) {
    return {
      success: false,
      error: '用户不存在'
    }
  }
  
  const userId = user.data[0]._id
  
  // 验证请假记录属于当前用户
  const leave = await db.collection('leaves').doc(cancelData.leaveId).get()
  if (!leave.data || leave.data.user_id !== userId) {
    return {
      success: false,
      error: '请假记录不存在或无权操作'
    }
  }
  
  await db.collection('leaves').doc(cancelData.leaveId).update({
    data: {
      is_cancelled: true,
      cancelled_time: new Date(),
      updatedAt: new Date()
    }
  })
  
  return {
    success: true,
    message: '销假成功'
  }
}
