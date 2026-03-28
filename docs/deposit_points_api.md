# Deposit Points API

This API provides a public listing of active deposit points. It ensures that no personally identifiable information (PII) is exposed.

## `GET /api/locations`

Fetches all active deposit points along with their auto-assigned 5-digit tracking code.

### Request

- **Method**: `GET`
- **URL**: `/api/locations`
- **Headers**: None required.

### Response Structure

Returns a JSON array on success (`200 OK`).

```typescript
type LocationResponse = {
  pudo_id: string;        // Sequential PUDO identifier (e.g., "brickshare-001") - Primary identifier
  code: string;           // Assigned 5-digit code (calculated from internal ID)
  name: string;           // Internal name or owner name
  location_name: string;  // Public name of the establishment
  address: string;        // Physical address
  postal_code: string;    // ZIP/Postal code
  city: string;           // City
  is_active: boolean;     // Active status of the location
}[]
```

### Example Response

```json
[
  {
    "pudo_id": "brickshare-001",
    "code": "48192",
    "name": "Paco Pil",
    "location_name": "Kiosko Central",
    "address": "Calle Mayor 12",
    "postal_code": "28013",
    "city": "Madrid",
    "is_active": true
  },
  {
    "pudo_id": "brickshare-002",
    "code": "19542",
    "name": "Ana García",
    "location_name": "Papelería Ana",
    "address": "Avenida de América 23",
    "postal_code": "28002",
    "city": "Madrid",
    "is_active": true
  }
]
```

### Errors

- `500 Internal Server Error`: Returned if there is an issue fetching the data from the database. Body format: `{ "error": "Failed to fetch deposit points" }`.
