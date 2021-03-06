/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
    set,
    del,
    observe,
    defineReactive,
    toggleObserving
} from '../observer/index'

import {
    warn,
    bind,
    noop,
    hasOwn,
    hyphenate,
    isReserved,
    handleError,
    nativeWatch,
    validateProp,
    isPlainObject,
    isServerRendering,
    isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
    enumerable: true,
    configurable: true,
    get: noop,
    set: noop
}

export function proxy (target: Object, sourceKey: string, key: string) {
    sharedPropertyDefinition.get = function proxyGetter () {
        return this[sourceKey][key]
    }
    sharedPropertyDefinition.set = function proxySetter (val) {
        this[sourceKey][key] = val
    }
    Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
    // 保存当前组件的watcher实例。
    // 无论是$watch注册的watcher实例，还是watch选项注册的watcher实例，都会添加到当前实例的vm._watchers属性中
    vm._watchers = []
    const opts = vm.$options
    // 父组件提供数据，子组件通过props字段选择自己需要哪些内容
    // Vue内部通过子组件的props选项将需要的数据筛选出来之后添加到子组件的上下文中
    // 初始化props: 通过规格化后的opts.props，从父组件传入的props数据中或从new创建实例
    // 传入的propsData参数中，查找出需要的数据保存在当前实例的vm._props中，然后在vm上设置一个代理
    // 实现通过vm.x 访问vm._props.x的目的
    if (opts.props) initProps(vm, opts.props)
    // 初始化methods: 使我们可以通过vm[x] 访问到opts.methods[x]方法
    if (opts.methods) initMethods(vm, opts.methods)

    // 初始化data
    // 简单来说，data中数据最终会保存到vm._data中。然后在vm上设置一个代理，使得通过vm.x可以访问到vm._data中的x属性
    // 最后由于这些数据不是响应式的，需要调用observe函数将data装缓存响应式数据，于是data就完成了初始化
    if (opts.data) {
        initData(vm)
    } else {
        observe(vm._data = {}, true /* asRootData */)
    }
    // 初始化计算属性
    // 当计算属性的内容发生变化后，计算属性的watcher和组件的watcher都会得到通知。
    // 计算属性的watcher会将自己的dirty属性设置为true，当下一次读取计算属性时，就会重新计算一次值
    // 然后组件的watcher也会得到通知，从而执行render函数重新渲染
    // 读取数据这个操作其实会出发计算属性的getter方法。这个getter方法被触发时会做两件事
    // 1、计算当前计算属性的值，此时会使用watcher去观察计算属性中用到的所有其他数据的变化(将当前的watcher添加到其他数据的依赖(Dep)列表中)。
    // 同时将计算属性的watcher的dirty属性设置为false,这样再次读取计算属性时将不会重新计算，除非计算属性所依赖的数据发生了变化
    // 2、当计算属性中用到的数据发生变化时，模板中读取计算属性，使用组件的watcher观察计算属性中用到的所有数据的变化
    // 用户自定义的watch，使用用户自定义的Watcher观察计算属性中用到的所有数据的变化，区别于当计算属性函数中用到的数据发生变化时，向谁发送通知

    if (opts.computed) initComputed(vm, opts.computed)
    // 火狐浏览器中Object.prototype上有一个watch方法
    if (opts.watch && opts.watch !== nativeWatch) {
        initWatch(vm, opts.watch)
    }
}
// propsOptions规格化之后的props选项
function initProps (vm: Component, propsOptions: Object) {
    const propsData = vm.$options.propsData || {}
    const props = vm._props = {}
    // cache prop keys so that future props updates can iterate using Array
    // instead of dynamic object key enumeration.
    // 缓存props的key
    const keys = vm.$options._propKeys = []
    const isRoot = !vm.$parent
    // root instance props should be converted
    if (!isRoot) {
        toggleObserving(false)
    }
    for (const key in propsOptions) {
        keys.push(key)
        // 获取key对应的value值
        const value = validateProp(key, propsOptions, propsData, vm)
        /* istanbul ignore else */
        if (process.env.NODE_ENV !== 'production') {
            const hyphenatedKey = hyphenate(key)
            if (isReservedAttribute(hyphenatedKey) ||
                config.isReservedAttr(hyphenatedKey)) {
                warn(
                    `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
                    vm
                )
            }
            defineReactive(props, key, value, () => {
                if (!isRoot && !isUpdatingChildComponent) {
                    warn(
                        `Avoid mutating a prop directly since the value will be ` +
                        `overwritten whenever the parent component re-renders. ` +
                        `Instead, use a data or computed property based on the prop's ` +
                        `value. Prop being mutated: "${key}"`,
                        vm
                    )
                }
            })
        } else {
            // 将props设置到vm._props中
            defineReactive(props, key, value)
        }
        // static props are already proxied on the component's prototype
        // during Vue.extend(). We only need to proxy props defined at
        // instantiation here.
        if (!(key in vm)) {
            // 设置代理 当使用vm[key] 访问数据时，其实访问的是vm.props[key]
            proxy(vm, `_props`, key)
        }
    }
    toggleObserving(true)
}

