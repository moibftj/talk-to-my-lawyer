/**
 * Type-safe database operations helper
 * 
 * This module provides type-safe wrappers around Supabase operations
 * to resolve type inference issues while maintaining the client factory pattern.
 */

import { db } from './client-factory'
import type { Database } from '@/lib/database.types'

// Helper types for better type inference
type Tables = Database['public']['Tables']
type TableName = keyof Tables
type TableInsert<T extends TableName> = Tables[T]['Insert']
type TableRow<T extends TableName> = Tables[T]['Row']
type TableUpdate<T extends TableName> = Tables[T]['Update']

/**
 * Type-safe service role operations that bypass RLS
 * WARNING: Only use for admin/system operations!
 */
export const serviceRoleOps = {
    /**
     * Insert a single record with proper typing
     */
    async insert<T extends TableName>(
        table: T,
        data: TableInsert<T>
    ) {
        const client = db.serviceRole()
        return client.from(table).insert(data).select().single()
    },

    /**
     * Upsert a single record with proper typing
     */
    async upsert<T extends TableName>(
        table: T,
        data: TableInsert<T>,
        options?: { onConflict?: string; ignoreDuplicates?: boolean }
    ) {
        const client = db.serviceRole()
        return client.from(table).upsert(data, options).select().single()
    },

    /**
     * Update records with proper typing
     */
    async update<T extends TableName>(
        table: T,
        data: TableUpdate<T>
    ) {
        const client = db.serviceRole()
        return client.from(table).update(data)
    },

    /**
     * Select records with proper typing
     */
    async select<T extends TableName>(table: T) {
        const client = db.serviceRole()
        return client.from(table).select()
    },

    /**
     * Delete records with proper typing
     */
    async delete<T extends TableName>(table: T) {
        const client = db.serviceRole()
        return client.from(table).delete()
    }
}

/**
 * Type-safe server operations that respect RLS
 */
export const serverOps = {
    /**
     * Insert a single record with proper typing
     */
    async insert<T extends TableName>(
        table: T,
        data: TableInsert<T>
    ) {
        const client = await db.server()
        return client.from(table).insert(data).select().single()
    },

    /**
     * Upsert a single record with proper typing
     */
    async upsert<T extends TableName>(
        table: T,
        data: TableInsert<T>,
        options?: { onConflict?: string; ignoreDuplicates?: boolean }
    ) {
        const client = await db.server()
        return client.from(table).upsert(data, options).select().single()
    },

    /**
     * Update records with proper typing
     */
    async update<T extends TableName>(
        table: T,
        data: TableUpdate<T>
    ) {
        const client = await db.server()
        return client.from(table).update(data)
    },

    /**
     * Select records with proper typing
     */
    async select<T extends TableName>(table: T) {
        const client = await db.server()
        return client.from(table).select()
    },

    /**
     * Delete records with proper typing
     */
    async delete<T extends TableName>(table: T) {
        const client = await db.server()
        return client.from(table).delete()
    }
}

// Export types for external use
export type { Tables, TableName, TableInsert, TableRow, TableUpdate }