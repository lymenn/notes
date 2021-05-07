/* @flow */

import { toArray } from '../util/index'
// 定义Vue.use,负责为Vue安装插件，做了以下两件事：
// 1. 判断插件是否已经安装，如果安装则直接结束
// 2. 安装插件，执行插件的install方法
export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    // 已经安装过的插件列表
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    // 判断插件是否已经安装
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }
    // 将Vue实例放到第一个参数位置，然后将这些参数传递给install方法
    // additional parameters
    const args = toArray(arguments, 1)
    args.unshift(this)
    if (typeof plugin.install === 'function') {
      // plugin是一个对象,则执行其install方法安装插件
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      // 直接执行plugin安装插件
      plugin.apply(null, args)
    }
    // 在插件列表中添加新安装的插件
    installedPlugins.push(plugin)
    return this
  }
}
