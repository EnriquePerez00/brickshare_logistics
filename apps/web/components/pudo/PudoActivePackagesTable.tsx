'use client';

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package, TruckIcon, RotateCcw, AlertTriangle } from 'lucide-react';

interface ActivePackage {
  id: string;
  tracking_code: string;
  status: string;
  package_number: number;
  package_type: 'delivery' | 'return';
  customer_name: string;
  customer_first_name: string;
  customer_last_name: string;
  hours_in_location: number;
  created_at: string;
  updated_at: string;
}

interface PudoActivePackagesTableProps {
  locationId: string;
  onRefresh?: () => void;
}

export default function PudoActivePackagesTable({ locationId, onRefresh }: PudoActivePackagesTableProps) {
  const [packages, setPackages] = useState<ActivePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'delivery' | 'return'>('all');
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    loadPackages();
  }, [locationId]);

  async function loadPackages() {
    setLoading(true);
    try {
      const response = await fetch(`/api/pudo/active-packages?location_id=${locationId}`);
      if (!response.ok) throw new Error('Error loading packages');
      
      const result = await response.json();
      setPackages(result.data || []);
      setAlertCount(result.alerts?.over_24h || 0);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatTimeInLocation(hours: number): string {
    if (hours < 1) {
      return `${Math.floor(hours * 60)}m`;
    } else if (hours < 24) {
      const h = Math.floor(hours);
      const m = Math.floor((hours - h) * 60);
      return `${h}h ${m}m`;
    } else {
      const days = Math.floor(hours / 24);
      const h = Math.floor(hours % 24);
      return `${days}d ${h}h`;
    }
  }

  const filteredPackages = packages
    .filter(pkg => {
      if (typeFilter !== 'all' && pkg.package_type !== typeFilter) return false;
      if (searchTerm && !pkg.tracking_code.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Cargando paquetes...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda y filtros */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[250px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Buscar por tracking..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={typeFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter('all')}
          >
            <Package className="h-4 w-4 mr-2" />
            Todos
          </Button>
          <Button
            variant={typeFilter === 'delivery' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter('delivery')}
          >
            <TruckIcon className="h-4 w-4 mr-2" />
            Entregas
          </Button>
          <Button
            variant={typeFilter === 'return' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter('return')}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Devoluciones
          </Button>
        </div>
      </div>

      {/* Tabla */}
      {filteredPackages.length === 0 ? (
        <div className="p-8 text-center border rounded-lg">
          <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">No hay paquetes en local</h3>
          <p className="text-gray-500">Cuando lleguen paquetes, aparecerán aquí automáticamente.</p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Tracking Code</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Tiempo en local</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPackages.map((pkg) => {
                  const isOverdue = pkg.hours_in_location > 24;
                  return (
                    <TableRow 
                      key={pkg.id}
                      className={isOverdue ? 'bg-yellow-50' : ''}
                    >
                      <TableCell className="font-mono">{pkg.package_number}</TableCell>
                      <TableCell className="font-mono font-semibold">
                        {pkg.tracking_code}
                      </TableCell>
                      <TableCell>{pkg.customer_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {pkg.package_type === 'delivery' ? (
                            <>
                              <TruckIcon className="h-4 w-4 text-blue-600" />
                              <span className="text-sm">Entrega</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4 text-orange-600" />
                              <span className="text-sm">Devolución</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          En local
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{formatTimeInLocation(pkg.hours_in_location)}</span>
                          {isOverdue && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Alertas */}
          {alertCount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-medium">
                {alertCount} {alertCount === 1 ? 'paquete' : 'paquetes'} con más de 24h en local
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}