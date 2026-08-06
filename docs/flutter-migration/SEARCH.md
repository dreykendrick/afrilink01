# PART 16 — Marketplace Search & Filtering Behavior

This describes the **exact** current search/filter/sort behavior implemented in `src/pages/Index.tsx` (state) and `src/components/marketplace/MarketplaceNav.tsx` (UI), so a Flutter rebuild matches behavior 1:1 — including gaps that should be consciously kept or intentionally improved.

## 16.1 Where search lives
- All marketplace product data (`marketplaceProducts: Product[]`) is fetched **once per view-entry** (whenever `view` becomes `'landing'` or `'marketplace'`) via a single unfiltered Supabase query: `supabase.from('products').select('*').eq('status', 'approved')`. There is no server-side search/filter — **all searching, filtering, and category matching happens entirely client-side** on the array already in memory (`filteredProducts` computed in `Index.tsx`).
- Search input state: `searchTerm: string` (`useState`, default `''`), owned by `Index.tsx`, passed down to `MarketplaceNav` as `searchTerm`/`setSearchTerm` props. There are **two identical search `<input>` fields** rendered — one for desktop (`hidden md:flex`) and one for mobile (`md:hidden`) — both bound to the same `searchTerm` state.

## 16.2 Fields matched by search
Exact matching logic (`Index.tsx`):
```
matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase())
             || p.description.toLowerCase().includes(searchTerm.toLowerCase())
```
- **Fields searched:** `title` and `description` only. **Not searched:** `category`, `vendorId`, price, commission, slug, or any vendor/business name.
- **Case sensitivity:** Case-**insensitive** — both sides are lower-cased before `.includes()`.
- **Match type:** Simple substring containment (`String.includes`), not word-boundary, not fuzzy, not tokenized, not ranked/scored. No handling of accents/diacritics normalization.
- **Empty search term:** `''.includes('')` is always true for `""`.includes(""), and since `searchTerm.toLowerCase()` when empty is `''`, `title.includes('')` is always `true` — so an empty search term matches everything (no filtering applied), which is the expected default/browse-all state.

## 16.3 Debouncing
- **There is NO debouncing whatsoever.** `onChange={(e) => setSearchTerm(e.target.value)}` fires on every keystroke, immediately triggering a state update and a full re-filter/re-render of `filteredProducts` (an array `.filter()` over all `marketplaceProducts` on every keystroke, in the parent `Index.tsx` render). Since filtering is a pure in-memory array operation (not a network call), this has never needed debouncing performance-wise for the currently expected data volumes, but it does mean the entire product grid re-renders per keystroke.
- No `useMemo` wraps `filteredProducts`/`categories` — they are recomputed on every render of `IndexContent`, not just when their inputs change.

## 16.4 Category filter
- `selectedCategory: string`, default `'All'`.
- `categories` list is **derived dynamically from the fetched marketplace products**, not a fixed enum: `['All', ...Array.from(new Set(marketplaceProducts.map(p => p.category)))]`. This means the category chips shown depend entirely on whichever `category` string values exist among currently-approved products (no canonicalization/case-normalization of category strings, no fixed taxonomy in the frontend).
- Rendered as a horizontally scrollable row of pill buttons (`MarketplaceNav`); clicking sets `selectedCategory` directly (no multi-select — single active category at a time).
- Matching logic: `selectedCategory === 'All' || p.category === selectedCategory` — **exact string equality**, case-sensitive, no partial match.

## 16.5 Commission % filter
- `commissionFilter: string`, default `'all'`. Options (fixed, hardcoded, not derived from data): `'all' | '5+' | '10+' | '15+' | '20+'`.
- Rendered via a shadcn `<Select>` inside a collapsible "Filters" panel (toggled by a funnel icon button; panel visibility is local `filtersOpen` state in `MarketplaceNav`, not lifted to `Index.tsx`).
- Matching logic (all are **inclusive `>=` lower-bound-only** thresholds on `product.commission`, a plain numeric percentage stored per product — no upper bound, no custom/typed range):
  - `'5+'` → `commission >= 5`
  - `'10+'` → `commission >= 10`
  - `'15+'` → `commission >= 15`
  - `'20+'` → `commission >= 20`
  - `'all'` → no filtering.

