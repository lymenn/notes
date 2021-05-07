Function.prototype.myBind = function(context, ...args){
    const thisFn = this
    let bindFn = function(...bindArgs){
        context = (this instanceof bindFn)  ? this : Object(context)
        return thisFn.call(context, ...args, ...bindArgs)
    }
    if(thisFn.prototype){
        bindFn.prototype = Object.create(thisFn.prototype)
    }
    return bindFn
}