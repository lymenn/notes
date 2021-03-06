/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
    def,
    warn,
    hasOwn,
    hasProto,
    isObject,
    isPlainObject,
    isPrimitive,
    isUndef,
    isValidArrayIndex,
    isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
    shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
// 观察者类，会被附加到每个观察者实例上，value.__ob__ = this
// 而对象的各个属性会被转换成getter/setter，并收集依赖和通知
export class Observer {
    value: any;
    dep: Dep;
    vmCount: number; // number of vms that have this object as root $data

    constructor(value: any) {
        this.value = value
        this.dep = new Dep()
        this.vmCount = 0
        def(value, '__ob__', this)
        if (Array.isArray(value)) {
            if (hasProto) {
                protoAugment(value, arrayMethods)
            } else {
                copyAugment(value, arrayMethods, arrayKeys)
            }
            this.observeArray(value)
        } else {
            // value为对象，对象的每个属性都设置为响应式属性
            this.walk(value)
        }
    }

    /**
     * Walk through all properties and convert them into
     * getter/setters. This method should only be called when
     * value type is Object.
     */
    // 遍历对象的每个key，为每个key设置响应式
    walk (obj: Object) {
        const keys = Object.keys(obj)
        for (let i = 0; i < keys.length; i++) {
            defineReactive(obj, keys[i])
        }
    }

    /**
     * Observe a list of Array items.
     */
    // 遍历数组, 为数组的每一项设置观察，处理数组元素为对象的情况
    observeArray (items: Array<any>) {
        for (let i = 0, l = items.length; i < l; i++) {
            observe(items[i])
        }
    }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
    /* eslint-disable no-proto */
    target.__proto__ = src
    /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
    for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i]
        def(target, key, src[key])
    }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
// 响应式的入口
// 为对象创建观察者实例， 如果对象已经被观察过， 则返回已有的观察者实例，否则创建新的观察者实例
export function observe (value: any, asRootData: ?boolean): Observer | void {
    if (!isObject(value) || value instanceof VNode) {
        return
    }
    let ob: Observer | void
    if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
        ob = value.__ob__
    } else if (
        shouldObserve &&
        !isServerRendering() &&
        (Array.isArray(value) || isPlainObject(value)) &&
        Object.isExtensible(value) &&
        !value._isVue
    ) {
        ob = new Observer(value)
    }
    if (asRootData && ob) {
        ob.vmCount++
    }
    return ob
}

/**
 * Define a reactive property on an Object.
 */
// 拦截 obj[key] 的读取和设置操作
export function defineReactive (
    obj: Object,
    key: string,
    val: any,
    customSetter?: ?Function,
    shallow?: boolean
) {
    // 实例化一个dep， 一个key一个dep
    const dep = new Dep()
    // 获取对象的属性描述符， 如果是不可配置的话直接return
    const property = Object.getOwnPropertyDescriptor(obj, key)
    if (property && property.configurable === false) {
        return
    }

    // cater for pre-defined getter/setters
    // 记录getter和setter 获取val值
    const getter = property && property.get
    const setter = property && property.set
    if ((!getter || setter) && arguments.length === 2) {
        val = obj[key]
    }
    // 递归调用， 处理val即obj[key]为对象的情况，保证对象中的所有key都被观察
    let childOb = !shallow && observe(val)
    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        // get拦截对obj[key]的读取操作
        get: function reactiveGetter () {
            const value = getter ? getter.call(obj) : val
            // Dep.target为Dep类的一个静态属性，值为watcher，实例化Watcher时会被设置
            // 实例化watcher时会执行new Watcher时传递的回调函数
            // 而回调函数中如果有vm.key的读取行为，会触发这里的 读取 拦截，进行依赖收集
            // 回调函数执行完以后又会将Dep.target设置为null,避免这里重复收集
            if (Dep.target) {
                // 依赖收集, 在dep中添加watcher，也在watcher中添加dep
                dep.depend()
                // childOb 表示对象中嵌套对象的观察者对象，如果存在则对其依赖收集
                if (childOb) {
                    childOb.dep.depend()
                    // 如果是 obj[key] 是 数组，则触发数组响应式
                    if (Array.isArray(value)) {
                        // 为数组项为对象的项添加依赖
                        dependArray(value)
                    }
                }
            }
            return value
        },
        // set拦截对obj[key]的设置操作
        set: function reactiveSetter (newVal) {
            const value = getter ? getter.call(obj) : val
            /* eslint-disable no-self-compare */
            if (newVal === value || (newVal !== newVal && value !== value)) {
                return
            }
            /* eslint-enable no-self-compare */
            if (process.env.NODE_ENV !== 'production' && customSetter) {
                customSetter()
            }
            // #7981: for accessor properties without setter
            if (getter && !setter) return
            if (setter) {
                setter.call(obj, newVal)
            } else {
                val = newVal
            }
            // 对新值进行观察，让新值也是响应式的
            childOb = !shallow && observe(newVal)
            // 依赖通知更新
            dep.notify()
        }
    })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
