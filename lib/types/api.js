"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSupabaseError = isSupabaseError;
exports.isSupabaseSuccess = isSupabaseSuccess;
// Type Guards
function isSupabaseError(result) {
    return result.error !== null;
}
function isSupabaseSuccess(result) {
    return result.error === null && result.data !== null;
}
