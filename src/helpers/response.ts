export function success<T>(data: T) {
  return {
    data,
    errors: false
  }
}

export function error(message: string, code: string = 'ERROR', status: number = 500) {
  return {
    data: null,
    errors: {
      message,
      code,
      status
    }
  }
}

export function validationError(details: { field: string; message: string }[]) {
  return {
    data: null,
    errors: details
  }
}
