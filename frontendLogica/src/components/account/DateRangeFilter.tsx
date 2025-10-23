import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
} from "date-fns";
import { cn } from "@/lib/utils";

interface DateRangeFilterProps {
  customerId: string;
  dateRange: { from: Date; to: Date };
  onChange: (range: { from: Date; to: Date }) => void;
  disabled?: boolean;
}

const DateRangeFilter = ({ customerId, dateRange, onChange, disabled = false }: DateRangeFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempRange, setTempRange] = useState<{ from?: Date; to?: Date }>({});
  const [hoverDate, setHoverDate] = useState<Date | undefined>(undefined);
  const [enabledDates, setEnabledDates] = useState<Date[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const today = new Date();

  // Función para normalizar fechas a medianoche local
  const normalizeToLocalDate = (dateString: string): Date => {
    // Si viene en formato ISO (YYYY-MM-DD), crear fecha local
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day); // month - 1 porque Date usa índice 0-11
    }
    
    // Para otros formatos, usar Date constructor pero normalizar a medianoche local
    const date = new Date(dateString);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  };

  // Función para comparar fechas sin considerar horas
  const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  // Fetch fechas habilitadas desde la API
  useEffect(() => {
    const fetchEnabledDates = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`https://pwi.es/api/fechas-con-datos/${customerId}`);
        const data = await res.json();
        
        console.log('Raw API response:', data); // Debug
        
        const normalizedDates = data.fechas.map((dateString: string) => {
          const normalized = normalizeToLocalDate(dateString);
          return normalized;
        });
        
        setEnabledDates(normalizedDates);
        
      } catch (err) {
        console.error("Error al obtener fechas disponibles:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (customerId) fetchEnabledDates();
  }, [customerId]);

  const isDateEnabled = (date: Date) => {
    if (date > today) return false; // deshabilitar días futuros
    
    const isEnabled = enabledDates.some(enabledDate => isSameDay(enabledDate, date));
    
    return isEnabled;
  };

  const presets = [
    { label: "Hoy", value: "today", range: { from: today, to: today } },
    { label: "Este mes", value: "this-month", range: { from: startOfMonth(today), to: today } },
    { label: "Último mes", value: "last-month", range: { from: startOfMonth(subMonths(today, 1)), to: endOfMonth(subMonths(today, 1)) } },
    { label: "Este año", value: "this-year", range: { from: startOfYear(today), to: today } },
  ];

  const handlePresetSelect = (value: string) => {
    const preset = presets.find((p) => p.value === value);
    if (preset) {
      onChange(preset.range);
      setTempRange({});
      setIsOpen(false);
    }
  };

  const handleCalendarSelect = (selected: Date) => {
    if (selected) {
      
      if (!tempRange.from) {
        setTempRange({ from: selected });
        setHoverDate(undefined);
      } else {
        const startDate = tempRange.from;
        const endDate = selected;
        const finalRange = startDate <= endDate ? { from: startDate, to: endDate } : { from: endDate, to: startDate };
        
        console.log(`Final range selected: ${finalRange.from.toLocaleDateString()} - ${finalRange.to.toLocaleDateString()}`); // Debug
        
        onChange(finalRange);
        setTempRange({});
        setHoverDate(undefined);
        setIsOpen(false);
      }
    }
  };

  const handleDayClick = (date?: Date) => {
    if (!date) return;
    
    console.log(`Day clicked: ${date.toLocaleDateString()}, Enabled: ${isDateEnabled(date)}`); // Debug
    
    if (!isDateEnabled(date)) return; // 🔒 solo días habilitados
    
    if (tempRange.from && isSameDay(tempRange.from, date)) {
      console.log(`Same day selected twice, setting single day range`); // Debug
      onChange({ from: date, to: date });
      setTempRange({});
      setHoverDate(undefined);
      setIsOpen(false);
      return;
    }
    
    handleCalendarSelect(date);
  };

  const handleDayMouseEnter = (date: Date) => {
    if (tempRange.from && !tempRange.to && isDateEnabled(date)) {
      setHoverDate(date);
    }
  };

  const handleDayMouseLeave = () => {
    setHoverDate(undefined);
  };

  const formatDateDisplay = () => {
    if (isSameDay(dateRange.from, dateRange.to)) {
      return format(dateRange.from, "dd/MM/yy");
    }
    return `${format(dateRange.from, "dd/MM/yy")} - ${format(dateRange.to, "dd/MM/yy")}`;
  };

  const isDisabled = disabled || isLoading;

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (!isDisabled) {
          setIsOpen(open);
          if (!open) setTempRange({});
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="w-[280px] justify-start text-left font-normal"
          disabled={isDisabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {isLoading ? "Cargando..." : formatDateDisplay()}
          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 border-b">
          <Select onValueChange={handlePresetSelect}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Opciones rápidas" />
            </SelectTrigger>
            <SelectContent>
              {presets.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="p-0">
          <Calendar
            mode="single"
            selected={tempRange.from || dateRange.from}
            onDayClick={handleDayClick}
            onDayMouseEnter={handleDayMouseEnter}
            onDayMouseLeave={handleDayMouseLeave}
            disabled={(date) => !isDateEnabled(date)} // 🔒 integración con API
            defaultMonth={dateRange.to || today}
            className={cn("pointer-events-auto")}
            modifiers={{
              range_start: (() => {
                if (tempRange.from && hoverDate) return tempRange.from <= hoverDate ? tempRange.from : hoverDate;
                return tempRange.from || dateRange.from;
              })(),
              range_end: (() => {
                if (tempRange.from && hoverDate) return tempRange.from <= hoverDate ? hoverDate : tempRange.from;
                return tempRange.to || dateRange.to;
              })(),
              range_middle: (() => {
                let start, end;
                if (tempRange.from && hoverDate) {
                  start = tempRange.from <= hoverDate ? tempRange.from : hoverDate;
                  end = tempRange.from <= hoverDate ? hoverDate : tempRange.from;
                } else {
                  start = tempRange.from || dateRange.from;
                  end = tempRange.to || dateRange.to;
                }
                if (!start || !end || isSameDay(start, end)) return [];
                const days = [];
                const current = new Date(start);
                current.setDate(current.getDate() + 1);
                while (current < end) {
                  days.push(new Date(current));
                  current.setDate(current.getDate() + 1);
                }
                return days;
              })(),
            }}
            modifiersClassNames={{
              range_start: "!bg-accent !text-accent-foreground hover:!bg-accent/90 !rounded-none",
              range_end: "!bg-accent !text-accent-foreground hover:!bg-accent/90 !rounded-none",
              range_middle: "!bg-accent/20 !text-accent hover:!bg-accent/30 !rounded-none",
              today: "bg-transparent text-foreground !rounded-none",
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DateRangeFilter;