## 16.6 Price range filter
- `priceFilter: string`, default `'all'`. Options (fixed, hardcoded TZS bands, displayed with a "Tsh" suffix via `formatCurrency`):
  - `'0-50000'` → `price < 50000` (note: **strictly less-than**, not `<=`)
  - `'50000-100000'` → `price >= 50000 && price <= 100000` (inclusive both ends)
  - `'100000-500000'` → `price > 100000 && price <= 500000` (**exclusive lower bound** — a product priced exactly 100,000 falls only in the previous bucket, avoiding double counting, but note the asymmetry with the first bucket's `<` vs this bucket's `>` bound design)
  - `'500000+'` → `price > 500000`
  - `'all'` → no filtering.
- Currency is always TZS (Tanzanian Shilling); there is no currency selector or conversion — see CONFIGURATION.md.

## 16.7 Combined filter logic
All four predicates are ANDed together in a single `.filter()` pass:
```
matchesSearch && matchesCategory && matchesCommission && matchesPrice
```
There is no OR logic, no "match any filter", and no way to combine e.g. two price ranges.

"Active filters" indicator: `hasActiveFilters = commissionFilter !== 'all' || priceFilter !== 'all'` — shown as a colored dot on the filter icon; a "Clear"/cancel-style link resets both `commissionFilter` and `priceFilter` to `'all'` (search term and category are NOT reset by this "clear filters" action — they're treated as separate, top-level controls, not part of the "Filters" panel).

## 16.8 Sorting
**There is no sort control and no sorting logic anywhere in the marketplace UI or state.** Products are always rendered in whatever order the Supabase query returns them (i.e., implicit database/insertion order for `select('*').eq('status','approved')`, since no `.order(...)` clause is present in `fetchMarketplaceProducts`). There is no "sort by price", "sort by commission", "newest", or "best selling" option today. A Flutter rebuild that wants sorting is a **net-new feature**, not a behavior port.

## 16.9 Pagination / result limits
- **No pagination, no infinite scroll, no "load more" button, and no page-size limit** on the marketplace product fetch — the entire approved-products table is fetched in one query and filtered/rendered client-side. (Contrast with `useNotifications`, which does apply `.limit(20)` — that pattern is NOT used for marketplace products.)
- Because there is no pagination, the "search" experience for large catalogs would degrade purely by transferring/rendering more data — this is a known scalability gap worth flagging for the rebuild (see PERFORMANCE.md §"Known bottlenecks").

## 16.10 Empty results state
- When `filteredProducts.length === 0`, the marketplace view renders a simple centered message: `"No products found"` (plain text, `text-muted-foreground`), no illustration, no "clear filters" call-to-action, no suggestions. This exact string is not run through i18next in the reviewed code (hardcoded English string in `Index.tsx`), unlike most other marketplace copy which uses `t('marketplace...')` keys via `MarketplaceNav`.

## 16.11 Recent searches / suggestions / autocomplete
**None of these exist today.** Explicitly confirmed absent:
- No search history persistence (not in `localStorage`, not server-side).
- No autocomplete/typeahead dropdown.
- No "trending searches" or "popular products" suggestion surface.
- No search analytics/tracking of query terms (contrast with affiliate link clicks, which ARE tracked via `resolve_affiliate_link` RPC).
- No spelling correction / "did you mean".

If the Flutter rebuild wants to add any of the above, they should be treated as **new features**, not parity requirements, and should be called out to stakeholders explicitly since they don't exist in the current product.

## 16.12 Product detail lookup (related but distinct from search)
- Standalone product deep-links exist via `/p/:productId` route (`ProductPage.tsx`) and via slugs generated by `src/utils/slug.ts` (`slugify(title) + '-' + id.slice(0,6)`), used for shareable/affiliate/checkout links — this is a direct-lookup path, not part of the search/filter system, and does not go through `searchTerm` matching at all.

## 16.13 Summary of exact thresholds for parity
| Filter | Values | Comparator |
|---|---|---|
| Search | free text vs `title`/`description` | case-insensitive substring |
| Category | dynamic list from data + `'All'` | exact string equality |
| Commission | `all, 5+, 10+, 15+, 20+` | `commission >= N` |
| Price (TZS) | `all, 0-50000, 50000-100000, 100000-500000, 500000+` | see §16.6 for exact `<`/`<=`/`>`/`>=` per band |
| Sort | none | N/A |
| Pagination | none | entire dataset fetched at once |
