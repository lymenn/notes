/* @flow */

import { mergeOptions } from '../util/index'
// 定义Vue.mixin, 负责全局混入选项，影响之后创建的所有Vue实例，这些实例会合并全局混入的选项
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    // 在Vue的默认配置项上合并mixin对象
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
