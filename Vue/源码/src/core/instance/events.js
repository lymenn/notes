/* @flow */

import {
    tip,
    toArray,
    hyphenate,
    formatComponentName,
    invokeWithErrorHandling
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

export function initEvents (vm: Component) {
    // 新增_events属性，用来存储事件
    vm._events = Object.create(null)
    vm._hasHookEvent = false
    // init parent attached events
    // 获取父组件向子组件注册的事件
    const listeners = vm.$options._parentListeners
    if (listeners) {
        //将父组件向子组件注册的事件注册到子组件实例中
        updateComponentListeners(vm, listeners)
    }
}

let target: any

function add (event, fn) {
    target.$on(event, fn)
}

function remove (event, fn) {
    target.$off(event, fn)
}

function createOnceHandler (event, fn) {
    const _target = target
    return function onceHandler () {
        const res = fn.apply(null, arguments)
        if (res !== null) {
            _target.$off(event, onceHandler)
        }
    }
}

export function updateComponentListeners (
    vm: Component,
    listeners: Object,
    oldListeners: ?Object
) {
    target = vm
    // 对比新(listeners)老(oldListeners)事件的不同，并调用add和remove方法注册和卸载事件
    // 如果listeners对象中，存在某个key(事件名)在oldListeners中不存在，那么这个事件需要添加到当前组件的事件系统中
    // 如果oldListeners对象中，存在某个key(事件名)在listeners中不存在，那么这个事件需要从到当前组件的事件系统中移除
    updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm)
    target = undefined
}

export function eventsMixin (Vue: Class<Component>) {
    const hookRE = /^hook:/
    // 监听实例上的自定义事件，vm._event = { eventName: [fn1, ...], ...}
    // event单个事件名称，或者多个事件名组成的数组
    // fn当event被触发时执行的回调函数
    // 示例：
    // vm.$on('test', function (msg) { 
    //     console.log(msg);
    // })
    // vm.$emit('test', 'hi')
    // => "hi"
    // 在注册事件时将回调函数收集起来放入 vm._event中，在触发事件时将收集起来的回调函数依次执行即可
    Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
        const vm: Component = this
        if (Array.isArray(event)) {
            // event由多个事件名组成的数组，则遍历这些事件，依次递归调用$on
            for (let i = 0, l = event.length; i < l; i++) {
                vm.$on(event[i], fn)
            }
        } else {
            // 将注册的事件和回调以键值对的形式存储到vm._event = {eventName: [fn1, ...], ...}
            (vm._events[event] || (vm._events[event] = [])).push(fn)
            // optimize hook:event cost by using a boolean flag marked at registration
            // instead of a hash lookup
            // hookEvent，提供从外部为组件实例注入声明周期方法的机会
            // 比如从组件外部为组件的 mounted 方法注入额外的逻辑
            // 该能力是结合 callhook 方法实现的
            if (hookRE.test(event)) {
                vm._hasHookEvent = true
            }
        }
        return vm
    }

    // 监听一个事件，但是只触发一次。一旦触发之后，监听器就会被移除
    Vue.prototype.$once = function (event: string, fn: Function): Component {
        const vm: Component = this
        // 包裹回调函数，触发时，先移除包裹函数，再触发用户的回调函数
        function on () {
            vm.$off(event, on)
            fn.apply(vm, arguments)
        }
        on.fn = fn
        vm.$on(event, on)
        return vm
    }

    // 移除自定义事件监听器，即从vm._events对象中找到对应的事件，移除所有事件或者移除指定事件的回调
    Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
        const vm: Component = this
        // all
        //vm.$off移除实例上的所有监听器 =》vm._events = {}
        if (!arguments.length) {
            vm._events = Object.create(null)
            return vm
        }
        // array of events
        //移除一些事件 event = [event1, ...],遍历event数组，递归调用vm.$off
        if (Array.isArray(event)) {
            for (let i = 0, l = event.length; i < l; i++) {
                vm.$off(event[i], fn)
            }
            return vm
        }
        // specific event
        // 移除指定事件
        const cbs = vm._events[event]
        if (!cbs) {
            // 表示没有注册过该事件
            return vm
        }
        if (!fn) {
            // 没有提供回调函数，则移除该事件的所有回调函数，vm._event[event] = null
            vm._events[event] = null
            return vm
        }
        // specific handler
        //移除指定事件的指定回调函数，就是从事件的回调数组中找到该函数，然后删除
        let cb
        let i = cbs.length
        while (i--) {
            cb = cbs[i]
            // cb.fn 当使用$once注册事件时，会用一个on拦截器代替监听器注册到事件列表中
            // 拦截器和用户提供的监听器函数是不同的，为了确保$off移除监听不失败，添加fn属性，便于查找
            if (cb === fn || cb.fn === fn) {
                cbs.splice(i, 1)
                break
            }
        }
        return vm
    }

    // 触发实例上的指定事件，vm._events[event] = cbs => loop cbs => cb(args)
    Vue.prototype.$emit = function (event: string): Component {
        const vm: Component = this
        if (process.env.NODE_ENV !== 'production') {
            // 将事件名转换为小写
            const lowerCaseEvent = event.toLowerCase()
            // 意思是说，HTML 属性不区分大小写，所以你不能使用 v-on 监听小驼峰形式的事件名（eventName），而应该使用连字符形式的事件名（event-name)
            if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
                tip(
                    `Event "${lowerCaseEvent}" is emitted in component ` +
                    `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
                    `Note that HTML attributes are case-insensitive and you cannot use ` +
                    `v-on to listen to camelCase events when using in-DOM templates. ` +
                    `You should probably use "${hyphenate(event)}" instead of "${event}".`
                )
            }
        }
        // 从vm._event对象上拿到当前事件的回调函数数组，并一次调用数组中的回调函数，并且传递提供的参数
        let cbs = vm._events[event]
        if (cbs) {
            cbs = cbs.length > 1 ? toArray(cbs) : cbs
            const args = toArray(arguments, 1)
            const info = `event handler for "${event}"`
            for (let i = 0, l = cbs.length; i < l; i++) {
                invokeWithErrorHandling(cbs[i], vm, args, vm, info)
            }
        }
        return vm
    }
}
