# Shared Assets

This directory contains reusable assets for the Dev Atlas project.

## Icons

The `icons/` directory contains the project logo and favicon files in various sizes:

### Source
- `logo.png` - Original logo file (high resolution)

### Website Favicons
- `favicon.ico` - Multi-size ICO file (16x16, 32x32, 48x48)
- `favicon-16x16.png` - 16x16 PNG favicon
- `favicon-32x32.png` - 32x32 PNG favicon  
- `apple-touch-icon.png` - 180x180 Apple touch icon

### VSCode Extension Icons
- `icon-128x128.png` - Extension icon (marketplace)
- `icon-64x64.png` - Medium size icon
- `icon-32x32.png` - Activity bar icon
- `icon-16x16.png` - Small size icon

## Usage

### Website
Favicon files are automatically copied to `apps/website/public/` and referenced in the layout metadata.

### VSCode Extension  
Icon files are copied to `apps/vscode-extension/icons/` and referenced in the `package.json`:
- `icon` field uses `icons/icon-128x128.png` for the marketplace
- Activity bar icon uses `icons/icon-32x32.png`

## Regenerating Icons

To regenerate icons from the source logo:

```bash
cd packages/shared/assets/icons

# Generate favicon files
magick logo.png -resize 16x16 favicon-16x16.png
magick logo.png -resize 32x32 favicon-32x32.png  
magick logo.png -resize 48x48 favicon-48x48.png
magick logo.png -resize 180x180 apple-touch-icon.png
magick favicon-16x16.png favicon-32x32.png favicon-48x48.png favicon.ico

# Generate VSCode extension icons
magick logo.png -resize 128x128 icon-128x128.png
magick logo.png -resize 64x64 icon-64x64.png
magick logo.png -resize 32x32 icon-32x32.png
magick logo.png -resize 16x16 icon-16x16.png

# Copy to destinations
cp favicon.ico favicon-16x16.png favicon-32x32.png apple-touch-icon.png ../../apps/website/public/
cp logo.png icon-*.png ../../apps/vscode-extension/icons/
```