function initData (vm: Component) {
    let data = vm.$options.data
    // 判断data的类型：如果是函数，则需要执行函数，并将其返回值赋值给data和vm._data
    data = vm._data = typeof data === 'function'
        ? getData(data, vm)
        : data || {}
    if (!isPlainObject(data)) {
        data = {}
        process.env.NODE_ENV !== 'production' && warn(
            'data functions should return an object:\n' +
            'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
            vm
        )
    }
    // proxy data on instance
    const keys = Object.keys(data)
    const props = vm.$options.props
    const methods = vm.$options.methods
    let i = keys.length
    // 将data中的所有属性代理到实例的vm._data中对应的属性
    while (i--) {
        const key = keys[i]
        // 如果某个key与methods中的方法重名,依然会代理到实例中，但是在非生产环境中会发出警告
        if (process.env.NODE_ENV !== 'production') {
            if (methods && hasOwn(methods, key)) {
                warn(
                    `Method "${key}" has already been defined as a data property.`,
                    vm
                )
            }
        }
        // 如果某个key与props中的属性重名,则不会将代理到实例中
        if (props && hasOwn(props, key)) {
            process.env.NODE_ENV !== 'production' && warn(
                `The data property "${key}" is already declared as a prop. ` +
                `Use prop default value instead.`,
                vm
            )
        } else if (!isReserved(key)) {
            // 在vm实例上设置名为vm.key的访问器属性，这个属性的修改和获取针对的vm._data中的同名属性
            proxy(vm, `_data`, key)
        }
    }
    // observe data
    // 将vm._data中的数据转换为响应式的
    observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
    // #7573 disable dep collection when invoking data getters
    pushTarget()
    try {
        return data.call(vm, vm)
    } catch (e) {
        handleError(e, vm, `data()`)
        return {}
    } finally {
        popTarget()
    }
}

// 计算属性dirty标识符
const computedWatcherOptions = { lazy: true }

// 初始化计算属性
// vm:vuejs上下文(this)
// computed:计算属性对象
function initComputed (vm: Component, computed: Object) {
    // $flow-disable-line
    // _computedWatchers用来保存所有计算属性的watcher实例
    const watchers = vm._computedWatchers = Object.create(null)
    // computed properties are just getters during SSR
    // 计算属性在SSR环境中，只是一个普通的getter方法
    const isSSR = isServerRendering()

    // 依次初始化每一个计算属性
    for (const key in computed) {
        const userDef = computed[key]
        const getter = typeof userDef === 'function' ? userDef : userDef.get
        // 用户提供的计算属性不合法，打印提示
        if (process.env.NODE_ENV !== 'production' && getter == null) {
            warn(
                `Getter is missing for computed property "${key}".`,
                vm
            )
        }
        // 在非SSR环境中，为计算属性创建内部观察器
        if (!isSSR) {
            // create internal watcher for the computed property.
            // 创建watcher实例
            watchers[key] = new Watcher(
                vm,
                getter || noop,
                noop,
                computedWatcherOptions
            )
        }

        // component-defined computed properties are already defined on the
        // component prototype. We only need to define computed properties defined
        // at instantiation here.
        // 判断当前计算属性是否和props、data、method中某一个重名
        if (!(key in vm)) {
            defineComputed(vm, key, userDef)
        } else if (process.env.NODE_ENV !== 'production') {
            if (key in vm.$data) {
                warn(`The computed property "${key}" is already defined in data.`, vm)
            } else if (vm.$options.props && key in vm.$options.props) {
                warn(`The computed property "${key}" is already defined as a prop.`, vm)
            }
        }
    }
}

// 在target上定义一个key属性，属性的getter和setter根据userDef的值来设置
export function defineComputed (
    target: any,
    key: string,
    userDef: Object | Function
) {
    // 在非服务端渲染时，计算属性才有缓存
    const shouldCache = !isServerRendering()
    if (typeof userDef === 'function') {
        sharedPropertyDefinition.get = shouldCache
            ? createComputedGetter(key)
            : createGetterInvoker(userDef)
        sharedPropertyDefinition.set = noop
    } else {
        sharedPropertyDefinition.get = userDef.get
            ? shouldCache && userDef.cache !== false
                ? createComputedGetter(key)
                : createGetterInvoker(userDef.get)
            : noop
        sharedPropertyDefinition.set = userDef.set || noop
    }
    // 用户没有设置setter，为计算属性设置一个默认的setter函数
    if (process.env.NODE_ENV !== 'production' &&
        sharedPropertyDefinition.set === noop) {
        sharedPropertyDefinition.set = function () {
            warn(
                `Computed property "${key}" was assigned to but it has no setter.`,
                this
            )
        }
    }
    // 在target上定义一个key属性
    Object.defineProperty(target, key, sharedPropertyDefinition)
}

