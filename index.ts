/*
 * @Author: shh
 * @Date: 2020-01-03 10:42:07
 * @Last Modified by: shh
 * @Last Modified time: 2020-01-03 10:47:08
 * @Desc
 */

global.Object = Object
global.Date = Date

import router from './lib/router'
import dataCenter from './lib/data-center'

router.beforeRouteEnter = (to, from , next) => {
  dataCenter.registerPage(to)
  next()
}

export { default as router } from './lib/router'
export { default as dataCenter } from './lib/data-center'
