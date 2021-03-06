/* @flow */
// 什么是VNode？
// VNode类，可以实例化不同类型的vnode实例，不同类型的vnode实例各自表示不同类型的DOM元素
// vnode实例可以理解成节点描述对象，这个JavaScript对象用来描述一个真实的DOM元素，真实的DOM由vnode创建并插入到页面中
// 渲染视图的过程是先创建vnode，然后再使用vnode去生成真实的DOM元素，最后插入到页面渲染视图
// VNode有什么作用？
// Vue状态的侦测采用了中等粒度。当状态发生变化时，通知到组件级别，然后组件内部采用虚拟DOM来渲染视图
// 当某个状态发生变化，组件收到通知重新渲染，通过新老vnode对比，只对需要更新的部分进行DOM操作，避免了重新渲染整个组件的所有节点，造成性能浪费！
// 只对需要更新的部分进行DOM操作可以提升很多性能，这是vnode最重要的一个作用
export default class VNode {
    tag: string | void;
    data: VNodeData | void;
    children: ?Array<VNode>;
    text: string | void;
    elm: Node | void;
    ns: string | void;
    context: Component | void; // rendered in this component's scope
    key: string | number | void;
    componentOptions: VNodeComponentOptions | void;
    componentInstance: Component | void; // component instance
    parent: VNode | void; // component placeholder node

    // strictly internal
    raw: boolean; // contains raw HTML? (server only)
    isStatic: boolean; // hoisted static node
    isRootInsert: boolean; // necessary for enter transition check
    isComment: boolean; // empty comment placeholder?
    isCloned: boolean; // is a cloned node?
    isOnce: boolean; // is a v-once node?
    asyncFactory: Function | void; // async component factory function
    asyncMeta: Object | void;
    isAsyncPlaceholder: boolean;
    ssrContext: Object | void;
    fnContext: Component | void; // real context vm for functional nodes
    fnOptions: ?ComponentOptions; // for SSR caching
    devtoolsMeta: ?Object; // used to store functional render context for devtools
    fnScopeId: ?string; // functional scope id support

    constructor(
        tag?: string,
        data?: VNodeData,
        children?: ?Array<VNode>,
        text?: string,
        elm?: Node,
        context?: Component,
        componentOptions?: VNodeComponentOptions,
        asyncFactory?: Function
    ) {
        // 当前节点标签名
        this.tag = tag
        // 当前节点数据 （VNodeData类型）
        this.data = data
        // 当前节点子节点
        this.children = children
        // 当前节点文本
        this.text = text
        // 当前节点对应的真实DOM节点
        this.elm = elm
        // 当前节点命名空间
        this.ns = undefined
        // 当前节点上下文
        this.context = context
        // 函数化组件上下文
        this.fnContext = undefined
        // 函数化组件配置项
        this.fnOptions = undefined
        // 函数化组件ScopeId
        this.fnScopeId = undefined
        // 子节点key属性
        this.key = data && data.key
        // 组件配置项
        this.componentOptions = componentOptions
        // 组件实例
        this.componentInstance = undefined
        // 当前节点父节点
        this.parent = undefined
        // 是否为原生HTML或只是普通文本
        this.raw = false
        // 静态节点标志 keep-alive
        this.isStatic = false
        // 是否作为根节点插入
        this.isRootInsert = true
        // 是否为注释节点
        this.isComment = false
        // 是否为克隆节点
        this.isCloned = false
        // 是否为v-once节点
        this.isOnce = false
        // 异步工厂方法
        this.asyncFactory = asyncFactory
        // 异步meta
        this.asyncMeta = undefined
        // 是否为异步占位
        this.isAsyncPlaceholder = false
    }

    // DEPRECATED: alias for componentInstance for backwards compat.
    /* istanbul ignore next */
    get child (): Component | void {
        return this.componentInstance
    }
}

// 创建注释节点
// <!-- 注释节点 -->
// {
//     text: '注释节点',
//     isComment: true
// }
export const createEmptyVNode = (text: string = '') => {
    const node = new VNode()
    node.text = text
    node.isComment = true
    return node
}

// {
//     text: 'Hello Tangem'
// }
export function createTextVNode (val: string | number) {
    return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.
// 作用: 优化静态节点和插槽节点
// 以静态节点为例，静态节点因为他的内容不会改变，所以除了首次渲染需要执行渲染函数获取vnode之外，后续更新不需要执行渲染函数重新生成vnode
// 创建克隆节点，使用克隆节点进行渲染，这样就不需要重新执行渲染函数，生成新的静态节点的vnode，从而提升一定程度的性能
export function cloneVNode (vnode: VNode): VNode {
    const cloned = new VNode(
        vnode.tag,
        vnode.data,
        // #7975
        // clone children array to avoid mutating original in case of cloning
        // a child.
        vnode.children && vnode.children.slice(),
        vnode.text,
        vnode.elm,
        vnode.context,
        vnode.componentOptions,
        vnode.asyncFactory
    )
    cloned.ns = vnode.ns
    cloned.isStatic = vnode.isStatic
    cloned.key = vnode.key
    cloned.isComment = vnode.isComment
    cloned.fnContext = vnode.fnContext
    cloned.fnOptions = vnode.fnOptions
    cloned.fnScopeId = vnode.fnScopeId
    cloned.asyncMeta = vnode.asyncMeta
    cloned.isCloned = true
    return cloned
}
