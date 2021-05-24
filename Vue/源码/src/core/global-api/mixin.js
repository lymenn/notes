/* @flow */

import { mergeOptions } from '../util/index'
// 定义Vue.mixin, 负责全局混入选项，影响之后创建的所有Vue实例，这些实例会合并全局混入的选项
// 原理:将用户传入的对象与Vue.js自身的options属性合并在一起
// 因为mixin方法修改了Vue.options属性，而之后创建的每个势力都会用到该属性，所以会影响创建的每个实例
export function initMixin (Vue: GlobalAPI) {
    Vue.mixin = function (mixin: Object) {
        // 在Vue的默认配置项上合并mixin对象
        this.options = mergeOptions(this.options, mixin)
        return this
    }
}
