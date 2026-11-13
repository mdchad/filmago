# Filmago

A web camera that shoots like a roll of film: pick a stock, get 24 or 36
exposures, no retakes. Each frame develops on the GPU (TypeGPU / WebGPU)
and lands on the roll's contact sheet. Everything lives in the browser
(IndexedDB); there is no backend yet.

## Run

```sh
bun install
bun run dev     # HTTPS on the LAN; open the printed "Network" URL on your phone
bun run test    # Vitest: stocks, curves, repository, shader WGSL generation
bun run build   # type-check + production build
```

Camera access requires a secure context, so the dev server is HTTPS. For a
certificate your machine trusts (no browser warning), set up mkcert once:

```sh
brew install mkcert
mkcert -install   # adds a local CA to the system trust store (asks for your password)
bun run certs     # writes .certs/ for localhost + your current LAN IPs
```

Re-run `bun run certs` if your LAN IP changes. To get rid of the warning on a
phone too, install the CA from `$(mkcert -CAROOT)/rootCA.pem` on the phone
and trust it (iOS: Settings → General → About → Certificate Trust Settings).
Without `.certs/`, Vite falls back to a self-signed certificate, which
browsers warn about but let you click through.

Requires WebGPU: iOS 26+ Safari or a recent Chrome. Other browsers get an
explanatory screen.

## Layout

| Folder        | Contents                                                                    |
| ------------- | --------------------------------------------------------------------------- |
| `src/film`    | `FilmStock` type, the three shipped stocks, curve evaluation (pure data)    |
| `src/gpu`     | Device setup and loss recovery, bind group layouts, shaders, `FilmRenderer` |
| `src/camera`  | `getUserMedia` stream hook, frame capture (3000px long-edge cap)            |
| `src/roll`    | `RollRepository` interface, `IndexedDbRollRepository`, Zustand store        |
| `src/ui`      | React components and hooks: viewfinder, counter, contact sheet, picker     |

### Rendering passes

1. **bright** (¼ res): highlights above the stock's halation threshold
2. **blur H / blur V** (¼ res): separable gaussian
3. **film**: color matrix + tone curves → halation add → grain → vignette
4. **develop** (to canvas): animates `progress` 0→1. At 1 it returns the film output unchanged
5. **preview** (to canvas): the light viewfinder grade

The color stage is isolated in `src/gpu/colorTransform.ts`. That's the
seam for swapping in a 3D LUT later.

### Tuning stocks

In dev builds, a **Tune** button opens sliders for the active stock. Use
"Full film look in viewfinder" to preview live, then **Copy params as JSON**
and paste the values into `src/film/stocks.ts`.
