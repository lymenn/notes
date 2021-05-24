/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
    warn,
    extend,
    nextTick,
    mergeOptions,
    defineReactive
} from '../util/index'
// 全局API和实例方法不同，前者是直接在Vue上挂载方法，后者是在Vue.prototype原型上挂载方法
// 初始化Vue的全局API，比如:
// 默认配置:Vue.config
// 工具方法:Vue.util.xx
// Vue.set、Vue.delete、Vue.nextTick、Vue.observable
// Vue.options.components、Vue.options.directives、Vue.options.filters、Vue.options._base
// Vue.use、Vue.extend、Vue.mixin、Vue.component、Vue.directive、Vue.filter
export function initGlobalAPI (Vue: GlobalAPI) {
    // config
    const configDef = {}
    // Vue 的默认配置
    configDef.get = () => config
    if (process.env.NODE_ENV !== 'production') {
        configDef.set = () => {
            warn(
                'Do not replace the Vue.config object, set individual fields instead.'
            )
        }
    }
    Object.defineProperty(Vue, 'config', configDef)

    // exposed util methods.
    // NOTE: these are not considered part of the public API - avoid relying on
    // them unless you are aware of the risk.
    // 暴露一些工具方法
    Vue.util = {
        // 警告日志
        warn,
        // 类似选项合并
        extend,
        // 选项合并
        mergeOptions,
        // 设置响应式
        defineReactive
    }
    // Vue set / delete / nextTicks
    // 设置对象的属性，如果对象是响应式的，确保对象被创建之后也是响应式的，同时出发视图更新
    Vue.set = set
    // 删除对象的属性，如果对象是响应式的，确保删除能出发视图更新
    Vue.delete = del

    // 在下次DOM更新循环结束之后执行延迟回调
    Vue.nextTick = nextTick

    // 2.6 explicit observable API
    // 响应式方法
    Vue.observable = <T>(obj: T): T => {
        observe(obj)
    return obj
              }
  {/* Vue.options.components/directives/filters */}
        Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
            Vue.options[type + 's'] = Object.create(null)
        })

        // this is used to identify the "base" constructor to extend all plain-object
        // components with in Weex's multi-instance scenarios.
  {/* Vue的构造函数挂载到Vue.options._base上 */}
        Vue.options._base = Vue
  {/* Vue.options.components中添加内置组件,比如keep-alive */}
        extend(Vue.options.components, builtInComponents)
  {/* Vue.use */}
        initUse(Vue)
  {/* Vue.mixin */}
        initMixin(Vue)
  {/* Vue.extend */}
        initExtend(Vue)
  {/* Vue.component/directive/filter */}
        initAssetRegisters(Vue)
      }
