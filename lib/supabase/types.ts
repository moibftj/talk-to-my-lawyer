import type { Database } from '@/lib/database.types'

type AddRelationships<T> = T extends { Row: unknown; Insert: unknown; Update: unknown }
    ? T & { Relationships: [] }
    : T

type AddViewRelationships<T> = T extends { Row: unknown }
    ? T & { Relationships: [] }
    : T

type SchemaWithRelationships<S> = {
    Tables: { [K in keyof S['Tables']]: AddRelationships<S['Tables'][K]> }
    Views: { [K in keyof S['Views']]: AddViewRelationships<S['Views'][K]> }
    Functions: S['Functions']
    Enums: S extends { Enums: infer E } ? E : {}
    CompositeTypes: S extends { CompositeTypes: infer C } ? C : {}
}

export type DatabaseWithRelationships = {
    public: SchemaWithRelationships<Database['public']>
}
