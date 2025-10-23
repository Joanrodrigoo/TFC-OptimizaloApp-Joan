// sortPagination.ts
import { useState, useCallback, useEffect } from "react";

type SortOrder = "asc" | "desc";
type SortField = string;

export function useSorting() {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
      } else {
        setSortField(field);
        setSortOrder("asc");
      }
    },
    [sortField, sortOrder]
  );

  const getSortIcon = (field: SortField) => {
    if (field !== sortField) return null;
    return sortOrder === "asc" ? "↑" : "↓"; // Puedes reemplazar por iconos
  };

  return { sortField, sortOrder, handleSort, getSortIcon };
}

export function usePagination(totalItems: number, itemsPerPage: number) {
  const [currentPage, setCurrentPage] = useState(1);
  
  // Recalcular totalPages cada vez que cambie totalItems
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Resetear página si la página actual es mayor que el total de páginas
  useEffect(() => {
    if (totalItems > 0 && totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage, totalItems]);

  const handlePageChange = useCallback((page: number) => {
    if (page < 1 || page > totalPages) return;
    console.log('Page change:', { from: currentPage, to: page, totalPages });
    setCurrentPage(page);
  }, [currentPage, totalPages]);

  const resetPage = useCallback(() => {
    console.log('Reset page to 1');
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    totalPages,
    handlePageChange,
    resetPage,
  };
}