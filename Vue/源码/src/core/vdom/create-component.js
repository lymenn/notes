/* @flow */

import VNode from './vnode'
import { resolveConstructorOptions } from 'core/instance/init'
import { queueActivatedComponent } from 'core/observer/scheduler'
import { createFunctionalComponent } from './create-functional-component'

import {
    warn,
    isDef,
    isUndef,
    isTrue,
    isObject
} from '../util/index'

import {
    resolveAsyncComponent,
    createAsyncPlaceholder,
    extractPropsFromVNodeData
} from './helpers/index'

import {
    callHook,
    activeInstance,
    updateChildComponent,
    activateChildComponent,
    deactivateChildComponent
} from '../instance/lifecycle'

import {
    isRecyclableComponent,
    renderRecyclableComponentTemplate
} from 'weex/runtime/recycle-list/render-component-template'

// inline hooks to be invoked on component VNodes during patch
// patch期间在组件vnode上调用内联钩子
const componentVNodeHooks = {
    // 初始化
    init (vnode: VNodeWithData, hydrating: boolean): ?boolean {
        if (
            vnode.componentInstance &&
            !vnode.componentInstance._isDestroyed &&
            vnode.data.keepAlive
        ) {
            // kept-alive components, treat as a patch
            // 被keep-alive包裹的组件
            const mountedNode: any = vnode // work around flow
            componentVNodeHooks.prepatch(mountedNode, mountedNode)
        } else {
            // 创建组件实例，即new vnode.componentOptions.Ctor(options) => 得到 Vue 组件实例
            const child = vnode.componentInstance = createComponentInstanceForVnode(
                vnode,
                activeInstance
            )
            // 执行组件的$mount方法，进入挂载阶段，接下来就是通过编译器得到render函数，接着走挂起、patch、这条路，直到组件渲染到页面
            child.$mount(hydrating ? vnode.elm : undefined, hydrating)
        }
    },

    // 更新vnode，用新的vnode配置，更新旧的vnode上的各种属性
    prepatch (oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
        // 新vnode的组件配置项
        const options = vnode.componentOptions
        // 老vnode的组件实例
        const child = vnode.componentInstance = oldVnode.componentInstance
        // 用vnode上的属性更新child上的各种属性
        updateChildComponent(
            child,
            options.propsData, // updated props
            options.listeners, // updated listeners
            vnode, // new parent vnode
            options.children // new children
        )
    },

    // 执行组件的mounted生命周期钩子
    insert (vnode: MountedComponentVNode) {
        const { context, componentInstance } = vnode
        // 如果组件未挂载，则调用mounted生命周期钩子
        if (!componentInstance._isMounted) {
            componentInstance._isMounted = true
            callHook(componentInstance, 'mounted')
        }
        // 处理keep-alive组件的异常情况
        if (vnode.data.keepAlive) {
            if (context._isMounted) {
                // vue-router#1212
                // During updates, a kept-alive component's child components may
                // change, so directly walking the tree here may call activated hooks
                // on incorrect children. Instead we push them into a queue which will
                // be processed after the whole patch process ended.
                queueActivatedComponent(componentInstance)
            } else {
                activateChildComponent(componentInstance, true /* direct */)
            }
        }
    },

    // 销毁组件
    // 1、如果组件被keep- alive组件包裹，则使组件失活，不销毁组件，从而缓存组件的状态
    // 2、如果组件没有keep-alive包裹，则直接调用实例的$destroy方法销毁组件
    destroy (vnode: MountedComponentVNode) {
        // 从vnode上获取组件实例
        const { componentInstance } = vnode
        if (!componentInstance._isDestroyed) {
            // 如果组件实例没有被销毁
            if (!vnode.data.keepAlive) {
                // 组件没有被 keep-alive 组件包裹，则直接调用 $destroy 方法销毁组件
                componentInstance.$destroy()
            } else {
                // 负责让组件失活，不销毁组件实例，从而缓存组件状态
                deactivateChildComponent(componentInstance, true /* direct */)
            }
        }
    }
}

const hooksToMerge = Object.keys(componentVNodeHooks)

