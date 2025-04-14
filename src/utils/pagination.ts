export interface Pagination {
  page: number
  limit: number
  skip: number
};

export function parsePagination(query: any): Pagination {
  const page = parseInt(query.page as string, 10) || 1
  const limit = parseInt(query.limit as string, 10) || 10
  const skip = (page - 1) * limit

  return { page, limit, skip }
};

export function generatePaginationResult(totalRows: number, pagination: Pagination) {
  return {
    rowsCount: totalRows,
    pageCount: Math.ceil(totalRows / pagination.limit),
    currentPage: pagination.page,
    limit: pagination.limit,
  };
}
