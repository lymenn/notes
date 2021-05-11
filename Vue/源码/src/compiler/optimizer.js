/* @flow */

import { makeMap, isBuiltInTag, cached, no } from 'shared/util'

let isStaticKey
let isPlatformReservedTag

const genStaticKeysCached = cached(genStaticKeys)

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 */
// 优化
// 遍历ast，标记每个节点是静态节点还是动态节点，然后标记静态跟节点
// 这样在后续的更新过程中就不需要再关注这些节点
export function optimize (root: ?ASTElement, options: CompilerOptions) {
    if (!root) return
    isStaticKey = genStaticKeysCached(options.staticKeys || '')
    // 平台保留标签
    isPlatformReservedTag = options.isReservedTag || no
    // first pass: mark all non-static nodes.
    // 遍历所有节点，给每个节点设置static属性，标识其是否为静态节点
    markStatic(root)
    // second pass: mark static roots.
    // 进一步标记静态根，一个节点要成为静态根节点，需要具体一下条件:
    // 节点本身是静态节点，而且有子节点，而且子节点不只是一个文本节点，则标记为静态根
    // 静态根节点不能只有静态文本的子节点，因为这样的收益太低，这种情况下始终更新它就好了
    markStaticRoots(root, false)
}

function genStaticKeys (keys: string): Function {
    return makeMap(
        'type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap' +
        (keys ? ',' + keys : '')
    )
}

// 在所有子节点上设置static属性，用来表示是否为静态节点
// 注意: 如果有子节点为动态节点，则父节点也被认为是动态节点
// @param {*} node
// @returns
function markStatic (node: ASTNode) {
    // 通过node.static来标识是否为静态节点
    node.static = isStatic(node)
    if (node.type === 1) {
        // do not make component slot content static. this avoids
        // 1. components not able to mutate slot nodes
        // 2. static slot content fails for hot-reloading
        // 不要将组件的插槽内容设置为静态节点，这样可以避免:
        // 1、组件不能改变插槽节点
        // 2、静态插槽内容在热重载时失败
        if (
            !isPlatformReservedTag(node.tag) &&
            node.tag !== 'slot' &&
            node.attrsMap['inline-template'] == null
        ) {
            // 递归终止条件，如果节点不是平台保留标签 && 也不是slot 标签 && 也不是内联模板，则直接结束
            return
        }
        // 遍历子节点，递归调用markStatic来标记这些子节点的static属性
        for (let i = 0, l = node.children.length; i < l; i++) {
            const child = node.children[i]
            markStatic(child)
            // 如果子节点是非静态节点，则将父节点更新为非静态节点
            if (!child.static) {
                node.static = false
            }
        }

        // 如果存在v -if、v -else -if、v - else这些指令，则依次标记block中节点的static
        if (node.ifConditions) {
            for (let i = 1, l = node.ifConditions.length; i < l; i++) {
                const block = node.ifConditions[i].block
                markStatic(block)
                if (!block.static) {
                    node.static = false
                }
            }
        }
    }
}

// 进一步标记静态根，一个节点要成为静态根节点，需要具备以下条件：
// 节点本身是静态节点，而且有子节点，而且子节点不只是一个文本节点，则标记为静态根
// 静态根节点不能只有静态文本的子节点，因为这样收益太低！这种情况始终更新它就好了
// @param { ASTElement } node 当前节点
// @param { boolean } isInFor 当前节点是否被包裹在 v-for 指令所在的节点内
function markStaticRoots (node: ASTNode, isInFor: boolean) {
    if (node.type === 1) {
        if (node.static || node.once) {
            // 节点是静态的或者节点上有v-once指令，标记node.staticInFor = true or false
            node.staticInFor = isInFor
        }
        // For a node to qualify as a static root, it should have children that
        // are not just static text. Otherwise the cost of hoisting out will
        // outweigh the benefits and it's better off to just always render it fresh.
        if (node.static && node.children.length && !(
            node.children.length === 1 &&
            node.children[0].type === 3
        )) {
            node.staticRoot = true
            return
        } else {
            node.staticRoot = false
        }
        // 当前节点不是静态根节点的时候，递归遍历其子节点，标记静态根
        if (node.children) {
            for (let i = 0, l = node.children.length; i < l; i++) {
                markStaticRoots(node.children[i], isInFor || !!node.for)
            }
        }
        // 如果节点存在 v-if、 v-else-if、v-else指令，则为block节点标记静态根
        if (node.ifConditions) {
            for (let i = 1, l = node.ifConditions.length; i < l; i++) {
                markStaticRoots(node.ifConditions[i].block, isInFor)
            }
        }
    }
}

// 判断节点是否为静态节点
// 通过定义的node.type来判断，2：表达式 =》 动态，3：文本 =》静态
// 凡是有v-bind,v-if,v-for等指令的都属于动态节点
// 组件为动态节点
// 父节点含有v-for指令的template标签，则为动态节点
// @param {*} node 
// @returns boolean
function isStatic (node: ASTNode): boolean {
    if (node.type === 2) { // expression
        // 比如：{{ msg }}
        return false
    }
    if (node.type === 3) { // text
        return true
    }
    return !!(node.pre || (
        !node.hasBindings && // no dynamic bindings
        !node.if && !node.for && // not v-if or v-for or v-else
        !isBuiltInTag(node.tag) && // not a built-in
        isPlatformReservedTag(node.tag) && // not a component
        !isDirectChildOfTemplateFor(node) &&
        Object.keys(node).every(isStaticKey)
    ))
}

function isDirectChildOfTemplateFor (node: ASTElement): boolean {
    while (node.parent) {
        node = node.parent
        if (node.tag !== 'template') {
            return false
        }
        if (node.for) {
            return true
        }
    }
    return false
}
