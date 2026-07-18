# Perilla Migration

This guide covers replacing Perilla's vendored KCC collection layer with
`@focusgrid/ariakit-adapter` and Ariakit `Composite`.

## Package setup

For local publish-artifact testing, build tarballs from Focusgrid:

```sh
cd /Users/acyuan/Code/focusgrid
./scripts/pnpm pack:local
```

Then install the generated `.packs/*.tgz` files in Perilla. This tests the same
package shape npm consumers will receive.

```sh
cd /Users/acyuan/Code/perilla
pnpm add \
  ../focusgrid/.packs/focusgrid-focusgrid-0.1.0.tgz \
  ../focusgrid/.packs/focusgrid-shortcut-engine-0.1.0.tgz \
  ../focusgrid/.packs/focusgrid-ariakit-adapter-0.1.0.tgz \
  @ariakit/react@^0.4.34
```

Remove Focusgrid sibling workspace entries from Perilla. Perilla should not
commit `../focusgrid/packages/*` workspace links, package aliases, Vite aliases,
or source imports. After Focusgrid is published, replace the local tarball
dependencies with normal semver dependencies from npm.

## Replace KCC imports

Remove Perilla imports from `src/focusgrid/kccReact` and
`src/focusgrid/kccController`. Import the adapter and Ariakit instead:

```tsx
import { Composite, CompositeItem, useCompositeStore } from "@ariakit/react";
import {
  createCompositeNavigationKeymap,
  useCompositeShortcutRouter,
} from "@focusgrid/ariakit-adapter/react";
import { parseKeySequence } from "@focusgrid/shortcut-engine";
```

Use `createCompositeNavigationKeymap({ overrides })` in place of
`createDefaultKCCollectionKeymap({ overrides })`. Keep H/J/K/L and G/G-style
settings in Perilla's shortcut settings state and pass them through as adapter
overrides.

## Preserve Perilla-owned behavior

Do not recreate `KCCollection`, `KCItem`, or `KCList`. Convert each collection
pane to render an Ariakit `Composite` root and `CompositeItem` rows.

Perilla should continue to own:

- data-list rendering
- active row derivation
- row actions such as Space and Enter
- document start/end, half-page, and viewport-row targeting
- scroll-into-view behavior
- mailbox geometry calculations

The adapter should own only shortcut routing. Add app actions to the same
keymap as navigation:

```ts
const keymap = [
  ...createCompositeNavigationKeymap({ overrides: collectionOverrides }),
  {
    sequence: parseKeySequence("Space"),
    action: "row.toggle",
  },
  {
    sequence: parseKeySequence("Enter"),
    action: "row.open",
  },
];
```

Then dispatch those actions from `onMatch` against Perilla state:

```tsx
const { compositeProps } = useCompositeShortcutRouter({
  keymap,
  getContext: () => ({
    activeId,
    rows,
  }),
  onMatch: ({ action }) => {
    runMailboxNavigationAction(action, activeId, rows);
  },
});
```

Attach `compositeProps` to the Ariakit root:

```tsx
<Composite store={composite} {...compositeProps}>
  {rows.map((row) => (
    <CompositeItem key={row.id} id={row.id} data-active={row.id === activeId}>
      {renderRow(row)}
    </CompositeItem>
  ))}
</Composite>
```

## Update app-level forwarding

Replace `.KCCollection` selectors with `[data-focusgrid-composite]`.

Perilla's global shortcut forwarding can continue to find the active pane's
keyboard target, focus it, and dispatch a cloned keydown, but the boundary must
be the adapter marker:

```ts
element.closest<HTMLElement>("[data-focusgrid-composite]");
```

`getPaneKeyboardTarget()` should prefer `[data-focusgrid-composite]` before
falling back to the pane element.

## Remove vendored KCC

After all collection panes are migrated:

- delete `src/focusgrid/kccReact.tsx`
- delete `src/focusgrid/kccController.ts`
- remove `KCShortcutOverrides` imports and replace them with the adapter's
  `CompositeNavigationShortcutOverrides` type
- delete `.KCCollection` CSS and selectors
- remove tests that assert KCC-specific DOM structure

Keep tests that assert keyboard behavior, focus movement, action dispatch,
editable-target ignore behavior, and global forwarding into the active
composite.
