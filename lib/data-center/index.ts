/*
 * @Author: shh
 * @Date: 2020-01-02 10:38:38
 * @Last Modified by: shh
 * @Last Modified time: 2020-01-03 17:20:51
 * @Desc 数据层管理中心
 */

import { create } from 'dva-core'
import { createLogger } from 'redux-logger'
import cloneDeep from 'lodash/cloneDeep'

interface DataCenter {
  registerModule: (data: ModuleData) => void
  registerModel: (model: any) => void
  registerPage: (url: string) => void
  unregisterPage: (url: string) => void
  davOpts?: any // dva opts 需要在registerModule前设置
  getStore: () => any
  getDispatch: () => any
  getInitState: () => any  // redux init state
}

let app
let store
let dispatch
const initState = {}
function createApp(opt) {
  // redux日志
  if (process.env.NODE_ENV === 'development') {
    opt.onAction = [createLogger()]
  }
  app = create(opt)
  app.start()
  store = app._store
  dispatch = store.dispatch
  app.dispatch = dispatch

  // hook app.model
  const originModel = app.model
  function model(model) {
    originModel.call(this, model)
    initState[model.namespace] = cloneDeep(model.state)
  }
  app.model = model
}

interface ModuleData {
  name: string
  models: {
    core?: Model[]
    pages?: Model[]
  }
}

interface Model {
  model: any
  page?: string  // 页面路径
  preRegister?: boolean // model是否预注册
}

interface RegisteredModels {
  global: string[]
  local: RegisteredModule[]
}

interface RegisteredModule {
  name: string
  isRegistered: boolean
  core: RegisteredModel[]
  pages: RegisteredModel[]
}

interface RegisteredModel {
  module: string
  namespace: string
  suspendModels: any[]
}

// 模块注册表
const moduleDatas: ModuleData[] = []
// model注册表
const registeredModels: RegisteredModels = {
  global: [],
  local: []
}

/**
 * 注册dva model
 * @param model
 */
export function registerModel(model: any) {
  if (!app) {
    createApp(dataCenter.davOpts)
  }

  if (!registeredModels.global.find(module => module === model.namespace)) {
    app.model(model)
    registeredModels.global.push(model.namespace)
  }
}

export function registerModule(data: ModuleData) {
  if (!app) {
    createApp(dataCenter.davOpts)
  }

  if (!data.name) {
    throwError('module must have a name')
  }
  if (!data.models.core && !data.models.pages) {
    throwError('module must have core or pages model')
  }
  moduleDatas.push(data)
  if (data.models.pages) {
    for (const model of data.models.pages) {
      if (model.preRegister && model.page) {
        registerPage(model.page)
      }
    }
  }
}

export function registerPage(url: string) {
  const moduleInfo = getModule(url)
  if (moduleInfo) {
    const module = <ModuleData>moduleInfo[0]
    let registedModule = getRegistedModule(module.name)
    if (!registedModule) {
      registedModule = {
        name: module.name,
        isRegistered: false,
        core: [],
        pages: []
      }
      registeredModels.local.push(registedModule)
    }

    if (!registedModule.isRegistered) {
      // 注册页面models
      if (module.models.pages) {
        for (const pageModel of module.models.pages) {
          console.log(`data-center register page: ${pageModel.page}`)
          app.model(pageModel.model)
          registedModule.pages.push({
            module: module.name,
            namespace: pageModel.model.namespace,
            suspendModels: []
          })
        }
      }

      // 注册模块公共models
      if (module.models.core) {
        for (const coreModel of module.models.core) {
          app.model(coreModel.model)
          registedModule.core.push({
            module: module.name,
            namespace: coreModel.model.namespace,
            suspendModels: []
          })
        }
      }
      registedModule.isRegistered = true
    }

    // let registedModel = getRegistedModel(registedModule, namespace)
    // if (!registedModel) {
    //   // model未注册过
    //   registedModel = {
    //     module: module.name,
    //     namespace,
    //     suspendModels: []
    //   }
    //   registedModule.pages.push(registedModel)
    //   app.model(page.model)
    // }

    // else {
    //   // model已经注册过，需要需要取消注册原model, 并且将原model添加到suspendModels
    //   registedModel.suspendModels.push(backupModel(page.model))
    //   app.unmodel(namespace)
    //   app.model(page.model)
    // }
  }
}

export function unregisterPage(url: string) {
  const moduleInfo = getModule(url)
  if (moduleInfo) {
    console.log(`data-center unregister page: ${url}`)
    const module = <ModuleData>moduleInfo[0]
    const page = <Model>moduleInfo[1]
    const namespace = page.model.namespace

    const registedModule = getRegistedModule(module.name)
    if (registedModule) {
      const registedModel = getRegistedModel(registedModule, namespace)
      app.unmodel(namespace)
      if (registedModel) {
        if (registedModel.suspendModels.length > 0) {
          // 有挂起的相同页面的不同实例model, 需要进行model恢复
          app.model(registedModel.suspendModels.pop())
        } else {
          // 将model从注册模块中移除，如果本模块下没有其它注册页面，移除模块
          removeModel(registedModule, namespace)
          if (registedModule.pages.length === 0) {
            for (const coreModel of registedModule.core) {
              app.unmodel(coreModel.namespace)
            }
            removeModule(module.name)
          }
        }
      }
    }
  }
}

function getModule(url: string) {
  for (const data of moduleDatas) {
    if (data.models.pages) {
      for (const page of data.models.pages) {
        if (page.page === url) {
          return [data, page]
        }
      }
    }
  }
}

function getRegistedModule(name: string) {
  for (const module of registeredModels.local) {
    if (module.name === name) {
      return module
    }
  }
}

function getRegistedModel(module: RegisteredModule, namespace: string) {
  for (const page of module.pages) {
    if (page.namespace === namespace) {
      return page
    }
  }
}

function removeModel(module: RegisteredModule, namespace: string) {
  module.pages = module.pages.filter(page => page.namespace !== namespace)
}

function removeModule(name: string) {
  registeredModels.local = registeredModels.local.filter(module => module.name !== name)
}

/**
 * 备份dva model
 * @param model
 */
function backupModel(model) {
  const state = store.getState()
  return {
    namespace: model.namespace,
    state: cloneDeep(state[model.namespace]),
    reducers: model.reducers,
    effects: model.effects,
    subscriptions: model.subscriptions
  }
}

function throwError(msg: string) {
  throw new Error(`data-center error: ${msg}`)
}

const dataCenter: DataCenter = {
  registerModule,
  registerModel,
  registerPage,
  unregisterPage,
  davOpts: {},
  getStore: () => store,
  getDispatch: () => dispatch,
  getInitState: () => initState
}
export default dataCenter