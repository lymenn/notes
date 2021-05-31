/* @flow */

import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
const modules = platformModules.concat(baseModules)

// patch工厂函数，为其传入平台特有的一些操作，然后返回一个patch函数
// nodeOps web平台的 DOM 操作API
// modules 平台特有的一些操作，比如 attrs, klass, events, domProps, style, transition
export const patch: Function = createPatchFunction({ nodeOps, modules })
