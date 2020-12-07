  call apply bind 三者都可以改变函数体内this的指向，这三个方法有什么区别呢？它们的适用场景又是哪些？
  - 三者都是用来改变函数this的指向
  - 三者的第一个参数都是this指向的对象
  - bind是返回一个绑定函数可稍后指向，call、apply是立即调用
  - 三者都可以给定参数传递
  - call的参数需要全部列出，apply给定参数数组
## call
- 不传，或者传null,undefined,函数中的this在非严格模式下指向window
- 传递另一个函数的函数名，函数中的this指向这个函数的引用
- 传递一个原始值时，this会指向该原始值的自动包装对象。如String,Number,Boolean
#### 应用场景
1. 继承
   ```js
   function Person(name, weight){
       this.name = name
       this.weight = weight
       this.say = function(){
           console.log('姓名:' + this.name)
           console.log('体重:' + this.weight)
       }
   }

   function Student(name, age, job){
       // call中的this作为thisargs参数传递
       // Person方法中的this就指向了Student中的this
       // 所以，Person中的this就指向了Student中的this的对象
       // Person中定义的name和weight，就相当于在Student的this对象上定义了这些属性
       // 最后，返回this对象
       Person.call(this, name, age)
       this.job = job
       this.say = function(){
           console.log('姓名:' + this.name)
           console.log('体重:' + this.weight)
           console.log('工作:' + this.job)
       }
   }
   let stu = new Student('tangem', 20, '学生')
   ```
2. 数组方法
   ```js
    var array1 = [12 , "foo" , {name "Joe"} , -2458]; 
    var array2 = ["Doe" , 555 , 100]; 
    Array.prototype.push.apply(array1, array2);

    var  numbers = [5, 458 , 120 , -215 ]; 
    maxInNumbers = Math.max.call(Math,5, 458 , 120 , -215); 
   ```
3. 代理log方法
   ```js
   function log(){
       let args = Array.prototype.slice.call(arguments)
       args.unshift('app:')
       console.log.apply(console, args)
   }
   log(1,2,3) // app: 1,2,3
   ```
## apply
- 与call基本相同
## bind
bind()方法会创建一个新函数，称为绑定函数，当调用这个绑定函数时，绑定函数会以创建它时传入的第一个参数作为this，传入bind（）方法的第二个及以后的参数加上绑定函数运行时本身的参数序列作为原函数的参数调用原函数
- bind是ES5新增的一个方法，该方法会创建一个函数（绑定函数）
- 传参和call或apply类似
- 不会执行对应的函数，call和apply会执行对应的函数
- 返回对函数的引用
## 模拟实现
- Call
  Call改变了函数this的指向，并且执行了该函数
```js
Function.prototype.myCall = function(ctx){
    ctx = ctx || window
    ctx.fn = this
    let args = []
    for(let i = 1,len = arguments.length; i < len; i++){
        args.push('arguments['+i+']')
    }
    let result = eval('ctx.fn(' + args.join(',') +')')
    delete ctx.fn
    return result
}
var value = 2;

var obj = {
    value: 1
}
function bar(name, age) {
    console.log(this.value);
    return {
        value: this.value,
        name: name,
        age: age
    }
}
bar.myCall(null); // 2
console.log(bar.myCall(obj, 'kevin', 18));

```
- Apply
```js
Function.prototype.myApply = function(ctx, arr){
    ctx = Object(ctx) || window
    ctx.fn = this
    arr = arr || []
    var args = []
    for(let i=0,len = arr.length; i< len;i++){
        args.push('arr['+i+']')
    }
    result =eval('ctx.fn(' + args+ ')')
    delete ctx.fn
    return result
}

function person(name, age){
    console.log(name, age)
}
```

- Bind
  创建并返回了一个绑定this的函数且可传入参数
```js
Function.prototype.myBind = function(ctx){
    let self = this
    let args = [].slice.call(arguments, 1)
    var fnop = function(){}

    var fbound =  function (){
        let bindArgs = [].slice.call(arguments)
        self.apply(this instanceof self ? this: ctx, args.concat(bindArgs))
    }


    fnop.prototype = this.prototype
    //我们直接修改fbound.prototype = this.prototype，会修改函数的prototype。利用一个空函数中转
    // fbound.prototype = this.prototype
    fbound.prototype = new fnop()
    return fbound
}
```
  
