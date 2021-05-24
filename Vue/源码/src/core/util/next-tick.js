/* @flow */
/* globals MutationObserver */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIE, isIOS, isNative } from './env'

export let isUsingMicroTask = false

const callbacks = []
let pending = false
// 做了三件事
// 1.将pending置为false
// 2.清空callbacks数组
// 3.执行callbacks数组中的每一个函数(flushSchedulerQueque)
function flushCallbacks () {
    pending = false
    const copies = callbacks.slice(0)
    callbacks.length = 0
    // 遍历 callbacks 数组，执行其中存储的每个 flushSchedulerQueue 函数
    for (let i = 0; i < copies.length; i++) {
        copies[i]()
    }
}

// 可以看到 timerFunc的作用很简单，就是将flushCallbacks函数放入浏览器的异步任务队列中
let timerFunc

if (typeof Promise !== 'undefined' && isNative(Promise)) {
    const p = Promise.resolve()
    // 首选Promise.resolve().then()
    timerFunc = () => {
        // 在微任务队列中放入 flushCallbacks函数
        p.then(flushCallbacks)
        // 在有问题的UIWebViews中，Promise.then不会完全中断，但是他可能陷入怪异的状态
        // 在这种状态下，回调被推入微任务队列，但队列没有被刷新，直到浏览器需要执行其他工作，比如处理一个定时器
        // 因此，我们可以通过添加空计时器来 强制 刷新微任务队列
        if (isIOS) setTimeout(noop)
    }
    isUsingMicroTask = true
} else if (!isIE && typeof MutationObserver !== 'undefined' && (
    isNative(MutationObserver) ||
    // PhantomJS and iOS 7.x
    MutationObserver.toString() === '[object MutationObserverConstructor]'
)) {
    // MutationObserver次之
    // Use MutationObserver where native Promise is not available,
    // e.g. PhantomJS, iOS7, Android 4.4
    // (#6466 MutationObserver is unreliable in IE11)
    let counter = 1
    const observer = new MutationObserver(flushCallbacks)
    const textNode = document.createTextNode(String(counter))
    observer.observe(textNode, {
        characterData: true
    })
    timerFunc = () => {
        counter = (counter + 1) % 2
        textNode.data = String(counter)
    }
    isUsingMicroTask = true
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
    // Fallback to setImmediate.
    // Technically it leverages the (macro) task queue,
    // but it is still a better choice than setTimeout.
    // 再就是setImmediate,他其实已经是一个宏任务了，但仍然比setTimeout好
    timerFunc = () => {
        setImmediate(flushCallbacks)
    }
} else {
    // Fallback to setTimeout.
    // 最后使用setTimeout
    timerFunc = () => {
        setTimeout(flushCallbacks, 0)
    }
}
// 开发中遇到一种场景: 
// 当更新了状态之后，需要对新dom做一些操作，但是这时我们其实获取不到更新后的DOM，因为还没有重新渲染。
// 这个时候我们就需要用到nextTick
// nextTick接收一个回调函数作为参数，它的作用是将回调延迟到下次DOM更新周期之后执行


// 下次DOM更新周期之后，具体是指什么时候？
// 在Vue中，当状态发生变化时，watcher会得到通知，然后触发虚拟DOM的渲染流程。
// 而watcher触发渲染这个操作不是同步的，而是异步的。
// 也就是说，Vue中有一个队列，每当需要渲染时，会将watcher推送到这个队列中，在下一次事情循环中再让watcher触发渲染流程



// 为什么Vue使用异步更新队列？
// Vue2.0使用虚拟dom渲染，变化侦测的通知只发送到组件。组件内用到的所有状态的变化都会通知到同一个watcher，然后虚拟dom会对这个组件对比（diff）并更改DOM
// 也就是说，如果同一轮事件循环中两个数据发生了变化，那么组件的watcher会收到两份通知，vue会将收到通知的watcher实例添加到队列中缓存起来，并且在添加到队列
// 之前检查其中是否已经存在相同的watcher，只有不存在时，才将watcher实例添加到队列中，然后在下一次事件循环中，Vue会让队列中的watcher触发渲染流程并清空队列
// 。这样就可以保证，即便在同一轮事件循环中有两个状态发生改变，watcher最后也只执行一次渲染流程

