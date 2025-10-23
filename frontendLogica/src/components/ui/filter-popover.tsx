import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Filter, X } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

interface FilterPopoverProps {
  filters: FilterConfig[];
  onClearAll?: () => void;
}

export function FilterPopover({ filters, onClearAll }: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  
  // Count active filters (not including "all" values)
  const activeFiltersCount = filters.filter(filter => 
    filter.value && filter.value !== "all"
  ).length;

  const handleClearAll = () => {
    if (onClearAll) {
      onClearAll();
    } else {
      filters.forEach(filter => filter.onChange("all"));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative">
          <Filter className="h-4 w-4 mr-2" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge 
              variant="secondary" 
              className="ml-2 h-5 min-w-[20px] rounded-full p-0 text-xs flex items-center justify-center"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="bottom" sideOffset={5} avoidCollisions={true} collisionPadding={20}>
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filtros</h4>
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="h-8 px-2 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Limpiar
              </Button>
            )}
          </div>
        </div>
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">{/* Limitar altura y permitir scroll interno */}
          {filters.map((filter, index) => (
            <div key={filter.key} className="space-y-3">
              {index > 0 && <div className="border-t pt-4" />}
              <label className="text-sm font-semibold text-foreground border-b border-border pb-1 block">{filter.label}</label>
              <div className="grid gap-2">
                {filter.options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => filter.onChange(option.value)}
                    className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-md transition-colors ${
                      filter.value === option.value
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span>{option.label}</span>
                    {filter.value === option.value && (
                      <div className="w-2 h-2 rounded-full bg-current" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}