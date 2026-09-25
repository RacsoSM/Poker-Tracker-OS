import { resolve } from 'node:path';
import type { OcrEnginePaths } from './engine';

// Solo para Node (scripts y tests): datos de idioma locales, sin red ni caché.
export function nodeOcrPaths(): OcrEnginePaths {
  return { langPath: resolve(process.cwd(), 'node_modules/@tesseract.js-data/eng/4.0.0_best_int'), cacheMethod: 'none' };
}
