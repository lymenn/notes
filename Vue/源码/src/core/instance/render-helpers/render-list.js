/* @flow */

import { isObject, isDef, hasSymbol } from 'core/util/index'

/**
 * Runtime helper for rendering v-for lists.
 */
// 运行时渲染v-for列表的帮助函数，循环遍历val，依次为每一项执行render方法生成vnode，最终返回一个vnode数组
export function renderList (
    val: any,
    render: (
        val: any,
        keyOrIndex: string | number,
        index?: number
    ) => VNode
): ?Array<VNode> {
    let ret: ?Array<VNode>, i, l, keys, key
    if (Array.isArray(val) || typeof val === 'string') {
        // val为数组或者字符串
        ret = new Array(val.length)
        for (i = 0, l = val.length; i < l; i++) {
            ret[i] = render(val[i], i)
        }
    } else if (typeof val === 'number') {
        // val为一个数值，则遍历0-val的所有数字
        ret = new Array(val)
        for (i = 0; i < val; i++) {
            ret[i] = render(i + 1, i)
        }
    } else if (isObject(val)) {
        // val为一个对象，遍历对象
        if (hasSymbol && val[Symbol.iterator]) {
            // val为一个可迭代对象
            ret = []
            const iterator: Iterator<any> = val[Symbol.iterator]()
            let result = iterator.next()
            while (!result.done) {
                ret.push(render(result.value, ret.length))
                result = iterator.next()
            }
        } else {
            // val为一个普通对象
            keys = Object.keys(val)
            ret = new Array(keys.length)
            for (i = 0, l = keys.length; i < l; i++) {
                key = keys[i]
                ret[i] = render(val[key], key, i)
            }
        }
    }
    if (!isDef(ret)) {
        ret = []
    }
    // 返回vnode数组
    (ret: any)._isVList = true
    return ret
}
