// PaginationControlled.tsx
import React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface PaginationControlledProps {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
}

const PaginationControlled: React.FC<PaginationControlledProps> = ({
  currentPage,
  onPageChange,
  totalPages,
}) => (
  <Pagination aria-label="pagination" className="justify-center">
    <PaginationContent>
      <PaginationItem>
        <PaginationPrevious
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
        />
      </PaginationItem>

      {Array.from({ length: totalPages }, (_, i) => (
        <PaginationItem key={i}>
          <PaginationLink
            onClick={() => onPageChange(i + 1)}
            isActive={currentPage === i + 1}
            className="cursor-pointer"
          >
            {i + 1}
          </PaginationLink>
        </PaginationItem>
      ))}

      <PaginationItem>
        <PaginationNext
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
        />
      </PaginationItem>
    </PaginationContent>
  </Pagination>
);

export default PaginationControlled;
