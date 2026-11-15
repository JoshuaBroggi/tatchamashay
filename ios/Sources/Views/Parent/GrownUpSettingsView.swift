import SwiftUI

/// Sound, motion and the child profiles on this phone, accessible only through parent controls.
struct GrownUpSettingsView: View {
    @Environment(PlaySettings.self) private var settings
    @Environment(FamilyModel.self) private var family
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion

    @State private var editing: ChildProfile?
    @State private var adding = false

    var body: some View {
        @Bindable var settings = settings
        List {
            Section {
                Toggle("Sounds", isOn: $settings.soundOn)
                    .accessibilityIdentifier("soundToggle")
                Toggle("Less motion", isOn: Binding(
                    get: { settings.reducesMotion(system: systemReduceMotion) },
                    set: { settings.reducedMotion = $0 }
                ))
                .accessibilityIdentifier("motionToggle")
                if !settings.followsSystemMotion {
                    Button("Follow the iPhone's Reduce Motion setting") { settings.followSystemMotion() }
                }
            } header: {
                Text("Sound and motion")
            } footer: {
                Text("Less motion keeps treasures still and makes the chest open gently.")
            }

            Section {
                ForEach(family.children) { child in
                    HStack {
                        Button {
                            family.choosePlayingChild(child.id)
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: child.avatar.symbol).foregroundStyle(Palette.gold).frame(width: 28)
                                Text(child.pirateName).foregroundStyle(Palette.textPrimary)
                                Spacer()
                                if family.child?.id == child.id {
                                    Text("Playing").font(Typeface.label()).foregroundStyle(Palette.gold)
                                }
                            }
                        }
                        Button("Edit") { editing = child }
                            .buttonStyle(.borderless)
                    }
                    .accessibilityIdentifier("pirate-\(child.pirateName)")
                }
                Button { adding = true } label: { Label("Add a pirate", systemImage: "plus.circle.fill") }
                    .accessibilityIdentifier("addPirate")
            } header: {
                Text("Pirates")
            } footer: {
                Text("Tap a pirate to choose who's playing. Each pirate has their own chest. Pirates have no account and no public name.")
            }
        }
        .scrollContentBackground(.hidden)
        .background(Palette.ground1.ignoresSafeArea())
        .navigationTitle("Settings")
        .sheet(item: $editing) { child in
            PirateEditor(child: child, canRemove: family.children.count > 1)
        }
        .sheet(isPresented: $adding) { PirateEditor(child: nil, canRemove: false) }
    }
}

/// Adds or edits one pirate profile. Removing one also empties that pirate's chest, so it asks first.
private struct PirateEditor: View {
    let child: ChildProfile?
    let canRemove: Bool

    @Environment(\.dismiss) private var dismiss
    @Environment(FamilyModel.self) private var family
    @State private var name = ""
    @State private var avatar = PirateAvatar.parrot
    @State private var confirmingRemove = false
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Pirate name") {
                    TextField("Captain Emmanuel", text: $name)
                        .accessibilityIdentifier("pirateNameField")
                }
                Section("Picture") {
                    Picker("Picture", selection: $avatar) {
                        ForEach(PirateAvatar.allCases) { Image(systemName: $0.symbol).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
                if let child, canRemove {
                    Section {
                        Button("Remove \(child.pirateName)", role: .destructive) { confirmingRemove = true }
                    }
                }
                if let message = family.errorMessage {
                    Section { Text(message).foregroundStyle(Palette.gold) }
                }
            }
            .navigationTitle(child == nil ? "New pirate" : "Edit pirate")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(name.trimmed.isEmpty || saving)
                        .accessibilityIdentifier("savePirate")
                }
            }
            .onAppear {
                name = child?.pirateName ?? ""
                avatar = child?.avatar ?? .parrot
            }
            .confirmationDialog("Remove this pirate?", isPresented: $confirmingRemove, titleVisibility: .visible) {
                Button("Remove pirate and their chest", role: .destructive) {
                    guard let child else { return }
                    Task {
                        await family.removeChild(child)
                        if family.errorMessage == nil { dismiss() }
                    }
                }
            } message: {
                Text("Their chest of treasures is removed from this phone too. This can't be undone.")
            }
        }
    }

    private func save() {
        guard !saving else { return }
        saving = true
        Task {
            if var child {
                child.pirateName = name.trimmed
                child.avatar = avatar
                await family.saveChild(child)
            } else {
                await family.addChild(pirateName: name.trimmed, avatar: avatar)
            }
            saving = false
            if family.errorMessage == nil { dismiss() }
        }
    }
}
