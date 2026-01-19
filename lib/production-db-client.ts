/**
 * Production Database Connection Wrapper
 * Handles connection issues gracefully with automatic fallbacks
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

class ProductionDatabaseClient {
  private client: SupabaseClient | null;
  private initialized: boolean;
  private retryCount: number;
  private maxRetries: number;

  constructor() {
    this.client = null;
    this.initialized = false;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  async initialize(): Promise<SupabaseClient> {
    if (this.initialized && this.client) return this.client;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing Supabase credentials');
    }

    // Enhanced client configuration for production stability
    this.client = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'x-client-info': 'production-app',
          'apikey': serviceKey
        }
      },
      // Connection pooling and retry settings
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });

    this.initialized = true;
    return this.client;
  }

  // Wrapper for database operations with automatic retry
  async safeQuery<T>(operation: (client: SupabaseClient) => Promise<T>): Promise<T> {
    await this.initialize();
    
    if (!this.client) {
      throw new Error('Database client not initialized');
    }
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation(this.client);
      } catch (error: any) {
        if (attempt === this.maxRetries) {
          console.error('Database operation failed after retries:', error.message);
          throw error;
        }
        
        // Smart retry logic based on error type
        if (error.message.includes('schema cache')) {
          // Wait and retry for schema cache issues
          await this.delay(1000 * Math.pow(2, attempt));
          continue;
        } else if (error.message.includes('connection')) {
          // Reinitialize for connection issues
          this.initialized = false;
          await this.delay(500 * attempt);
          await this.initialize();
          continue;
        } else {
          // Don't retry for other errors (permissions, etc.)
          throw error;
        }
      }
    }
    
    throw new Error('Unexpected end of retry loop');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convenience methods for common operations
  async getProfile(userId) {
    return this.safeQuery(async (client) => {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    });
  }

  async checkAdminRole(userId) {
    return this.safeQuery(async (client) => {
      const { data: isSuperAdmin } = await client.rpc('is_super_admin');
      const { data: isAttorneyAdmin } = await client.rpc('is_attorney_admin');
      
      return {
        isSuperAdmin: !!isSuperAdmin,
        isAttorneyAdmin: !!isAttorneyAdmin,
        isAnyAdmin: isSuperAdmin || isAttorneyAdmin
      };
    });
  }

  async createLetter(letterData) {
    return this.safeQuery(async (client) => {
      const { data, error } = await client
        .from('letters')
        .insert(letterData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    });
  }

  async getEmployeeCoupon(employeeId) {
    return this.safeQuery(async (client) => {
      const { data, error } = await client
        .from('employee_coupons')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('is_active', true)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data;
    });
  }
}

// Singleton instance for production use
const productionDB = new ProductionDatabaseClient();

export { ProductionDatabaseClient, productionDB };
export default productionDB;