// 创建组件的vnode
// 1、函数式组件通过执行render方法生成组件的vnode
// 2、普通组件通过new VNode生成vnode，但是普通组件有个重要的操作是在data.hook对象上设置了四个钩子函数
//     分别是init，prepatch、insert、destroy，在组件的patch阶段会被调用
//     比如init方法，调用时会进入组件的创建挂载阶段，直到完成渲染
// @param {*} Ctor 组件构造函数
// @param {*} data 属性组成的 JSON 字符串
// @param {*} context 上下文
// @param {*} children 子节点数组
// @param {*} tag 标签名
// @returns VNode or Array<VNode>
export function createComponent (
    Ctor: Class<Component> | Function | Object | void,
    data: ?VNodeData,
    context: Component,
    children: ?Array<VNode>,
    tag?: string
): VNode | Array<VNode> | void {
    // 组件构造函数不存在，直接结束
    if (isUndef(Ctor)) {
        return
    }

    const baseCtor = context.$options._base

    // plain options object: turn it into a constructor
    // 当Ctor为配置对象时，通过Vue.extend将其转化为构造函数
    if (isObject(Ctor)) {
        Ctor = baseCtor.extend(Ctor)
    }

    // if at this stage it's not a constructor or an async component factory,
    // reject.
    // 到这里为止，如果Ctor仍然不是一个函数，则表示这是一个无效的组件定义
    if (typeof Ctor !== 'function') {
        if (process.env.NODE_ENV !== 'production') {
            warn(`Invalid Component definition: ${String(Ctor)}`, context)
        }
        return
    }

    // async component
    // 异步组件
    let asyncFactory
    if (isUndef(Ctor.cid)) {
        asyncFactory = Ctor
        Ctor = resolveAsyncComponent(asyncFactory, baseCtor)
        if (Ctor === undefined) {
            // return a placeholder node for async component, which is rendered
            // as a comment node but preserves all the raw information for the node.
            // the information will be used for async server-rendering and hydration.
            // 为异步组件返回一个占位符节点，组件被渲染为注释节点，但保留了节点的所有原始信息，这些信息将用于异步服务器渲染 和 hydration
            return createAsyncPlaceholder(
                asyncFactory,
                data,
                context,
                children,
                tag
            )
        }
    }

    // 节点的属性 JSON字符串
    data = data || {}

    // resolve constructor options in case global mixins are applied after
    // component constructor creation
    // 这里其实就是组件选项合并的地方，即编译器将组件编译为渲染函数，渲染时执行 render 函数，然后执行其中的_c,就会走到这里
    // 解析构造函数选项，并合并基类，以防止在组件构造函数创建后应用全局混入
    resolveConstructorOptions(Ctor)

    // transform component v-model data into props & events
    // 将组件的v - model的信息（值和回调）转换为data.attrs对象的属性、值和data.on对象上的事件、回调
    if (isDef(data.model)) {
        transformModel(Ctor.options, data)
    }

    // extract props
    // 提取props数据，得到propsData对象，propsData[key] = val
    // 以组件props配置中的属性为key，父组件中对应的数据为value
    const propsData = extractPropsFromVNodeData(data, Ctor, tag)

    // functional component
    // 函数式组件
    if (isTrue(Ctor.options.functional)) {
        // 执行函数式组件的render函数，生成组件的vnode，做了以下3件事
        // 1、设置组件的props
        // 2、设置函数式组件的渲染上下文，传递给函数式组件的render函数
        // 3、调用函数式组件的render函数生成vnode
        return createFunctionalComponent(Ctor, propsData, data, context, children)
    }

    // extract listeners, since these needs to be treated as
    // child component listeners instead of DOM listeners
    // 获取事件监听器对象data.on,因为这些监听器要作为子组件监听器处理，而不是DOM监听器
    const listeners = data.on
    // replace with listeners with .native modifier
    // so it gets processed during parent component patch.
    // 将带有.native,修饰符的事件对象赋值给data.on
    data.on = data.nativeOn

    if (isTrue(Ctor.options.abstract)) {
        // 如果是抽象组件，则保留props、listeners和slot
        // abstract components do not keep anything
        // other than props & listeners & slot

        // work around flow
        const slot = data.slot
        data = {}
        if (slot) {
            data.slot = slot
        }
    }

    // install component management hooks onto the placeholder node
    // 在组件的data对象上设置hook对象
    // hook对象增加四个属性，init、prepatch、insert、destroy
    // 负责组件的创建、更新、销毁，这些方法在组件的pathch阶段会被调用
    installComponentHooks(data)

    // return a placeholder vnode
    const name = Ctor.options.name || tag
    // 实例化组件的vnode，对于普通组件的标签名会比较特殊，vue-component-${cid}-${name}
    const vnode = new VNode(
        `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
        data, undefined, undefined, undefined, context,
        { Ctor, propsData, listeners, tag, children },
        asyncFactory
    )

    // Weex specific: invoke recycle-list optimized @render function for
    // extracting cell-slot template.
    // https://github.com/Hanks10100/weex-native-directive/tree/master/component
    /* istanbul ignore if */
    if (__WEEX__ && isRecyclableComponent(vnode)) {
        return renderRecyclableComponentTemplate(vnode)
    }

    return vnode
}
// new vnode.componentOptions.Ctor(options) => 得到 Vue 组件实例
export function createComponentInstanceForVnode (
    // we know it's MountedComponentVNode but flow doesn't
    vnode: any,
    // activeInstance in lifecycle state
    parent: any
): Component {
    const options: InternalComponentOptions = {
        _isComponent: true,
        _parentVnode: vnode,
        parent
    }
    // check inline-template render functions
    // 检查内联模板渲染函数
    const inlineTemplate = vnode.data.inlineTemplate
    if (isDef(inlineTemplate)) {
        options.render = inlineTemplate.render
        options.staticRenderFns = inlineTemplate.staticRenderFns
    }
    // new VueComponent(options) => Vue 实例
    return new vnode.componentOptions.Ctor(options)
}
// 在组件的data对象上设置hook对象
// hook对象增加4个属性，init，prepatch，insert，destroy
// 负责组件的创建、更新、销毁
function installComponentHooks (data: VNodeData) {

    const hooks = data.hook || (data.hook = {})
    // 遍历hooksToMerge数组，hooksToMerge =  ['init', 'prepatch', 'insert' 'destroy']
    for (let i = 0; i < hooksToMerge.length; i++) {
        // 比如 key = init
        const key = hooksToMerge[i]
        // 从data.hook对象中获取key对应的方法
        const existing = hooks[key]
        // componentVNodeHooks 对象中key对应的方法
        const toMerge = componentVNodeHooks[key]
        // 合并用户传递的hook方法和框架自带的hook方法，其实就是分别执行两个方法
        if (existing !== toMerge && !(existing && existing._merged)) {
            hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
        }
    }
}

function mergeHook (f1: any, f2: any): Function {
    const merged = (a, b) => {
        // flow complains about extra args which is why we use any
        f1(a, b)
        f2(a, b)
    }
    merged._merged = true
    return merged
}

// transform component v-model info (value and callback) into
// prop and event handler respectively.
// 将组件的v-model的信息（值和回调）转换为data.attrs对象的属性、值和data.on对象上的事件、回调
function transformModel (options, data: any) {
    // model的属性和事件，默认为value和input
    const prop = (options.model && options.model.prop) || 'value'
    const event = (options.model && options.model.event) || 'input'
        // 在data.attrs对象上存储v-model的值
        ; (data.attrs || (data.attrs = {}))[prop] = data.model.value
    // 在data.on对象上存储v-model的事件
    const on = data.on || (data.on = {})
    // 已存在的事件回调函数
    const existing = on[event]
    // v-model中事件对应的回调函数
    const callback = data.model.callback
    // 合并回调函数
    if (isDef(existing)) {
        if (
            Array.isArray(existing)
                ? existing.indexOf(callback) === -1
                : existing !== callback
        ) {
            on[event] = [callback].concat(existing)
        }
    } else {
        on[event] = callback
    }
}
