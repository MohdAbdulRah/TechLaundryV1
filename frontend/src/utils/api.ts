import type { AuthToken, LoginPayload, SignupPayload } from '../types/auth';
import { decodeJwtPayload, getToken } from './auth';  // ← add getToken
import type { UserRole } from '../types/auth';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.message ?? data?.error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

// ── NEW: authenticated request ─────────────────────────
async function authRequest<T>(path: string, body: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.message ?? data?.error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthToken> => {
    const res = await request<{ data: AuthToken }>('/api/users/login', payload);
    
    // API returns { status, success, message, data: { token, user } }
    // Merge JWT payload into user to fill missing fields (role, etc.)
    const { token, user } = res.data;
    const jwtPayload = decodeJwtPayload(token);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: (jwtPayload?.role as UserRole) ?? 'user',  // ← pulled from JWT
        firstName : (jwtPayload?.firstName as string) ?? '',
      },
    };
  },

  signup: async (payload: SignupPayload): Promise<AuthToken> => {
    const res = await request<{ data: AuthToken }>('/api/users/signup', payload);
    const { token, user } = res.data;
    const jwtPayload = decodeJwtPayload(token);

    return {
      token,
      user: {
        id:        (jwtPayload?.id as string)       ?? '',
        username:  (jwtPayload?.username as string) ?? '',
        email:     (jwtPayload?.email as string)    ?? '',
        role:      (jwtPayload?.role as UserRole)   ?? 'user',
        firstName: (jwtPayload?.firstName as string)    ?? ''
      },
    };
  },
};

type GeoPoint = {
  type: 'Point';
  coordinates: [number, number];
};

export const shopApi = {
  addShop: async (payload: {
    name: string;
    address: string;
    location: GeoPoint;
  }) => {
    const res = await authRequest<{ data: unknown }>(
      '/api/shop/add',
      payload
    );

    return res.data;
  },
   getShopDeliveries: async () => {
    const token = getToken();

    const res = await fetch(
      `${BASE_URL}/api/shop/orders`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        data?.message ??
          data?.error ??
          `Request failed (${res.status})`
      );
    }

    return data.data;
  },
  getOtpCollectedFromUser: async (data: {
  deliveryId: string;
}) => {

  try {

    const response = await fetch(
      `${BASE_URL}/api/shop/get/otp/collected_from_user`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(data),
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    return result.data;

  } catch (err: any) {

    throw new Error(
      err.message || "Failed to fetch OTP"
    );

  }

},
 markServiceDone: async (data: {
  deliveryId: string;
  serviceId: string;
}) => {

  try {

    const response = await fetch(
      `${BASE_URL}/api/shop/mark-service-done`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(data),
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    return result.data;

  } catch (err: any) {

    throw new Error(
      err.message || "Failed to fetch OTP"
    );

  }

},
 assignDeliveryBoy: async (data: {
  deliveryId: string;
}) => {

  try {

    const response = await fetch(
      `${BASE_URL}/api/shop/assign-delivery-boy`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(data),
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    return result.data;

  } catch (err: any) {

    throw new Error(
      err.message || "Failed to fetch OTP"
    );

  }

},
 getValidOtpForCollectionFromShop: async (
  deliveryId: string
) => {

  try {

    const response = await fetch(
      `${BASE_URL}/api/shop/get-valid-otp-for-collection-from-shop/${deliveryId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
       
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    return result.data;

  } catch (err: any) {

    throw new Error(
      err.message || "Failed to fetch OTP"
    );

  }

},
};

export const deliveryApi = {
  getMyDeliveries: async () => {
    const token = getToken();

    const res = await fetch(
      `${BASE_URL}/api/delivery/all-deliveries`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        data?.message ??
          data?.error ??
          `Request failed (${res.status})`
      );
    }

    return data.data;
  },
  getUserDeliveries: async () => {
    const token = getToken();

    const res = await fetch(
      `${BASE_URL}/api/delivery/user`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        data?.message ??
          data?.error ??
          `Request failed (${res.status})`
      );
    }

    return data.data;
  },
  getOtpStarted: async (deliveryId: string) => {

  const token = getToken();

  const res = await fetch(
    `${BASE_URL}/api/delivery/get-otp-started`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify({
        deliveryId
      }),
    }
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data?.message ??
      data?.error ??
      `Request failed (${res.status})`
    );
  }

  return data.data;
},
createOtpCode: async ({
  deliveryId,
  user1,
}: {
  deliveryId: string;
  user1: string;
}) => {
  const token = getToken();

  const res = await fetch(
    `${BASE_URL}/api/otp/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        deliveryId,
        user1,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "Failed to create OTP");
  }

  return data.data;
},

verifyOtpCollectionStarted: async ({
  deliveryId,
  otp,
}: {
  deliveryId: string;
  otp: string;
}) => {
  const token = getToken();

  const res = await fetch(
    `${BASE_URL}/api/otp/verify-otp-collection-started`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        deliveryId,
        otp,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "OTP verification failed");
  }

  return data.data;
},
createOtpForShopCollection: async ({
  deliveryId,
  shopId,
}: {
  deliveryId: string;
  shopId: string;
}) => {
  const token = getToken();

  const res = await fetch(
    `${BASE_URL}/api/otp/otp-for-shop-collection`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        deliveryId,
        shopId,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "OTP Creation failed");
  }

  return data.data;
},
verifyOtpForShopCollection: async (body: {
  deliveryId: string;
  shopId: string;
  otp: string;
}) => {

  const res = await fetch(
    `${BASE_URL}/api/otp/verify-otp/shop-collection`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(body)
    }
  );

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.message);
  }

  return data.data;
},
createOtpForCollectionFromShop: async (body: {
  deliveryId: string;
  shopId: string;
}) => {

  const res = await fetch(
    `${BASE_URL}/api/otp/create-otp-for-collection-from-shop`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(body)
    }
  );

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.message);
  }

  return data.data;
},
verifyOtpForCollectionFromShop: async (body: {
  deliveryId: string;
  otpCode: string;
}) => {

  const res = await fetch(
    `${BASE_URL}/api/otp/verify-otp-for-collection-from-shop`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(body)
    }
  );

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.message);
  }

  return data.data;
},
giveToUser: async (body: {
  deliveryId: string
}) => {

  const res = await fetch(
    `${BASE_URL}/api/otp/create-otp-for-give-to-user`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(body)
    }
  );

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.message);
  }

  return data.data;
},
getOtpForGiveToUser : async (body: {
  deliveryId: string
}) => {

  const res = await fetch(
    `${BASE_URL}/api/delivery/get-otp-for-give-to-user`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(body)
    }
  );

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.message);
  }

  return data.data;
},
verifyOtpForGiveToUser: async (body: {
  deliveryId: string;
  otpCode: string;
}) => {

  const res = await fetch(
    `${BASE_URL}/api/otp/verify-otp-for-give-to-user`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(body)
    }
  );

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.message);
  }

  return data.data;
},
getDoneDeliveries: async () => {

  const res = await fetch(
    `${BASE_URL}/api/delivery/get-completed-deliveries-of-delivery-boy`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      
    }
  );

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.message);
  }

  return data.data;
},
updateLiveLocation: async (body: {
  deliveryId: string;
  coordinates: [number, number];
}) => {

  const res = await fetch(
    `${BASE_URL}/api/users/updateLiveLocation`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify(body)
    }
  );

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.message);
  }

  return data.data;
},
};