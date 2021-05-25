/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import { mark, measure } from '../util/perf'
import { createEmptyVNode } from '../vdom/vnode'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'
import { toggleObserving } from '../observer/index'
import { pushTarget, popTarget } from '../observer/dep'

import {
    warn,
    noop,
    remove,
    emptyObject,
    validateProp,
    invokeWithErrorHandling
} from '../util/index'

export let activeInstance: any = null
export let isUpdatingChildComponent: boolean = false

export function setActiveInstance (vm: Component) {
    const prevActiveInstance = activeInstance
    activeInstance = vm
    return () => {
        activeInstance = prevActiveInstance
    }
}

// 初始化实例属性 $开头的是提供给用户使用的外部属性，_开头的属性是提供给内部使用的内部属性
export function initLifecycle (vm: Component) {
    const options = vm.$options

    // locate first non-abstract parent
    let parent = options.parent
    // 找出第一个非抽象父类
    if (parent && !options.abstract) {
        while (parent.$options.abstract && parent.$parent) {
            parent = parent.$parent
        }
        // 当前组件主动添加到父组件中
        parent.$children.push(vm)
    }
    // 第一个非抽象类型的父级
    vm.$parent = parent
    // 根组件: 当前组件没有父组件，则他自己就是跟组件。如果有，就是父组件的根组件
    vm.$root = parent ? parent.$root : vm
    // 当前实例的直接子组件，该属性的值是从子组件中主动添加到父组件中
    vm.$children = []
    vm.$refs = {}

    vm._watcher = null
    vm._inactive = null
    vm._directInactive = false
    vm._isMounted = false
    vm._isDestroyed = false
    vm._isBeingDestroyed = false
}

export function lifecycleMixin (Vue: Class<Component>) {
    // 负责更新页面 页面首次渲染和后续更新的入口位置，也是patch的入口位置
    Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
        const vm: Component = this
        const prevEl = vm.$el
        const prevVnode = vm._vnode
        const restoreActiveInstance = setActiveInstance(vm)
        vm._vnode = vnode
        // Vue.prototype.__patch__ is injected in entry points
        // based on the rendering backend used.
        if (!prevVnode) {
            // initial render
            // 首次渲染即初始化页面时走这里
            vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)
        } else {
            // updates
            // 响应式数据更新时，即更新页面走这里
            vm.$el = vm.__patch__(prevVnode, vnode)
        }
        restoreActiveInstance()
        // update __vue__ reference
        if (prevEl) {
            prevEl.__vue__ = null
        }
        if (vm.$el) {
            vm.$el.__vue__ = vm
        }
        // if parent is an HOC, update its $el as well
        if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
            vm.$parent.$el = vm.$el
        }
        // updated hook is called by the scheduler to ensure that children are
        // updated in a parent's updated hook.
    }

    // 直接调用watcher.update方法，迫使组件重新渲染
    // 它仅仅影响实例本身和插入内容的子组件，而不是所有子组件
    // vm.$forceUpdate手动通知Vue实例重新渲染
    Vue.prototype.$forceUpdate = function () {
        const vm: Component = this
        // vm._watcher就是Vue实例的watcher。当状态发生变化时，会通知到组件级别，也就是这个实例watcher
        // 每当组件内依赖的数据发生变化，都会自动触发Vue实例中_watcher的update方法 2.6节
        if (vm._watcher) {
            vm._watcher.update()
        }
    }

    // 完全销毁一个实例。清理它与其他实例的连接，解绑他的全部指令及事件监听
    // 同时会触发beforeDestroy和destroyed的钩子函数
    Vue.prototype.$destroy = function () {
        const vm: Component = this
        if (vm._isBeingDestroyed) {
            // 表示实例已销毁
            return
        }
        // 调用beforeDestory钩子
        callHook(vm, 'beforeDestroy')
        // 标识实例已经销毁
        vm._isBeingDestroyed = true
        // remove self from parent
        // 清理当前组件与父组件的连接
        // 将自己从父组件的$children属性中移除
        const parent = vm.$parent
        // 如果当前实例有父级，同时父级没有被销毁且不是抽象组件，将自己的实例从父级的$children属性中移除
        // 实例的$children属性，存储了所有子组件
        if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
            remove(parent.$children, vm)
        }
        // teardown watchers
        // 状态会收集一些依赖，当状态发生变化时会向这些依赖发送通知，而被收集的依赖就是watcher实例。
        // 当Vue实例销毁时，应该将实例监听的状态都取消掉，也就是从状态的依赖(Dep)列表中将watcher移除

        // vm._watcher,vue2.0中，变化侦测的粒度为中等粒度，他只会发送通知到组件级别，然后组件使用虚拟dom进行重新渲染
        // 在Vue实例上有一个watcher，也就是vm._watcher,他会监听组件中用到的所有状态，即这个组件中用到的所有状态的依赖列表都会收集到vm._watcher中
        // 当这些状态发生变化时，都会通知这个实例的vm._watcher,然后这个vm._watcher再调用虚拟dom重新渲染
        // 从watcher监听的所有状态的依赖列表中移除watcher，删除之后，当状态发生变化，watcher实例就不会再得到通知
        // 组件实例的watcher,保存在vm._watcher上
        if (vm._watcher) {
            vm._watcher.teardown()
        }
        // 用户通过vm.$watcher创建的watcher，存储在vm._watchers =  [] 属性中
        // 循环调用每个watcher实例的teardown方法，将watcher实例从它所监听的状态依赖列表中删除
        let i = vm._watchers.length
        // 移除监听
        while (i--) {
            vm._watchers[i].teardown()
        }
        // remove reference from data ob
        // frozen object may not have observer.
        if (vm._data.__ob__) {
            vm._data.__ob__.vmCount--
        }
        // call the last hook...
        // 表示vue实例已经被销毁
        vm._isDestroyed = true
        // invoke destroy hooks on current rendered tree
        // 调用__patch__销毁节点
        vm.__patch__(vm._vnode, null)
        // fire destroyed hook
        // 调用destory钩子
        callHook(vm, 'destroyed')
        // turn off all instance listeners.
        // 移除实例的所有事件监听
        vm.$off()
        // remove __vue__ reference
        if (vm.$el) {
            vm.$el.__vue__ = null
        }
        // release circular reference (#6759)
        if (vm.$vnode) {
            vm.$vnode.parent = null
        }
    }
}

