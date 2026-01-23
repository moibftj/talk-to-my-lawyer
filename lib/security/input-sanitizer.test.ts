/**
 * Tests for lib/security/input-sanitizer
 */

import { describe, it, expect } from 'vitest'
import {
  sanitizeString,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeHtml,
  sanitizeJson,
  sanitizeNumber,
  sanitizeBoolean,
  sanitizeArray,
  escapeSqlString,
  sanitizeFileName,
  validateInput,
  type ValidationResult,
} from './input-sanitizer'

describe('sanitizeString', () => {
  it('returns empty string for non-string input', () => {
    expect(sanitizeString(123)).toBe('')
    expect(sanitizeString(null)).toBe('')
    expect(sanitizeString(undefined)).toBe('')
    expect(sanitizeString({})).toBe('')
  })

  it('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello')
    expect(sanitizeString('\t\nhello\n\t')).toBe('hello')
  })

  it('enforces max length', () => {
    expect(sanitizeString('a'.repeat(2000), 100)).toBe('a'.repeat(100))
    expect(sanitizeString('hello', 10)).toBe('hello')
  })

  it('removes angle brackets', () => {
    expect(sanitizeString('<script>alert(1)</script>')).toBe('scriptalert(1)/script')
    expect(sanitizeString('hello<world>')).toBe('helloworld')
  })

  it('removes javascript protocol', () => {
    expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)')
    expect(sanitizeString('JAVASCRIPT:alert(1)')).toBe('alert(1)')
  })

  it('removes event handlers', () => {
    expect(sanitizeString('onclick=alert(1)')).toBe('alert(1)')
    expect(sanitizeString('onerror=bad()')).toBe('bad()')
    expect(sanitizeString('ONLOAD=x()')).toBe('x()')
  })

  it('preserves safe strings', () => {
    expect(sanitizeString('Hello, World!')).toBe('Hello, World!')
    expect(sanitizeString('test@example.com')).toBe('test@example.com')
    expect(sanitizeString('https://example.com')).toBe('https://example.com')
  })
})

describe('sanitizeEmail', () => {
  it('returns empty string for non-string input', () => {
    expect(sanitizeEmail(123)).toBe('')
    expect(sanitizeEmail(null)).toBe('')
  })

  it('converts to lowercase', () => {
    expect(sanitizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com')
    expect(sanitizeEmail('TeSt@ExAmPlE.cOm')).toBe('test@example.com')
  })

  it('trims whitespace', () => {
    expect(sanitizeEmail('  test@example.com  ')).toBe('test@example.com')
  })

  it('accepts valid email addresses', () => {
    expect(sanitizeEmail('test@example.com')).toBe('test@example.com')
    expect(sanitizeEmail('user.name@domain.co.uk')).toBe('user.name@domain.co.uk')
    expect(sanitizeEmail('user+tag@example.com')).toBe('user+tag@example.com')
  })

  it('rejects invalid email addresses', () => {
    expect(sanitizeEmail('invalid')).toBe('')
    expect(sanitizeEmail('@example.com')).toBe('')
    expect(sanitizeEmail('test@')).toBe('')
    expect(sanitizeEmail('test@')).toBe('')
    expect(sanitizeEmail('test example.com')).toBe('')
  })
})

describe('sanitizeUrl', () => {
  it('returns empty string for non-string input', () => {
    expect(sanitizeUrl(123)).toBe('')
    expect(sanitizeUrl(null)).toBe('')
  })

  it('accepts http URLs', () => {
    // Note: happy-dom's URL implementation may differ from browser
    // The function uses native URL constructor
    const result = sanitizeUrl('http://example.com')
    expect(result).toBeTruthy()
    expect(result).toContain('http')
  })

  it('accepts https URLs', () => {
    const result = sanitizeUrl('https://example.com')
    expect(result).toBeTruthy()
    expect(result).toContain('https')
  })

  it('rejects dangerous protocols', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeUrl('file:///etc/passwd')).toBe('')
    expect(sanitizeUrl('data:text/html,<script>')).toBe('')
    expect(sanitizeUrl('ftp://example.com')).toBe('')
  })

  it('returns empty string for invalid URLs', () => {
    expect(sanitizeUrl('not a url')).toBe('')
    expect(sanitizeUrl('://example.com')).toBe('')
  })
})

describe('sanitizeHtml', () => {
  it('returns empty string for non-string input', () => {
    expect(sanitizeHtml(123)).toBe('')
    expect(sanitizeHtml(null)).toBe('')
  })

  it('removes script tags', () => {
    expect(sanitizeHtml('<script>alert(1)</script>')).not.toContain('<script>')
    expect(sanitizeHtml('<script>alert(1)</script>')).not.toContain('</script>')
    expect(sanitizeHtml('<ScRiPt>alert(1)</ScRiPt>')).not.toContain('script')
  })

  it('removes style tags', () => {
    expect(sanitizeHtml('<style>body{color:red}</style>')).not.toContain('<style>')
    expect(sanitizeHtml('<style>body{color:red}</style>')).not.toContain('</style>')
  })

  it('removes event handlers', () => {
    const result = sanitizeHtml('<div onclick="alert(1)">Click</div>')
    expect(result).not.toContain('onclick')
  })

  it('removes dangerous protocols in attributes', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">Link</a>')
    expect(result).not.toContain('javascript:')
  })

  it('preserves safe HTML', () => {
    const result = sanitizeHtml('<p>Hello <strong>World</strong></p>')
    expect(result).toContain('<p>')
    expect(result).toContain('<strong>')
  })
})

