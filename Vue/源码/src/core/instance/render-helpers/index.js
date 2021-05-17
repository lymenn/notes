/* @flow */

import { toNumber, toString, looseEqual, looseIndexOf } from 'shared/util'
import { createTextVNode, createEmptyVNode } from 'core/vdom/vnode'
import { renderList } from './render-list'
import { renderSlot } from './render-slot'
import { resolveFilter } from './resolve-filter'
import { checkKeyCodes } from './check-keycodes'
import { bindObjectProps } from './bind-object-props'
import { renderStatic, markOnce } from './render-static'
import { bindObjectListeners } from './bind-object-listeners'
import { resolveScopedSlots } from './resolve-scoped-slots'
import { bindDynamicKeys, prependModifier } from './bind-dynamic-keys'

// 在实例上挂载简写的渲染工具函数，这些都是运行时代码
// 这些工具函数在编译器生成的渲染函数中被使用到了
export function installRenderHelpers (target: any) {
    // v-once指令的运行时帮助程序，为VNode加上打上静态标记
    // 有点多余，因为含有v-once指令的节点都被当作静态节点处理了，所以也不会走这里
    target._o = markOnce
    // 将值转换为数字
    target._n = toNumber
    // 将值转换为字符串形式，普通值=> String(val)，对象 => JSON.stringify(val)
    target._s = toString
    // 运行时渲染 v-for列表的帮助函数，循环遍历val值，依次为每一项执行render方法生成vnode，最终返回一个vnode数组
    target._l = renderList
    target._t = renderSlot
    // 判断两个值是否相等
    target._q = looseEqual

    // 相当于indexOf方法
    target._i = looseIndexOf

    // 运行时负责生成静态树的VNode帮助程序，完成了以下两件事
    // 1、执行staticRenderFns 数组中指定下标的渲染函数，生成静态树的vnode并缓存，下次在缓存时从缓存中直接读取（isInFor 必须为 true）
    // 2、为静态树的VNode打静态标记
    target._m = renderStatic
    target._f = resolveFilter
    target._k = checkKeyCodes
    target._b = bindObjectProps
    // 为文本节点创建vnode
    target._v = createTextVNode
    // 为空节点创建vnode
    target._e = createEmptyVNode
    target._u = resolveScopedSlots
    target._g = bindObjectListeners
    target._d = bindDynamicKeys
    target._p = prependModifier
}
