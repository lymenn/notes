/* @flow */

import Vue from 'core/index'
import config from 'core/config'
import { extend, noop } from 'shared/util'
import { mountComponent } from 'core/instance/lifecycle'
import { devtools, inBrowser } from 'core/util/index'

import {
    query,
    mustUseProp,
    isReservedTag,
    isReservedAttr,
    getTagNamespace,
    isUnknownElement
} from 'web/util/index'

import { patch } from './patch'
import platformDirectives from './directives/index'
import platformComponents from './components/index'

// install platform specific utils
Vue.config.mustUseProp = mustUseProp
Vue.config.isReservedTag = isReservedTag
Vue.config.isReservedAttr = isReservedAttr
Vue.config.getTagNamespace = getTagNamespace
Vue.config.isUnknownElement = isUnknownElement

// install platform runtime directives & components
extend(Vue.options.directives, platformDirectives)
extend(Vue.options.components, platformComponents)

// install platform patch function
Vue.prototype.__patch__ = inBrowser ? patch : noop

// public mount method
// 运行时版本的vm.$mount
// 运行时版本的vm.$mount方法包含了vm.$mount方法的核心功能
Vue.prototype.$mount = function (
    el?: string | Element,
    hydrating?: boolean
): Component {
    // 获取el对应的DOM元素
    el = el && inBrowser ? query(el) : undefined
    // 将Vue实例挂载到DOM元素上
    // 将实例挂载到DOM元素上是指将模板渲染到指定的DOM元素中，而且是持续性的，也就是说，以后当状态发生变化的时候，依然可以渲染到指定的DOM元素
    // 实现这个功能要开启watcher。watcher将持续性的观察模板中用到的所有状态，当这些状态被修改时，将得到通知，从而进行渲染操作，这个过程将持续到实例被销毁
    return mountComponent(this, el, hydrating)
}

// devtools global hook
/* istanbul ignore next */
if (inBrowser) {
    setTimeout(() => {
        if (config.devtools) {
            if (devtools) {
                devtools.emit('init', Vue)
            } else if (
                process.env.NODE_ENV !== 'production' &&
                process.env.NODE_ENV !== 'test'
            ) {
                console[console.info ? 'info' : 'log'](
                    'Download the Vue Devtools extension for a better development experience:\n' +
                    'https://github.com/vuejs/vue-devtools'
                )
            }
        }
        if (process.env.NODE_ENV !== 'production' &&
            process.env.NODE_ENV !== 'test' &&
            config.productionTip !== false &&
            typeof console !== 'undefined'
        ) {
            console[console.info ? 'info' : 'log'](
                `You are running Vue in development mode.\n` +
                `Make sure to turn on production mode when deploying for production.\n` +
                `See more tips at https://vuejs.org/guide/deployment.html`
            )
        }
    }, 0)
}

export default Vue
