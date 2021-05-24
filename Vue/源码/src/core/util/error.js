/* @flow */

import config from '../config'
import { warn } from './debug'
import { inBrowser, inWeex } from './env'
import { isPromise } from 'shared/util'
import { pushTarget, popTarget } from '../observer/dep'
// 该函数会依次触发父组件链路上的每一个父组件中定义的errorCaptured钩子函数
// 如果全局的config.errorHandler被定义，那么所有的错误也同时发送给config.errorHandler
// 错误的传播规则在handleError函数中实现
export function handleError (err: Error, vm: any, info: string) {
    // Deactivate deps tracking while processing error handler to avoid possible infinite rendering.
    // See: https://github.com/vuejs/vuex/issues/1505
    pushTarget()
    try {
        if (vm) {
            let cur = vm
            // 依次触发父组件链路上的每一个父组件中定义的errorCaptured钩子函数
            // 通过while语句，自底向上不停的循环获取父组件，直到根组件
            while ((cur = cur.$parent)) {
                const hooks = cur.$options.errorCaptured
                if (hooks) {
                    // 遍历当前组件errorCaptured钩子函数列表，依次执行列表中的每一个errorCaptured钩子函数
                    for (let i = 0; i < hooks.length; i++) {
                        try {
                            const capture = hooks[i].call(cur, err, vm, info) === false
                            if (capture) return
                        } catch (e) {
                            globalHandleError(e, cur, 'errorCaptured hook')
                        }
                    }
                }
            }
        }
        globalHandleError(err, vm, info)
    } finally {
        popTarget()
    }
}

export function invokeWithErrorHandling (
    handler: Function,
    context: any,
    args: null | any[],
    vm: any,
    info: string
) {
    let res
    try {
        res = args ? handler.apply(context, args) : handler.call(context)
        if (res && !res._isVue && isPromise(res) && !res._handled) {
            res.catch(e => handleError(e, vm, info + ` (Promise/async)`))
            // issue #9511
            // avoid catch triggering multiple times when nested calls
            res._handled = true
        }
    } catch (e) {
        handleError(e, vm, info)
    }
    return res
}

function globalHandleError (err, vm, info) {
    // 这里的config.errorHandler就是Vue.config.errorHandler
    if (config.errorHandler) {
        try {
            return config.errorHandler.call(null, err, vm, info)
        } catch (e) {
            // if the user intentionally throws the original error in the handler,
            // do not log it twice
            // 如果全局错误处理的函数也发生报错，则在控制台打印其中抛出的错误
            if (e !== err) {
                logError(e, null, 'config.errorHandler')
            }
        }
    }
    // Vue始终会将错误打印在控制台
    logError(err, vm, info)
}

function logError (err, vm, info) {
    if (process.env.NODE_ENV !== 'production') {
        warn(`Error in ${info}: "${err.toString()}"`, vm)
    }
    /* istanbul ignore else */
    if ((inBrowser || inWeex) && typeof console !== 'undefined') {
        console.error(err)
    } else {
        throw err
    }
}
