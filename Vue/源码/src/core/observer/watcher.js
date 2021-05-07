/* @flow */

import {
    warn,
    remove,
    isObject,
    parsePath,
    _Set as Set,
    handleError,
    noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
// 一个组件一个watcher(渲染watcher)或者一个表达式一个watcher(用户watcher)
// 当数据更新时 watcher 会被处发，访问 this.computedProperty 时也会触发 watcher
export default class Watcher {
    vm: Component;
    expression: string;
    cb: Function;
    id: number;
    deep: boolean;
    user: boolean;
    lazy: boolean;
    sync: boolean;
    dirty: boolean;
    active: boolean;
    deps: Array<Dep>;
    newDeps: Array<Dep>;
    depIds: SimpleSet;
    newDepIds: SimpleSet;
    before: ?Function;
    getter: Function;
    value: any;

    constructor(
        vm: Component,
        expOrFn: string | Function,
        cb: Function,
        options?: ?Object,
        isRenderWatcher?: boolean
    ) {
        this.vm = vm
        if (isRenderWatcher) {
            vm._watcher = this
        }
        vm._watchers.push(this)
        // options
        if (options) {
            this.deep = !!options.deep
            this.user = !!options.user
            this.lazy = !!options.lazy
            this.sync = !!options.sync
            this.before = options.before
        } else {
            this.deep = this.user = this.lazy = this.sync = false
        }
        this.cb = cb
        this.id = ++uid // uid for batching
        this.active = true
        this.dirty = this.lazy // for lazy watchers
        this.deps = []
        this.newDeps = []
        this.depIds = new Set()
        this.newDepIds = new Set()
        this.expression = process.env.NODE_ENV !== 'production'
            ? expOrFn.toString()
            : ''
        // parse expression for getter
        if (typeof expOrFn === 'function') {
            this.getter = expOrFn
        } else {
            // this.getter = function(){ return 'xxx' }
            // 在this.get中执行this.getter会触发依赖收集
            // 待后续 this.xx更新时触发响应式
            this.getter = parsePath(expOrFn)
            if (!this.getter) {
                this.getter = noop
                process.env.NODE_ENV !== 'production' && warn(
                    `Failed watching path: "${expOrFn}" ` +
                    'Watcher only accepts simple dot-delimited paths. ' +
                    'For full control, use a function instead.',
                    vm
                )
            }
        }
        // 当expOrFn是字符串类型的keypath时，Watcher读取这个keypath指向的数据并观察这个数据的变化
        // 当expOrFn是函数时，Watcher会观察expOrFn函数中读取的所有Vue实例上的响应式数据
        // 也就是说如果函数读取Vue实例上两个数据，那么Watcher会同时观察这两个数据的变化，其中任意一个变化，watcher都会得到通知
        this.value = this.lazy
            ? undefined
            : this.get()
    }

    /**
     * Evaluate the getter, and re-collect dependencies.
     */
    // 执行 this.getter, 并重新收集依赖
    // this.getter是实例化watcher时传递的第二个参数，一个函数或者字符串。比如: updateComponent或者parsePath返回的读取this.xxx的函数
    // 为什么要重新收集依赖?
    // 因为触发更新说明响应式数据被更新了，但是被更新的数据虽然经过observer观察了, 但是没有收集依赖
    // 所以，在更新页面时，会重新执行一次render函数，执行期间会触发读取操作，进行依赖收集
    get () {
        pushTarget(this)
        let value
        const vm = this.vm
        try {
            value = this.getter.call(vm, vm)
        } catch (e) {
            if (this.user) {
                handleError(e, vm, `getter for watcher "${this.expression}"`)
            } else {
                throw e
            }
        } finally {
            // "touch" every property so they are all tracked as
            // dependencies for deep watching
            // 在Dep.target=undefined之前去触发子值的依赖收集逻辑，这样才能保证子集收集的依赖是当前这个Watcher
            if (this.deep) {
                traverse(value)
            }
            popTarget()
            this.cleanupDeps()
        }
        return value
    }

    /**
     * Add a dependency to this directive.
     */
    // 该方法的作用是在Watcher中记录自己都订阅过哪些Dep
    addDep (dep: Dep) {
        const id = dep.id
        // 判重， 如果dep已存在则不重复添加
        if (!this.newDepIds.has(id)) {
            // 缓存dep.id 用于判重
            this.newDepIds.add(id)
            // 添加dep
            this.newDeps.push(dep)
            // 避免在dep中重复添加watcher this.depIds的设置在cleanupDeps方法中
            if (!this.depIds.has(id)) {
                // 添加watcher 自己到dep
                dep.addSub(this)
            }
        }
    }

    /**
     * Clean up for dependency collection.
     */
    cleanupDeps () {
        let i = this.deps.length
        while (i--) {
            const dep = this.deps[i]
            if (!this.newDepIds.has(dep.id)) {
                dep.removeSub(this)
            }
        }
        let tmp = this.depIds
        this.depIds = this.newDepIds
        this.newDepIds = tmp
        this.newDepIds.clear()
        tmp = this.deps
        this.deps = this.newDeps
        this.newDeps = tmp
        this.newDeps.length = 0
    }

    /**
     * Subscriber interface.
     * Will be called when a dependency changes.
     */
    // 根据watcher配置项 决定接下来怎么走 一般是queueWatcher
    update () {
        /* istanbul ignore else */
        if (this.lazy) {
            // 懒执行走这里 比如computed
            // 将dirty置为true 可以让computedGetter 执行重写计算computed 回调函数的执行结果
            this.dirty = true
        } else if (this.sync) {
            // 同步执行 使用vm.$watch 或者 watch选项时可以传一个sync选项
            // 为true时在数据更新时该watcher就不走异步更新队列，直接执行this.run方法进行异步更新
            this.run()
        } else {
            // 更新时一般走这里 将watcher放入watcher队列
            queueWatcher(this)
        }
    }

    /**
     * Scheduler job interface.
     * Will be called by the scheduler.
     */
    // 由刷新队列函数flushSchedulerQueue，完成如下几件事
    // 1.执行实例化watcher传递的第二个参数，updateComponent或者获取this.xxx的一个函数
    // 2.更新旧值为新值
    // 3.执行实例化watcher时传递的第三个参数，比如用户watcher的回调
    run () {
        if (this.active) {
            const value = this.get()
            if (
                value !== this.value ||
                // Deep watchers and watchers on Object/Arrays should fire even
                // when the value is the same, because the value may
                // have mutated.
                isObject(value) ||
                this.deep
            ) {
                // set new value
                const oldValue = this.value
                this.value = value
                if (this.user) {
                    // 如果是用户watcher 则执行用户传递的第三个参数：回调函数，参数为val和oldVal
                    try {
                        this.cb.call(this.vm, value, oldValue)
                    } catch (e) {
                        handleError(e, this.vm, `callback for watcher "${this.expression}"`)
                    }
                } else {
                    // 渲染watcher，this.cb = noop, 一个空函数
                    this.cb.call(this.vm, value, oldValue)
                }
            }
        }
    }

    /**
     * Evaluate the value of the watcher.
     * This only gets called for lazy watchers.
     */
    // 懒执行的watcher会调用该方法
    // 比如: computed，在获取vm.computedProperty的值时会调用该方法
    // 然后执行this.get,得到返回值
    // this.dirty被设置为false，作用时页面在本次渲染中只回执行一次computed.key的回调函数
    // 这也是大家常说的computed和methods的区别之一是computed有缓存的原理所在
    // 而页面更新后this.dirty会被重置为true,这一步是在this.update方法中完成
    evaluate () {
        this.value = this.get()
        this.dirty = false
    }

    /**
     * Depend on all deps collected by this watcher.
     */
    depend () {
        let i = this.deps.length
        while (i--) {
            this.deps[i].depend()
        }
    }

    /**
     * Remove self from all dependencies' subscriber list.
     */
    teardown () {
        if (this.active) {
            // remove self from vm's watcher list
            // this is a somewhat expensive operation so we skip it
            // if the vm is being destroyed.
            if (!this.vm._isBeingDestroyed) {
                remove(this.vm._watchers, this)
            }
            let i = this.deps.length
            while (i--) {
                this.deps[i].removeSub(this)
            }
            this.active = false
        }
    }
}