// 什么是事件循环？
// JavaScript是一门单线程且非阻塞的脚本语言，这以为这JavaScript在执行的时候，只有一个主线程来处理所有任务。
// 而非阻塞是指代码需要处理异步任务时，主线程会挂起这个任务，当异步任务处理完毕后，主线程在根据一定规则去执行相应回调
// 事实上，当任务处理完毕后，JavaScript会将这个事件加入一个队列中，我们称这个队列为事件队列。
// 被放入这个队列中的事件不会立即执行其回调，而是等待当前执行栈中的所有任务执行完毕后，主线程会去查找事件队列中是否有任务（异步任务）

// 异步任务有两种类型： 微任务 和 宏任务，不同类型的任务会被分配到不同的任务队列中

// 当执行栈中的所有任务都执行完毕后，会检查微任务队列中是否有事件存在，如果存在，则会依次执行微任务队列中事件对应的回调，直到为空。
// 然后去宏任务队列中取出一个事件，把对应的回调加入到当前执行栈，当执行栈中的所有任务都执行完毕后，检查微任务队列中是否有事件存在。
// 无限重复此过程，就形成了一个无限循环，这个循环就叫-事件循环
// 属于微任务的事件包括但不限于以下几种
// Promise.then
// MutationObserver
// Object.observe
// Process.nextTick
// 属于宏任务的事件包括但不限于以下几种
// setTimeout
// setInterval
// setImmediate
// MessageChannel
// requestAnimationFrame
// I / O
// UI交互事件

// 什么是执行栈？
// 当我们执行一个方法时，JavaScript会生成一个与这个方法对应的执行环境(context)，又叫执行上下文
// 这个执行环境中有这个方法的私有作用域、上层作用域的指向、方法的参数、私有作用域中定义的变量以及this对象。
// 这个执行环境会被添加到一个栈中，这个栈就是执行栈

// 如果在这个方法的代码中执行到了一行函数调用语句，那么JavaScript会生成这个函数的执行环境并将其添加到执行栈中，
// 然后进入这个执行环境继续执行其中的代码。执行完毕并返回结果，JavaScript会退出执行环境并把这个执行环境从栈中销毁，
// 回到上一个方法的执行环境。这个过程反复执行，直到执行栈中的代码全部执行完毕。这个执行环境的栈就是执行栈

// 完成两件事
// 1、用try catch 包装flushSchedulerQueue函数，然后将其放入callbacks数组
// 2、如果pending为false，表示现在浏览器的任务队列中没有flushCallbacks函数
//  如果pending为true，则表示浏览器队列中已经被放入了flushCallbacks函数，
//  待执行flushCallbacks函数时，pending会被再次置为false，表示下一个flushCallbacks函数可以进入浏览器的任务队列了

// pending的作用：保证在同一时刻，浏览器的任务队列中只有一个flushCallbacks函数
// @param {*} cb 接收一个回调函数 => flushSchedulerQueue
// @param {*} ctx 上下文


// 定义一个延迟回调，即下次DOM更新循环结束之后执行
export function nextTick (cb?: Function, ctx?: Object) {
    let _resolve
    // callbacks数组存储经过包装的cb函数
    callbacks.push(() => {
        if (cb) {
            // 用try catch包装回调函数，便于捕获错误
            try {
                cb.call(ctx)
            } catch (e) {
                handleError(e, ctx, 'nextTick')
            }
        } else if (_resolve) {
            _resolve(ctx)
        }
    })
    if (!pending) {
        pending = true
        // 执行timerFunc, 在浏览器的队列中（首选微任务队列）放入flushCallbacks函数
        timerFunc()
    }
    // $flow-disable-line
    if (!cb && typeof Promise !== 'undefined') {
        return new Promise(resolve => {
            _resolve = resolve
        })
    }
}
