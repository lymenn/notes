/* @flow */

import { hasOwn } from 'shared/util'
import { warn, hasSymbol } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'

export function initProvide (vm: Component) {
  const provide = vm.$options.provide
  if (provide) {
    // provide 类型是函数则执行函数,将返回值赋值给vm._provide 否则直接将provide赋值给vm._provide
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}

// 初始化inject
export function initInjections (vm: Component) {
  // 通过用户配置的inject, 自底向上搜索可用的注入内容，并将结果以{key:value}的形式返回
  const result = resolveInject(vm.$options.inject, vm)
  if (result) {
    // 通知defineReactive函数不要将内容转换成响应式的
    toggleObserving(false)
    // 循环result并依次调用defineReactive函数，将他们设置到当前实例上
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        defineReactive(vm, key, result[key])
      }
    })
    toggleObserving(true)
  }
}

// 读取用户在当前组件中设置的inject的key
// 然后循环key，将每一个key从当前组件起，不断向父组件查找是否有值，找到了就停止循环
// 最终将所有key对应的值一起返回
export function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    const result = Object.create(null)
    // 如果浏览器原生支持symbol，使用Reflect.ownKeys读出inject的所有key
    // 如果不支持symbol，使用Object.keys获取key
    const keys = hasSymbol
      ? Reflect.ownKeys(inject)
      : Object.keys(inject)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // #6574 in case the inject object is observed...
      if (key === '__ob__') continue
      // 获取原源属性的键名
      const provideKey = inject[key].from
      let source = vm
      while (source) {
        if (source._provided && hasOwn(source._provided, provideKey)) {
          // 通过provide注入内容时，其实是将内容注入到当前实例的_provided中，所以可以从父组件的_provided中获取注入内容
          result[key] = source._provided[provideKey]
          break
        }
        // 将source设置为父组件实例进行下一轮循环
        source = source.$parent
      }
      // 祖先组件中找不到注入的内容
      if (!source) {
        // 使用默认值
        if ('default' in inject[key]) {
          const provideDefault = inject[key].default
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    return result
  }
}