function createComputedGetter (key) {
    // 每当读取计算属性时，computedGetter函数都会被执行
    return function computedGetter () {
        // 当前计算属性所对应的watcher
        const watcher = this._computedWatchers && this._computedWatchers[key]
        if (watcher) {
            // 每当计算属性的依赖发生了变化，会将计算属性的watcher.dirty设置为true，这样当下一次读取计算属性时。会重新计算
            // dirty为true，说明计算属性所依赖的状态发生了变化，他的返回值可能也会有变化，需要重新计算结果
            if (watcher.dirty) {
                watcher.evaluate()
            }
            // 将读取计算属性的那个watcher添加到计算属性所依赖的所有状态的依赖列表中
            if (Dep.target) {
                watcher.depend()
            }
            return watcher.value
        }
    }
}

function createGetterInvoker (fn) {
    return function computedGetter () {
        return fn.call(this, this)
    }
}
// 只需要循环选项中methods对象，并将每个属性一次挂到vm上即可
function initMethods (vm: Component, methods: Object) {
    // 变量props用来判断methods中的方法是否和props发生了重复
    const props = vm.$options.props
    for (const key in methods) {
        // 非生产环境校验methods并在控制台发出警告
        if (process.env.NODE_ENV !== 'production') {
            if (typeof methods[key] !== 'function') {
                warn(
                    `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
                    `Did you reference the function correctly?`,
                    vm
                )
            }
            if (props && hasOwn(props, key)) {
                warn(
                    `Method "${key}" has already been defined as a prop.`,
                    vm
                )
            }
            if ((key in vm) && isReserved(key)) {
                warn(
                    `Method "${key}" conflicts with an existing Vue instance method. ` +
                    `Avoid defining component methods that start with _ or $.`
                )
            }
        }
        // 方法赋值到当前vm实例中：方法不存在，则保存一个空函数。存在,将方法bind当前vm实例，在赋值
        vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
    }
}
// 初始化watch选项
// vm 当前上下文
// watch 用户设置的watch对象
function initWatch (vm: Component, watch: Object) {
    for (const key in watch) {
        // handler的类型不确定，数组和其他(字符串、函数、对象)
        const handler = watch[key]
        if (Array.isArray(handler)) {
            for (let i = 0; i < handler.length; i++) {
                createWatcher(vm, key, handler[i])
            }
        } else {
            // 处理其他类型的handler,并调用vm.$watch创建Watcher观察表达式
            createWatcher(vm, key, handler)
        }
    }
}
// vm vue实例上下文(this)
// expOrFn 表达式或者计算属性函数
// handler watcher对象的值，可能值有三种：字符串，函数，对象
// options 用于传递给vm.$watch的选项对象
function createWatcher (
    vm: Component,
    expOrFn: string | Function,
    handler: any,
    options?: Object
) {
    if (isPlainObject(handler)) {
        options = handler
        handler = handler.handler
    }
    if (typeof handler === 'string') {
        // {b:'someMethod'}
        handler = vm[handler]
    }
    //expOrFn 表达式或计算属性函数
    //handler watch对象的值
    //options选项对象 {handler:function(){}, deep: true}
    return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
    // flow somehow has problems with directly declared definition object
    // when using Object.defineProperty, so we have to procedurally build up
    // the object here.
    const dataDef = {}
    dataDef.get = function () { return this._data }
    const propsDef = {}
    propsDef.get = function () { return this._props }
    if (process.env.NODE_ENV !== 'production') {
        dataDef.set = function () {
            warn(
                'Avoid replacing instance root $data. ' +
                'Use nested data properties instead.',
                this
            )
        }
        propsDef.set = function () {
            warn(`$props is readonly.`, this)
        }
    }
    // 将data属性和props属性挂载到Vue.prototype对象上
    // 这样在程序中就可以通过this.$data和$props来访问data和props对象了
    Object.defineProperty(Vue.prototype, '$data', dataDef)
    Object.defineProperty(Vue.prototype, '$props', propsDef)

    // 所有以$开头的方法都是在Vue.js原型上设置的
    // $set和$delete为了解决变化侦测的缺陷
    Vue.prototype.$set = set
    Vue.prototype.$delete = del
    // 创建watcher,返回unwatch,共完成如下5件事
    // 1、兼容性处理，保证最后new Watcher时cb为函数
    // 2、标识用户watcher
    // 3、创建watcher实例
    // 4、设置了immediate，则立即执行一次cb
    // 5、返回unwatch
    Vue.prototype.$watch = function (
        expOrFn: string | Function,
        cb: any,
        options?: Object
    ): Function {
        const vm: Component = this
        // 兼容性处理，因为用户vm.$watch时设置的cb可能是对象
        if (isPlainObject(cb)) {
            return createWatcher(vm, expOrFn, cb, options)
        }
        // options.user表示用户watcher，还有渲染watcher，即updateComponent方法中实例化的watcher
        options = options || {}
        options.user = true
        // 创建watcher
        const watcher = new Watcher(vm, expOrFn, cb, options)
        // 如果用户设置了immediate为true，则立即执行一次回调函数
        if (options.immediate) {
            pushTarget()
            try {
                cb.call(vm, watcher.value)
            } catch (error) {
                handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
            }
            popTarget()
        }
        // 返回一个unwatch函数，用于解除监听
        return function unwatchFn () {
            watcher.teardown()
        }
    }
}
