/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(
    // 在这之前所做的所有事情，只有一个目的，就是为了构建平台特有的编译选项(options), 比如web平台

    // 1.将html解析成ast
    // 2.对ast进行静态标记
    // 3.将ast生产渲染函数
    //     静态渲染函数放到 code.staticRenderFns数组中
    //     code.render为动态渲染函数
    //     在将来渲染时执行渲染函数得到vnode
    function baseCompile (
        template: string,
        options: CompilerOptions
    ): CompiledResult {
        // 将模板解析为ast,每个节点的ast对象上都设置了元素的所有信息。比如标签信息，属性信息，插槽信息，父节点，及节点等
        // 具体有哪些属性查看start和end这两个处理开始和结束标签的方法
        const ast = parse(template.trim(), options)
        // 优化，遍历ast，为每个节点静态标记
        // 标记每个节点是否为静态节点然后进一步标记出静态根节点
        // 这样在后续更新中就可以跳过这些静态节点了
        // 标记静态跟，用于生成渲染函数阶段，生成静态根节点的渲染函数
        if (options.optimize !== false) {
            optimize(ast, options)
        }
        // 代码生成，将 ast 转换成可执行的 render 函数的字符串形式
        // code = {
        //   render: `with(this){return ${_c(tag, data, children, normalizationType)}}`,
        //   staticRenderFns: [_c(tag, data, children, normalizationType), ...]
        // }

        const code = generate(ast, options)
        return {
            ast,
            render: code.render,
            staticRenderFns: code.staticRenderFns
        }
    })
