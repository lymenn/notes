/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

export function createCompilerCreator (baseCompile: Function): Function {
    return function createCompiler (baseOptions: CompilerOptions) {

        // 编译函数，做了两件事
        // 1.选项合并，将options配置项合并到finalOptions(baseOptions), 得到最终的编译配置对象
        // 2.调用核心编译器baseCompile得到编译结果
        // 3.将编译器产生的error和tip挂载到编译结果上，返回编译结果
        function compile (
            template: string,
            options?: CompilerOptions
        ): CompiledResult {
            // 以平台特有的编译配置为原型创建编译选项对象
            const finalOptions = Object.create(baseOptions)
            const errors = []
            const tips = []

            // 日志，负责记录error和tip
            let warn = (msg, range, tip) => {
                (tip ? tips : errors).push(msg)
            }

            // 如果存在编译选项，合并options和baseOptions
            if (options) {

                if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
                    // $flow-disable-line
                    const leadingSpaceLength = template.match(/^\s*/)[0].length

                    // 增强日志方法
                    warn = (msg, range, tip) => {
                        const data: WarningMessage = { msg }
                        if (range) {
                            if (range.start != null) {
                                data.start = range.start + leadingSpaceLength
                            }
                            if (range.end != null) {
                                data.end = range.end + leadingSpaceLength
                            }
                        }
                        (tip ? tips : errors).push(data)
                    }
                }
                // merge custom modules
                // 将options中的配置项和并到finalOptions

                // 合并自定义module
                if (options.modules) {
                    finalOptions.modules =
                        (baseOptions.modules || []).concat(options.modules)
                }
                // merge custom directives
                // 合并自定义指令
                if (options.directives) {
                    finalOptions.directives = extend(
                        Object.create(baseOptions.directives || null),
                        options.directives
                    )
                }
                // copy other options
                // 拷贝其他配置项
                for (const key in options) {
                    if (key !== 'modules' && key !== 'directives') {
                        finalOptions[key] = options[key]
                    }
                }
            }

            // 日志
            finalOptions.warn = warn

            // 到这里终于到重点了，调用核心编译函数，传递模板字符串和最终的编译选项，得到编译结果
            // 前面所做的所有事情都是为了构建平台最终的编译选项
            const compiled = baseCompile(template.trim(), finalOptions)
            if (process.env.NODE_ENV !== 'production') {
                detectErrors(compiled.ast, warn)
            }
            // 将编译产生的错误和提示挂载到编译结果上
            compiled.errors = errors
            compiled.tips = tips
            return compiled
        }

        return {
            compile,
            compileToFunctions: createCompileToFunctionFn(compile)
        }
    }
}
