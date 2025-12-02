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
import { format, startOfMonth, endOfMonth, startOfYear, subMonths, subDays } from "date-fns";
import { es } from "date-fns/locale";
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
  const yesterday = subDays(today, 1); // Google Ads solo proporciona datos hasta ayer

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
      if (!customerId) return;

      try {
        setIsLoading(true);
        const res = await fetch(`https://optimizalo.app/api/fechas-con-datos/${customerId}`);
        
        if (!res.ok) {
          throw new Error(`Error ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        
        console.log('Raw API response:', data); // Debug
        
        if (!data.fechas || !Array.isArray(data.fechas)) {
          console.error('Invalid API response format:', data);
          setEnabledDates([]);
          return;
        }

        const normalizedDates = data.fechas.map((dateString: string) => {
          const normalized = normalizeToLocalDate(dateString);
          return normalized;
        });
        
        setEnabledDates(normalizedDates);
    
        
      } catch (err) {
        console.error("Error al obtener fechas disponibles:", err);
        setEnabledDates([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEnabledDates();
  }, [customerId]);

  const isDateEnabled = (date: Date) => {
    if (date > yesterday) return false; // deshabilitar días futuros (hasta ayer)
    
    // Si no hay fechas cargadas de la API, permitir todas las fechas hasta ayer
    if (enabledDates.length === 0) return true;
    
    const isEnabled = enabledDates.some(enabledDate => isSameDay(enabledDate, date));
    
    return isEnabled;
  };

  const presets = [
    {
      label: "Ayer",
      value: "yesterday",
      range: { from: yesterday, to: yesterday }
    },
    {
      label: "Este mes",
      value: "this-month",
      range: { from: startOfMonth(today), to: yesterday }
    },
    {
      label: "Último mes",
      value: "last-month",
      range: { from: startOfMonth(subMonths(today, 1)), to: endOfMonth(subMonths(today, 1)) }
    },
    {
      label: "Este año",
      value: "this-year",
      range: { from: startOfYear(today), to: yesterday }
    }
  ];

  const handlePresetSelect = (value: string) => {
    const preset = presets.find(p => p.value === value);
    if (preset) {
      onChange(preset.range);
      setTempRange({});
      setIsOpen(false);
    }
  };

  const handleCalendarSelect = (selected: Date) => {
    console.log("Calendar selected:", selected);
    
    if (selected) {
      // Si no hay primera fecha seleccionada
      if (!tempRange.from) {
        console.log("Primera fecha seleccionada:", selected);
        setTempRange({ from: selected });
        setHoverDate(undefined);
        // No cerrar el calendario, mantenerlo abierto
      } else {
        // Ya hay una primera fecha, esta es la segunda
        console.log("Segunda fecha seleccionada:", selected);
        const startDate = tempRange.from;
        const endDate = selected;
        
        // Crear el rango final
        const finalRange = startDate <= endDate 
          ? { from: startDate, to: endDate }
          : { from: endDate, to: startDate };
        
        console.log("Rango final:", finalRange);
        onChange(finalRange);
        setTempRange({});
        setHoverDate(undefined);
        setIsOpen(false);
      }
    }
  };

  // Función para manejar clicks en días ya seleccionados
  const handleDayClick = (date?: Date) => {
    if (!date) return;
    
    console.log("Day clicked:", date, "Enabled:", isDateEnabled(date));
    
    // 🔒 Solo permitir clicks en días habilitados
    if (!isDateEnabled(date)) {
      console.log("Date not enabled, ignoring click");
      return;
    }
    
    // Si hay una fecha temporal y hacemos click en la misma fecha
    if (tempRange.from && isSameDay(tempRange.from, date)) {
      console.log("Click en la misma fecha - creando rango de un día");
      onChange({ from: date, to: date });
      setTempRange({});
      setHoverDate(undefined);
      setIsOpen(false);
      return;
    }
    
    // Si no, usar la lógica normal de selección
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
      return format(dateRange.from, "dd/MM/yy", { locale: es });
    }
    return `${format(dateRange.from, "dd/MM/yy", { locale: es })} - ${format(dateRange.to, "dd/MM/yy", { locale: es })}`;
  };

  const isDisabled = disabled || isLoading;

  return (
    <Popover 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!isDisabled) {
          setIsOpen(open);
          if (!open) {
            setTempRange({});
            setHoverDate(undefined);
          }
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
          {isLoading ? "Cargando fechas..." : formatDateDisplay()}
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
            onSelect={handleDayClick}
            onDayClick={handleDayClick}
            onDayMouseEnter={handleDayMouseEnter}
            onDayMouseLeave={handleDayMouseLeave}
            disabled={(date) => !isDateEnabled(date)}
            defaultMonth={dateRange.to || yesterday}
            locale={es}
            weekStartsOn={1}
            className={cn("pointer-events-auto")}
            modifiers={{
              range_start: (() => {
                if (tempRange.from && hoverDate) {
                  return tempRange.from <= hoverDate ? tempRange.from : hoverDate;
                }
                return tempRange.from || dateRange.from;
              })(),
              range_end: (() => {
                if (tempRange.from && hoverDate) {
                  return tempRange.from <= hoverDate ? hoverDate : tempRange.from;
                }
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
              })()
            }}
            modifiersClassNames={{
              range_start: "!bg-accent !text-accent-foreground hover:!bg-accent/90 !rounded-none",
              range_end: "!bg-accent !text-accent-foreground hover:!bg-accent/90 !rounded-none", 
              range_middle: "!bg-accent/20 !text-accent hover:!bg-accent/30 !rounded-none",
              today: "bg-transparent text-foreground !rounded-none"
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DateRangeFilter;