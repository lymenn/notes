// 新生成一个空对象
// 将空对象链接到原型中
// 绑定this
// 返回新对象
function myNew(ctor, ...args){
    if(typeof ctor !== 'function'){
        throw new Error('参数一必须为函数')
    }
    let obj = Object.create(ctor.prototype)
    obj.__proto__ = ctor.prototype
    let ret = ctor.apply(obj, args)
    
    return ret instanceof Object ? ret: obj
}