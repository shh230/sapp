/*
 * @Author: shh
 * @Date: 2019-12-31 10:22:40
 * @Last Modified by: shh
 * @Last Modified time: 2020-01-03 10:31:50
 * @Desc Taro小程序路由封装
 */

import Taro from "@tarojs/taro"
import throttle from 'lodash/throttle'

const throttle_wait_time = 1.5

interface Router {
  beforeRouteEnter?: (to: string, from: string, next: () => void) => void
  beforeRouteLeave?: (from: string) => void
  onError?: (error) => void
  navigateTo: (option: Option) => Promise<CallbackResult>
  redirectTo: (option: Option) => Promise<CallbackResult>
  navigateBack: (option?: navigateBack.Option) => Promise<CallbackResult>
  switchTab: (option: Option) => Promise<CallbackResult>
  reLaunch: (option: Option) => Promise<CallbackResult>
  getCurrentPage: () => string
}

interface CallbackResult {
  /** 错误信息 */
  errMsg: string
}

interface Option {
  /** 需要跳转的应用内非 tabBar 的页面的路径, 路径后可以带参数。参数与路径之间使用 `?` 分隔，参数键与参数值用 `=` 相连，不同参数用 `&` 分隔；如 'path?key=value&key2=value2' */
  url: string
  /** 接口调用结束的回调函数（调用成功、失败都会执行） */
  complete?: (res: CallbackResult) => void
  /** 接口调用失败的回调函数 */
  fail?: (res: CallbackResult) => void
  /** 接口调用成功的回调函数 */
  success?: (res: CallbackResult) => void
}

namespace navigateBack {
export interface Option {
    /** 接口调用结束的回调函数（调用成功、失败都会执行） */
    complete?: (res: CallbackResult) => void
    /** 返回的页面数，如果 delta 大于现有页面数，则返回到首页。 */
    delta?: number
    /** 接口调用失败的回调函数 */
    fail?: (res: CallbackResult) => void
    /** 接口调用成功的回调函数 */
    success?: (res: CallbackResult) => void
  }
}

const router: Router = {
  navigateTo: throttle(navigateTo, throttle_wait_time),
  redirectTo: throttle(redirectTo, throttle_wait_time),
  switchTab: throttle(switchTab, throttle_wait_time),
  reLaunch: throttle(reLaunch, throttle_wait_time),
  navigateBack: throttle(navigateBack, throttle_wait_time),
  getCurrentPage
}
export default router

export function getCurrentPage(): string {
  const pages = Taro.getCurrentPages()
  let url = pages[pages.length - 1] ? pages[pages.length - 1].route : ''
  if (url.length > 0 && !url.startsWith('/')) {
    url = `/${url}`
  }
  return url
}

function navigate(option: Option) {
  option.url = encodeUrl(option.url)
  const from = getCurrentPage()
  const to = absoluteUrl(option.url)
  return new Promise((resolve, reject) => {
    if (router.beforeRouteEnter) {
      router.beforeRouteEnter(to, from, resolve)
    }
  }).then(value => {
    if (typeof value === 'string') {
      return value
    } else if (typeof value === 'boolean' && value === false) {
      return Promise.reject()
    } else if (value instanceof Error) {
      if (router.onError) {
        router.onError(value)
      }
      return Promise.reject(value)
    }
  })
}

function navigateTo(option: Option) {
  if (Taro.getCurrentPages().length > 9) {
    return redirectTo(option)
  } else {
    return navigate(option).then(value => {
      if (value) {
        return navigateTo({url: value})
      } else {
        return Taro.navigateTo(option)
      }
    })
  }
}

function redirectTo(option: Option) {
  return navigate(option).then(value => {
    if (value) {
      return redirectTo({url: value})
    } else {
      return Taro.redirectTo(option)
    }
  })
}

function switchTab(option: Option) {
  return navigate(option).then(value => {
    if (value) {
      return switchTab({url: value})
    } else {
      return Taro.switchTab(option)
    }
  })
}

function reLaunch(option: Option) {
  return navigate(option).then(value => {
    if (value) {
      return reLaunch({url: value})
    } else {
      return Taro.reLaunch(option)
    }
  })
}

function navigateBack(option?: navigateBack.Option) {
  return Taro.navigateBack(option)
}

function absoluteUrl(url: string) {
  const index = url.indexOf('?')
  if (index > 0) {
    return url.substring(0, index)
  } else {
    return url
  }
}

function encodeUrl(url: string) {
  const index = url.indexOf('?')
  if (index > 0) {
    const urls = url.split('?')
    const params = urls[1].split('&')
    const encodeParams = params.map(param => param.split('=').map(value => encodeURIComponent(value)).join('='))
    return [urls[0], encodeParams.join('&')].join('?')
  } else {
    return url
  }
}