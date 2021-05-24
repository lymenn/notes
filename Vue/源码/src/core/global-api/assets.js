/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'

export function initAssetRegisters (Vue: GlobalAPI) {
    /**
     * Create asset registration methods.
     */
    // 定义Vue.component,Vue.directive,Vue.filter这三个方法
    // 这三个方法所做的事情是类似的，就是在this.options.xx上存放对应的配置
    // 比如Vue.component(compName, {xxx}) 结果是 this.options.components.compName = 组件构造函数
    // ASSET_TYPES = ['component', 'directive', 'filter']
    // 注册或者获取
    ASSET_TYPES.forEach(type => {
        Vue[type] = function (
            id: string,
            definition: Function | Object
        ): Function | Object | void {
            // definition参数不存在，说明是获取操作
            if (!definition) {
                return this.options[type + 's'][id]
            } else {
                /* istanbul ignore if */
                if (process.env.NODE_ENV !== 'production' && type === 'component') {
                    validateComponentName(id)
                }
                if (type === 'component' && isPlainObject(definition)) {
                    // 如果组件中存在name,则使用,否则直接使用id
                    definition.name = definition.name || id
                    //   extend就是Vue.extend,所以这时的definition就变成了组件构造函数,使用时直接new definition()
                    definition = this.options._base.extend(definition)
                }
                if (type === 'directive' && typeof definition === 'function') {
                    definition = { bind: definition, update: definition }
                }
                // 在实例化是通过mergeOptions将全局注册的组件合并到每个组件的配置对象的components中
                this.options[type + 's'][id] = definition
                return definition
            }
        }
    })
}
