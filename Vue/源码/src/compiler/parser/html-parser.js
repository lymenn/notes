/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson (MPL-1.1 OR Apache-2.0 OR GPL-2.0-or-later)
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'
import { unicodeRegExp } from 'core/util/lang'

// Regular Expressions for parsing tags and attributes
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+?\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
const startTagOpen = new RegExp(`^<${qnameCapture}`)
const startTagClose = /^\s*(\/?)>/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being passed as HTML comment when inlined in page
const comment = /^<!\--/
const conditionalComment = /^<!\[/

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&amp;': '&',
    '&#10;': '\n',
    '&#9;': '\t',
    '&#39;': "'"
}
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr (value, shouldDecodeNewlines) {
    const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
    return value.replace(re, match => decodingMap[match])
}
// 通过循环遍历html模板字符串，依次处理其中的各个标签，以及标签上的属性
// @param {*} html html 模版
// @param {*} options 配置项
export function parseHTML (html, options) {
    const stack = []
    const expectHTML = options.expectHTML
    // 是否是自闭和标签
    const isUnaryTag = options.isUnaryTag || no
    // 是否可以只有开始标签
    const canBeLeftOpenTag = options.canBeLeftOpenTag || no
    // 记录在原始html字符串中的开始位置
    let index = 0
    let last, lastTag
    // 每次循环都从HTML模板中截取一小段字符串，然后重复以上过程，直到html模板被截成一个空字符串，解析完毕
    // 在循环过程中会根据截取的字符串类型来触发不同的钩子函数
    while (html) {
        last = html
        // Make sure we're not in a plaintext content element like script/style
        // 确保不是在script style textarea这样的纯文本元素中
        if (!lastTag || !isPlainTextElement(lastTag)) {
            // 找第一个<字符
            let textEnd = html.indexOf('<')
            // textEnd === 0 说明在开头找到了
            // 分别处理可能找到的注释标签、条件注释标签、Doctype、开始标签、结束标签
            // 每处理完一种情况，就会截断(continue)循环，并且重置html字符串，将处理过的标签截断，下一次循环处理剩余的html字符串模板
            if (textEnd === 0) {
                // Comment:
                // 处理注释标签 <!-- xx -->
                if (comment.test(html)) {
                    // 注释标签的结束索引
                    const commentEnd = html.indexOf('-->')

                    if (commentEnd >= 0) {
                        // 是否保留注释
                        if (options.shouldKeepComment) {
                            // 得到注释内容、注释的开始索引、结束索引
                            options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
                        }
                        // 调整html 和 index变量
                        advance(commentEnd + 3)
                        continue
                    }
                }

                // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
                // 处理条件注释标签：<!--[if IE]>

                if (conditionalComment.test(html)) {
                    // 找到结束为止
                    const conditionalEnd = html.indexOf(']>')

                    if (conditionalEnd >= 0) {
                        // 调整html和index变量
                        advance(conditionalEnd + 2)
                        continue
                    }
                }

                // Doctype:
                // 处理doctype，<!DOCTYPE html>
                const doctypeMatch = html.match(doctype)
                if (doctypeMatch) {
                    advance(doctypeMatch[0].length)
                    continue
                }

                // 处理开始标签和结束标签是整个函数的核心部分
                // 这两部分就是构造 element ast

                // End tag:
                // 处理结束标签，比如 </div>
                const endTagMatch = html.match(endTag)
                if (endTagMatch) {
                    const curIndex = index
                    advance(endTagMatch[0].length)
                    // 处理结束标签
                    parseEndTag(endTagMatch[1], curIndex, index)
                    continue
                }

                // Start tag:
                // 处理开始标签，比如 <div id="app">，startTagMatch = { tagName: 'div', attrs: [[xx], ...], start: index }
                const startTagMatch = parseStartTag()
                if (startTagMatch) {
                    // 进一步处理上一步得到结果，并最后调用 options.start 方法
                    // 真正的解析工作都是在这个 start 方法中做的
                    handleStartTag(startTagMatch)
                    if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
                        advance(1)
                    }
                    continue
                }
            }

            let text, rest, next
            if (textEnd >= 0) {
                // 能走到这里说明在html中匹配到了 < xx，但这不属于上述几种情况
                // 它就只是一个普通的一段文本: <我是文本
                // 是从html中找到下一个<, 直到<xx是上述几种情况的标签， 则结束
                // 在这整个过程中一直在调整textEnd的值，作为html中下一个有效标签的开始位置
                // 截取html模板字符串textEnd之后的内容，rest = <xx
                rest = html.slice(textEnd)
                // 这个while循环就是处理<xx 之后的纯文本情况
                // 截取文本内容，并找到有效标签开始位置 textEnd

                // 剩余的模板不符合任何需要被解析的片段，说明<是文本的一部分，
                // 继续循环找到下一个 <, 并将其前面的文本截取出来加到前面截取了一半的文本后面
                // 重复此过程直到，所有文本都解析完
                while (
                    !endTag.test(rest) &&
                    !startTagOpen.test(rest) &&
                    !comment.test(rest) &&
                    !conditionalComment.test(rest)
                ) {
                    // < in plain text, be forgiving and treat it as text
                    // 则认为 < 后面的内容为纯文本，然后在这些纯文本中再次找<
                    next = rest.indexOf('<', 1)
                    // 如果没找到 < ,则直接循环结束
                    if (next < 0) break
                    // 走到这里说明在后续的字符串中找到了<,索引位置为next
                    textEnd += next
                    // 截取html字符串模板textEnd之后的内容赋值给rest,继续判断之后的字符串是否存在标签
                    rest = html.slice(textEnd)
                }
                // 走到这里说明遍历结束，有两种情况，一种是 < 之后就是一段纯文本，要不就是在后面找到了有效标签，截取文本
                text = html.substring(0, textEnd)
            }

            // 如果textEnd < 0,说明html中没有找到<,那说明html就是一段文本
            if (textEnd < 0) {
                text = html
            }

            // 将文本内容从html模板字符串中截取掉
            if (text) {
                advance(text.length)
            }

            // 处理文本
            // 基于文本生成ast对象，然后将该ast放到它的父元素的肚子里
            // 即currentParent.children数组中
            if (options.chars && text) {
                options.chars(text, index - text.length, index)
            }
        } else {
            // 处理script、style、textarea标签的闭合标签
            let endTagLength = 0
            // 开始标签的小写形式
            const stackedTag = lastTag.toLowerCase()
            const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
            // 匹配并处理开始标签和结束标签之间的所有文本，比如 <script>xx</script>
            const rest = html.replace(reStackedTag, function (all, text, endTag) {
                endTagLength = endTag.length
                if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
                    text = text
                        .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
                        .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
                }
                if (shouldIgnoreFirstNewline(stackedTag, text)) {
                    text = text.slice(1)
                }
                if (options.chars) {
                    options.chars(text)
                }
                return ''
            })
            index += html.length - rest.length
            html = rest
            parseEndTag(stackedTag, index - endTagLength, index)
        }

        // 到这里就处理结束，如果stack数组中还有内容，则说明有标签没有被闭合，给出提示
        if (html === last) {
            options.chars && options.chars(html)
            if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
                options.warn(`Mal-formatted tag at end of template: "${html}"`, { start: index + html.length })
            }
            break
        }
    }

    // Clean up any remaining tags
    parseEndTag()

    // 重置html，html = 从索引 n 位置开始的向后的所有字符
    // index为html在原始的模板字符串中的开始索引，也就是下一次该处理的字符的开始位置
    function advance (n) {
        index += n
        html = html.substring(n)
    }

    // 解析分为三部分: 解析标签名，属性，结尾
    // 解析开始标签， 比如： <div id="app" >
    // @returns { tagName: 'div', attrs: [[xx], ...], start: index }
    // 如果不符合开始标签的正则表达式规则，返回undefined
    function parseStartTag () {
        // step1： 解析标签名
        const start = html.match(startTagOpen)
        if (start) {
            // 处理结果
            const match = {
                // 标签名
                tagName: start[1],
                // 属性，占位符
                attrs: [],
                // 标签的开始位置
                start: index
            }
            // 调整html和index.比如：
            // html = ' id="app">'
            // index = 此时的索引
            // start[0] = '<div'
            advance(start[0].length)
            let end, attr

            // step2： 解析标签属性
            // 解析标签属性
            // 处理开始标签内的各个属性，并将这些属性放到match.attrs数组中
            // 每解析一个属性，就截取一个属性。直到剩余的模板不存在属性
            while (!(end = html.match(startTagClose)) && (attr = html.match(dynamicArgAttribute) || html.match(attribute))) {
                // 当前属性的开始位置
                attr.start = index
                // 移动index指针，截取掉当前属性
                advance(attr[0].length)
                //当前属性的结束位置(最后一个元素的索引 + 1)
                attr.end = index
                // 添加到返回结果集中
                match.attrs.push(attr)
            }
            // step3： 解析标签结尾，判断是否是自闭和标签
            // 开始标签的结束，end = '>' 或 end = ' />'
            if (end) {
                // unarySlash: '' 或 unarySlash： ‘/’
                // 标识开始标签是否是自闭和标签
                match.unarySlash = end[1]
                // 移动index指针，截取掉当前属性
                advance(end[0].length)
                // 标签的结束位置
                match.end = index
                return match
            }
        }
    }

    // 进一步处理开始标签的解析结果----match对象
    // 1.处理属性match.attrs，如果不是自闭和标签，则将标签信息放到stack数组，待将来处理到它的闭合标签再将其弹出stack
    // 表示该标签处理完毕，这时标签的所有信息都在element ast对象上
    // 2.接下来调用options.start方法处理标签，并根据标签信息生成element ast，
    // 以及处理开始标签上的属性和指令，最后将element ast 放入 stack数组
    // @param {*} match { tagName: 'div', attrs: [[xx], ...], start: index }
    function handleStartTag (match) {
        const tagName = match.tagName
        const unarySlash = match.unarySlash

        if (expectHTML) {
            if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
                parseEndTag(lastTag)
            }
            if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
                parseEndTag(tagName)
            }
        }

        // 一元标签 比如 <hr />
        const unary = isUnaryTag(tagName) || !!unarySlash

        // 处理match.attrs,得到 attrs = [{ name: attrName, value: attrVal, start: xx, end: xx }, ...]
        // 比如 atts = [{ name: 'id', value: 'app', start: xx, end: xx }, ...]
        const l = match.attrs.length
        const attrs = new Array(l)
        for (let i = 0; i < l; i++) {
            const args = match.attrs[i]
            // 比如：args[3] => 'id'，args[4] => '='，args[5] => 'app'
            const value = args[3] || args[4] || args[5] || ''
            const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
                ? options.shouldDecodeNewlinesForHref
                : options.shouldDecodeNewlines
            // attrs[i] = { id: 'app' }
            attrs[i] = {
                name: args[1],
                value: decodeAttr(value, shouldDecodeNewlines)
            }
            // 非生产环境，记录属性的开始和结束索引
            if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
                attrs[i].start = args.start + args[0].match(/^\s*/).length
                attrs[i].end = args.end
            }
        }

        // 如果不是自闭和标签，则将标签信息放到stack数组中，待将来处理到它的闭合标签时再将其弹出stack
        // 如果是闭合标签，则标签信息就没必要进去stack了，直接处理众多属性，将它们都设置到element ast对象上
        // 就没有处理结束标签的那一步了，这一步在处理开始标签的过程中就进行了
        if (!unary) {
            // 将标签信息放到stack数组中，{ tag, lowerCasedTag, attrs, start, end }
            stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs, start: match.start, end: match.end })
            // 标识当前标签的结束标签为 tagName
            lastTag = tagName
        }

        // 调用start方法，主要做了以下6件事
        // 1.创建AST对象
        // 2.处理存在v-model指令的input标签，分别处理input为checkbox, radio, 其他情况
        // 3.处理标签上的众多指令，比如 v-pre,v-for,v-if,v-once
        // 4.如果根节点root不存在则设置当前元素为根节点
        // 5.如果当前元素为非自闭和标签，则将自己push到stack数组中，并记录currentParent，在接下来处理子元素时告诉子元素自己的父节点是谁
        // 6.如果当前元素为自闭和标签，则表示该标签要处理结束了，让自己和父元素产生关系，以及设置自己的子元素
        if (options.start) {
            options.start(tagName, attrs, unary, match.start, match.end)
        }
    }

    // 解析结束标签，比如: </div>
    // 最主要的就是:
    // 1、处理stack数组， 从stack数组中找到当前结束标签对应的开始标签， 然后调用options.end方法
    // 2、处理完结束标签后调整stack数组，保证在正常情况下stack数组中最后一个元素就是下一个结束标签对应的开始标签
    // 3、处理一些异常情况，比如stack数组中最后一个元素不是当前结束标签对应的开始标签，还有就是 br和p标签单独处理
    // @param {*} tagName 标签名，比如 div
    // @param {*} start 结束标签的开始索引
    // @param {*} end 结束标签的结束索引
    function parseEndTag (tagName, start, end) {
        let pos, lowerCasedTagName
        if (start == null) start = index
        if (end == null) end = index

        // 倒叙遍历stack数组，找到第一个和当前结束标签相同的标签，该标签就是结束标签对应的开始标签的描述对象
        // 理论上，不出异常，stack数组中的最后一个元素就是当前结束标签对应的开始标签的描述对象
        // Find the closest opened tag of the same type
        if (tagName) {
            lowerCasedTagName = tagName.toLowerCase()
            for (pos = stack.length - 1; pos >= 0; pos--) {
                if (stack[pos].lowerCasedTag === lowerCasedTagName) {
                    break
                }
            }
        } else {
            // If no tag name is provided, clean shop
            pos = 0
        }

        // 如果在stack中一直没找到相同的标签名，则pos 就会< 0，进行后面的else分支
        if (pos >= 0) {
            // 这个for循环负责关闭stack数组中索引 >= pos的所有标签
            // 为什么要用一个循环，上面说到正常情况下stack数组的最后一个元素就是我们要找的开始标签
            // 但是有些异常情况，就是有些元素没有提供结束标签，比如：
            // stack = ['span', 'div', 'span', 'h1']，当前处理的结束标签tagName = div  
            // 匹配到div,pos = 1, 那索引为2和3的两个标签span、h1说明就没提供结束标签
            // 这个for循环负责关闭div、span、h1这三个标签
            // 并在开发环境为span和h1这两个标签给出 “未匹配到结束标签的提示”
            // Close all the open elements, up the stack
            for (let i = stack.length - 1; i >= pos; i--) {
                if (process.env.NODE_ENV !== 'production' &&
                    (i > pos || !tagName) &&
                    options.warn
                ) {
                    options.warn(
                        `tag <${stack[i].tag}> has no matching end tag.`,
                        { start: stack[i].start, end: stack[i].end }
                    )
                }
                if (options.end) {
                    // 走到这里说明，上面的异常情况处理完了，调用options.end处理正常的结束标签
                    options.end(stack[i].tag, start, end)
                }
            }

            // Remove the open elements from the stack
            // 将刚才处理的那些标签从数组中移除，保证数组的最后一个元素就是下一结束标签对应的开始标签
            stack.length = pos
            // lastTag记录数组中未处理的最后一个开始标签
            lastTag = pos && stack[pos - 1].tag
        } else if (lowerCasedTagName === 'br') {
            // 当前处理的标签为br标签
            if (options.start) {
                options.start(tagName, [], true, start, end)
            }
        } else if (lowerCasedTagName === 'p') {
            // p标签
            if (options.start) {
                // 处理<p>标签
                options.start(tagName, [], false, start, end)
            }
            if (options.end) {
                // 处理</p>标签
                options.end(tagName, start, end)
            }
        }
    }
}
