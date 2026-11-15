import SwiftUI
import UIKit

/// A parent-owned paint draft. The shared look is saved only with the final reviewed placement.
struct TreasurePaintView: View {
    @Binding var look: TreasureLook
    var onDone: () -> Void
    @State private var step = 0
    @State private var selectedColor = 0

    private let steps = ["Colors", "Place", "Texture"]
    private var paint: TreasurePaint { look.paint ?? TreasurePaint(color: look.color) }
    private var activeColor: Int { min(selectedColor, paint.colors.count - 1) }
    private var regions: [TreasureCatalog.PaintRegion] { TreasureCatalog.bundled.paintRegions(for: look.model) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Button(action: onDone) {
                    Label("Back to beast details", systemImage: "chevron.left")
                        .font(.subheadline).foregroundStyle(Palette.textSecondary)
                        .frame(minHeight: 44)
                }
                .accessibilityIdentifier("paintDone")
                HStack(spacing: 8) {
                    ForEach(steps.indices, id: \.self) { index in
                        Button { step = index } label: {
                            VStack(spacing: 5) {
                                Text("\(index + 1). \(steps[index])").font(.subheadline.weight(.semibold))
                                Capsule().fill(step == index ? Palette.gold : Palette.borderQuiet).frame(height: 3)
                            }
                            .foregroundStyle(step == index ? Palette.gold : Palette.textSecondary)
                            .frame(maxWidth: .infinity, minHeight: 44)
                        }
                        .accessibilityIdentifier("paintStep\(index)")
                        .accessibilityAddTraits(step == index ? .isSelected : [])
                    }
                }
                if step == 0 { colorChoices }
                if step == 1 { placementChoices }
                if step == 2 { textureChoices }

                Button(step == 2 ? "Done painting" : "Next: \(steps[min(step + 1, 2)])") {
                    if step == 2 { onDone() } else { step += 1 }
                }
                .buttonStyle(GoldButtonStyle())
                .accessibilityIdentifier("paintNext")
                Button("Reset to original look") {
                    look.paint = nil
                    look.color = look.model.defaultColor
                    selectedColor = 0
                    step = 0
                }
                .font(.subheadline).frame(maxWidth: .infinity, minHeight: 44)
                .foregroundStyle(Palette.textSecondary)
                .accessibilityIdentifier("paintReset")
            }
            .padding(20)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(Palette.ground1)
        .onChange(of: paint.colors.count) { selectedColor = min(selectedColor, paint.colors.count - 1) }
    }

    private var colorChoices: some View {
        VStack(alignment: .leading, spacing: 18) {
            heading("Make a little palette", detail: "Choose how many colors, then fill each paint pot.")
            Picker("How many colors?", selection: Binding(get: { paint.colors.count }, set: { count in
                change { $0.setColorCount(count) }
            })) {
                ForEach(1...3, id: \.self) { Text("\($0) \($0 == 1 ? "color" : "colors")").tag($0) }
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("paintColorCount")
            paintPots
            Text("Nature-inspired palettes").font(.subheadline.weight(.semibold))
            LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 8) {
                paletteButton("Woodland", colors: [.chestnut, .sand, .charcoal])
                paletteButton("Ember", colors: [.charcoal, .terracotta, .copper])
                paletteButton("Cobalt", colors: [.navy, .cobalt, .sky])
                paletteButton("Garden", colors: [.pine, .sage, .cream])
            }
            ForEach(TreasureColor.paletteRows, id: \.name) { row in
                VStack(alignment: .leading, spacing: 8) {
                    Text(row.name).font(.caption).foregroundStyle(Palette.textSecondary)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 44), spacing: 8)], spacing: 8) {
                        ForEach(row.colors) { color in
                            Button { change { $0.setColor(PaintColor(color), at: activeColor) } } label: {
                                Circle().fill(Color(color)).frame(width: 32, height: 32)
                                    .overlay {
                                        if paint.colors[activeColor] == PaintColor(color) {
                                            Circle().stroke(.white, lineWidth: 3).padding(-3)
                                            Image(systemName: "checkmark").font(.caption.bold())
                                                .foregroundStyle(color.rgb.red + color.rgb.green + color.rgb.blue > 1.6 ? .black : .white)
                                        }
                                    }
                                    .frame(minWidth: 44, minHeight: 44)
                            }
                            .accessibilityLabel(color.displayName)
                            .accessibilityIdentifier("paintSwatch-\(color.rawValue)")
                            .accessibilityAddTraits(paint.colors[activeColor] == PaintColor(color) ? .isSelected : [])
                        }
                    }
                }
            }
            ColorPicker("Mix your own color", selection: Binding(
                get: { Color(paint.colors[activeColor]) },
                set: { color in
                    var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
                    guard UIColor(color).getRed(&r, green: &g, blue: &b, alpha: &a) else { return }
                    change { $0.setColor(PaintColor(red: Double(r), green: Double(g), blue: Double(b)), at: activeColor) }
                }), supportsOpacity: false)
                .accessibilityIdentifier("paintCustomColor")
        }
    }

    private var paintPots: some View {
        HStack(spacing: 12) {
            ForEach(Array(paint.colors.enumerated()), id: \.offset) { index, color in
                Button { selectedColor = index } label: {
                    VStack(spacing: 6) {
                        Circle().fill(Color(color)).frame(width: 44, height: 44)
                            .overlay(Circle().stroke(activeColor == index ? Palette.gold : Palette.borderQuiet, lineWidth: 3).padding(-4))
                            .overlay(Text("\(index + 1)").font(.callout.bold()).foregroundStyle(.white).shadow(color: .black, radius: 2))
                        Text(color.name).font(.caption2).lineLimit(1)
                    }
                    .foregroundStyle(Palette.textPrimary).frame(maxWidth: .infinity, minHeight: 76)
                }
                .draggable("treasure-paint:\(index)")
                .accessibilityLabel("Color \(index + 1), \(color.name)")
                .accessibilityAddTraits(activeColor == index ? .isSelected : [])
                .accessibilityIdentifier("paintPot\(index)")
            }
        }
        .padding(8)
    }

    private var placementChoices: some View {
        VStack(alignment: .leading, spacing: 18) {
            heading("Put your colors here", detail: "Drag a paint pot onto a named area. Or tap a pot, then tap an area.")
            paintPots
            ForEach(Array(regions.enumerated()), id: \.element.id) { index, region in
                Button { change { $0.assign(activeColor, to: region.id) } } label: {
                    HStack(spacing: 14) {
                        Text("\(index + 1)").font(.headline).foregroundStyle(Palette.gold)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(region.name).font(.headline)
                            Text("Color \(paint.colorIndex(for: region.id) + 1) · \(paint.color(for: region.id).name)")
                                .font(.caption).foregroundStyle(Palette.textSecondary)
                        }
                        Spacer()
                        Circle().fill(Color(paint.color(for: region.id))).frame(width: 36, height: 36)
                            .overlay(Circle().stroke(Palette.borderStrong))
                    }
                    .padding(16).foregroundStyle(Palette.textPrimary)
                    .background(Palette.ground2, in: RoundedRectangle(cornerRadius: 14))
                }
                .accessibilityLabel("Paint \(region.name)")
                .accessibilityValue("Color \(paint.colorIndex(for: region.id) + 1), \(paint.color(for: region.id).name)")
                .accessibilityHint("Applies the selected paint pot")
                .accessibilityIdentifier("paintRegion-\(region.id)")
                .dropDestination(for: String.self) { values, _ in
                    guard let token = values.first, token.hasPrefix("treasure-paint:"),
                          let index = Int(token.dropFirst("treasure-paint:".count)), paint.colors.indices.contains(index) else { return false }
                    change { $0.assign(index, to: region.id) }
                    selectedColor = index
                    return true
                }
            }
            Text("The preview shows exactly which part changes. You can use the same color in several places.")
                .font(.caption).foregroundStyle(Palette.textSecondary)
        }
    }

    private var textureChoices: some View {
        VStack(alignment: .leading, spacing: 18) {
            heading("Give it some character", detail: "A texture covers the areas you painted. Your colors stay in their places.")
            ForEach(TreasureTexture.allCases) { texture in
                Button { change { $0.texture = texture } } label: {
                    HStack(spacing: 14) {
                        Image(uiImage: PaintSurface.preview(texture)).resizable()
                            .colorMultiply(Color(paint.colors[0]))
                            .frame(width: 52, height: 52).clipShape(RoundedRectangle(cornerRadius: 12))
                        VStack(alignment: .leading, spacing: 4) {
                            Label(texture.name, systemImage: texture.symbol).font(.headline)
                            Text(texture.detail).font(.caption).foregroundStyle(Palette.textSecondary)
                        }
                        Spacer()
                        if paint.texture == texture { Image(systemName: "checkmark.circle.fill").foregroundStyle(Palette.gold) }
                    }
                    .padding(12).foregroundStyle(Palette.textPrimary)
                    .background(Palette.ground2, in: RoundedRectangle(cornerRadius: 14))
                }
                .accessibilityIdentifier("paintTexture-\(texture.rawValue)")
                .accessibilityAddTraits(paint.texture == texture ? .isSelected : [])
            }
        }
    }

    private func heading(_ title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.title2.bold()).foregroundStyle(Palette.textPrimary)
            Text(detail).font(.subheadline).foregroundStyle(Palette.textSecondary)
        }
    }

    private func paletteButton(_ name: String, colors: [TreasureColor]) -> some View {
        Button {
            change { draft in
                for index in draft.colors.indices { draft.setColor(PaintColor(colors[index]), at: index) }
            }
        } label: {
            HStack {
                Text(name).font(.caption.weight(.semibold))
                Spacer(minLength: 4)
                ForEach(Array(colors.prefix(paint.colors.count).enumerated()), id: \.offset) { _, color in
                    Circle().fill(Color(color)).frame(width: 15, height: 15)
                }
            }
            .padding(12).frame(minHeight: 44).foregroundStyle(Palette.textPrimary)
            .background(Palette.ground2, in: RoundedRectangle(cornerRadius: 10))
        }
        .accessibilityIdentifier("paintPalette-\(name)")
    }

    private func change(_ edit: (inout TreasurePaint) -> Void) {
        var draft = paint
        edit(&draft)
        look.paint = draft
    }
}
