// https://github.com/lymenn/articles/blob/master/2017/JavaScript%E5%9F%BA%E7%A1%80%E5%BF%83%E6%B3%95%E2%80%94%E2%80%94%E6%B7%B1%E6%B5%85%E6%8B%B7%E8%B4%9D.md
// 赋值运算符 = 实现的是浅拷贝，只拷贝对象的引用值
// Javascript中对象和数组自带的方法都是“首层浅拷贝”
// JSON.stringfy实现的是深拷贝,但是要求目标对象是json安全的。即undefined，function(){}, symbol在转换过程中会被忽略

const mapTag = '[object Map]';
const setTag = '[object Set]';
const arrayTag = '[object Array]';
const objectTag = '[object Object]';
const argsTag = '[object Arguments]';

const boolTag = '[object Boolean]';
const dateTag = '[object Date]';
const numberTag = '[object Number]';
const stringTag = '[object String]';
const symbolTag = '[object Symbol]';
const errorTag = '[object Error]';
const regexpTag = '[object RegExp]';
const funcTag = '[object Function]';


const deepTag = [mapTag, setTag, arrayTag, objectTag, argsTag];


const deepClone = (target, map = new WeakMap()) => {
    //克隆原始数据类型
    if(!isObject(target)){
        return target
    }1
    //初始化
    const type = getType(target)
    let cloneTarget;
    if(deepTag.includes(type)){
        cloneTarget = getInit(target)
    } else{
        return cloneOtherType(target, type)
    }

    // 防止循环引用
    if(map.has(target)) return map.get(target)
    map.set(target, cloneTarget)

    //clone set
    if(type === setTag){
        target.forEach(value => {
            cloneTarget.add(deepClone(value, map))
        });
        return cloneTarget
    }
    //clone map
    if(type === mapTag){
        target.forEach((value, key) => {
            cloneTarget.set(key, deepClone(value, map))
        })
        return cloneTarget
    }
    // clone object array
    for(let key in target){
       cloneTarget[key] = deepClone(target[key], map)
    }
    return cloneTarget
}
function cloneOtherType(target, type){
    const Ctor = target.constructor
    switch(type){
        case boolTag:
        case numberTag:
        case stringTag:
        case errorTag:
        case dateTag:
        case regexpTag:
            return new Ctor(target)
        case funcTag:
            return cloneFunction(target)
        default:
            return null
    }
}
function cloneFunction(target){
    
}
function getInit(target){
    let Ctor = target.constructor
    return new Ctor()
}
function isObject(target){
    let type = typeof target
    return target !== null && (target === 'function' || target === 'object')
}
function getType(target){
    return Object.prototype.toString.call(target)
}

