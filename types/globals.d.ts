/* Type-checking support for the plain JavaScript (checked by `npm run typecheck`, nothing here is compiled or shipped).
   Browser events in this code always come from elements, so their targets are treated as elements; a few globals come
   from scripts loaded on the page (JSZip) or from the Cloudflare runtime (caches.default). */
interface EventTarget { closest(selectors: string): any; dataset: DOMStringMap; value: any; checked: boolean; id: string; selectionStart: number; files: FileList; disabled: boolean; }
interface Element { onclick: any; onchange: any; oninput: any; disabled: boolean; style: CSSStyleDeclaration; dataset: DOMStringMap; value: any; checked: boolean; hidden: boolean; focus(): void; click(): void; }
interface HTMLDialogElement { _v: any; }
interface Window { __badges?: () => void; JSZip: any; }
interface Error { status?: number; data?: any; extra?: any; body?: any; }
declare var JSZip: any;
interface CacheStorage { default: Cache; }
interface Window { __reload?: () => void; }
interface Element { offsetWidth: number; offsetHeight: number; isContentEditable: boolean; colSpan: number; }
interface Node { matches(selectors: string): boolean; closest(selectors: string): any; }
