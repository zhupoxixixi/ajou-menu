# Third-party notices

The neutral theme tokens and compact menu, header, and date-navigation layout
were adapted from **cukurova-yemekhane** by Umutcan:

- Project: https://github.com/umutcandev/cukurova-yemekhane
- Reference site: https://www.cukurova.app/
- Source files consulted: `app/globals.css`, `components/header.tsx`,
  `components/menu-card.tsx`, `components/mobile-menu.tsx`.

Ajou Menu uses its own branding, menu data, translation pipeline, and vanilla
JavaScript implementation. The original university logo, authentication,
comments, and service integrations are not included.

The original MIT license is reproduced below:

MIT License

Copyright (c) 2025 Umutcan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Uiverse.io card by Codewithvinay

The user supplied a CSS card snippet attributed to Codewithvinay on Uiverse.io.
Its gray surface (`#e0e0e0`), rounded corners, and opposing light/dark shadows
were adapted in a previous version. This historical attribution is retained;
the current interface uses the Deepika glass material described below. No exact
component URL or separate license text was provided with the snippet.

## Tabler UI v1.7.0

**Use in Ajou Menu:** This notice covers an adaptation of Tabler component structure and light visual styling into local HTML/CSS. It does not indicate that Ajou Menu includes the complete Tabler UI kit or its bundled CSS/JavaScript.

**Source components (Tabler UI documentation v1.7.0):**

- [Page layouts](https://docs.tabler.io/ui/layout/page-layouts)
- [Cards](https://docs.tabler.io/ui/components/card)
- [Navigation and tabs](https://docs.tabler.io/ui/layout/navs-tabs)
- [Segmented control](https://docs.tabler.io/ui/components/segmented-control)
- [Live card demo](https://dev.tabler.io/cards.html)

**Package and license verification:** The npm registry metadata for [`@tabler/core` v1.7.0](https://registry.npmjs.org/@tabler/core/1.7.0) identifies its license as MIT. The license text below was verified against the [Tabler repository's LICENSE file](https://raw.githubusercontent.com/tabler/tabler/dev/LICENSE).

```text
The MIT License (MIT)

Copyright (c) 2018-2026 The Tabler Authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Deepika Liquid Glass

The current refraction engine is the unmodified `liquid-glass.js` from
[deepika-builds/liquid-glass](https://github.com/deepika-builds/liquid-glass),
commit `98ed97bd99def529493fd37177228810f6422f6d`.

- Source: `vendor/liquid-glass.js`
- Complete upstream MIT license: [vendor/LICENSE](vendor/LICENSE)
- Upstream source SHA256: `dfadcbd3e72646a156bab4f0bde4bfa3baae6ea7ebd54659ccb71fcb6ecfd752`
- Local adapter: `glass.js`; local background selection: `background.js`.

The default background photograph was supplied and selected by the user for
this project. User-selected replacement backgrounds are processed and stored
locally in the browser and are not uploaded by Ajou Menu.
