## new
new运算符创建一个用户定义的对象类型的实例或具有构造函数内置对象类型之一  
也许有点难懂，在模拟new之前，我们看看new实现了哪些功能  
举个例子  
```js
function Okatu(name, age){
    this.name = name 
    this.age = age

    this.habit = 'games'
}
Okatu.prototype.strenth = 60
Okatu.prototype.sayName = function(){
    console.log(this.name)
}
var p = new Okatu('tangem', 18)
console.log(p.name)
console.log(p.habit)
console.log(p.strenth)

p.sayName()

```

从这个例子中我们可以看到,实例p可以:  
    1. 访问到构造函数中的属性  
    2. 访问到Okatu.prototype中的属性  
接下来我们可以尝试模拟下  
因为new是关键字，我们无法像bind函数那样直接覆盖，所以我们写一个函数，命名为objectFactory,来模拟new的效果。用的时候是这样的:
```js
function Okatu(){
    ...
}
// 使用 new 
var p = new Okatu(...)
// 使用objectFactory
var p = objectFactory(Okatu, ...)
```
## 初步实现  
分析:
因为new的结果是一个新对象，所以在模拟实现的时候我们也要建立一个新对象。假设这个对象叫做obj,因为obj具有Okatu构造函数中的属性，想想经典继承的例子，我们可以使用Okatu.apply(obj, arguments)来给obj添加新的属性  
我们知道实例的__proto__属性会指向构造函数的prototype,也正是因为这样的关系，实例可以访问原型上的属性  
现在，我们来看第一版  
```js
function objectFactory(){
    var obj = new Object()
    var Constructor = [].shift.call(arguments)
    obj.__proto__ = Constructor.prototype
    // 不能使用 obj.prototype = Constructor.prototype 相当于修改了Object构造函数的原型
    Constructor.apply(obj, arguments)

    return obj
}
```
在这一版中，我们:  
    1. 用new Object()的方式创建了一个对象obj
    2. 取出第一个参数，也就是传入的构造函数。此外因为shift会修改原数组，所以arguments会被去除第一个参数
    3. 将obj的原型指向构造函数，这样obj就可以访问到构造函数中原型
    4. 使用apply，改变构造函数的this指向到新建的对象，这样obj就可以访问到构造函数中的属性
    5. 返回obj
## 返回值效果
接下来我们来看一种情况，假如构造函数有返回值，举个例子：
```js
function Okatu(name, age){
    this.strength = 60
    this.name = name
    return {
        age: age,
        habit: 'games'
    }
}

var p = new Okatu('tangem', 67)
console.log(p.name) //undefined
console.log(p.habit) //games
console.log(p.strength) //undefined
console.log(p.age) // 67
```
在这个例子中，构造函数返回了一个对象，实例p中只能访问返回对象中的属性。 
假如我们返回了一个基本数据类型的值呢？  
在来个例子:  
```js
function Okatu(name, age){
    this.strength = 60;
    this.age = age;

    return 'handsome boy';
}

var p = new Okatu('tangem', 78)
console.log(p.name) // undefined
console.log(p.habit) // undefined
console.log(p.strength) // 60
console.log(p.age) // 18
```
结果完全颠倒过来，这次有返回值，但是相当于没有返回值进行处理。
所以我们要判断返回值是不是一个对象，如果是一个对象，我们就返回对象，如果不是对象我们就返回自己创建的对象  
最后一版的代码
```js
function objectFactory(){
    var obj = new Object()

    var Constructor = [].shift.call(arguments)

    obj.__proto__ = Constructor.prototype

    var ret = Constructor.apply(obj, arguments)
    
    return typeof ret === 'object' ? ret : obj

}
```