// Renders the Slovnyk app icon as an opaque 1024×1024 PNG.
//
//   swift make-icon.swift <variant> <output.png> [--tinted]
//
// --tinted renders the grayscale version iOS uses for tinted home screens.
import AppKit

let size: CGFloat = 1024
let args = CommandLine.arguments
let variant = args[1]
let output = URL(fileURLWithPath: args[2])
let tinted = args.contains("--tinted")

func rgb(_ hex: UInt32) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
}

// Palette (matches Theme.accent in the app).
let amberLight = tinted ? rgb(0xFFFFFF) : rgb(0xFFCF8A)
let amber = tinted ? rgb(0xE6E6E6) : rgb(0xF5BA6B)
let amberDeep = tinted ? rgb(0xB8B8B8) : rgb(0xE0913F)
let inkTop = tinted ? rgb(0x000000) : rgb(0x232326)
let inkBottom = tinted ? rgb(0x000000) : rgb(0x0B0B0C)

let space = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: Int(size), height: Int(size), bitsPerComponent: 16, bytesPerRow: 0,
                    space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue | CGBitmapInfo.byteOrder16Little.rawValue)
    ?? CGContext(data: nil, width: Int(size), height: Int(size), bitsPerComponent: 8, bytesPerRow: 0,
                 space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
ctx.setShouldAntialias(true)
ctx.interpolationQuality = .high

func linearGradient(_ colors: [CGColor], from: CGPoint, to: CGPoint, locations: [CGFloat]? = nil) {
    let gradient = CGGradient(colorsSpace: space, colors: colors as CFArray, locations: locations)!
    ctx.drawLinearGradient(gradient, start: from, end: to, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
}

/// Outline of `text` in New York (the system serif). Built at a mid point size so the
/// sturdier optical cut is used (no fragile hairlines), then scaled to `capHeight`.
func serifPath(_ text: String, weight: NSFont.Weight, capHeight: CGFloat) -> CGPath {
    let pointSize: CGFloat = 48
    let base = NSFont.systemFont(ofSize: pointSize, weight: weight)
    let font = NSFont(descriptor: base.fontDescriptor.withDesign(.serif)!, size: pointSize)! as CTFont
    let line = CTLineCreateWithAttributedString(
        NSAttributedString(string: text, attributes: [.font: font]))
    let path = CGMutablePath()
    for run in CTLineGetGlyphRuns(line) as! [CTRun] {
        let count = CTRunGetGlyphCount(run)
        var glyphs = [CGGlyph](repeating: 0, count: count)
        var positions = [CGPoint](repeating: .zero, count: count)
        CTRunGetGlyphs(run, CFRange(location: 0, length: count), &glyphs)
        CTRunGetPositions(run, CFRange(location: 0, length: count), &positions)
        for i in 0..<count {
            if let glyph = CTFontCreatePathForGlyph(font, glyphs[i], nil) {
                path.addPath(glyph, transform: CGAffineTransform(translationX: positions[i].x, y: positions[i].y))
            }
        }
    }
    var scale = CGAffineTransform(scaleX: capHeight / CTFontGetCapHeight(font), y: capHeight / CTFontGetCapHeight(font))
    return path.copy(using: &scale)!
}

/// Moves `path` so its bounding box is centered at `center`.
func centered(_ path: CGPath, at center: CGPoint) -> CGPath {
    let box = path.boundingBoxOfPath
    var move = CGAffineTransform(translationX: center.x - box.midX, y: center.y - box.midY)
    return path.copy(using: &move)!
}

func fill(_ path: CGPath, top: CGColor, bottom: CGColor) {
    ctx.saveGState()
    ctx.addPath(path)
    ctx.clip()
    let box = path.boundingBoxOfPath
    linearGradient([top, bottom], from: CGPoint(x: box.midX, y: box.maxY), to: CGPoint(x: box.midX, y: box.minY))
    ctx.restoreGState()
}

func darkBackground() {
    linearGradient([inkTop, inkBottom], from: CGPoint(x: 0, y: size), to: CGPoint(x: 0, y: 0))
}

/// Bookmark ribbon hanging from the top edge, with a V-notch at the bottom.
func ribbon(x: CGFloat, width: CGFloat, length: CGFloat) -> CGPath {
    let path = CGMutablePath()
    let top = size + 10, bottom = size - length, notch = width * 0.42
    path.move(to: CGPoint(x: x, y: top))
    path.addLine(to: CGPoint(x: x + width, y: top))
    path.addLine(to: CGPoint(x: x + width, y: bottom))
    path.addLine(to: CGPoint(x: x + width / 2, y: bottom + notch))
    path.addLine(to: CGPoint(x: x, y: bottom))
    path.closeSubpath()
    return path
}

let middle = CGPoint(x: size / 2, y: size / 2)
let weight = NSFont.Weight.bold

switch variant {
case "s":
    // A single heavy serif S, slightly above center (optical center).
    darkBackground()
    let s = centered(serifPath("S", weight: weight, capHeight: 540), at: CGPoint(x: middle.x, y: middle.y + 6))
    fill(s, top: amberLight, bottom: amberDeep)

case "ribbon":
    // Serif S with a dictionary bookmark ribbon.
    darkBackground()
    let s = centered(serifPath("S", weight: weight, capHeight: 500), at: CGPoint(x: middle.x - 40, y: middle.y - 28))
    fill(s, top: amberLight, bottom: amberDeep)
    let r = ribbon(x: 690, width: 96, length: 250)
    fill(r, top: amberDeep, bottom: amber)

case "amber":
    // Inverted: warm amber tile with a near-black S.
    linearGradient([amberLight, amberDeep], from: CGPoint(x: 0, y: size), to: CGPoint(x: size, y: 0))
    let s = centered(serifPath("S", weight: weight, capHeight: 540), at: CGPoint(x: middle.x, y: middle.y + 6))
    fill(s, top: rgb(0x1E1A16), bottom: rgb(0x0E0C0A))

case "page":
    // A tilted amber index card with the S cut into it.
    darkBackground()
    let card = CGPath(roundedRect: CGRect(x: 232, y: 182, width: 560, height: 660),
                      cornerWidth: 56, cornerHeight: 56, transform: nil)
    var rotate = CGAffineTransform(translationX: middle.x, y: middle.y).rotated(by: -0.07)
        .translatedBy(x: -middle.x, y: -middle.y)
    let tiltedCard = card.copy(using: &rotate)!
    fill(tiltedCard, top: amberLight, bottom: amberDeep)
    let s = centered(serifPath("S", weight: weight, capHeight: 430), at: CGPoint(x: middle.x, y: middle.y + 4))
    var s2 = rotate
    fill(s.copy(using: &s2)!, top: rgb(0x26211B), bottom: rgb(0x12100D))

default:
    fatalError("unknown variant \(variant)")
}

let png = NSBitmapImageRep(cgImage: ctx.makeImage()!).representation(using: .png, properties: [:])!
try! png.write(to: output)
