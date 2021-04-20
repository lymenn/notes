// 防止多次提交 只执行最后一次提交
// 搜索联想功能
const debounce = (fn, delay) => {
    let timer = null
    return (...args) => {
        if(timer) clearTimeout(timer)
        timer = setTimeout(function(){
            fn.apply(null, args)
        }, delay)
    }
}