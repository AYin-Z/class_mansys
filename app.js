App({
  onLaunch: function() {
    // 小程序启动时执行
    console.log('小程序启动');
    // 初始化用户信息
    this.getUserInfo();
    // 检查注册状态
    this.checkRegistrationStatus();
  },
  checkRegistrationStatus: function() {
    // 检查用户是否已注册
    const isRegistered = wx.getStorageSync('isRegistered');
    if (!isRegistered) {
      // 未注册，跳转到注册页面
      wx.redirectTo({
        url: '/pages/auth/register'
      });
    }
  },
  onShow: function() {
    // 小程序显示时执行
    console.log('小程序显示');
  },
  onHide: function() {
    // 小程序隐藏时执行
    console.log('小程序隐藏');
  },
  getUserInfo: function() {
    // 获取用户信息
    wx.getUserInfo({
      success: res => {
        this.globalData.userInfo = res.userInfo;
        console.log('获取用户信息成功', res.userInfo);
      },
      fail: err => {
        console.error('获取用户信息失败', err);
      }
    });
  },
  globalData: {
    userInfo: null,
    baseUrl: 'https://api.example.com' // 后端API地址
  }
})