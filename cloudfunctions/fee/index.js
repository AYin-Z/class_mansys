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
      case 'createExpense':
        return await createExpense(data, openid)
      case 'getMyExpenses':
        return await getMyExpenses(openid)
      case 'getAllExpenses':
        return await getAllExpenses()
      case 'approveExpense':
        return await approveExpense(data, openid)
      case 'getBalance':
        return await getBalance()
      default:
        return {
          success: false,
          error: '未知操作'
        }
    }
  } catch (error) {
    console.error('班费管理失败:', error)
    return {
      success: false,
      error: '操作失败',
      details: error.message
    }
  }
}

// 提交班费记录
async function createExpense(expenseData, openid) {
  // 查找用户
  const user = await db.collection('users').where({ openid }).get()
  if (user.data.length === 0) {
    return {
      success: false,
      error: '用户不存在'
    }
  }
  
  const userId = user.data[0]._id
  
  const newExpense = {
    user_id: userId,
    amount: expenseData.amount,
    type: expenseData.type, // 收入/支出
    purpose: expenseData.purpose,
    status: 0, // 0: 待审批
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  const result = await db.collection('expenses').add(newExpense)
  
  return {
    success: true,
    expense: {
      ...newExpense,
      _id: result._id
    },
    message: '班费记录提交成功'
  }
}

// 获取我的班费记录
async function getMyExpenses(openid) {
  // 查找用户
  const user = await db.collection('users').where({ openid }).get()
  if (user.data.length === 0) {
    return {
      success: false,
      error: '用户不存在'
    }
  }
  
  const userId = user.data[0]._id
  
  const expenses = await db.collection('expenses')
    .where({ user_id: userId })
    .orderBy('createdAt', 'desc')
    .get()
  
  return {
    success: true,
    expenses: expenses.data
  }
}

// 获取所有班费记录（管理员）
async function getAllExpenses() {
  const expenses = await db.collection('expenses')
    .orderBy('createdAt', 'desc')
    .get()
  
  // 关联用户信息
  const expensesWithUser = await Promise.all(expenses.data.map(async (expense) => {
    const user = await db.collection('users').doc(expense.user_id).get()
    return {
      ...expense,
      user: user.data
    }
  }))
  
  return {
    success: true,
    expenses: expensesWithUser
  }
}

// 审批班费记录
async function approveExpense(approveData, openid) {
  // 查找审批人
  const approver = await db.collection('users').where({ openid }).get()
  if (approver.data.length === 0) {
    return {
      success: false,
      error: '审批人不存在'
    }
  }
  
  const approverId = approver.data[0]._id
  
  await db.collection('expenses').doc(approveData.expenseId).update({
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

// 获取班费余额
async function getBalance() {
  // 计算收入总额
  const incomeResult = await db.collection('expenses')
    .where({ type: '收入', status: 1 })
    .field({ amount: true })
    .get()
  
  const income = incomeResult.data.reduce((sum, item) => sum + item.amount, 0)
  
  // 计算支出总额
  const expenseResult = await db.collection('expenses')
    .where({ type: '支出', status: 1 })
    .field({ amount: true })
    .get()
  
  const expense = expenseResult.data.reduce((sum, item) => sum + item.amount, 0)
  
  const balance = income - expense
  
  return {
    success: true,
    balance: balance,
    income: income,
    expense: expense
  }
}
