/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
    const el = query(id)
    return el && el.innerHTML
})
// 编译器的入口
// 运行时的Vue.js包就没有这部分代码，通过打包器结合vue - loader + vue - compile - utils进行预编译，将模板编译成render函数

// 做了一件事，得到组件的render函数，将其设置到this.$options上

// 把Vue原型上的$mount方法保存在mount中，以便后续使用，然后Vue原型上的$mount被一个新的方法覆盖
// 新的方法会调用原始的方法，这种做法通常叫做函数劫持
// 通过函数劫持我们可以在原始功能上新增一些其他功能
// 在这里$mount的原始方法就是运行时mount的核心功能，而在完整版中需要将编译的功能新增到核心功能上去
const mount = Vue.prototype.$mount
Vue.prototype.$mount = function (
    el?: string | Element,
    hydrating?: boolean
): Component {
    // 挂载点
    // 通过el获取挂载的dom元素
    el = el && query(el)

    // 挂载点不能是html或者body
    /* istanbul ignore if */
    if (el === document.body || el === document.documentElement) {
        process.env.NODE_ENV !== 'production' && warn(
            `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
        )
        return this
    }

    // 配置项
    const options = this.$options
    // resolve template/el and convert to render function
    // 如果用户提供了render配置项，则直接跳过编译阶段，否则进入编译阶段
    // 解析template和el，并转换为render函数
    // 只有不存在渲染函数，才会将模板编译成渲染函数
    // 优先级render > template > el
    if (!options.render) {
        let template = options.template
        // 优先从用户配置中获取template选项
        if (template) {
            if (typeof template === 'string') {
                if (template.charAt(0) === '#') {
                    // { template:'#app' }, template是一个id选择器，则获取元素的innerHtml作为模板
                    template = idToTemplate(template)
                    /* istanbul ignore if */
                    if (process.env.NODE_ENV !== 'production' && !template) {
                        warn(
                            `Template element not found or is empty: ${options.template}`,
                            this
                        )
                    }
                }
            } else if (template.nodeType) {
                // template是一个正常的元素，则获取其innerHTML作为模板
                template = template.innerHTML
            } else {
                if (process.env.NODE_ENV !== 'production') {
                    warn('invalid template option:' + template, this)
                }
                return this
            }
        } else if (el) {
            // 说明用户没有设置template选项，则获取el选项中模板
            // 设置了el选项，则获取el选择器的outHtml作为模板
            template = getOuterHTML(el)
        }
        // 模板就绪，进入编译阶段
        // 将模板编译成渲染函数
        if (template) {
            /* istanbul ignore if */
            if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
                mark('compile')
            }

            // 编译模板，得到动态渲染函数和静态渲染函数
            const { render, staticRenderFns } = compileToFunctions(template, {
                // 在非生产环境下，编译时记录标签属性在模板字符串中开始和结束为止的索引
                outputSourceRange: process.env.NODE_ENV !== 'production',
                shouldDecodeNewlines,
                shouldDecodeNewlinesForHref,
                // 界定符，默认{{}}
                delimiters: options.delimiters,
                // 保留注释
                comments: options.comments
            }, this)
            // 将两个渲染函数放到this.$options上
            options.render = render
            options.staticRenderFns = staticRenderFns

            /* istanbul ignore if */
            if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
                mark('compile end')
                measure(`vue ${this._name} compile`, 'compile', 'compile end')
            }
        }
    }
    // 执行挂载
    return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {
    if (el.outerHTML) {
        return el.outerHTML
    } else {
        const container = document.createElement('div')
        container.appendChild(el.cloneNode(true))
        return container.innerHTML
    }
}

Vue.compile = compileToFunctions

export default Vue
