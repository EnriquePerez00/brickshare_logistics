'use client';

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, FileDown, ClipboardList } from 'lucide-react';
import HistoryFilters from './HistoryFilters';

interface OperationRecord {
  id: string;
  scan_timestamp: string;
  tracking_code: string;
  action_type: 'delivery_confirmation' | 'return_confirmation';
  action_type_label: string;
  previous_status: string;
  new_status: string;
  status_transition: string;
  result: boolean;
  operator_name: string;
  operator_id: string;
}

interface HistoryFilters {
  dateFrom: string;
  dateTo: string;
  actionType: 'all' | 'delivery_confirmation' | 'return_confirmation';
  resultFilter: 'all' | 'success' | 'failed';
  trackingSearch: string;
}

interface PudoOperationsHistoryProps {
  locationId: string;
}

export default function PudoOperationsHistory({ locationId }: PudoOperationsHistoryProps) {
  const [operations, setOperations] = useState<OperationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState<HistoryFilters>({
    dateFrom: today,
    dateTo: today,
    actionType: 'all',
    resultFilter: 'all',
    trackingSearch: ''
  });
  
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0
  });

  useEffect(() => {
    loadOperations();
  }, [locationId, filters, pagination.page]);

  async function loadOperations() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        location_id: locationId,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.dateFrom && { date_from: filters.dateFrom }),
        ...(filters.dateTo && { date_to: filters.dateTo }),
        ...(filters.actionType !== 'all' && { action_type: filters.actionType }),
        ...(filters.resultFilter !== 'all' && { result_filter: filters.resultFilter }),
        ...(filters.trackingSearch && { tracking_search: filters.trackingSearch })
      });

      const response = await fetch(`/api/pudo/operations-history?${params}`);
      if (!response.ok) throw new Error('Error loading history');
      
      const result = await response.json();
      setOperations(result.data || []);
      setPagination(prev => ({
        ...prev,
        totalCount: result.pagination.total_count,
        totalPages: result.pagination.total_pages
      }));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        location_id: locationId,
        ...(filters.dateFrom && { date_from: filters.dateFrom }),
        ...(filters.dateTo && { date_to: filters.dateTo }),
        ...(filters.actionType !== 'all' && { action_type: filters.actionType }),
        ...(filters.resultFilter !== 'all' && { result_filter: filters.resultFilter }),
        ...(filters.trackingSearch && { tracking_search: filters.trackingSearch })
      });

      const response = await fetch(`/api/pudo/export-history?${params}`);
      if (!response.ok) throw new Error('Error exporting');
      
      const data = await response.json();
      
      // Convertir a CSV
      if (data.length === 0) {
        alert('No hay datos para exportar');
        return;
      }

      const headers = Object.keys(data[0]);
      const csvHeaders = headers.join(',');
      const csvRows = data.map((row: any) => 
        headers.map(header => {
          const value = row[header];
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      );
      
      const csv = [csvHeaders, ...csvRows].join('\n');
      
      // Descargar
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `operaciones-pudo-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al exportar. Intenta de nuevo.');
    } finally {
      setIsExporting(false);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Cargando histórico...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <HistoryFilters
        filters={filters}
        onFiltersChange={(newFilters) => {
          setFilters(newFilters);
          setPagination(prev => ({ ...prev, page: 1 }));
        }}
        onExport={handleExport}
        isExporting={isExporting}
      />

      {/* Tabla */}
      {operations.length === 0 ? (
        <div className="p-8 text-center border rounded-lg">
          <ClipboardList className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">No hay operaciones registradas</h3>
          <p className="text-gray-500">Las operaciones de escaneo aparecerán aquí una vez que se realicen.</p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha/Hora</TableHead>
                  <TableHead>Tracking Code</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Estados</TableHead>
                  <TableHead className="text-center">Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operations.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell className="font-mono text-sm">
                      {formatDate(op.scan_timestamp)}
                    </TableCell>
                    <TableCell className="font-mono font-semibold">
                      {op.tracking_code}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{op.action_type_label}</div>
                        <div className="text-sm text-gray-500">Operador: {op.operator_name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {op.status_transition}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {op.result ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.totalCount)} de {pagination.totalCount} registros
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  ← Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant={pagination.page === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  {pagination.totalPages > 5 && <span className="px-2">...</span>}
                  {pagination.totalPages > 5 && (
                    <Button
                      variant={pagination.page === pagination.totalPages ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: pagination.totalPages }))}
                    >
                      {pagination.totalPages}
                    </Button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages}
                >
                  Siguiente →
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}