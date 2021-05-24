/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin (Vue: Class<Component>) {
    // 初始化阶段
    Vue.prototype._init = function (options?: Object) {
        const vm: Component = this
        // a uid
        vm._uid = uid++

        let startTag, endTag
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
            startTag = `vue-perf-start:${vm._uid}`
            endTag = `vue-perf-end:${vm._uid}`
            mark(startTag)
        }

        // a flag to avoid this being observed
        vm._isVue = true
        // merge options
        if (options && options._isComponent) {
            // optimize internal component instantiation
            // since dynamic options merging is pretty slow, and none of the
            // internal component options needs special treatment.
            initInternalComponent(vm, options)
        } else {
            vm.$options = mergeOptions(
                // 获取当前实例中构造函数的options选项及其所有父级的构造函数的options，之所以会有父级，是因为当前Vue实例可能是一个子组件
                resolveConstructorOptions(vm.constructor),
                options || {},
                vm
            )
        }
        /* istanbul ignore else */
        if (process.env.NODE_ENV !== 'production') {
            initProxy(vm)
        } else {
            vm._renderProxy = vm
        }
        // expose real self
        vm._self = vm
        // 初始化实例属性 

        // 为Vue实例设置属性并提供默认值.  _开头的为内部属性, $开头的为外部属性
        initLifecycle(vm)
        // 初始化事件 vm._events

        // 将父组件在模板中使用v-on注册的事件添加到子组件的事件系统中
        // v-on写在组件标签上，这个事件会被注册到子组件的事件系统
        // v-on写在平台标签上, 这个事件会被注册到浏览器事件中
        initEvents(vm)


        // 初始化渲染
        // 解析组件的插槽信息，得到 vm.$slot，处理渲染函数，得到 vm.$createElement 方法，即 h 函数
        initRender(vm)

        callHook(vm, 'beforeCreate')
        // 初始化Inject
        initInjections(vm) // resolve injections before data/props
        // 初始化状态
        initState(vm)
        // 初始化provide
        initProvide(vm) // resolve provide after data/props

        callHook(vm, 'created')

        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
            vm._name = formatComponentName(vm, false)
            mark(endTag)
            measure(`vue ${vm._name} init`, startTag, endTag)
        }

        if (vm.$options.el) {
            vm.$mount(vm.$options.el)
        }
    }
}

export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
    const opts = vm.$options = Object.create(vm.constructor.options)
    // doing this because it's faster than dynamic enumeration.
    const parentVnode = options._parentVnode
    opts.parent = options.parent
    opts._parentVnode = parentVnode

    const vnodeComponentOptions = parentVnode.componentOptions
    opts.propsData = vnodeComponentOptions.propsData
    opts._parentListeners = vnodeComponentOptions.listeners
    opts._renderChildren = vnodeComponentOptions.children
    opts._componentTag = vnodeComponentOptions.tag

    if (options.render) {
        opts.render = options.render
        opts.staticRenderFns = options.staticRenderFns
    }
}
// 从构造函数上解析配置项
export function resolveConstructorOptions (Ctor: Class<Component>) {
    // 从实例构造函数上获取选项

    let options = Ctor.options
    if (Ctor.super) {

        const superOptions = resolveConstructorOptions(Ctor.super)
        // 缓存
        const cachedSuperOptions = Ctor.superOptions
        if (superOptions !== cachedSuperOptions) {
            // 说明基类的配置项发生了改变
            // super option changed,
            // need to resolve new options.
            Ctor.superOptions = superOptions
            // check if there are any late-modified/attached options (#4976)
            // 找到更改的配置项
            const modifiedOptions = resolveModifiedOptions(Ctor)
            // update base extend options
            if (modifiedOptions) {
                // 将更改的配置项和extend选项合并
                extend(Ctor.extendOptions, modifiedOptions)
            }
            // 将新的选项赋值给options
            options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
            if (options.name) {
                options.components[options.name] = Ctor
            }
        }
    }
    return options
}

// 解析构造函数选项中后续被修改或者增加的选项
function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
    let modified
    // 构造函数选项
    const latest = Ctor.options
    // 密封的构造函数选项，备份
    const sealed = Ctor.sealedOptions
    // 对比两个选项，记录不一致的选项
    for (const key in latest) {
        if (latest[key] !== sealed[key]) {
            if (!modified) modified = {}
            modified[key] = latest[key]
        }
    }
    return modified
}
