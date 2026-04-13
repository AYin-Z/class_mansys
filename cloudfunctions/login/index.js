// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { code, userInfo } = event
  
  try {
    // 调用微信官方登录接口
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    // 查找用户
    const userCollection = db.collection('users')
    const user = await userCollection.where({ openid }).get()
    
    if (user.data.length === 0) {
      // 新用户，创建用户记录
      const newUser = {
        openid,
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        gender: userInfo.gender || 0,
        student_id: userInfo.student_id || '',
        name: userInfo.name || userInfo.nickName,
        class_id: userInfo.class_id || '',
        role: userInfo.role || 0,
        phone: userInfo.phone || '',
        email: userInfo.email || '',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      const result = await userCollection.add(newUser)
      return {
        success: true,
        user: {
          ...newUser,
          _id: result._id
        },
        message: '注册成功'
      }
    } else {
      // 老用户，更新用户信息
      const existingUser = user.data[0]
      await userCollection.doc(existingUser._id).update({
        data: {
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl,
          gender: userInfo.gender || 0,
          updatedAt: new Date()
        }
      })
      
      return {
        success: true,
        user: existingUser,
        message: '登录成功'
      }
    }
  } catch (error) {
    console.error('登录失败:', error)
    return {
      success: false,
      error: '登录失败',
      details: error.message
    }
  }
}
