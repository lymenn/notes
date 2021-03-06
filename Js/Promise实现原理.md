## 观察者模式
我们先来看一个简单的Promise使用:
```js
let p = new Promise(function(resolve, reject){
    setTimeout(function(){
        resolve('result')
    }, 1000)
})
p.then(res => console.log(res), err => console.log(err))
```
观察这个例子，我们分析Promise的调用过程:  
1. Promise的构造方法接收一个executer()，在new Promise（）时会立即执行这个executer回调.
2. executer()内部的异步任务放入宏/微任务队列，等待执行
3. then()被执行，收集成功/失败回调，放入成功/失败队列
4. executer()中的异步任务被执行，触发resolve/reject,从成功/失败队列中取出回调依次执行  
这种收集依赖-》触发通知-》取出依赖执行的方式，被广泛运用于观察者模式的实现。在Promise里，执行顺序是then()收集依赖-》异步出发resolve-》rosolve执行依赖。依此，我们勾勒出Promise的大致形状:
```js
class MyPromise{
    // 构造方法接收一个回调
    constructor(executor){
        this._resolveQueue = [] //then收集的执行成功的回调队列
        this._rejectQueue = [] // then收集的执行失败的回调队列
        // 由于resolve/reject是在executor内部调用，因此需要箭头函数固定this的指向,否则找不到this._resolveQueue
        let _resolve = val => {
            // 从成功队列里取出回调依次执行
            while(this._resolveQueue.length){
                const callback = this._resolveQueue.shift()
                callback(val)
            }
        }

        let _reject = val => {
            // 从失败队里里取出回调依次执行
            while(this._rejectQueue.length){
                const callback = this._rejectQueue.shift()
                callback(val)
            }
        }
        // new Promse()时立即执行executor，并传入resolve和reject
        executor(_resolve, _reject)
    }
    // 接收一个成功的回调和一个失败的回调，并push进对应的队列
    then(resolveFn, rejectFn){
        this._resolveQueue.push(resolveFn)
        this._rejectQueue.push(rejectFn)
    }
}
```
写完代码我们测试下
```js
let p = new MyPromise(function(resolve, reject){
    setTimeout(function(){
        resolve('result')
    }, 1000)
})
p.then(res => console.log(res) )
```
w我们运用观察者模式简单的实现了then和resolve，使我们能够给在then方法的回到里，取得异步操作的返回值。但这个Promise离我们最终实现还有很长的一段距离，下面一步步来补充这个Promise:
## Promise A+规范
上面我们已经简单的实现了一个超低配版的Promise，但是我们看到很多文章跟我们写的不一样，它们的Promise实现中还引入了各种状态控制。这是由于ES6的Promise实现需要遵循Promise A+规范，是规范对Promise的状态控制做了要求。Promise/A+规范比较长，这里只总结两条核心规则：  
1. Promise本质是一个状态机，且状态只能为以下三种: pending(等待态),fulfilled(执行态), rejected(拒绝态)，状态的变更是单向的，只能从pending-》fulfilled或pending-》rejected,状态变更不可逆
2. then方法接收两个可选参数，分别对应状态改变时触发的回调。then方法返回一个Promise,then方法可以被同一个Promise调用多次  
根据规范我们补充一下Promise的代码:
```js
// Promise/A+规范的三种状态
const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'
class MyPromise{
    // 构造方法接收一个回调
    constructor(executor){
        this._status = PENDING
        this._resolveQueue = [] //then收集的执行成功的回调队列
        this._rejectQueue = [] // then收集的执行失败的回调队列
        // 由于resolve/reject是在executor内部调用，因此需要箭头函数固定this的指向,否则找不到this._resolveQueue
        let _resolve = val => {
            if(this._status !== PENDING) return // 对应规范中的"状态只能由pending到fulfilled或pending到rejected"
            this._status = FULFILLED // 变更状态
            // 从成功队列里取出回调依次执行
            while(this._resolveQueue.length){
                const callback = this._resolveQueue.shift()
                callback(val)
            }
        }

        let _reject = val => {
            if(this._status !== PENDING) return // 对应规范中的"状态只能由pending到fulfilled或pending到rejected"
            this._status = REJECTED // 变更状态
            // 从失败队里里取出回调依次执行
            while(this._rejectQueue.length){
                const callback = this._rejectQueue.shift()
                callback(val)
            }
        }
        // new Promse()时立即执行executor，并传入resolve和reject
        executor(_resolve, _reject)
    }
    // 接收一个成功的回调和一个失败的回调，并push进对应的队列
    then(resolveFn, rejectFn){
        this._resolveQueue.push(resolveFn)
        this._rejectQueue.push(rejectFn)
    }
}
```
## then的链式调用
补充完规范，我们接着来实现链式调用，这是Promise实现的重点和难点，我们先来看下then是如何链式调用的:
```js
let p = new Promise(function(resolve, reject){
    setTimeout(function(){
        resolve(1)
    }, 1000)
})
p.then(res => {
    console.log(res)
    // then回调中可以return一个Promise
    return new Promise(function(resolve, reject){
        setTimeout(function(){
            resolve(2)
        }, 1000)
    })
}).then(res => {
    console.log(res)
    // then回调中也可以return一个值
    return 3
}).then(res => {
    console.log(res)
})
```
我们思考一下如何实现这种链式调用
1. 显然then需要返回一个Promise,这样才能找到then方法，所以我们会把then方法的返回值包装成Promise
2. then的回调需要拿到上一个then的返回值
3. then的回调需要顺序执行，以上面这段代码为例，虽然中间return了一个Promise,但执行顺序仍要保证是1-》2-》3。我们要等待当前Promise状态变更后，再执行下一个then收集的回调，这就要求我们对then返回值分类讨论。
```js
then(resolveFn, rejectFn){
    // return 一个新的Promise
    return new MyPromise((resolve, reject) => {
        // 把resolveFn重新包装一下，再push进resolve执行队列，这是为了能够获取回调的返回值，并进行分类讨论
        const fulfilledFn = val => {
            try{
                let x = resolveFn(val)

                x instanceof MyPromise ? x.then(resolve, reject) : resolve(x)
            } catch(error){
                reject(error)
            }
        }
        this._resolveQueue.push(fulfilledFn)
        const rejectedFn = val => {
            try{
                let x = rejectFn(val)

                x instanceof MyPromise ? x.then(resolve, reject) : resolve(x)
            } catch (error) {
                reject(error)
            }
        }
        this._rejectQueue.push(rejectedFn)
    })
}
```
然后我们测试一下链式调用:
```js
const p = new MyPromise(function(resolve, reject){
    setTimeout(function(){
        resolve(1)
    }, 1000)
})

p.then(res => {
    console.log(res)
    return 2
}).then(res => {
    console.log(res)
    return 3
}).then(res => {
    console.log(res)
    return new MyPromise(function(resolve, reject){
        setTimeout(function(){
            resolve(8888)
        }, 3000)
    })
}).then(res => {
    console.log(res)
})
```
## 值穿透&状态已变更的情况
我们已经初步完成了链式调用，但是对于then方法，我们还有两个细节要处理一下:
1. 值穿透：根据规范，如果then接收的参数不是function，那我们应该忽略它。如果没有忽略，当then回调不问function时，将会抛出异常，导致链式调用中断
2. 处理状态为resolve/reject的情况:其实我们上边then的写法是对应状态为pending的情况，但是有些时候，resolve/reject在then之前就被调用（比如 Promise.resolve().then()）,如果这个时候还把then回调push进resolve/reject的执行队列里，那么回调将不会被执行，因此对于状态已经变味fulfilled或rejected的情况，我们直接执行then回调:
```js
// 接收一个成功的回调和一个失败的回调，并push进对应的队列
then(resolveFn, rejectFn){
    // 根据规范，如果then的参数不是function，则我们需要忽略它，让链式调用继续往下执行
    typeof resolveFn !== 'funciton' ? resolveFn = val => val : null
    typeof rejectFn !== 'funciton' ? rejectFn = reason => {
        throw new Error(reason instanceof Error ? reason.message : reason)
    } : null
    // return 一个新的Promise
    return new MyPromise((resolve, reject) => {
        // 把resolveFn重新包装一下，再push进resolve执行队列，这是为了能够获取回调的返回值，并进行分类讨论
        const fulfilledFn = val => {
            try{
                let x = resolveFn(val)

                x instanceof MyPromise ? x.then(resolve, reject) : resolve(x)
            } catch(error){
                reject(error)
            }
        }
        const rejectedFn = val => {
            try{
                let x = rejectFn(val)

                x instanceof MyPromise ? x.then(resolve, reject) : resolve(x)
            } catch (error) {
                reject(error)
            }
        }
        switch(this._status){
            case PENDING:
                this._rejectQueue.push(rejectedFn)
                this._resolveQueue.push(fulfilledFn);
                break;
            // 当状态已经变为resolve/reject时,直接执行then回调
            case FULFILLED:
                fulfilledFn(this._value); // this._value是上一个then回调return的值
                break;
            case REJECTED:
                rejectedFn(this._value)
                break;
        }
    })
}
```
## 兼容同步任务
完成了then的链式调用以后，我们在处理一个前边的细节。上文我们说过，Promise的执行顺序是new Promise -> then()收集回调->resolve/reject执行回调。这一顺序是建立在executor是异步任务的前提下，如果executor是同步任务，那么顺序就会变成new Promise->resolve/reject->then收集回调，resolve的执行跑到then之前去了，为了兼容这种情况，我们给resolve/reject包一个setTimeout，让他异步执行。
>这里插一句,有关这个setTimeout,其实还有一番学问。虽然规范没有要求回调应该被放入宏任务队列还是微任务队列，但是Promise的默认实现是放进了微任务队列，我们的实现（包括大多数Promise手动实现和polyfill的转化）都是setTimeout放入了宏任务队列（当然我们也可以用MutationObserver模拟微任务） 
```js
// Promise/A+规范的三种状态
const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'
class MyPromise{
    // 构造方法接收一个回调
    constructor(executor){
        this._status = PENDING // Promise状态
        this._value = undefined // 储存then回调return的值
        this._resolveQueue = [] //then收集的执行成功的回调队列
        this._rejectQueue = [] // then收集的执行失败的回调队列
        // 由于resolve/reject是在executor内部调用，因此需要箭头函数固定this的指向,否则找不到this._resolveQueue
        let _resolve = val => {
            //把resolve执行回调的操作封装成一个函数,放进setTimeout里,以兼容executor是同步代码的情况
            const run = () => {
                if(this._status !== PENDING) return // 对应规范中的"状态只能由pending到fulfilled或pending到rejected"
                this._value = val
                this._status = FULFILLED // 变更状态
                // 从成功队列里取出回调依次执行
                while(this._resolveQueue.length){
                    const callback = this._resolveQueue.shift()
                    callback(val)
                }
            }
            setTimeout(run)
        }

        let _reject = val => {
            //把resolve执行回调的操作封装成一个函数,放进setTimeout里,以兼容executor是同步代码的情况
            const run = () => {
                if(this._status !== PENDING) return // 对应规范中的"状态只能由pending到fulfilled或pending到rejected"
                this._value = val
                this._status = REJECTED // 变更状态
                // 从失败队里里取出回调依次执行
                while(this._rejectQueue.length){
                    const callback = this._rejectQueue.shift()
                    callback(val)
                }
            }
            setTimeout(run)
        }
        // new Promse()时立即执行executor，并传入resolve和reject
        executor(_resolve, _reject)
    }
    // 接收一个成功的回调和一个失败的回调，并push进对应的队列
    then(resolveFn, rejectFn){
        // 根据规范，如果then的参数不是function，则我们需要忽略它，让链式调用继续往下执行
        typeof resolveFn !== 'function' ? resolveFn = val => val : null
        typeof rejectFn !== 'function' ? rejectFn = reason => {
            throw new Error(reason instanceof Error ? reason.message : reason)
        } : null
        // return 一个新的Promise
        return new MyPromise((resolve, reject) => {
            // 把resolveFn重新包装一下，再push进resolve执行队列，这是为了能够获取回调的返回值，并进行分类讨论
            const fulfilledFn = val => {
                try{

                    let x = resolveFn(val)
                    x instanceof MyPromise ? x.then(resolve, reject) : resolve(x)
                } catch(error){
                    reject(error)
                }
            }
            const rejectedFn = error => {
                try{
                    let x = rejectFn(error)

                    x instanceof MyPromise ? x.then(resolve, reject) : resolve(x)
                } catch (error) {
                    reject(error)
                }
            }
            switch(this._status){
            case PENDING:
                this._rejectQueue.push(rejectedFn)
                this._resolveQueue.push(fulfilledFn);
                break;
            // 当状态已经变为resolve/reject时,直接执行then回调
            case FULFILLED:
                fulfilledFn(this._value); // this._value是上一个then回调return的值
                break;
            case REJECTED:
                rejectedFn(this._value)
                break;
            }
        })
    }
}
```
然后我们可以测试这个Promise:
```js
let p1 = new MyPromise((resolve, reject) => {
  resolve(1)          //同步executor测试
})

p1
  .then(res => {
    console.log(res)
    return 2          //链式调用测试
  })
  .then()             //值穿透测试
  .then(res => {
    console.log(res)
    return new MyPromise((resolve, reject) => {
      resolve(3)      //返回Promise测试
    })
  })
  .then(res => {
    console.log(res)
    throw new Error('reject测试')   //reject测试
  })
  .then(() => {}, err => {
    console.log(err)
  })

// 输出 
// 1 
// 2 
// 3 
// Error: reject测试

```
## Promise.prototype.catch()
>catch()方法返回一个Promise,并且处理拒绝的情况，它的情况与调用Promise.prototype.then(undefined, onRejected)相同
```js
// catch方法其实就是执行一下then方法的第二个回调
catch(rejectFn){
    return this.then(undefined, rejectFn)
}  
```
## Promise.prototype.finally()
> finally()方法返回一个Promise.在Promise结束时，无论结果是fulfilled或者是rejected,都会执行指定的回调函数。在finally之后，还可以继续then.并且会将值原封不动的传给后面的then.
```js
//finally方法
finally(callback) {
  return this.then(
    value => MyPromise.resolve(callback()).then(() => value),             // MyPromise.resolve执行回调,并在then中return结果传递给后面的Promise
    reason => MyPromise.resolve(callback()).then(() => { throw reason })  // reject同理
  )
}

```
## Promise.resolve()
> Promise.resolve(value)方法返回一个以给定值解析后的Promise对象。如果该值为Promise,返回这个Promise;如果这个值是thenable（即带有"then" 方法)），返回的promise会“跟随”这个thenable的对象，采用它的最终状态；否则返回的promise将以此值完成。此函数将类promise对象的多层嵌套展平
```js
// 静态的resolve方法
static resolve(value){
    if(value instanceof MyPromise) return value //根据规范，参数如果是Promise实例，直接return这个实例
    return new MyPromise(resolve => resolve(value))
}
```
## Promise.reject()
>Promise.reject()返回一个带有拒绝原因的Promise对象
```js
static reject(reason){
    return new Promise((resolve, reject) => {
        reject(reason)
    })
}
```
## Promise.all()
>Promise.all(iterable)方法返回一个Promise实例，此实例在iterable参数内所有的promise都resolved或参数中不包含promise时resolve;如果参数中promise有一个rejected，此实例reject,失败原因是第一个失败Promise的结果
```js
// 静态的all方法
static all(promiseArr){
    let index = 0
    let result = []
    return new MyPromise((resolve, reject) => {
        promiseArr.forEach((p,i) => {
            //Promise.resolve用于处理传入值不为Promise的情况
            MyPromise.resolve(p).then(
                val => {
                    index++
                    result[i] = val
                    //所有then执行后，resolve结果
                    if(index === promiseArr.length){
                        resolve(result)
                    }
                },
                err => {
                    //有一个promise被reject时，MyPromise的状态reject
                    reject(err)
                }
            )
        })
    })
}
```
## Promise.race()
> Promise.race(iterable)方法返回一个Promise,一旦迭代器中的某个Promise解决或者拒绝，返回的Promise就会解决或拒绝
```js
static race(promiseArr){
    return new MyPromise((resolve, reject) => {
        //同时执行Promise,如果有一个Promise的状态发生改变,就变更新MyPromise的状态
        for(let p of promiseArr){
            //Promise.resolve(p)用于处理传入值不为Promise的情况
            MyPromise.resolve(p).then(
                val => {
                    resolve(value) //注意这个resolve是上边new MyPromise的
                },
                err => {
                    reject(err)
                }
            )
        }
    })
}
```
## 完整代码
```js
//Promise/A+规定的三种状态
const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'

class MyPromise {
  // 构造方法接收一个回调
  constructor(executor) {
    this._status = PENDING     // Promise状态
    this._value = undefined    // 储存then回调return的值
    this._resolveQueue = []    // 成功队列, resolve时触发
    this._rejectQueue = []     // 失败队列, reject时触发

    // 由于resolve/reject是在executor内部被调用, 因此需要使用箭头函数固定this指向, 否则找不到this._resolveQueue
    let _resolve = (val) => {
      //把resolve执行回调的操作封装成一个函数,放进setTimeout里,以兼容executor是同步代码的情况
      const run = () => {
        if(this._status !== PENDING) return   // 对应规范中的"状态只能由pending到fulfilled或rejected"
        this._status = FULFILLED              // 变更状态
        this._value = val                     // 储存当前value

        // 这里之所以使用一个队列来储存回调,是为了实现规范要求的 "then 方法可以被同一个 promise 调用多次"
        // 如果使用一个变量而非队列来储存回调,那么即使多次p1.then()也只会执行一次回调
        while(this._resolveQueue.length) {    
          const callback = this._resolveQueue.shift()
          callback(val)
        }
      }
      setTimeout(run)
    }
    // 实现同resolve
    let _reject = (val) => {
      const run = () => {
        if(this._status !== PENDING) return   // 对应规范中的"状态只能由pending到fulfilled或rejected"
        this._status = REJECTED               // 变更状态
        this._value = val                     // 储存当前value
        while(this._rejectQueue.length) {
          const callback = this._rejectQueue.shift()
          callback(val)
        }
      }
      setTimeout(run)
    }
    // new Promise()时立即执行executor,并传入resolve和reject
    executor(_resolve, _reject)
  }

  // then方法,接收一个成功的回调和一个失败的回调
  then(resolveFn, rejectFn) {
    // 根据规范，如果then的参数不是function，则我们需要忽略它, 让链式调用继续往下执行
    typeof resolveFn !== 'function' ? resolveFn = value => value : null
    typeof rejectFn !== 'function' ? rejectFn = reason => {
      throw new Error(reason instanceof Error? reason.message:reason);
    } : null
  
    // return一个新的promise
    return new MyPromise((resolve, reject) => {
      // 把resolveFn重新包装一下,再push进resolve执行队列,这是为了能够获取回调的返回值进行分类讨论
      const fulfilledFn = value => {
        try {
          // 执行第一个(当前的)Promise的成功回调,并获取返回值
          let x = resolveFn(value)
          // 分类讨论返回值,如果是Promise,那么等待Promise状态变更,否则直接resolve
          x instanceof MyPromise ? x.then(resolve, reject) : resolve(x)
        } catch (error) {
          reject(error)
        }
      }
  
      // reject同理
      const rejectedFn  = error => {
        try {
          let x = rejectFn(error)
          x instanceof MyPromise ? x.then(resolve, reject) : resolve(x)
        } catch (error) {
          reject(error)
        }
      }
  
      switch (this._status) {
        // 当状态为pending时,把then回调push进resolve/reject执行队列,等待执行
        case PENDING:
          this._resolveQueue.push(fulfilledFn)
          this._rejectQueue.push(rejectedFn)
          break;
        // 当状态已经变为resolve/reject时,直接执行then回调
        case FULFILLED:
          fulfilledFn(this._value)    // this._value是上一个then回调return的值(见完整版代码)
          break;
        case REJECTED:
          rejectedFn(this._value)
          break;
      }
    })
  }

  //catch方法其实就是执行一下then的第二个回调
  catch(rejectFn) {
    return this.then(undefined, rejectFn)
  }

  //finally方法
  finally(callback) {
    return this.then(
      value => MyPromise.resolve(callback()).then(() => value),             //执行回调,并returnvalue传递给后面的then
      reason => MyPromise.resolve(callback()).then(() => { throw reason })  //reject同理
    )
  }

  //静态的resolve方法
  static resolve(value) {
    if(value instanceof MyPromise) return value //根据规范, 如果参数是Promise实例, 直接return这个实例
    return new MyPromise(resolve => resolve(value))
  }

  //静态的reject方法
  static reject(reason) {
    return new MyPromise((resolve, reject) => reject(reason))
  }

  //静态的all方法
  static all(promiseArr) {
    let index = 0
    let result = []
    return new MyPromise((resolve, reject) => {
      promiseArr.forEach((p, i) => {
        //Promise.resolve(p)用于处理传入值不为Promise的情况
        MyPromise.resolve(p).then(
          val => {
            index++
            result[i] = val
            if(index === promiseArr.length) {
              resolve(result)
            }
          },
          err => {
            reject(err)
          }
        )
      })
    })
  }

  //静态的race方法
  static race(promiseArr) {
    return new MyPromise((resolve, reject) => {
      //同时执行Promise,如果有一个Promise的状态发生改变,就变更新MyPromise的状态
      for (let p of promiseArr) {
        MyPromise.resolve(p).then(  //Promise.resolve(p)用于处理传入值不为Promise的情况
          value => {
            resolve(value)        //注意这个resolve是上边new MyPromise的
          },
          err => {
            reject(err)
          }
        )
      }
    })
  }
}

```