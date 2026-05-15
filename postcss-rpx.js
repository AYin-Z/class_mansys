// 将 uni-app rpx 单位转为浏览器可识别的视口单位
// 1rpx = 100vw / 750 （uni-app 标准）
module.exports = () => ({
  postcssPlugin: 'postcss-rpx-to-viewport',
  Declaration(decl) {
    if (decl.value.includes('rpx')) {
      const replaced = decl.value.replace(
        /(\d+(?:\.\d+)?)rpx/g,
        (_, num) => `calc(${num} * 100vw / 750)`
      )
      if (replaced !== decl.value) {
        decl.value = replaced
      }
    }
  },
})
module.exports.postcss = true
