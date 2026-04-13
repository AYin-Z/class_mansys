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
      case 'createNotice':
        return await createNotice(data, openid)
      case 'getNotices':
        return await getNotices(data)
      case 'getNoticeDetail':
        return await getNoticeDetail(data)
      case 'getUnreadCount':
        return await getUnreadCount(openid)
      default:
        return {
          success: false,
          error: '未知操作'
        }
    }
  } catch (error) {
    console.error('通知管理失败:', error)
    return {
      success: false,
      error: '操作失败',
      details: error.message
    }
  }
}

// 发布通知
async function createNotice(noticeData, openid) {
  // 查找用户
  const user = await db.collection('users').where({ openid }).get()
  if (user.data.length === 0) {
    return {
      success: false,
      error: '用户不存在'
    }
  }
  
  const creatorId = user.data[0]._id
  
  const newNotice = {
    title: noticeData.title,
    content: noticeData.content,
    type: noticeData.type || 'normal',
    creator_id: creatorId,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  const result = await db.collection('notices').add(newNotice)
  
  return {
    success: true,
    notice: {
      ...newNotice,
      _id: result._id
    },
    message: '通知发布成功'
  }
}

// 获取通知列表
async function getNotices(params) {
  const { page = 1, pageSize = 10 } = params || {}
  const skip = (page - 1) * pageSize
  
  const notices = await db.collection('notices')
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()
  
  // 关联创建人信息
  const noticesWithCreator = await Promise.all(notices.data.map(async (notice) => {
    const creator = await db.collection('users').doc(notice.creator_id).get()
    return {
      ...notice,
      creator: creator.data
    }
  }))
  
  // 获取总数
  const totalResult = await db.collection('notices').count()
  
  return {
    success: true,
    notices: noticesWithCreator,
    total: totalResult.total,
    page,
    pageSize
  }
}

// 获取通知详情
async function getNoticeDetail(params) {
  const { noticeId } = params
  
  const notice = await db.collection('notices').doc(noticeId).get()
  if (!notice.data) {
    return {
      success: false,
      error: '通知不存在'
    }
  }
  
  // 关联创建人信息
  const creator = await db.collection('users').doc(notice.data.creator_id).get()
  
  return {
    success: true,
    notice: {
      ...notice.data,
      creator: creator.data
    }
  }
}

// 获取未读通知数
async function getUnreadCount(openid) {
  // 查找用户
  const user = await db.collection('users').where({ openid }).get()
  if (user.data.length === 0) {
    return {
      success: false,
      error: '用户不存在'
    }
  }
  
  // 这里简化处理，实际应该有一个通知阅读记录
  // 暂时返回总通知数
  const totalResult = await db.collection('notices').count()
  
  return {
    success: true,
    count: totalResult.total
  }
}
