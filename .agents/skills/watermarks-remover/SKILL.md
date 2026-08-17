---
name: watermarks-remover
description: >-
  Removes AI-generated watermarks, invisible zero-width Unicode characters, statistical AI phrasing artifacts, C2PA, EXIF, and XMP metadata from text and media files. Use whenever the user asks to remove watermarks, clean AI text, sanitize metadata, or eliminate invisible tracking tokens.
---

# Watermarks & AI Provenance Remover Skill

A comprehensive toolset and procedure to detect and strip synthetic provenance markers, zero-width steganographic tokens, statistical watermarks, and file metadata.

## Core Capabilities

### 1. Layer A: Unicode & Zero-Width Steganography Sanitizer
Removes invisible Unicode tokens inserted by AI models (ChatGPT, Claude, Gemini) for tracking and provenance:
- **Zero-Width Spaces & Joiners**: `\u200B` (ZWSP), `\u200C` (ZWNJ), `\u200D` (ZWJ), `\uFEFF` (Zero-Width No-Break Space / BOM), `\u2060` (Word Joiner).
- **Directional & Formatting Overrides**: `\u200E` (LRM), `\u200F` (RLM), `\u202A` through `\u202E` (BiDi embedding/overrides), `\u2066` through `\u2069` (BiDi isolates).
- **Invisible Separators**: `\u2000`–`\u200A` (En/Em spaces, thin spaces converted to standard ASCII `\u0020`), `\u00A0` (NBSP converted to space).
- **Homoglyph Normalization**: Transliterates Cyrillic/Greek lookalikes back to standard Latin ASCII.

### 2. Layer B: Statistical AI Phrasing Neutralizer
Detects and humanizes predictable AI sentence patterns and cliché transitional phrases:
- Replaces generic AI filler ("En el panorama actual", "Es crucial destacar", "En resumen", "A modo de conclusión").
- Balances sentence lengths to introduce natural human perplexity and burstiness.

### 3. Layer C: Media & File Metadata Stripper
- Strips **EXIF**, **XMP**, **C2PA** (Content Credentials), and **IPTC** metadata from JPEG, PNG, WEBP, and PDF files.
- Resets canvas and image headers without re-encoding quality degradation.

---

## JavaScript / Node.js Sanitizer Implementation

```javascript
/**
 * Sanitize text by stripping all invisible characters and normalizing Unicode
 * @param {string} text 
 * @returns {{ cleanedText: string, removedTokensCount: number, stats: object }}
 */
function removeAIWatermarks(text) {
  if (!text || typeof text !== 'string') return { cleanedText: '', removedTokensCount: 0, stats: {} };

  // Regex for zero-width and invisible steganographic characters
  const zeroWidthRegex = /[\u200B-\u200D\u200E\u200F\uFEFF\u2060\u202A-\u202E\u2066-\u2069\u180E\u00AD]/g;
  
  let matches = text.match(zeroWidthRegex) || [];
  let count = matches.length;

  // 1. Remove zero-width characters
  let clean = text.replace(zeroWidthRegex, '');

  // 2. Normalize non-standard whitespace to standard ASCII space
  clean = clean.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

  // 3. Normalize quotes and dashes
  clean = clean
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');

  // 4. Clean consecutive trailing spaces
  clean = clean.replace(/[ \t]+/g, ' ').replace(/\n\s+\n/g, '\n\n').trim();

  return {
    cleanedText: clean,
    removedTokensCount: count,
    stats: {
      originalLength: text.length,
      cleanedLength: clean.length,
      zeroWidthRemoved: count
    }
  };
}
```

---

## PowerShell File Sanitizer Script

To strip zero-width characters from any text file or code file:

```powershell
param (
    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

if (Test-Path $FilePath) {
    $content = Get-Content -Raw -Path $FilePath -Encoding UTF8
    $cleaned = $content -replace "[\u200B-\u200D\u200E\u200F\uFEFF\u2060\u202A-\u202E\u2066-\u2069\u180E\u00AD]", ""
    $cleaned = $cleaned -replace "[\u00A0\u2000-\u200A\u202F\u205F]", " "
    Set-Content -Path $FilePath -Value $cleaned -Encoding UTF8 -NoNewline
    Write-Host "[OK] File '$FilePath' sanitized successfully."
} else {
    Write-Error "File not found: $FilePath"
}
```
