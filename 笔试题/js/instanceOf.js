function myInstanceOf(leftVal, rightVal){
    let rihgtProto = rightVal.prototype
    let leftProto = leftVal.__proto__
    while(true){
        if(leftProto === null){
            return false
        }
        if(leftProto === rihgtProto){
            return true
        }
        leftProto = leftProto.__proto__
    }
}