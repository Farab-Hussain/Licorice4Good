# Migration from Cookies to localStorage

All authentication has been migrated from HTTP-only cookies to localStorage. 

## What Changed

### Backend
- ✅ Removed cookie setting from login/register endpoints
- ✅ Removed cookie fallbacks from auth middleware
- ✅ Now only reads token from `Authorization: Bearer <token>` header

### Frontend
- ✅ Created `utils/axios.ts` - axios instance with automatic Authorization header injection
- ✅ Created `utils/tokenUtils.ts` - localStorage token management utilities
- ✅ Updated login/register to store token in localStorage
- ✅ Updated useUser hook to use apiClient
- ✅ Updated cartStore and ordersStore to use apiClient

## Files Still Need Updates

The following files still use `withCredentials: true` and should be updated to use `apiClient` instead:

### Priority Files (Authentication Required):
1. `app/dashboard/admin/page.tsx` - Many admin API calls
2. `app/dashboard/orders/page.tsx` - Order management
3. `app/dashboard/page.tsx` - Dashboard data
4. `app/dashboard/analytics/page.tsx` - Analytics

### Public/Optional Auth Files:
- `app/(root)/cart/page.tsx` - Cart operations (may work without auth)
- `app/(root)/checkout/page.tsx` - Checkout (may work without auth)
- `app/(root)/track-order/page.tsx` - Order tracking (public)
- `app/auth/reset-password/page.tsx` - Password reset (public)
- `app/auth/forgot-password/page.tsx` - Password reset (public)
- `components/ui/shop/CustomPackBuilder.tsx` - Cart operations
- `config-webhook/cart.tsx` - Webhook config

## How to Update Files

### For Authenticated Requests:
Replace:
```typescript
import axios from 'axios';
const response = await axios.get(`${API_URL}/endpoint`, { withCredentials: true });
```

With:
```typescript
import apiClient from '@/utils/axios';
const response = await apiClient.get('/endpoint');
```

### For Public Requests (No Auth Needed):
Simply remove `withCredentials: true`:
```typescript
// Before
const response = await axios.get(`${API_URL}/endpoint`, { withCredentials: true });

// After
const response = await axios.get(`${API_URL}/endpoint`);
```

## Usage

### Using apiClient (for authenticated requests):
```typescript
import apiClient from '@/utils/axios';

// GET request
const response = await apiClient.get('/orders');

// POST request
const response = await apiClient.post('/orders', orderData);

// PUT request
const response = await apiClient.put('/orders/123', data);

// DELETE request
const response = await apiClient.delete('/orders/123');
```

The `apiClient` automatically:
- Adds `Authorization: Bearer <token>` header from localStorage
- Handles 401/403 errors by clearing token and redirecting to login
- Uses the base URL from `NEXT_PUBLIC_API_URL`

### Using tokenUtils directly:
```typescript
import { getToken, setToken, removeToken, hasToken } from '@/utils/tokenUtils';

// Get token
const token = getToken();

// Set token (after login)
setToken(token);

// Remove token (on logout)
removeToken();

// Check if token exists
if (hasToken()) {
  // User is logged in
}
```

