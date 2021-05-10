/* @flow */

/**
 * Expand input[v-model] with dynamic type bindings into v-if-else chains
 * Turn this:
 *   <input v-model="data[type]" :type="type">
 * into this:
 *   <input v-if="type === 'checkbox'" type="checkbox" v-model="data[type]">
 *   <input v-else-if="type === 'radio'" type="radio" v-model="data[type]">
 *   <input v-else :type="type" v-model="data[type]">
 */

import {
    addRawAttr,
    getBindingAttr,
    getAndRemoveAttr
} from 'compiler/helpers'

import {
    processFor,
    processElement,
    addIfCondition,
    createASTElement
} from 'compiler/parser/index'

// 处理存在v-model的input标签，但没处理v-model属性
// 分别处理了input为checkbox,radio和其他情况
// input具体是哪种情况由el.ifConditions中的条件判断
// <input v-mode="test" :type="checkbox or radio or other(比如 text)" />
// @param {*} el 
// @param {*} options 
// @returns branch0
function preTransformNode (el: ASTElement, options: CompilerOptions) {
    if (el.tag === 'input') {
        const map = el.attrsMap
        // 不存在v-model属性，直接结束
        if (!map['v-model']) {
            return
        }

        // 获取 :type的值
        let typeBinding
        if (map[':type'] || map['v-bind:type']) {
            typeBinding = getBindingAttr(el, 'type')
        }
        if (!map.type && !typeBinding && map['v-bind']) {
            typeBinding = `(${map['v-bind']}).type`
        }

        // 如果存在type属性
        if (typeBinding) {
            // 获取 v-if 的值，比如： <input v-model="test" :type="checkbox" v-if="test" />
            const ifCondition = getAndRemoveAttr(el, 'v-if', true)
            // &&test
            const ifConditionExtra = ifCondition ? `&&(${ifCondition})` : ``
            // 是否存在v-else属性，<input v-else />
            const hasElse = getAndRemoveAttr(el, 'v-else', true) != null
            // 获取v-else-if属性的值<inpu v-else-if="test" />
            const elseIfCondition = getAndRemoveAttr(el, 'v-else-if', true)
            // 克隆一个新的el对象，分别处理input为checkbox，radio或其他情况
            // 具体是哪种情况，通过element.ifConditions条件来判断
            // 1. checkbox
            const branch0 = cloneASTElement(el)
            // process for on the main node
            // 处理v-for表达式，得到branch0.for = arr, branch0.alias = item
            processFor(branch0)
            // 在branch0.attrsMap和branch0.attrsList对象中添加type属性
            addRawAttr(branch0, 'type', 'checkbox')
            // 分别处理元素节点key、ref、插槽、自闭合的slot标签、动态组件、class、style、v-bind、v-on、其他指令和一些原生属性
            processElement(branch0, options)
            // 标记当前对象已被处理过了
            branch0.processed = true // prevent it from double-processed
            // 得到true&&test or false&&test,标记当前input是否为checkbox
            branch0.if = `(${typeBinding})==='checkbox'` + ifConditionExtra
            // 在branch0.ifConditions数组中放入{ exp, block }对象
            addIfCondition(branch0, {
                exp: branch0.if,
                block: branch0
            })
            // 克隆一个新的ast对象
            // 2. add radio else-if condition
            const branch1 = cloneASTElement(el)
            // 获取v-for属性
            getAndRemoveAttr(branch1, 'v-for', true)
            // 在branch1.attrsMap和 branch1.attrsList对象中添加 type 属性
            addRawAttr(branch1, 'type', 'radio')
            // 分别处理元素节点key、ref、插槽、自闭合的slot标签、动态组件、class、style、v-bind、v-on、其他指令和一些原生属性
            processElement(branch1, options)
            // 在 branch0.ifConfitions 数组中放入 { exp, block } 对象
            addIfCondition(branch0, {
                // 标记当前input是否为radio
                exp: `(${typeBinding})==='radio'` + ifConditionExtra,
                block: branch1
            })
            // 3. other， input为其他情况
            const branch2 = cloneASTElement(el)
            getAndRemoveAttr(branch2, 'v-for', true)
            addRawAttr(branch2, ':type', typeBinding)
            processElement(branch2, options)
            addIfCondition(branch0, {
                exp: ifCondition,
                block: branch2
            })

            // 给branch0设置else或elseif条件
            if (hasElse) {
                branch0.else = true
            } else if (elseIfCondition) {
                branch0.elseif = elseIfCondition
            }

            return branch0
        }
    }
}

function cloneASTElement (el) {
    return createASTElement(el.tag, el.attrsList.slice(), el.parent)
}

export default {
    preTransformNode
}
