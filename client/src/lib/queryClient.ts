import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: RequestInit,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    ...options, // Allow passing additional fetch options
  });

  // Don't check response status if we're handling it in the caller (like for the script generator)
  if (options?.signal) {
    return res;
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Handle array query keys by building URL with params
    let url = queryKey[0] as string;
    let params = new URLSearchParams();
    
    // If queryKey has more than one element, treat the second element as a parameter
    if (Array.isArray(queryKey) && queryKey.length > 1) {
      const paramsObj = queryKey[1];
      
      // Handle specific routes that use simple ID parameters
      if (url.includes('scene-variations') && typeof paramsObj === 'number') {
        params.append('sceneId', String(paramsObj));
      } 
      // Handle parameter objects for search and filtering
      else if (typeof paramsObj === 'object' && paramsObj !== null) {
        Object.entries(paramsObj).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, String(value));
          }
        });
      }
    }
    
    // Add params to URL if any exist
    const finalUrl = params.toString() ? `${url}?${params.toString()}` : url;
    
    const res = await fetch(finalUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
