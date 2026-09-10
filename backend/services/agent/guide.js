const GUIDES = {
  请假: {
    steps: ['首页点「请假」进入请假页', '点「申请请假」，选择请假类型（早操/早集合/午集合/收假集合/晚自习/中队会/全休/其他）', '固定时段类型只需选日期；自由时段需自选起止时间', '填写事由（可附证明材料照片）', '提交后等待干部审批，通过后按时间离队', '归队后在同一页面点「销假」'],
    pages: ['/pages/leave/index', '/pages/leave/apply']
  },
  通知公告: {
    steps: ['底部「通知」页查看全部通知与待办', '带「待办」标记的通知需要点开并点「标记完成」', '公告在首页/公告页查看，附件可直接下载'],
    pages: ['/pages/notice/index', '/pages/announcement/index']
  },
  作业: {
    steps: ['进入「作业」页查看列表与截止时间', '点开作业查看要求与附件', '上传文件提交；截止后不能再提交', '批改结果在作业详情里查看'],
    pages: ['/pages/homework/index']
  },
  班费: {
    steps: ['进入「班费」页查看收缴批次与收支记录', '有待缴批次时点「缴纳」并填写金额', '报销：点「申请」填写金额与用途，上传凭证', '申请后进入审批链（区队长→辅导员→大额投票），进度在「我的申请」查看', '公示与账本对所有同学公开'],
    pages: ['/pages/fee/index', '/pages/fee/expense-apply']
  },
  建议箱: {
    steps: ['进入「建议箱」', '填写建议内容（至少 5 个字）与分类', '提交为匿名，干部只能看到内容看不到是谁', '可在「我的提交」凭本地凭据查看处理进度与回复'],
    pages: ['/pages/suggestion/index']
  },
  积分: {
    steps: ['进入「积分」页查看自己的积分明细与总分', '排行榜在「积分排行」中查看', '干部可在积分管理中加减分（需填写事由）'],
    pages: ['/pages/points/index']
  },
  心理: {
    steps: ['进入「心理」页填写你的困扰并提交', '只有心理副区/辅导员等授权人员可见', '处理进展可在「我的申请」查看'],
    pages: ['/pages/psychological/index']
  },
  相册: {
    steps: ['进入「相册」查看区队照片', '可上传照片，普通同学上传后需要干部审核', '干部可直接审核通过或驳回'],
    pages: ['/pages/album/index']
  },
  投票抽奖擂台: {
    steps: ['投票：进入「投票」页选择选项提交；干部可创建/关闭', '抽奖：进入「抽奖」页参与，干部开奖后查看结果', '擂台：进入「擂台」页报名挑战，干部裁判并更新擂主'],
    pages: ['/pages/vote/index', '/pages/lottery/index', '/pages/challenge/index']
  },
  账号: {
    steps: ['「我的」页面查看资料与角色', '设置里可改姓名/手机/邮箱、修改密码、切换主题', '忘记密码：登录页用手机号/邮箱验证码重置（需管理员配置短信/邮件服务）'],
    pages: ['/pages/profile/index', '/pages/profile/settings']
  },
  中队出勤: {
    steps: ['中队总览页查看各区队出勤/请假/未销假统计', '当日请假明细列出在假人员与时段', '干部可在仪表盘看到中队概览卡片'],
    pages: ['/pages/company/index', '/pages/dashboard/index']
  }
};

function systemGuide(args) {
  const topic = String((args && args.topic) || '').trim();
  if (!topic) {
    return { success: true, topics: Object.keys(GUIDES), hint: '请指定 topic，例如「请假」「班费」' };
  }
  const hitKey = Object.keys(GUIDES).find((k) => k.includes(topic) || topic.includes(k));
  if (!hitKey) {
    return { success: true, topic, found: false, topics: Object.keys(GUIDES), hint: '没有该主题，可从 topics 里选一个' };
  }
  return { success: true, topic: hitKey, found: true, steps: GUIDES[hitKey].steps, pages: GUIDES[hitKey].pages };
}

module.exports = { systemGuide, GUIDES };
