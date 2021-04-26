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
