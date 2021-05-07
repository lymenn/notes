class EventEmitter{
    constructor(){
        this._events = Object.create(null)
    }
    on(event, fn){
        if(Array.isArray(event)){
            for(let i=0 , l = event.length; i < l; i++){
                this.on(event[i], fn)
            }
        } else{
            (this._events[event] || (this._events[event] = [])).push(fn)
        }
    }
    off(event, fn){
        if(!arguments.length){
            this._events = Object.create(null)
            return this
        }
        if(Array.isArray(event)){
            for(let i=0; i<event.length; i++){
                this.off(event[i], fn)
            }
            return this
        }
        let cbs  = this._events[event]
        if(!cbs) return 
        if(!fn){
            this._events[event] = null
        }
        let cb 
        let i = cbs.length
        while(i--){
            cb = cbs[i]
            if(cb === fn || cb.fn === fn){
                cbs.splice(i, 1)
                break
            }
        }
        return this
    }
    once(event, fn){
        let on = (...args) => {
            this.off(event, fn)
            fn.apply(this, args)
        }
        on.fn = fn
        this.on(event, on)
        return this
    }
    emit(event, ...args){
        if(this._events[event]){
            this._events[event].forEach(fn => {
                fn.apply(this, args)
            })
        }
        return this
    }
}