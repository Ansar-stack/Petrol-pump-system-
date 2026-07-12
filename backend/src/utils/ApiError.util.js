class ApiError extends Error {
    constructor(status, message = "Some thing went wrong", errors = [], stack = ""){
        super(message)
        this.status = status, 
        this.data = null, 
        this.message = message, 
        this.success = false, 
        this.errors = errors
    }
}

export default ApiError