/* @flow */

import { emptyNode } from 'core/vdom/patch'
import { resolveAsset, handleError } from 'core/util/index'
import { mergeVNodeHook } from 'core/vdom/helpers/index'

export default {
    create: updateDirectives,
    update: updateDirectives,
    destroy: function unbindDirectives (vnode: VNodeWithData) {
        updateDirectives(vnode, emptyNode)
    }
}

function updateDirectives (oldVnode: VNodeWithData, vnode: VNodeWithData) {
    // 新旧节点只有某一个存在directives，那么就执行_update函数处理指令
    // 在模板解析时，directives会从模板的属性中解析出来并最终设置到vnode中
    if (oldVnode.data.directives || vnode.data.directives) {
        _update(oldVnode, vnode)
    }
}

function _update (oldVnode, vnode) {
    // 判断虚拟节点是否是一个新创建的节点
    const isCreate = oldVnode === emptyNode
    // 当新虚拟节点不存在而旧的虚拟存在时为真
    const isDestroy = vnode === emptyNode
    // 旧的指令集合，指oldVnode中保存的指令
    const oldDirs = normalizeDirectives(oldVnode.data.directives, oldVnode.context)
    // 新的指令集合，值vnode中保存的指令
    const newDirs = normalizeDirectives(vnode.data.directives, vnode.context)

    // 需要触发inserted指令钩子函数的指令列表
    const dirsWithInsert = []
    // 需要触发componentUpdated钩子函数的指令列表
    const dirsWithPostpatch = []

    let key, oldDir, dir
    // 对比两个指令集合并触发对应的钩子函数
    for (key in newDirs) {
        oldDir = oldDirs[key]
        dir = newDirs[key]
        // 旧指令不存在，说明当前指令是首次绑定到元素
        if (!oldDir) {
            // new directive, bind
            // 触发bind函数。如果方法存在，则执行它
            callHook(dir, 'bind', vnode, oldVnode)
            if (dir.def && dir.def.inserted) {
                // 如果该指令在注册时设置了inserted方法，那么将指令添加到dirsWithInsert中，这样做可以保证执行完所有指令的bind方法后再去执行inserted方法
                dirsWithInsert.push(dir)
            }
        } else {
            // 当旧指令存在时，说明指令已经绑定过了，那么这一次的操作应该是更新指令。
            // existing directive, update
            // 添加oldValue保存上次指令的value属性值
            dir.oldValue = oldDir.value
            dir.oldArg = oldDir.arg
            // 调用callhook触发指令的update钩子函数
            callHook(dir, 'update', vnode, oldVnode)
            // 判断注册自定义指令时，指令是否设置了componentUpdated方法，如果设置了，则指令添加到dirsWithPostpatch列表中，这样做的目的是让指令所在组件的Vnode及其子vnode全部更新后，再调用componentUpdated方法
            if (dir.def && dir.def.componentUpdated) {
                dirsWithPostpatch.push(dir)
            }
        }
    }

    // dirsWithInsert如果有元素，则循环dirsWithInsert依次调用callhook执行每一个指令的inserted钩子函数
    if (dirsWithInsert.length) {
        // 创建了一个callInsert函数，当这个函数执行时才会循环dirsWithInsert依次调用每一个指令的inserted钩子函数，这样做是为了让指令的inserted方法在被绑定元素插入到父节点之后再调用
        const callInsert = () => {
            for (let i = 0; i < dirsWithInsert.length; i++) {
                callHook(dirsWithInsert[i], 'inserted', vnode, oldVnode)
            }
        }
        if (isCreate) {
            // 新节点，执行指令的操作推迟到元素被插入父节点之后执行，将callInsert添加到虚拟节点的insert钩子函数中
            mergeVNodeHook(vnode, 'insert', callInsert)
        } else {
            // 如果不是新创建的节点，则直接执行
            callInsert()
        }
    }

    if (dirsWithPostpatch.length) {
        // 与inserted钩子函数相同，componentUpdated也需要推迟指令到所在组件的vnode和其子vnode全部更新后调用
        // 虚拟DOM会在元素更新前触发prepatch钩子函数
        // 正则更新时触发update钩子函数
        // 更新后出发postpatch钩子函数
        mergeVNodeHook(vnode, 'postpatch', () => {
            for (let i = 0; i < dirsWithPostpatch.length; i++) {
                callHook(dirsWithPostpatch[i], 'componentUpdated', vnode, oldVnode)
            }
        })
    }

    if (!isCreate) {
        for (key in oldDirs) {
            if (!newDirs[key]) {
                // no longer present, unbind
                // 旧指令在新指令中不存在时则需要解绑，触发unbind钩子函数
                callHook(oldDirs[key], 'unbind', oldVnode, oldVnode, isDestroy)
            }
        }
    }
}

const emptyModifiers = Object.create(null)

function normalizeDirectives (
    dirs: ?Array<VNodeDirective>,
    vm: Component
): { [key: string]: VNodeDirective } {
    const res = Object.create(null)
    if (!dirs) {
        // $flow-disable-line
        return res
    }
    let i, dir
    for (i = 0; i < dirs.length; i++) {
        dir = dirs[i]
        if (!dir.modifiers) {
            // $flow-disable-line
            dir.modifiers = emptyModifiers
        }
        res[getRawDirName(dir)] = dir
        dir.def = resolveAsset(vm.$options, 'directives', dir.name, true)
    }
    // Vue.directive('focus', {
    //     inserted: function (el) {
    //         el.focus()
    //     }
    // })
    // {
    //     v-focus: {
    //         def: { inserted: f },
    //         modifiers: { },
    //         name: 'focus',
    //         rawName: 'v-focus'
    //     }
    // }
    // $flow-disable-line
    return res
}

function getRawDirName (dir: VNodeDirective): string {
    return dir.rawName || `${dir.name}.${Object.keys(dir.modifiers || {}).join('.')}`
}

function callHook (dir, hook, vnode, oldVnode, isDestroy) {
    const fn = dir.def && dir.def[hook]
    if (fn) {
        try {
            fn(vnode.elm, dir, vnode, oldVnode, isDestroy)
        } catch (e) {
            handleError(e, vnode.context, `directive ${dir.name} ${hook} hook`)
        }
    }
}