// 挂载阶段
export function mountComponent (
    vm: Component,
    el: ?Element,
    hydrating?: boolean
): Component {
    vm.$el = el
    if (!vm.$options.render) {
        // 实例上不存在渲染函数，则设置一个默认的渲染函数createEmptyVNode，该函数执行返回一个注释类型的VNode节点
        vm.$options.render = createEmptyVNode
        if (process.env.NODE_ENV !== 'production') {
            /* istanbul ignore if */
            if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
                vm.$options.el || el) {
                warn(
                    'You are using the runtime-only build of Vue where the template ' +
                    'compiler is not available. Either pre-compile the templates into ' +
                    'render functions, or use the compiler-included build.',
                    vm
                )
            } else {
                warn(
                    'Failed to mount component: template or render function not defined.',
                    vm
                )
            }
        }
    }
    // 挂载实例前触发生命周期钩子
    callHook(vm, 'beforeMount')

    let updateComponent
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        updateComponent = () => {
            const name = vm._name
            const id = vm._uid
            const startTag = `vue-perf-start:${id}`
            const endTag = `vue-perf-end:${id}`

            mark(startTag)
            const vnode = vm._render()
            mark(endTag)
            measure(`vue ${name} render`, startTag, endTag)

            mark(startTag)
            vm._update(vnode, hydrating)
            mark(endTag)
            measure(`vue ${name} patch`, startTag, endTag)
        }
    } else {
        updateComponent = () => {

            // vm._render() ：
            // 执行实例上的_render（）渲染函数，得到一份最新的Vnode
            // vm._update() :
            // 调用虚拟DOM中的patch方法来执行新旧节点的对比并更新DOM节点。简单来说就是执行了渲染操作

            // 执行vm._render()函数；得到最新的vnode,并将vnode传递给_update方法，接下来就该到patch阶段了
            // vm._render就是大家经常听到的render函数，由两种方式得到:
            // 1.用户自己提供，在编写组件时，用render选项代替模板
            // 2.由编译器编译组件模板生成render选项
            vm._update(vm._render(), hydrating)
        }
    }

    // we set this to vm._watcher inside the watcher's constructor
    // since the watcher's initial patch may call $forceUpdate (e.g. inside child
    // component's mounted hook), which relies on vm._watcher being already defined
    // 回顾一下watcher观察数据的过程:
    // 状态通过Observer装换成响应式只有，每当触发getter时，会从全局的某个属性(Dep.target)中获取watcher实例并将它添加到数据的依赖列表中。
    // watcher读取数据之前，会先将自己设置到全局的(Dep.target)某个属性中。而数据读取会出发getter，所以会将watcher收集到依赖列表中。
    // 收集好依赖后，当数据发生变化，会向依赖列表中的watcher发送通知。
    // 当数据发生变化，watcher会一次又一次的执行函数进入渲染流程，如此反复，这个过程会持续到实例被销毁
    // 由于watcher第二个参数支持函数，所以当watcher执行函数时，函数中所读取的数据都将会出发getter去全局找到watcher并将其收集到依赖列表中
    // Watcher的第二个参数是函数，函数中读取的所有数据都会被watcher观察，这些数据任何一个发生变化，watcher都将得到通知

    // 已挂载阶段会持续追踪状态的变化，当数据发生变化时，watcher会通知虚拟Dom重新渲染视图
    // 在渲染视图前触发beforeUpdate钩子函数，渲染完毕后触发updated钩子函数
    new Watcher(vm, updateComponent, noop, {
        before () {
            if (vm._isMounted && !vm._isDestroyed) {
                callHook(vm, 'beforeUpdate')
            }
        }
    }, true /* isRenderWatcher */)
    hydrating = false

    // manually mounted instance, call mounted on self
    // mounted is called for render-created child components in its inserted hook
    if (vm.$vnode == null) {
        vm._isMounted = true
        // 挂载完毕后触发mounted钩子函数
        callHook(vm, 'mounted')
    }
    return vm
}