// 通过Vue.set或者this.$set方法给target的指定key设置val
// 因为在ES6之前，Js并没有提供元编程的能力，所以无法侦测到object什么时候被添加了一个新属性
// 如果target是对象，并且key不存在，将新key转换成响应式，然后执行依赖通知
export function set (target: Array<any> | Object, key: any, val: any): any {
    if (process.env.NODE_ENV !== 'production' &&
        (isUndef(target) || isPrimitive(target))
    ) {
        warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
    }
    // 更新数组指定下标的元素，Vue.set(arr, idx, val),通过splice方法实现响应式
    if (Array.isArray(target) && isValidArrayIndex(key)) {
        target.length = Math.max(target.length, key)
        // 当我们使用slice方法把val设置到target中的时候，数组拦截器会侦测到target发生了变化，并且自动会把我们这个新增的val转换成响应式的
        target.splice(key, 1, val)
        return val
    }
    // 更新对象已有属性，Vue.set(obj, key, val) 执行更新即可
    // 修改数据的动作会被Vue侦测到，所以数据发生变化后，会自动向依赖发送通知
    if (key in target && !(key in Object.prototype)) {
        target[key] = val
        return val
    }
    const ob = (target: any).__ob__
    // 不能向Vue实例或者$data动态添加响应式属性，vmCount的用处之一
    if (target._isVue || (ob && ob.vmCount)) {
        process.env.NODE_ENV !== 'production' && warn(
            'Avoid adding reactive properties to a Vue instance or its root $data ' +
            'at runtime - declare it upfront in the data option.'
        )
        return val
    }
    // target不是响应式对象，新属性会被设置，但是不会做响应式处理
    if (!ob) {
        target[key] = val
        return val
    }
    // 给对象定义新属性，通过defineReactive方法将新增属性转换成响应式，并触发依赖更新
    defineReactive(ob.value, key, val)
    // 向target的依赖发送通知
    ob.dep.notify()
    return val
}

/**
 * Delete a property and trigger change if necessary.
 */
// 由于Vue的变化侦测是使用Object.defineProperty实现的，所以如果数据是使用delete关键字删除的，无法发现数据发生了变化
// 为了解决这个问题Vue提供了vm.$delete来删除数据中的某个属性，并且此时Vue可以侦测到数据发生了变化
// 它帮助我们删除属性后自动向依赖发送通知，通知watcher数据发生了变化
export function del (target: Array<any> | Object, key: any) {
    // 通过Vue.delete或者vm.$delete删除target对象的指定key
    // 数组通过splice方法实现，对象通过delete运算符指定key,并执行依赖通知
    if (process.env.NODE_ENV !== 'production' &&
        (isUndef(target) || isPrimitive(target))
    ) {
        warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
    }
    // target为数组，则通过splice方法删除指定下标的元素
    // 因为使用了splice方法，数组拦截器会自动向依赖发送通知
    if (Array.isArray(target) && isValidArrayIndex(key)) {
        target.splice(key, 1)
        return
    }
    const ob = (target: any).__ob__
    // 避免删除Vue实例的属性或者$data的数据
    if (target._isVue || (ob && ob.vmCount)) {
        process.env.NODE_ENV !== 'production' && warn(
            'Avoid deleting properties on a Vue instance or its root $data ' +
            '- just set it to null.'
        )
        return
    }
    // 如果属性不存在直接结束
    if (!hasOwn(target, key)) {
        return
    }
    // 通过delete运算符删除对象的属性
    delete target[key]
    // ob来处理只有响应式数据才需要发送通知， 非响应式数据只需要执行删除操作即可
    if (!ob) {
        return
    }
    //执行依赖通知
    ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
// 遍历每个数组元素，递归处理数组项为对象的情况，为其添加依赖
// 因为前面的递归阶段无法为数组中的元素添加依赖
function dependArray (value: Array<any>) {
    for (let e, i = 0, l = value.length; i < l; i++) {
        e = value[i]
        e && e.__ob__ && e.__ob__.dep.depend()
        if (Array.isArray(e)) {
            dependArray(e)
        }
    }
}
