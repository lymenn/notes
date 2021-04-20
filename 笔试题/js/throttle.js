const throttle = (fn, delay) => {
    let timer = null
    return (...args) => {
        if(timer) return
        timer = setTimeout(function(){
            fn.apply(null, ...args)
            timer = null
        }, delay)
    }
}