export function updateChildComponent (
    vm: Component,
    propsData: ?Object,
    listeners: ?Object,
    parentVnode: MountedComponentVNode,
    renderChildren: ?Array<VNode>
) {
    if (process.env.NODE_ENV !== 'production') {
        isUpdatingChildComponent = true
    }

    // determine whether component has slot children
    // we need to do this before overwriting $options._renderChildren.

    // check if there are dynamic scopedSlots (hand-written or compiled but with
    // dynamic slot names). Static scoped slots compiled from template has the
    // "$stable" marker.
    const newScopedSlots = parentVnode.data.scopedSlots
    const oldScopedSlots = vm.$scopedSlots
    const hasDynamicScopedSlot = !!(
        (newScopedSlots && !newScopedSlots.$stable) ||
        (oldScopedSlots !== emptyObject && !oldScopedSlots.$stable) ||
        (newScopedSlots && vm.$scopedSlots.$key !== newScopedSlots.$key)
    )

    // Any static slot children from the parent may have changed during parent's
    // update. Dynamic scoped slots may also have changed. In such cases, a forced
    // update is necessary to ensure correctness.
    const needsForceUpdate = !!(
        renderChildren ||               // has new static slots
        vm.$options._renderChildren ||  // has old static slots
        hasDynamicScopedSlot
    )

    vm.$options._parentVnode = parentVnode
    vm.$vnode = parentVnode // update vm's placeholder node without re-render

    if (vm._vnode) { // update child tree's parent
        vm._vnode.parent = parentVnode
    }
    vm.$options._renderChildren = renderChildren

    // update $attrs and $listeners hash
    // these are also reactive so they may trigger child update if the child
    // used them during render
    vm.$attrs = parentVnode.data.attrs || emptyObject
    vm.$listeners = listeners || emptyObject

    // update props
    if (propsData && vm.$options.props) {
        toggleObserving(false)
        const props = vm._props
        const propKeys = vm.$options._propKeys || []
        for (let i = 0; i < propKeys.length; i++) {
            const key = propKeys[i]
            const propOptions: any = vm.$options.props // wtf flow?
            props[key] = validateProp(key, propOptions, propsData, vm)
        }
        toggleObserving(true)
        // keep a copy of raw propsData
        vm.$options.propsData = propsData
    }

    // update listeners
    listeners = listeners || emptyObject
    const oldListeners = vm.$options._parentListeners
    vm.$options._parentListeners = listeners
    updateComponentListeners(vm, listeners, oldListeners)

    // resolve slots + force update if has children
    if (needsForceUpdate) {
        vm.$slots = resolveSlots(renderChildren, parentVnode.context)
        vm.$forceUpdate()
    }

    if (process.env.NODE_ENV !== 'production') {
        isUpdatingChildComponent = false
    }
}

function isInInactiveTree (vm) {
    while (vm && (vm = vm.$parent)) {
        if (vm._inactive) return true
    }
    return false
}

export function activateChildComponent (vm: Component, direct?: boolean) {
    if (direct) {
        vm._directInactive = false
        if (isInInactiveTree(vm)) {
            return
        }
    } else if (vm._directInactive) {
        return
    }
    if (vm._inactive || vm._inactive === null) {
        vm._inactive = false
        for (let i = 0; i < vm.$children.length; i++) {
            activateChildComponent(vm.$children[i])
        }
        callHook(vm, 'activated')
    }
}

export function deactivateChildComponent (vm: Component, direct?: boolean) {
    if (direct) {
        vm._directInactive = true
        if (isInInactiveTree(vm)) {
            return
        }
    }
    if (!vm._inactive) {
        vm._inactive = true
        for (let i = 0; i < vm.$children.length; i++) {
            deactivateChildComponent(vm.$children[i])
        }
        callHook(vm, 'deactivated')
    }
}

// 从vm.$options中取出生命周期钩子列表，执行每一个生命周期钩子
export function callHook (vm: Component, hook: string) {
    // #7573 disable dep collection when invoking lifecycle hooks
    pushTarget()
    const handlers = vm.$options[hook]
    const info = `${hook} hook`
    if (handlers) {
        for (let i = 0, j = handlers.length; i < j; i++) {
            invokeWithErrorHandling(handlers[i], vm, null, vm, info)
        }
    }
    if (vm._hasHookEvent) {
        vm.$emit('hook:' + hook)
    }
    popTarget()
}
