# Prebuilt Binaries Guide

## 🎯 Why Prebuilds?

Native `.node` files are **NOT cross-platform compatible**:
- Windows `.node` → Windows only (PE/COFF format)
- Linux `.node` → Linux only (ELF format)  
- macOS `.node` → macOS only (Mach-O format)
- x64 binaries ≠ ARM64 binaries

## 📦 Two Distribution Strategies

### Option 1: User Compilation (Current Default)
**How it works:**
- User runs `npm install`
- `cmake-js` compiles C++ code on their machine
- Requires: Visual Studio (Windows), GCC (Linux), Xcode (macOS)

**Pros:** 
- Smaller package size
- Always matches user's exact platform

**Cons:**
- Users need build tools installed
- Slow install (~1-3 minutes)
- Can fail if build tools missing

---

### Option 2: Prebuilt Binaries (Recommended for Distribution)
**How it works:**
- CI builds `.node` files for all platforms
- Files stored in `prebuilds/` folder
- Published with npm package
- `node-gyp-build` loads correct binary at runtime

**Pros:**
- ✅ Fast install (~2 seconds)
- ✅ No build tools needed
- ✅ Better user experience

**Cons:**
- Larger package size (~5-10 MB)
- Must build for all platforms

## 🚀 Using Prebuilds

### Local Development
```bash
# Build for your current platform
npm run prebuild

# Build for multiple architectures
npm run prebuild-all
```

This creates:
```
prebuilds/
  darwin-arm64/
    node.napi.node
  darwin-x64/
    node.napi.node
  linux-x64/
    node.napi.node
  win32-x64/
    node.napi.node
```

### CI/CD Automated Prebuilds

The `prebuild` job runs when:
1. **On Release:** Creating a GitHub release
2. **Manual Trigger:** Commit message contains `[prebuild]`

```bash
git commit -m "feat: add new filter [prebuild]"
git push
```

This builds for:
- Node.js: 18, 20, 22
- Platforms: Linux, Windows, macOS
- Architectures: x64, ARM64

### Publishing to npm

**Step 1:** Generate prebuilds in CI
```bash
# Trigger prebuild workflow
git tag v1.0.0
git push --tags
# Or: git commit -m "release v1.0.0 [prebuild]"
```

**Step 2:** Download artifacts from GitHub Actions

**Step 3:** Commit prebuilds to repository
```bash
git add prebuilds/
git commit -m "chore: add prebuilt binaries for v1.0.0"
```

**Step 4:** Publish
```bash
npm publish
```

## 🔍 How `node-gyp-build` Works

When someone runs `npm install dsp-js-native`:

1. Checks `prebuilds/` for matching binary
2. If found → loads it instantly ✅
3. If not found → falls back to `cmake-js compile`

```js
// In your main entry point
const addon = require('node-gyp-build')(__dirname);
```

## 🛠️ Local Testing

Test that prebuilds work:
```bash
# Build prebuilds
npm run prebuild

# Remove build cache
rm -rf build/

# Try loading the prebuild
node -e "const addon = require('node-gyp-build')('.'); console.log(addon);"
```

## 📊 Package Size Comparison

| Strategy | Package Size | Install Time | Build Tools Required |
|----------|-------------|--------------|---------------------|
| User compilation | ~500 KB | 60-180s | ✅ Yes |
| Prebuilds (1 platform) | ~2 MB | 2-5s | ❌ No |
| Prebuilds (all platforms) | ~8 MB | 2-5s | ❌ No |

## 🎯 Recommendation

- **For open-source npm package:** Use prebuilds (better UX)
- **For private/internal use:** User compilation is fine
- **Best of both:** Ship prebuilds + fallback to compilation

## 🔗 References

- [prebuildify docs](https://github.com/prebuild/prebuildify)
- [node-gyp-build docs](https://github.com/prebuild/node-gyp-build)
