# Update Remote Shipment Status - Tests

Esta Edge Function actualiza el estado de envíos cuando se escanean en puntos PUDO.

## Ejecución de Tests

```bash
# Ejecutar tests unitarios
deno test --allow-env --allow-net supabase/functions/update-remote-shipment-status/index.test.ts

# Ejecutar con cobertura
deno test --allow-env --allow-net --coverage=coverage supabase/functions/update-remote-shipment-status/index.test.ts

# Ver reporte de cobertura
deno coverage coverage
```

## Casos de Prueba

### 1. Transición: in_transit_pudo → delivered_pudo
- **Input**: `{ shipmentId: "test-123", currentStatus: "in_transit_pudo" }`
- **Expected**: Status cambiado a "delivered_pudo"
- **Validación**: Registro en `pudo_scan_logs` y actualización en `shipment_status`

### 2. Transición: in_return_pudo → in_return
- **Input**: `{ shipmentId: "test-456", currentStatus: "in_return_pudo" }`
- **Expected**: Status cambiado a "in_return"
- **Validación**: Registro en `pudo_scan_logs` y actualización en `shipment_status`

### 3. Estado no válido
- **Input**: `{ shipmentId: "test-789", currentStatus: "pending" }`
- **Expected**: Error 400 con mensaje descriptivo
- **Validación**: No se realiza cambio de estado

### 4. Shipment no encontrado
- **Input**: `{ shipmentId: "non-existent", currentStatus: "in_transit_pudo" }`
- **Expected**: Error 404
- **Validación**: No se crea registro en logs

## Estructura de Tests

```typescript
Deno.test("Edge Function Tests", async (t) => {
  await t.step("Valid transition: in_transit_pudo → delivered_pudo", async () => {
    // Test implementation
  });
  
  await t.step("Valid transition: in_return_pudo → in_return", async () => {
    // Test implementation
  });
  
  await t.step("Invalid status transition", async () => {
    // Test implementation
  });
  
  await t.step("Shipment not found", async () => {
    // Test implementation
  });
});
```

## Mocking

Los tests usan mocks para:
- Cliente de Supabase
- Respuestas de base de datos
- Validación de parámetros

## Cobertura Esperada

- Líneas: >90%
- Funciones: 100%
- Ramas: >85%