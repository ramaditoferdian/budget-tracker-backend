export interface PaginationMeta {
  rowsCount: number;
  pageCount: number;
  currentPage: number;
  limit: number;
}

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

// Generic Result Function with Type Assertion
export function result<T>(data: T, pagination?: PaginationMeta): T {
  if (pagination) {
    // If pagination is provided, merge pagination metadata with data
    const resultData = {
      ...data,
      pagination,
    };
    
    // Perform type assertion to return the correct type T
    return resultData as T;
  }

  return data;
}