'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, FileDown, Calendar } from 'lucide-react';

interface HistoryFilters {
  dateFrom: string;
  dateTo: string;
  actionType: 'all' | 'delivery_confirmation' | 'return_confirmation';
  resultFilter: 'all' | 'success' | 'failed';
  trackingSearch: string;
}

interface HistoryFiltersProps {
  filters: HistoryFilters;
  onFiltersChange: (filters: HistoryFilters) => void;
  onExport: () => void;
  isExporting: boolean;
}

export default function HistoryFilters({ filters, onFiltersChange, onExport, isExporting }: HistoryFiltersProps) {
  const today = new Date().toISOString().split('T')[0];
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  function applyPreset(preset: 'today' | 'week' | 'month') {
    const newFilters = { ...filters };
    switch (preset) {
      case 'today':
        newFilters.dateFrom = today;
        newFilters.dateTo = today;
        break;
      case 'week':
        newFilters.dateFrom = lastWeek;
        newFilters.dateTo = today;
        break;
      case 'month':
        newFilters.dateFrom = lastMonth;
        newFilters.dateTo = today;
        break;
    }
    onFiltersChange(newFilters);
  }

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Calendar className="h-4 w-4" />
        Filtros:
      </div>

      {/* Fila 1: Fechas y Presets */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Desde:</label>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
            className="w-auto"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Hasta:</label>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
            className="w-auto"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset('today')}
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset('week')}
          >
            Última semana
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset('month')}
          >
            Último mes
          </Button>
        </div>
      </div>

      {/* Fila 2: Acción y Resultado */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Acción:</label>
          <Select
            value={filters.actionType}
            onValueChange={(value: any) => onFiltersChange({ ...filters, actionType: value })}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="delivery_confirmation">Entregas confirmadas</SelectItem>
              <SelectItem value="return_confirmation">Devoluciones recibidas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Resultado:</label>
          <Select
            value={filters.resultFilter}
            onValueChange={(value: any) => onFiltersChange({ ...filters, resultFilter: value })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="success">Exitosos</SelectItem>
              <SelectItem value="failed">Fallidos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Buscar por tracking..."
              value={filters.trackingSearch}
              onChange={(e) => onFiltersChange({ ...filters, trackingSearch: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>

        <Button
          onClick={onExport}
          disabled={isExporting}
          variant="default"
          size="sm"
        >
          <FileDown className="h-4 w-4 mr-2" />
          {isExporting ? 'Exportando...' : 'Exportar CSV'}
        </Button>
      </div>
    </div>
  );
}