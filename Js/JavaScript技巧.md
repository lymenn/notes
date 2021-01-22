### 判断对象的数据类型
```js
const isType = type => target => Object.prototype.toString.call(target) === `[object ${type}]`
isType('Array')([])
```
### 循环实现数组map方法
```js
const selfMap = function(fn, context){
    const newArr = Array.prototype.slice.call(this)
    for(let i = 0, len = newArr.length; i < len; i++ ){
        if(!newArr.hasOwnProperty(i)) continue;
        newArr[i] = fn.call(context, newArr[i], i,this)
    }
    return newArr
}
// selfMap 注入到 Array.prototype 上
Array.prototype.selfMap = selfMap
let a = [1, 2, 3]
let b = a.selfMap(function (item, index, arr) {
    return item * 2
})
```
- map的第二个参数为第一个参数回调中的this指向,如果第一个参数为箭头函数，那么设置第二个this会因为箭头函数的词法绑定而失效
- 另外就是对稀疏数组的处理，通过hasOwnProperty判断当前下标的是否存在于数组中 
### 使用 reduce 实现数组 map 方法
```js
const selfMap2 = function(fn, context){
    let arr = Array.prototype.slice.call(this)
    return arr.reduce(function(pre, cur, index){
        console.log(pre, 22)
        return pre.push(fn.call(context, cur, index, arr))
    }, [])
}
Array.prototype.selfMap2 = selfMap2
let a = [1, 2, 3]
let b = a.selfMap2(function (item, index, arr) {
    return item * 2
})
```
### 循环实现数组 filter 方法
```js
const selfFilter = function(fn, context){
    let arr = Array.prototype.slice.call(this)
    let newArr = []
    for(let i =0, len = arr.length; i < len; i++){
        if(arr.hasOwnProperty(i) && fn.call(context, arr[i], i, arr)) newArr.push(arr[i])
    }
    return newArr
}
Array.prototype.selfFilter = selfFilter
function checkAdult(age) {
    return age >= 18;
}
var ages = [32, 33, 16, 40];
let adult = ages.selfFilter(checkAdult);
console.log(adult)
```

### 使用 reduce 实现数组 filter 方法
```js
const selfFilter2 = function(fn, context){
    const arr = Array.prototype.slice.call(this)
    return arr.reduce(function(pre, cur, index){
        return fn.call(context, cur, index, arr) ? [...pre, cur]: [...pre]
    }, [])
}
Array.prototype.selfFilter2 = selfFilter2
function checkAdult(age) {
    return age >= 18;
}
var ages = [32, 33, 16, 40];
let adult = ages.selfFilter2(checkAdult);
console.log(adult)
```
### 循环实现数组的 some 方法
```js
const selfSome = function(fn, context){
    let arr = Array.prototype.slice.call(this)
    for(let i =0, len = arr.length; i < len; i++){
        if(arr.hasOwnProperty(i) && fn.call(context, arr[i], i, arr)){
            return true
        }
    return false
}
```
### 循环实现数组的 reduce 方法
```js
Array.prototype.reduce = function(fn, initValue){
    let arr = Array.prototype.slice.call(this)
    let startIndex = 0
    let res
    if(!initValue){
        for(let i =0, len = arr.length; i < len; i++){
            if(arr.hasOwnProperty(i)){
                initValue = arr[i]
                startIndex = i
                break
            }
        }
    }
    res = initValue
    for(let i = ++ startIndex, len = arr.length; i < len; i++){
        if(arr.hasOwnProperty(i)){
            res = fn.call(null, arr[i], index, arr)
        }
    }
    return res
}
```
### 使用 reduce 实现数组的 flat 方法
```js
Array.prototype.selfFlat = function(depth = 1){
    let arr = Array.prototype.slice.call(this)
    if(depth === 0) return arr
    return arr.reduce((pre, cur)=>{
        if(Array.isArray(cur)){
            return [...pre, ...Array.prototype.selfFlat.call(cur, depth -1)]
        }
        return [...pre, cur]
    }, [])
}
```