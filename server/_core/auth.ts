/**
 * Authentication utilities
 */

import { sdk } from './sdk';

export interface AuthUser {
  id: string;
  name?: string;
  email?: string;
}

/**
 * Verify JWT token and return user information
 */
export async function verifyJWT(token: string): Promise<AuthUser | null> {
  try {
    // Verify the session token using the SDK
    const userInfo = await sdk.verifySession(token);
    
    if (!userInfo || !userInfo.openId) {
      return null;
    }
    
    return {
      id: userInfo.openId,
      name: userInfo.name,
      email: (userInfo as any).email || '',
    };
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

