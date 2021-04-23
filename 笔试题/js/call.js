Function.prototype.myCall = function(context, ...args){
    context = (context === undefined || context === null) ? window: Object(context)
    const FN = Symbol() // 用于临时存储函数
    context[FN] = this  // 函数保存在上下文的FN属性中
    let res = context[FN](...args) // 通过隐式绑定执行函数并传递参数
    delete context[FN] // 删除上下文对象的属性
    return res
}