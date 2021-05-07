Function.prototype.myApply = function(context){
    context = (context === null || context === undefined ) ? window : Object(context)
    const FN = Symbol()
    context[FN] = this
    let args = arguments[1]
    if(!Array.isArray(args)){
        throw new TypeError('参数二必须为数组')
    }
    let res = context[FN](...args)
    delete context[FN]
    return res
}