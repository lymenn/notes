/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
export function traverse (val: any) {
    // 递归val的所有子值来触发它们的依赖收集功能
    _traverse(val, seenObjects)
    seenObjects.clear()
}

function _traverse (val: any, seen: SimpleSet) {
    let i, keys
    const isA = Array.isArray(val)
    if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
        return
    }
    if (val.__ob__) {
        const depId = val.__ob__.dep.id
        if (seen.has(depId)) {
            return
        }
        seen.add(depId)
    }
    if (isA) {
        i = val.length
        while (i--) _traverse(val[i], seen)
    } else {
        keys = Object.keys(val)
        i = keys.length
        // 循环Object中的所有key，然后执行一次读取操作，再递归子值
        // 其中val[keys[i]]会触发getter，也就是触发依赖手机的操作
        // 这时Dep.target还没有被清空，会将当前的Watcher收集进去
        // 而_traverse是一个递归的操作，所以这个val的子值也会触发同样的逻辑，
        // 这样就可以实现通过deep参数来监听所有子值的变化
        while (i--) _traverse(val[keys[i]], seen)
    }
}