describe('sanitizeJson', () => {
  it('returns empty object for non-object input', () => {
    expect(sanitizeJson(123)).toEqual({})
    expect(sanitizeJson('string')).toEqual({})
    expect(sanitizeJson(null)).toEqual({})
  })

  it('sanitizes string values', () => {
    const input = { name: '<script>alert(1)</script>' }
    const result = sanitizeJson(input)
    expect(result.name).not.toContain('<script>')
  })

  it('preserves number and boolean values', () => {
    const input = { count: 42, active: true }
    const result = sanitizeJson(input)
    expect(result.count).toBe(42)
    expect(result.active).toBe(true)
  })

  it('sanitizes array string values', () => {
    const input = { tags: ['<script>', 'safe', 'javascript:alert(1)'] }
    const result = sanitizeJson(input)
    // sanitizeString removes angle brackets and javascript: protocol
    expect(result.tags).toEqual(['script', 'safe', 'alert(1)'])
  })

  it('recursively sanitizes nested objects', () => {
    const input = {
      user: {
        name: '<b>Name</b>',
        email: 'TEST@EXAMPLE.COM',
      },
    }
    const result = sanitizeJson(input)
    expect(result.user.name).not.toContain('<')
    expect(result.user.email).toBe('test@example.com')
  })
})

describe('sanitizeNumber', () => {
  it('returns null for non-numeric input', () => {
    expect(sanitizeNumber('abc')).toBeNull()
    expect(sanitizeNumber(NaN)).toBeNull()
    expect(sanitizeNumber(Infinity)).toBeNull()
    expect(sanitizeNumber(null)).toBeNull()
  })

  it('returns valid number', () => {
    expect(sanitizeNumber(42)).toBe(42)
    expect(sanitizeNumber('42')).toBe(42)
    expect(sanitizeNumber(3.14)).toBe(3.14)
    expect(sanitizeNumber('3.14')).toBe(3.14)
  })

  it('respects min constraint', () => {
    expect(sanitizeNumber(5, 10)).toBeNull()
    expect(sanitizeNumber(15, 10)).toBe(15)
    expect(sanitizeNumber(10, 10)).toBe(10)
  })

  it('respects max constraint', () => {
    expect(sanitizeNumber(15, undefined, 10)).toBeNull()
    expect(sanitizeNumber(5, undefined, 10)).toBe(5)
    expect(sanitizeNumber(10, undefined, 10)).toBe(10)
  })

  it('respects both min and max constraints', () => {
    expect(sanitizeNumber(5, 10, 20)).toBeNull()
    expect(sanitizeNumber(25, 10, 20)).toBeNull()
    expect(sanitizeNumber(15, 10, 20)).toBe(15)
  })
})

describe('sanitizeBoolean', () => {
  it('returns boolean input as-is', () => {
    expect(sanitizeBoolean(true)).toBe(true)
    expect(sanitizeBoolean(false)).toBe(false)
  })

  it('converts string "true" to true', () => {
    expect(sanitizeBoolean('true')).toBe(true)
    expect(sanitizeBoolean('TRUE')).toBe(true)
    expect(sanitizeBoolean('True')).toBe(true)
  })

  it('converts string "1" to true', () => {
    expect(sanitizeBoolean('1')).toBe(true)
  })

  it('converts other values to boolean', () => {
    expect(sanitizeBoolean('false')).toBe(false)
    expect(sanitizeBoolean('0')).toBe(false)
    expect(sanitizeBoolean(1)).toBe(true)
    expect(sanitizeBoolean(0)).toBe(false)
    expect(sanitizeBoolean({})).toBe(true)
    expect(sanitizeBoolean([])).toBe(true)
    expect(sanitizeBoolean('')).toBe(false)
  })
})

describe('sanitizeArray', () => {
  it('returns empty array for non-array input', () => {
    expect(sanitizeArray('not an array')).toEqual([])
    expect(sanitizeArray(123)).toEqual([])
    expect(sanitizeArray(null)).toEqual([])
  })

  it('returns array as-is within max length', () => {
    const input = [1, 2, 3, 4, 5]
    expect(sanitizeArray(input, 10)).toEqual(input)
  })

  it('truncates array to max length', () => {
    const input = [1, 2, 3, 4, 5]
    expect(sanitizeArray(input, 3)).toEqual([1, 2, 3])
  })

  it('uses default max length of 100', () => {
    const input = Array.from({ length: 150 }, (_, i) => i)
    const result = sanitizeArray(input)
    expect(result.length).toBe(100)
  })

  it('handles empty arrays', () => {
    expect(sanitizeArray([])).toEqual([])
  })
})

