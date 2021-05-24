/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'

export function initExtend (Vue: GlobalAPI) {
    /**
     * Each instance constructor, including Vue, has a unique
     * cid. This enables us to create wrapped "child
     * constructors" for prototypal inheritance and cache them.
     */
    Vue.cid = 0
    let cid = 1

    /**
     * Class inheritance
     */
    // Vue.extend的作用是创建一个继承Vue身上部分功能的子类

    // 基于Vue去扩展子类，该子类同样支持进一步的扩展
    // 扩展时可以传递一些默认配置，就像Vue也会有一些默认配置
    // 默认配置和基类有冲突则会进行选项合并 mergeOptions
    Vue.extend = function (extendOptions: Object): Function {
        extendOptions = extendOptions || {}
        const Super = this
        // 以父类的ID作为缓存的
        const SuperId = Super.cid
        // 缓存保存在配置项extendOptions._Ctor属性中
        const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
        // 如果缓存中存在，则直接返回缓存中的构造函数
        // 是么情况下可以利用这个缓存?
        // 如果你在多次调用Vue.extend时,使用了同一个配置项(extendOptions),这是就会启用缓存
        if (cachedCtors[SuperId]) {
            return cachedCtors[SuperId]
        }

        // 获取子类的name，并进行校验
        const name = extendOptions.name || Super.options.name
        if (process.env.NODE_ENV !== 'production' && name) {
            validateComponentName(name)
        }
        // 定义Sub构造函数和Vue构造函数一样
        const Sub = function VueComponent (options) {
            //初始化
            this._init(options)
        }
        // 通过原型继承的方式继承Vue
        Sub.prototype = Object.create(Super.prototype)
        Sub.prototype.constructor = Sub
        // cid为每一个类的唯一标识
        Sub.cid = cid++
        // 选项合并，合并Vue的配置项到自己的配置项上来
        Sub.options = mergeOptions(
            Super.options,
            extendOptions
        )
        // 记录自己的基类，将父类保存到子类的super属性中
        Sub['super'] = Super

        // For props and computed properties, we define the proxy getters on
        // the Vue instances at extension time, on the extended prototype. This
        // avoids Object.defineProperty calls for each instance created.
        // 初始化props，将props中的key代理到Sub.prototype._props对象上
        // vm.name实际上可以访问到的是Sub.prototype._props.name
        // 组件类通过this._props访问
        if (Sub.options.props) {
            initProps(Sub)
        }
        // 如果选项中存在computed,则对他进行初始化
        if (Sub.options.computed) {
            initComputed(Sub)
        }

        // allow further extension/mixin/plugin usage
        // 将父类中存在的属性依次复制到子类中
        // 定义extend/mixin/use这三个静态方法，允许在Sub基础上再进一步构造子类
        Sub.extend = Super.extend
        Sub.mixin = Super.mixin
        Sub.use = Super.use

        // create asset registers, so extended classes
        // can have their private assets too.
        // 定义componet、filter、directive三个静态方法
        ASSET_TYPES.forEach(function (type) {
            Sub[type] = Super[type]
        })
        // enable recursive self-lookup
        // 递归组件的原理，如果组件设置了name属性，则将自己注册到自己的components选项中
        if (name) {
            Sub.options.components[name] = Sub
        }

        // keep a reference to the super options at extension time.
        // later at instantiation we can check if Super's options have
        // been updated.
        // 扩展时保留对基类选项的引用
        // 稍后在实例化时，我们可以检查 Super 的选项是否具有更新
        Sub.superOptions = Super.options
        Sub.extendOptions = extendOptions
        Sub.sealedOptions = extend({}, Sub.options)

        // cache constructor
        // 缓存
        cachedCtors[SuperId] = Sub

        // 返回子类
        // 其实就是创建了一个Sub函数并继承了父级。如果直接使用Vue.extend,则Sub继承Vue构造函数
        return Sub
    }
}

function initProps (Comp) {
    const props = Comp.options.props
    for (const key in props) {
        proxy(Comp.prototype, `_props`, key)
    }
}

function initComputed (Comp) {
    const computed = Comp.options.computed
    for (const key in computed) {
        defineComputed(Comp.prototype, key, computed[key])
    }
}
