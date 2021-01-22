## MVVM构造函数
```js
function Vue(options = {}){
    // 配置初始化
    this.$options = options
    let data = this._data = this.$options.data

    // 数据劫持 Object.defineProperty
    observe(data)

    // 数据代理 this就代理了this._data
    for(let key in data){
        Object.defineProperty(this, key, {
            configurable: true,
            set(newVal){
                this._data[key] = newVal 
            }, 
            get(){
                return this.data[key]
            }, 
        })
    }
    // 数据编译 模板编译
    new Compile(options.el, this)
}
```
1. 创建了一个构造函数Vue,参数options为配置选项，默认为{}
2. 配置初始化
3. 数据劫持
4. 数据代理
5. 数据编译
## 数据劫持
```js
function Observe(data){
    let dep = new Dep()
    for(let key in data){
        let val = data[key]
        Object.defineProperty(data, key, {
            enumerable: true,
            get(){
                Dep.target && dep.addSub(Dep.target)
                return val
            }, 
            set(newVal){
                if(newVal === val) return 
                val = newVal
                observe(val)
                dep.notify()
            }, 
        })
        observe(val)
    }
}
// 外面再写一个函数
// 不用每次调用都写个new
// 也方便递归调用
function observe(data){
    // 如果不是对象的话直接return掉
    // 防止递归溢出
    if (!data || typeof data !== 'object') return;
    return new Observe(data);

}
```
1. 创建一个Observe构造函数，参数为待劫持的对象
2. 遍历对象的属性，給每个属性添加get和set方法
3. get方法中，如果被订阅，则把订阅者添加到容器中Dep中，然后再返回值
4. set方法中，如果只值发生改变，则需要调用observe方法劫持新值设置set和get方法，并通知订阅者值更新
5. observe(val)对属性值做深度劫持
## 数据代理
```js
function initProxy(){

}
```
## 数据渲染
```js
function initRender(el, vm){
    vm.$el = document.querySelector(el)
    let fragment = document.createDocumentFragment()
    
    while(let child = vm.$el.firstChild){
        fragment.appendChild(child);
    }
    replace(fragment)

    function replace(frag){
        const reg = /\{\{(.*?)\}\}/g;   // 正则匹配{{}}
        Array.from(frag.childNodes).forEach(node => {
            let txt = node.textContent; 
            
            if(node.nodeType === 3 && reg.test(txt)){
                (function replaceText(){
                    node.textContent = node.textContent.replace(reg, (matcher,placeholder) => {
                        new Watcher(vm, placeholder, replaceText)
                        return placeholder.split('.').reduce((val, key) =>{
                                return val[key]
                            }, vm)
                        })
                })()
                
            }
            if(node.nodeType === 1){
                let nodeAttr = node.attributes
                Array.from(nodeAttr).forEach(attr => {
                    let name = attr.name
                    let exp = attr.value
                    if(name.includes('v-')){
                        node.value = vm[exp]
                    }
                    new Watcher(vm, exp, newVal => {
                        node.value = newVal
                    })
                    node.addEventListener('input', e => {
                        let newVal = e.target.value
                        vm[exp] = newVal
                    })
                })
            }
            if(node.childNodes && node.childNodes.length){
                replace(node)
            }
        })
    }

    vm.$el.appendChild(fragment);
}
```
1. 创建渲染函数，el为元素选择器，vm为实例对象
2. 将el范围里内容拿到，并放入文档随便中节省开销
3. 对el里面的内容进行替换
## 发布订阅
```js
function Dep(){
    this.subs = []
}
Dep.prototype.addSub = function(sub){
    this.subs.push(sub)
}
Dep.prototype.notify = function(){
    this.subs.forEach(sub => sub.update())
}
function Watcher(vm, exp, fn){
    this.fn = fn
    this.vm = vm
    this.exp = exp
    Dep.target = this
    let val = vm
    let arr = exp.split('.')
    arr.forEach(key => {
        val = val[key]
    })
    Dep.target = null
}
Watcher.prototype.update = function(){
    let val = this.vm
    let arr = this.exp.split('.')
    arr.forEach(key => {
        val = val[key]
    })
    this.fn(val)
}
```