describe('escapeSqlString', () => {
  it('escapes backslashes', () => {
    expect(escapeSqlString('test\\file')).toBe('test\\\\file')
  })

  it('escapes single quotes', () => {
    expect(escapeSqlString("test'file")).toBe("test''file")
  })

  it('escapes double quotes', () => {
    expect(escapeSqlString('test"file')).toBe('test\\"file')
  })

  it('escapes null bytes', () => {
    expect(escapeSqlString('test\0file')).toBe('test\\0file')
  })

  it('escapes newlines', () => {
    expect(escapeSqlString('test\nfile')).toBe('test\\nfile')
  })

  it('escapes carriage returns', () => {
    expect(escapeSqlString('test\rfile')).toBe('test\\rfile')
  })

  it('escapes substitute character', () => {
    expect(escapeSqlString('test\x1afile')).toBe('test\\Zfile')
  })

  it('handles complex SQL injection attempts', () => {
    expect(escapeSqlString("' OR '1'='1")).toBe("'' OR ''1''=''1")
  })
})

describe('sanitizeFileName', () => {
  it('returns empty string for non-string input', () => {
    expect(sanitizeFileName(123)).toBe('')
    expect(sanitizeFileName(null)).toBe('')
  })

  it('removes directory traversal sequences', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('etcpasswd')
    expect(sanitizeFileName('..\\..\\windows\\system32')).toBe('windowssystem32')
  })

  it('removes slashes', () => {
    expect(sanitizeFileName('path/to/file.txt')).toBe('pathtofile.txt')
    expect(sanitizeFileName('path\\to\\file.txt')).toBe('pathtofile.txt')
  })

  it('removes leading dots', () => {
    expect(sanitizeFileName('.hidden')).toBe('hidden')
    expect(sanitizeFileName('...file')).toBe('file')
  })

  it('enforces max length of 255', () => {
    const longName = 'a'.repeat(300)
    expect(sanitizeFileName(longName).length).toBe(255)
  })

  it('returns default name for empty result', () => {
    expect(sanitizeFileName('..')).toBe('file')
    expect(sanitizeFileName('///')).toBe('file')
  })

  it('preserves valid filenames', () => {
    expect(sanitizeFileName('document.pdf')).toBe('document.pdf')
    expect(sanitizeFileName('image-v2.png')).toBe('image-v2.png')
    expect(sanitizeFileName('my_document_final_v2.txt')).toBe('my_document_final_v2.txt')
  })
})

describe('validateInput', () => {
  it('returns valid result for valid input', () => {
    const schema = {
      name: { type: 'string', required: true, maxLength: 100 },
      email: { type: 'email', required: true },
    }
    const input = {
      name: 'John Doe',
      email: 'john@example.com',
    }

    const result = validateInput(input, schema)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.data).toEqual({
      name: 'John Doe',
      email: 'john@example.com',
    })
  })

  it('returns errors for missing required fields', () => {
    const schema = {
      name: { type: 'string', required: true },
      email: { type: 'email', required: true },
    }
    const input = {}

    const result = validateInput(input, schema)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('name is required')
    expect(result.errors).toContain('email is required')
    expect(result.data).toBeUndefined()
  })

  it('returns errors for invalid types', () => {
    const schema = {
      age: { type: 'number', required: true },
      active: { type: 'boolean', required: true },
    }
    const input = {
      age: 'not a number',
      active: 'not a boolean',
    }

    const result = validateInput(input, schema)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('age must be a valid number')
  })

  it('handles optional fields', () => {
    const schema = {
      name: { type: 'string', required: true },
      nickname: { type: 'string', required: false },
    }
    const input = {
      name: 'John Doe',
    }

    const result = validateInput(input, schema)

    expect(result.valid).toBe(true)
    expect(result.data).toHaveProperty('name')
  })

  it('validates email format', () => {
    const schema = {
      email: { type: 'email', required: true },
    }
    const input = {
      email: 'invalid-email',
    }

    const result = validateInput(input, schema)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('email must be a valid email')
  })

  it('validates arrays', () => {
    const schema = {
      tags: { type: 'array', required: true },
    }
    const input = {
      tags: 'not an array',
    }

    const result = validateInput(input, schema)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('tags must be an array')
  })

  it('sanitizes string values', () => {
    const schema = {
      name: { type: 'string', required: true, maxLength: 50 },
    }
    const input = {
      name: '  <script>alert(1)</script>  ',
    }

    const result = validateInput(input, schema)

    expect(result.valid).toBe(true)
    expect(result.data?.name).not.toContain('<script>')
  })

  it('handles multiple field types', () => {
    const schema = {
      name: { type: 'string', required: true },
      age: { type: 'number', required: false },
      active: { type: 'boolean', required: false },
      tags: { type: 'array', required: false },
    }
    const input = {
      name: 'John',
      age: '25',
      active: 'true',
      tags: ['tag1', 'tag2'],
    }

    const result = validateInput(input, schema)

    expect(result.valid).toBe(true)
    expect(result.data?.age).toBe(25)
    expect(result.data?.active).toBe(true)
  })
})
