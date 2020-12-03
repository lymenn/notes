# this
this的指向，是在函数被调用的时候确定的，也就是创建执行上下文

## 全局环境的this  
全局环境中的this指向全局对象。

## 函数中的this  
在函数的上下文中，this由调用者提供，由调用函数的方式来决定。如果被调用函数被一个对象所拥有的，那么该函数在调用时，内部的this指向该对象.如果函数独立调用，那么函数内部的this，严格模式下为undefined，非严格模式下指向全局对象。
```js
'use strict'
function fn(){
    console.log(this)
}
fn() // undefined
window.fn() // window
```
fn()是严格模式下的独立调用，thi指向undefined。window.fn(),fn被window调用，this指向window  
再看例子，加深对调用者是否独立运行的理解
```js
var a = 20
var obj = {
    a: 10,
    getA: function(){
        console.log(this.a)
    }
}
obj.getA() // 10
var test = obj.getA
test() // 20
```
在obj.getA()中getA是调用者的，所以他不是独立调用，被obj对象所拥有，因此它的this指向了调用者obj.test()作为调用者，尽管他与obj.getA的引用相同，但它是独立调用，this指向undefined,非严格模式下指向window  
再来看一个例子
```js
function foo(){
    console.log(this.a)
}

function active(fn){
    fn()
}
var a = 20
var obj = {
    a: 10,
    getA: foo
}
active(obj.foo) // 20
```
active(obj.foo)中,obj.foo的真实调用者，为独立调用。严格模式下this指向undefined，非严格模式下指向window
## call apply bind 中的this
JS内部提供了一种机制，让我们可以手动设置this的指向。它们是call和apply和bind。所有的函数都具有这三个方法。它们除了参数略有不同外，其他功能完全一样。它们的第一个参数都为this将要指向的对象。  
根据自己的需要灵活的修改this的指向
```js
var foo = {
    name: 'joker',
    showName: function(){
        console.log(this.name)
    }
}

var bar = {
    name: 'bar'
}

foo.showName.call(bar) // bar
```
实现继承
```js
// 函数表达式创建函数，不存在函数提升，也就是函数调用必须在表达式之后。函数声明创建函数，存在函数提升，可以在定义之前调用函数
var Person = function(name, age){
    this.name = name
    this.age = age
    this.gender = ['woman', 'men']
}
var Student = function(name,age,high){
    Person.call(this, name, age)
    this.high = high
}

Student.prototype.message = function(){
      console.log('name:' + this.name + ', age:' + this.age + ', high:' + this.high + ', gender:' + this.gender[0] + ';');
} 
new Student('xiaom', '13', '199cm').message() //name:xiaom, age:13, high:199cm, gender:woman;
```
在Student构造函数中，借助call方法。将父级构造函数中的代码执行了一次，相当于将Person中的代码，在Student中复制了一份，其中的this指向为Student中new出来的实例对象。  
Student的构造函数等同于下
```js
var Student = function(name, age, high){
    this.name = name
    this.age = age
    this.gender = ['woman', 'man']
    // Person.call(this, name, age)这一句话相当于上面三句话
    this.high = high
}
```
## setTimeout中的this  
超时调用的代码都是在全局作用域中执行的，因此，函数中this在严格模式下指向undefined，非严格模式下指向window
## 构造函数与原型方法中this
在封装对面的时候，构造函数中的this和原型对象上方法的this指向又是怎么样的呢
```js
function Person(name, age){
    this.name = name
    this.age = age
}

Person.prototype.getName = function(){
    return this.name
}
var p1 = new Person('xiaom', 11)
p1.getName()
```
new操作符调用构造函数发生了什么？  
- 创建一个新的对象{}
- 将构造函数的this指向这个新对象。this = {}
- 执行构造函数的代码，为这个对象添加属性和方法 
- 返回新对象 return this

#### 三道面试题
```js
function Foo(){
    getName = function(){ alert(1) }
    return this
}

Foo.getName = function(){ alert(2) }
Foo.prototype.getName = function(){ alert(3) }
var getName = function(){ alert(4) }
function getName(){ alert(5) }
// 请输出以下结果
Foo.getName()
getName()
Foo().getName()
getName()
new Foo.getName()
new Foo().getName()
new new Foo().getName()
```
题目首先声明了一个Foo函数，接着给Foo函数添加了一个静态属性getName,存储了一个匿名函数.然后，给Foo的原型对象添加了一个getName的匿名函数。之后又通过函数表达式创建了一个getName函数，最后再声明了一个函数getName
- Foo.getName() 访问函数存储的静态属性。结果是2
- getName() 
  1. 创建全局上下文时，存在变量提升和函数声明提升。函数声明提升覆盖了变量提升。此时，getName = function(){ alert(5) }
  2. 当执行到 var getName = function(){ alert(4) }时，全局上下文中的变量对象中getName属性又被修改为 function(){ alert(4) }
  3. 执行getName(),变量对象中查找getName并输出4
