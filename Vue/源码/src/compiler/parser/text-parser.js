/* @flow */

import { cached } from 'shared/util'
import { parseFilters } from './filter-parser'

const defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

const buildRegex = cached(delimiters => {
    const open = delimiters[0].replace(regexEscapeRE, '\\$&')
    const close = delimiters[1].replace(regexEscapeRE, '\\$&')
    return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

type TextParseResult = {
    expression: string,
    tokens: Array<string | { '@binding': string }>
}

//处理文本节点
export function parseText (
    text: string,
    delimiters?: [string, string]
): TextParseResult | void {
    const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
    // 纯文本直接返回
    if (!tagRE.test(text)) {
        return
    }
    const tokens = []
    const rawTokens = []
    let lastIndex = tagRE.lastIndex = 0
    let match, index, tokenValue
    while ((match = tagRE.exec(text))) {
        index = match.index
        // push text token
        // 先把{{前边的文本添加到tokens中
        if (index > lastIndex) {
            rawTokens.push(tokenValue = text.slice(lastIndex, index))
            tokens.push(JSON.stringify(tokenValue))
        }
        // tag token
        const exp = parseFilters(match[1].trim())
        // 把变量改成_s(x)这样的形式也添加到数组中
        tokens.push(`_s(${exp})`)
        rawTokens.push({ '@binding': exp })

        // 设置lastIndex来保证下一轮循环时，正则表达式不再匹配已经解析过的文本
        lastIndex = index + match[0].length
    }
    // 当所有变量都处理完毕后，如果最后一个变量右边还有文本，将文本添加到数组中
    if (lastIndex < text.length) {
        rawTokens.push(tokenValue = text.slice(lastIndex))
        tokens.push(JSON.stringify(tokenValue))
    }
    // tokens 'hello {name}' => tokens = ['hello ', '_s(name)']
    return {
        expression: tokens.join('+'),
        tokens: rawTokens
    }
}
