"use strict";
/**
 * Centralized type definitions barrel export
 *
 * This module consolidates all type definitions for the application.
 * Import types from here to ensure consistency across the codebase.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSupabaseSuccess = exports.isSupabaseError = exports.USER_ROLES = exports.LETTER_STATUSES = void 0;
// Re-export constants from centralized location
var constants_1 = require("@/lib/constants");
Object.defineProperty(exports, "LETTER_STATUSES", { enumerable: true, get: function () { return constants_1.LETTER_STATUSES; } });
Object.defineProperty(exports, "USER_ROLES", { enumerable: true, get: function () { return constants_1.USER_ROLES; } });
// Re-export type guards
var api_1 = require("./api");
Object.defineProperty(exports, "isSupabaseError", { enumerable: true, get: function () { return api_1.isSupabaseError; } });
Object.defineProperty(exports, "isSupabaseSuccess", { enumerable: true, get: function () { return api_1.isSupabaseSuccess; } });
