---
"zarrita": patch
---

Drop `FileSystemStore` from the `zarrita` root barrel, which accidentally landed in 0.7.0 as part of #384. Node users who still want `FileSystemStore` can import it directly:

```ts
import { FileSystemStore } from "@zarrita/storage";
// or
import FileSystemStore from "@zarrita/storage/fs";
```

