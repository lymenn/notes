/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */
// 定义 arrayMethods 对象，用于增加Array.prototype
// 当访问 arrayMethods 对象对象中的能改变数组的七个方法时会被拦截，以实现响应式
import { def } from '../util/index'
// 备份 数组原型
const arrayProto = Array.prototype
// 通过继承的方式创建新的arrayMethods
export const arrayMethods = Object.create(arrayProto)
// 可以改变数组自身的七个方法
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  // 缓存原生方法
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    // 先执行原生方法
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    // 如果method是以下三个方法之一，说明新加入了元素
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // 对新加入的元素做响应式
    if (inserted) ob.observeArray(inserted)
    // notify change
    // 通知更新
    ob.dep.notify()
    return result
  })
})