- Foo().getName()  
  1. 先执行Foo()，执行Foo的上下文时，在当前的活动对象中没有找到getName属性。所以，在作用域链中查找，在父级的变量的对象中找到了getName属性并修改getName属性为function(){ alert(1) }
  2. return this。非严格模式下，函数的直接调用，this执行window，所以返回window对象。
  3. window.getName()。输出1
- getName()
  1. 输出1
- new Foo.getName()
  1. 根据运算符的优先级，new Foo.getName() 等价于 new (Foo.getName)()
  2. 调用Foo中的静态方法作为构造函数，输出2
- new Foo().getName()
  1. 等价于 (new Foo()).getName()
  2. 构造函数返回this，也就是实例化对象。
  3. 实例化对象上没有getName属性，在原型对象中查找到。输出3
- new new Foo().getName()
  1. 等价于new ((new Foo()).getName)()
  2. 先初始化Foo的实例化对象，然后将其原型上的getName函数作为构造函数再次new。  
```js
var person1 = {
    name: 'person1',
    show1: function(){
        console.log(this.name)
    },
    show2: () => console.log(this.name),
    show3: function(){
        function(){
            console.log( this.name)
        }
    },
    show4: function(){
        return () => console.log(this.name)
    }
}
var person2 = { name: 'person2' }


person1.show1()
person1.show1.call(person2)

person1.show2()
person1.show2.call(person2)

person1.show3()
person1.show3().call(person2)
person1.show3.call(person2)()

person1.show4()
person1.show4().call(person2)
person1.show4.call(person2)()
```
- person1.show1() person1调用show1，this指向person1输出person1
- person1.show1.call(person2) show1中的this指向person2，输出person2
- person1.show2()  
  备注: 箭头函数由于没有自身的this,所以this只能根据作用域链网上层查找，直到找到了一个绑定了this的作用域（最靠近箭头函数的普通函数作用域或者全局环境）。箭头函数this指向声明函数时，最靠近箭头函数的普通函数的this.但这个this也会因为调用普通函数时环境的不同而发生变化。导致这个现象的原因是，这个普通函数会产生一个闭包，将他的变量对象保存在这个箭头函数的作用域链中
  show2是个箭头函数，没有自己的this.沿着作用域链查找绑定了this的作用域。找到了window，this指向window。输出window
- person1.show2.call(person2)
  this的指向在定义时已经决定了，call不改变箭头函数this指向
- person1.show3()
  show3返回一个函数，最终执行环境是window。在全局环境中this === window.输出window
- person1.show3().call(person2)
  person1.show3()返回的函数，被call将内部的this指向到person2。输出person2
- person1.show3.call(person2)()
  show3的this指向person2，但是返回的函数this没变，指向环境还是全局上下文。输出window
- person1.show4()()
  1. 首先调用show4，show4的this指向person1  
  2. 执行到return （）=> console.log(this.name)时，由于箭头函数没有自己的this，查找父级绑定了this的上下文。也就是show4的this。然后返回
  3. 执行箭头函数输出person1
- person1.show4().call(person2)
  this的指向在定义的时候已经确定，call不改变箭头函数this指向。输出perosn1
- perons1.show4.call(person2)()
  改变了箭头函数父级的this指向，因此，箭头函数的this同时也改变输出person2
```js
var name = 'window'
function Person(name){
    this.name = name
    this.show1 = function(){
        console.log(this.name)
    }
    this.show2 = () => { console.log(this.name) }
    this.show3 = function(){
        return function(){
            console.log(this.name)
        }
    }
    this.show4 = function(){
        return () => { console.log(this.name) }
    }
}

var personA = new Person('personA')
var personB = new Person('personB')

personA.show1()
personA.show1.call(personB)

personA.show2()
personA.show2.call(personB)

personA.show3()()
personA.show3().call(personB)
personA.show3.call(personB)()

personA.show4()()
personA.show4().call(personB)
personA.show4.call(personB)()
```
- personA.show1()
  this指向调用它的对象，输出personA
- personA.show1.call(personB)
  show1的this指向perosnB，输出personB
- personA.show2()
  箭头函数没有自己的this，在父级中找到了绑定this的Person的作用域。输出personA
- personA.show2.call(personB)
  this的指向在定义时已经决定了，call不改变箭头函数this指向
- personA.show3()()
  返回函数，执行环境是全局上下文。输出window
- personA.show3().call(personB)
  返回函数，执行环境是全局上下文，this指向personB。输出personB 
- personA.show3.call(personB)()
  只改变show3的this指向，但不改变返回的函数的this指向，输出window
- personA.show4()()
  返回的箭头函数this为show4中的this。输出personA
- personA.show4().call(personB)
  this的指向在定义时已经决定了，call不改变箭头函数this指向
- personA.show4.call(personB)()
  箭头函数定义时，父级的this指向了personB.输出personB
 


  

