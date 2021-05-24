/* @flow */

import {
    warn,
    invokeWithErrorHandling
} from 'core/util/index'
import {
    cached,
    isUndef,
    isTrue,
    isPlainObject
} from 'shared/util'

const normalizeEvent = cached((name: string): {
    name: string,
    once: boolean,
    capture: boolean,
    passive: boolean,
    handler?: Function,
    params?: Array<any>
} => {
    const passive = name.charAt(0) === '&'
    name = passive ? name.slice(1) : name
    const once = name.charAt(0) === '~' // Prefixed last, checked first
    name = once ? name.slice(1) : name
    const capture = name.charAt(0) === '!'
    name = capture ? name.slice(1) : name
    return {
        name,
        once,
        capture,
        passive
    }
})

export function createFnInvoker (fns: Function | Array<Function>, vm: ?Component): Function {
    function invoker () {
        const fns = invoker.fns
        if (Array.isArray(fns)) {
            const cloned = fns.slice()
            for (let i = 0; i < cloned.length; i++) {
                invokeWithErrorHandling(cloned[i], null, arguments, vm, `v-on handler`)
            }
        } else {
            // return handler return value for single handlers
            return invokeWithErrorHandling(fns, null, arguments, vm, `v-on handler`)
        }
    }
    invoker.fns = fns
    return invoker
}

// 通过updateListeners函数对比listeners和oldListeners的不同
// 并调用参数中提供的add和remove进行相应的注册事件和卸载事件
export function updateListeners (
    on: Object,
    oldOn: Object,
    add: Function,
    remove: Function,
    createOnceHandler: Function,
    vm: Component
) {
    let name, def, cur, old, event
    // 循环on，查找在oldOn中不存在的事件，调用add添加它
    for (name in on) {
        def = cur = on[name]
        old = oldOn[name]
        // 规格化事件,即解析出注册事件的修饰符  { ~increment: function() { }}，~为事件修饰符，代表once.
        // 返回 { name, once, capture, passive }
        event = normalizeEvent(name)

        /* istanbul ignore if */
        if (__WEEX__ && isPlainObject(def)) {
            cur = def.handler
            event.params = def.params
        }
        // 为null或者undefined则发出警告
        if (isUndef(cur)) {
            process.env.NODE_ENV !== 'production' && warn(
                `Invalid handler for event "${event.name}": got ` + String(cur),
                vm
            )
        } else if (isUndef(old)) {
            if (isUndef(cur.fns)) {
                cur = on[name] = createFnInvoker(cur, vm)
            }
            if (isTrue(event.once)) {
                cur = on[name] = createOnceHandler(event.name, cur, event.capture)
            }
            add(event.name, cur, event.capture, event.passive, event.params)
        } else if (cur !== old) {
            old.fns = cur
            on[name] = old
        }
    }
    // 循环oldOn, 查找中在on中不存在的事件，调用remove移除它
    for (name in oldOn) {
        if (isUndef(on[name])) {
            event = normalizeEvent(name)
            remove(event.name, oldOn[name], event.capture)
        }
    }
}
