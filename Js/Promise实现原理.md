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
                    console.log(x,'x')
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
            console.log(this._status, 'status')
            switch(this._status){
            case PENDING:
                this._rejectQueue.push(rejectedFn)
                this._resolveQueue.push(fulfilledFn);
                break;
            // 当状态已经变为resolve/reject时,直接执行then回调
            case FULFILLED:
                console.log(333,this._value)
                fulfilledFn(this._value); // this._value是上一个then回调return的值
                break;
            case REJECTED:
                rejectedFn(this._value)
                break;
            }
        })
    }
}
let p1 = new MyPromise((resolve, reject) => {
  resolve(1)          //同步executor测试
})

p1
  .then(res => {
    console.log(res)
    return 2          //链式调用测试
  })
```
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